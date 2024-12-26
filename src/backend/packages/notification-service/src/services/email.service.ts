// External imports with versions
import nodemailer from 'nodemailer'; // ^6.9.0
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.4.0
import { z } from 'zod'; // ^3.0.0
import winston from 'winston'; // ^3.8.0
import { Counter, Histogram } from 'prom-client'; // ^14.0.0
import { injectable, inject } from 'inversify'; // ^6.0.0

// Internal imports
import { EmailConfig, createTransport } from '../config/email.config';
import { 
  EmailTemplate, 
  TEMPLATE_IDS, 
  compileTemplate 
} from '../templates/email.templates';
import { validateEmail, validateBulkEmails } from '../../../shared/utils/src/validation.util';

// Type definitions
interface EmailOptions {
  priority?: 'high' | 'normal' | 'low';
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  trackingId?: string;
}

interface BulkEmailOptions extends EmailOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: Error;
  timestamp: Date;
  trackingId?: string;
}

interface BulkSendResult {
  success: boolean;
  totalSent: number;
  failed: Array<{ email: string; error: Error }>;
  timestamp: Date;
  batchDetails: Array<{
    batchId: string;
    size: number;
    success: boolean;
  }>;
}

// Constants
const EMAIL_QUEUE_OPTIONS = {
  retries: 3,
  backoff: 'exponential',
  removeOnComplete: true,
  attempts: 5,
  backoffDelay: 1000,
  timeout: 30000
};

// Metrics configuration
const EMAIL_METRICS = {
  sendDuration: new Histogram({
    name: 'email_send_duration_seconds',
    help: 'Duration of email sending operation',
    labelNames: ['template', 'priority']
  }),
  sendErrors: new Counter({
    name: 'email_send_errors_total',
    help: 'Total number of email sending errors',
    labelNames: ['template', 'error_type']
  }),
  rateLimitHits: new Counter({
    name: 'email_rate_limit_hits_total',
    help: 'Total number of rate limit hits'
  }),
  templateCompilations: new Counter({
    name: 'email_template_compilations_total',
    help: 'Total number of template compilations',
    labelNames: ['template']
  })
};

// Email validation schema
const emailSchema = z.object({
  to: z.string().email(),
  templateId: z.string(),
  data: z.record(z.any()),
  options: z.object({
    priority: z.enum(['high', 'normal', 'low']).optional(),
    attachments: z.array(z.object({
      filename: z.string(),
      content: z.instanceof(Buffer),
      contentType: z.string()
    })).optional(),
    cc: z.array(z.string().email()).optional(),
    bcc: z.array(z.string().email()).optional(),
    replyTo: z.string().email().optional(),
    trackingId: z.string().optional()
  }).optional()
});

/**
 * Enhanced email service with comprehensive security, monitoring, and internationalization support
 */
@injectable()
export class EmailService {
  private readonly transport: nodemailer.Transporter;
  private readonly rateLimiter: RateLimiter;
  private readonly config: EmailConfig;
  private readonly logger: winston.Logger;
  private readonly metrics: typeof EMAIL_METRICS;
  private readonly templateCache: Map<string, EmailTemplate>;
  private readonly connectionPool: Map<string, number>;

