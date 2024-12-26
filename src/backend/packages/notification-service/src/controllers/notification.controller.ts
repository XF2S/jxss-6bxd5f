// External imports with versions
import { ServerUnaryCall, sendUnaryData } from '@grpc/grpc-js'; // ^1.9.0
import { injectable, inject } from 'inversify'; // ^6.0.1
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.4.1
import { MetricsCollector } from '@opentelemetry/metrics'; // ^1.0.0

// Internal imports
import { EmailService } from '../services/email.service';
import { SMSService } from '../services/sms.service';
import { Logger } from '../../../shared/utils/src/logger.util';
import { validateEmail } from '../../../shared/utils/src/validation.util';

// Types
interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

interface NotificationMetrics {
  sendDuration: any;
  sendErrors: any;
  rateLimitHits: any;
  batchSize: any;
}

@injectable()
export class NotificationController {
  private readonly retryPolicies: Map<string, RetryPolicy>;
  private readonly metrics: NotificationMetrics;

  constructor(
    @inject('EmailService') private readonly emailService: EmailService,
    @inject('SMSService') private readonly smsService: SMSService,
    @inject('Logger') private readonly logger: Logger,
    @inject('MetricsCollector') metricsCollector: MetricsCollector,
    @inject('RateLimiter') private readonly rateLimiter: RateLimiter
  ) {
    // Initialize retry policies
    this.retryPolicies = new Map([
      ['email', { maxAttempts: 3, backoffMs: 1000, maxBackoffMs: 10000 }],
      ['sms', { maxAttempts: 2, backoffMs: 2000, maxBackoffMs: 6000 }]
    ]);

    // Initialize metrics
    this.metrics = {
      sendDuration: metricsCollector.createHistogram('notification_send_duration', {
        description: 'Duration of notification sending operations'
      }),
      sendErrors: metricsCollector.createCounter('notification_send_errors', {
        description: 'Number of notification sending errors'
      }),
      rateLimitHits: metricsCollector.createCounter('notification_rate_limit_hits', {
        description: 'Number of rate limit hits'
      }),
      batchSize: metricsCollector.createHistogram('notification_batch_size', {
        description: 'Size of notification batches'
      })
    };
  }

  /**
   * Handles single email notification requests
   */
  public async sendEmail(
    call: ServerUnaryCall<any, any>,
    callback: sendUnaryData<any>
  ): Promise<void> {
    const startTime = process.hrtime();
    const correlationId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { to, templateId, data, options } = call.request;

      // Validate email
      if (!await validateEmail(to)) {
        throw new Error('Invalid email address');
      }

      // Check rate limit
      try {
        await this.rateLimiter.consume(to);
      } catch (error) {
        this.metrics.rateLimitHits.inc();
        callback({
          code: 429,
          message: 'Rate limit exceeded',
          correlationId
        });
        return;
      }

      // Send email with retry policy
      const result = await this.withRetry(
        async () => await this.emailService.sendEmail(to, templateId, data, options),
        this.retryPolicies.get('email')!
      );

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metrics.sendDuration.record(seconds + nanoseconds / 1e9, {
        type: 'email',
        template: templateId
      });

      // Log success
      this.logger.info('Email sent successfully', {
        correlationId,
        to,
        templateId,
        messageId: result.messageId
      });

      callback(null, {
        success: true,
        messageId: result.messageId,
        correlationId
      });

    } catch (error) {
      // Record error metrics
      this.metrics.sendErrors.inc({
        type: 'email',
        error: error.name
      });

      // Log error
      this.logger.error('Failed to send email', error as Error, {
        correlationId,
        request: call.request
      });

      callback({
        code: 500,
        message: 'Failed to send email',
        details: error.message,
        correlationId
      });
    }
  }

  /**
   * Handles bulk email notification requests
   */
  public async sendBulkEmails(
    call: ServerUnaryCall<any, any>,
    callback: sendUnaryData<any>
  ): Promise<void> {
    const startTime = process.hrtime();
    const batchId = `batch-${Date.now()}`;

    try {
      const { recipients, templateId, data, options } = call.request;

      // Record batch size metric
      this.metrics.batchSize.record(recipients.length, {
        type: 'email'
      });

      // Validate all recipients
      const validRecipients = await Promise.all(
        recipients.map(async (email: string) => ({
          email,
          isValid: await validateEmail(email)
        }))
      );

      const invalidEmails = validRecipients
        .filter(r => !r.isValid)
        .map(r => r.email);

      if (invalidEmails.length > 0) {
        throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }

      // Send bulk emails
      const result = await this.emailService.sendBulkEmails(
        recipients,
        templateId,
        data,
        {
          ...options,
          batchId
        }
      );

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metrics.sendDuration.record(seconds + nanoseconds / 1e9, {
        type: 'bulk_email',
        template: templateId
      });

      // Log success
      this.logger.info('Bulk emails sent', {
        batchId,
        totalSent: result.totalSent,
        failed: result.failed.length
      });

      callback(null, {
        success: true,
        batchId,
        totalSent: result.totalSent,
        failed: result.failed
      });

    } catch (error) {
      // Record error metrics
      this.metrics.sendErrors.inc({
        type: 'bulk_email',
        error: error.name
      });

      // Log error
      this.logger.error('Failed to send bulk emails', error as Error, {
        batchId,
        request: call.request
      });

      callback({
        code: 500,
        message: 'Failed to send bulk emails',
        details: error.message,
        batchId
      });
    }
  }

  /**
   * Handles SMS notification requests
   */
  public async sendSMS(
    call: ServerUnaryCall<any, any>,
    callback: sendUnaryData<any>
  ): Promise<void> {
    const startTime = process.hrtime();
    const correlationId = `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const result = await this.withRetry(
        async () => await this.smsService.sendSMS(call.request),
        this.retryPolicies.get('sms')!
      );

      // Record metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.metrics.sendDuration.record(seconds + nanoseconds / 1e9, {
        type: 'sms'
      });

      callback(null, {
        success: true,
        messageSid: result.messageSid,
        correlationId
      });

    } catch (error) {
      this.metrics.sendErrors.inc({
        type: 'sms',
        error: error.name
      });

      this.logger.error('Failed to send SMS', error as Error, {
        correlationId,
        request: call.request
      });

      callback({
        code: 500,
        message: 'Failed to send SMS',
        details: error.message,
        correlationId
      });
    }
  }

  /**
   * Checks delivery status of a notification
   */
  public async checkDeliveryStatus(
    call: ServerUnaryCall<any, any>,
    callback: sendUnaryData<any>
  ): Promise<void> {
    try {
      const { type, messageId } = call.request;

      let status;
      if (type === 'sms') {
        status = await this.smsService.checkDeliveryStatus(messageId);
      } else {
        throw new Error('Unsupported notification type');
      }

      callback(null, {
        success: true,
        status
      });

    } catch (error) {
      this.logger.error('Failed to check delivery status', error as Error, {
        request: call.request
      });

      callback({
        code: 500,
        message: 'Failed to check delivery status',
        details: error.message
      });
    }
  }

  /**
   * Helper method to implement retry logic
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt < policy.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt === policy.maxAttempts) {
          break;
        }

        const backoff = Math.min(
          policy.backoffMs * Math.pow(2, attempt - 1),
          policy.maxBackoffMs
        );
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }

    throw lastError!;
  }
}