// External imports with versions
import * as nodemailer from 'nodemailer'; // ^6.9.0
import { z } from 'zod'; // ^3.0.0

// Internal imports
import { validateEmail } from '../../../shared/utils/src/validation.util';
import { Logger } from '../../../shared/utils/src/logger.util';

// Initialize logger
const logger = new Logger('EmailConfig');

// Zod schemas for configuration validation
const SMTPConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean(),
  auth: z.object({
    user: z.string().min(1),
    pass: z.string().min(1)
  }),
  pool: z.object({
    maxConnections: z.number().int().positive(),
    maxMessages: z.number().int().positive(),
    rateDelta: z.number().int().positive(),
    rateLimit: z.number().int().positive()
  }),
  retry: z.object({
    attempts: z.number().int().positive(),
    delay: z.number().int().positive()
  })
});

const EmailDefaultsSchema = z.object({
  from: z.string().email(),
  replyTo: z.string().email().optional(),
  charset: z.string().default('UTF-8'),
  encoding: z.string().default('quoted-printable'),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  tracking: z.object({
    enabled: z.boolean(),
    provider: z.string().optional()
  })
});

const RateLimitsSchema = z.object({
  maxPerSecond: z.number().int().positive(),
  maxPerMinute: z.number().int().positive(),
  maxPerHour: z.number().int().positive(),
  burstSize: z.number().int().positive(),
  queueSize: z.number().int().positive()
});

// Configuration constants
export const SMTP_CONFIG = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Boolean(process.env.SMTP_SECURE),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  pool: {
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS) || 5,
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES) || 100,
    rateDelta: Number(process.env.SMTP_RATE_DELTA) || 1000,
    rateLimit: Number(process.env.SMTP_RATE_LIMIT) || 5
  },
  retry: {
    attempts: Number(process.env.SMTP_RETRY_ATTEMPTS) || 3,
    delay: Number(process.env.SMTP_RETRY_DELAY) || 1000
  }
};

export const EMAIL_DEFAULTS = {
  from: process.env.EMAIL_FROM,
  replyTo: process.env.EMAIL_REPLY_TO,
  charset: 'UTF-8',
  encoding: 'quoted-printable',
  priority: 'normal',
  tracking: {
    enabled: Boolean(process.env.EMAIL_TRACKING_ENABLED),
    provider: process.env.EMAIL_TRACKING_PROVIDER
  }
};

export const RATE_LIMITS = {
  maxPerSecond: Number(process.env.EMAIL_RATE_PER_SECOND) || 10,
  maxPerMinute: Number(process.env.EMAIL_RATE_PER_MINUTE) || 100,
  maxPerHour: Number(process.env.EMAIL_RATE_PER_HOUR) || 1000,
  burstSize: Number(process.env.EMAIL_BURST_SIZE) || 20,
  queueSize: Number(process.env.EMAIL_QUEUE_SIZE) || 1000
};

/**
 * Creates and configures SMTP transport with connection pooling and retry logic
 */
export async function createTransport(config: typeof SMTP_CONFIG): Promise<nodemailer.Transporter> {
  try {
    // Validate configuration
    const validatedConfig = SMTPConfigSchema.parse(config);

    logger.info('Creating SMTP transport', { host: validatedConfig.host });

    const transport = nodemailer.createTransport({
      ...validatedConfig,
      pool: true,
      maxConnections: validatedConfig.pool.maxConnections,
      rateDelta: validatedConfig.pool.rateDelta,
      rateLimit: validatedConfig.pool.rateLimit,
      maxMessages: validatedConfig.pool.maxMessages
    });

    // Verify connection
    await verifyConnection(transport);

    return transport;
  } catch (error) {
    logger.error('Failed to create SMTP transport', error, { host: config.host });
    throw error;
  }
}

/**
 * Verifies SMTP connection with retry logic
 */
export async function verifyConnection(transport: nodemailer.Transporter): Promise<boolean> {
  const maxRetries = SMTP_CONFIG.retry.attempts;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await transport.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      attempts++;
      logger.error(`SMTP verification attempt ${attempts} failed`, error);
      
      if (attempts === maxRetries) {
        throw new Error('Failed to verify SMTP connection after maximum retries');
      }

      await new Promise(resolve => setTimeout(resolve, SMTP_CONFIG.retry.delay));
    }
  }

  return false;
}

/**
 * Enhanced email configuration class with comprehensive email management capabilities
 */
@injectable()
export class EmailConfig {
  private transport: nodemailer.Transporter;
  private readonly smtpConfig: typeof SMTP_CONFIG;
  private readonly defaults: typeof EMAIL_DEFAULTS;
  private readonly rateLimits: typeof RATE_LIMITS;
  private connectionPool: Map<string, number>;
  private lastConnectionCheck: Date;

  constructor(
    smtpConfig: typeof SMTP_CONFIG,
    defaults: typeof EMAIL_DEFAULTS,
    rateLimits: typeof RATE_LIMITS
  ) {
    // Validate configurations
    this.smtpConfig = SMTPConfigSchema.parse(smtpConfig);
    this.defaults = EmailDefaultsSchema.parse(defaults);
    this.rateLimits = RateLimitsSchema.parse(rateLimits);

    this.connectionPool = new Map();
    this.lastConnectionCheck = new Date();

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.transport = await createTransport(this.smtpConfig);
      logger.info('Email configuration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email configuration', error);
      throw error;
    }
  }

  public async getTransport(): Promise<nodemailer.Transporter> {
    // Verify connection health periodically
    const now = new Date();
    if (now.getTime() - this.lastConnectionCheck.getTime() > 300000) { // 5 minutes
      await this.verifyTransportHealth();
      this.lastConnectionCheck = now;
    }
    return this.transport;
  }

  public getDefaults(): typeof EMAIL_DEFAULTS {
    return this.defaults;
  }

  private async verifyTransportHealth(): Promise<void> {
    try {
      await verifyConnection(this.transport);
    } catch (error) {
      logger.error('Transport health check failed', error);
      await this.initialize();
    }
  }
}