  constructor(
    @inject('EmailConfig') config: EmailConfig,
    @inject('Logger') logger: winston.Logger,
    @inject('Metrics') metrics: typeof EMAIL_METRICS
  ) {
    this.config = config;
    this.logger = logger;
    this.metrics = metrics;
    this.templateCache = new Map();
    this.connectionPool = new Map();

    // Initialize transport with connection pooling
    this.transport = createTransport(this.config.getTransport());

    // Configure rate limiter with Redis backend
    this.rateLimiter = new RateLimiter({
      points: 100, // Number of emails
      duration: 60, // Per minute
      blockDuration: 60, // Block for 1 minute if exceeded
      storeClient: this.config.getRedisClient()
    });

    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      await this.transport.verify();
      this.logger.info('Email service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email service', error as Error);
      throw error;
    }
  }

  /**
   * Sends a single email with enhanced security and monitoring
   */
  public async sendEmail(
    to: string,
    templateId: string,
    data: Record<string, any>,
    options: EmailOptions = {}
  ): Promise<SendResult> {
    const startTime = process.hrtime();

    try {
      // Validate input
      const validationResult = emailSchema.safeParse({ to, templateId, data, options });
      if (!validationResult.success) {
        throw new Error(`Validation failed: ${validationResult.error.message}`);
      }

      // Check rate limit
      await this.rateLimiter.consume(to);

      // Get email defaults and merge with options
      const emailDefaults = this.config.getDefaults();
      const mergedOptions = { ...emailDefaults, ...options };

      // Compile template
      const compiledHtml = await compileTemplate(templateId, data);
      this.metrics.templateCompilations.inc({ template: templateId });

      // Send email
      const result = await this.transport.sendMail({
        from: emailDefaults.from,
        to,
        html: compiledHtml,
        ...mergedOptions,
        headers: {
          'X-Priority': options.priority || 'normal',
          'X-Tracking-ID': options.trackingId || '',
          'X-Mailer': 'Enrollment-System'
        }
      });

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metrics.sendDuration.observe(
        { template: templateId, priority: options.priority || 'normal' },
        seconds + nanoseconds / 1e9
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date(),
        trackingId: options.trackingId
      };

    } catch (error) {
      this.handleEmailError(error as Error, templateId, to);
      throw error;
    }
  }

  /**
   * Sends emails to multiple recipients with batching and monitoring
   */
  public async sendBulkEmails(
    recipients: string[],
    templateId: string,
    data: Record<string, any>,
    options: BulkEmailOptions = {}
  ): Promise<BulkSendResult> {
    const startTime = new Date();
    const results: BulkSendResult = {
      success: true,
      totalSent: 0,
      failed: [],
      timestamp: startTime,
      batchDetails: []
    };

    try {
      // Validate all recipients
      const validEmails = await validateBulkEmails(recipients);
      if (validEmails.length === 0) {
        throw new Error('No valid email addresses provided');
      }

      // Configure batching
      const batchSize = options.batchSize || 50;
      const delayBetweenBatches = options.delayBetweenBatches || 1000;

      // Process in batches
      for (let i = 0; i < validEmails.length; i += batchSize) {
        const batch = validEmails.slice(i, i + batchSize);
        const batchId = `batch-${i/batchSize}`;

        try {
          // Send batch
          const batchPromises = batch.map(email =>
            this.sendEmail(email, templateId, data, {
              ...options,
              trackingId: `${options.trackingId}-${batchId}`
            })
          );

          const batchResults = await Promise.allSettled(batchPromises);

          // Process batch results
          const batchSuccess = batchResults.every(result => result.status === 'fulfilled');
          results.batchDetails.push({
            batchId,
            size: batch.length,
            success: batchSuccess
          });

          // Update counters
          results.totalSent += batchResults.filter(r => r.status === 'fulfilled').length;
          batchResults
            .filter(r => r.status === 'rejected')
            .forEach((r, index) => {
              results.failed.push({
                email: batch[index],
                error: (r as PromiseRejectedResult).reason
              });
            });

          // Delay between batches
          if (i + batchSize < validEmails.length) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          }

        } catch (error) {
          this.logger.error('Batch processing failed', error as Error, { batchId });
          results.success = false;
        }
      }

      return results;

    } catch (error) {
      this.handleEmailError(error as Error, templateId, 'bulk');
      throw error;
    }
  }

  private handleEmailError(error: Error, templateId: string, recipient: string): void {
    this.logger.error('Email sending failed', error, {
      templateId,
      recipient,
      timestamp: new Date()
    });

    this.metrics.sendErrors.inc({
      template: templateId,
      error_type: error.name
    });

    if (error.message.includes('rate limit')) {
      this.metrics.rateLimitHits.inc();
    }
  }
}