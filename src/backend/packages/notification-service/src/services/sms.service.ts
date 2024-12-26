// External dependencies
import { Twilio, MessageInstance } from 'twilio'; // v4.19.0
import { SMSRequest, SMSResponse } from '@grpc/grpc-js'; // v1.9.0
import Redis from 'ioredis'; // v5.3.0
import { RateLimiter } from 'rate-limiter-flexible'; // v2.4.1
import { CircuitBreaker } from 'opossum'; // v6.0.0
import { injectable } from 'inversify';

// Internal dependencies
import { Logger } from '../../../shared/utils/src/logger.util';

// Types
interface DeliveryStatus {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp: string;
  attempts: number;
}

interface MessageTemplate {
  id: string;
  content: string;
  maxLength: number;
  allowedVariables: string[];
}

@injectable()
export class SMSService {
  private readonly twilioClient: Twilio;
  private readonly logger: Logger;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly redis: Redis;
  private readonly messageQueue: any; // Type would be defined by message queue implementation

  constructor(
    logger: Logger,
    rateLimiter: RateLimiter,
    circuitBreaker: CircuitBreaker,
    redis: Redis,
    messageQueue: any
  ) {
    this.logger = logger;
    this.rateLimiter = rateLimiter;
    this.circuitBreaker = circuitBreaker;
    this.redis = redis;
    this.messageQueue = messageQueue;

    // Initialize Twilio client
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    // Configure circuit breaker
    this.configureCircuitBreaker();
  }

  private configureCircuitBreaker(): void {
    const breaker = new CircuitBreaker(async (message: any) => {
      return await this.twilioClient.messages.create(message);
    }, {
      timeout: 5000, // 5 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000 // 30 seconds
    });

    breaker.on('open', () => {
      this.logger.error('Circuit breaker opened', new Error('SMS service circuit breaker opened'), {
        service: 'SMSService',
        event: 'circuit_breaker_open'
      });
    });

    this.circuitBreaker = breaker;
  }

  private async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      const lookupResult = await this.twilioClient.lookups.v2
        .phoneNumbers(phoneNumber)
        .fetch();
      return lookupResult.valid || false;
    } catch (error) {
      this.logger.error('Phone number validation failed', error as Error, {
        phoneNumber,
        service: 'SMSService'
      });
      return false;
    }
  }

  private async cacheDeliveryStatus(
    messageSid: string,
    status: DeliveryStatus
  ): Promise<void> {
    const cacheKey = `sms:status:${messageSid}`;
    await this.redis.setex(
      cacheKey,
      parseInt(process.env.SMS_CACHE_TTL || '3600'),
      JSON.stringify(status)
    );
  }

  public async sendSMS(request: SMSRequest): Promise<SMSResponse> {
    const correlationId = `sms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Check rate limits
      await this.rateLimiter.consume(request.to);

      // Validate phone number
      const isValid = await this.validatePhoneNumber(request.to);
      if (!isValid) {
        throw new Error('Invalid phone number');
      }

      // Process template if templateId is provided
      let messageContent = request.templateId
        ? await this.processTemplate(request.templateId, request.variables || {})
        : request.message;

      const messageParams = {
        to: request.to,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: messageContent,
        statusCallback: `${process.env.SERVICE_URL}/sms/status-callback`
      };

      // Send message through circuit breaker
      const message: MessageInstance = await this.circuitBreaker.fire(messageParams);

      // Cache initial delivery status
      const initialStatus: DeliveryStatus = {
        status: message.status,
        timestamp: new Date().toISOString(),
        attempts: 1
      };
      await this.cacheDeliveryStatus(message.sid, initialStatus);

      // Log successful send
      this.logger.info('SMS sent successfully', {
        messageSid: message.sid,
        to: request.to,
        status: message.status,
        correlationId
      });

      return {
        success: true,
        messageSid: message.sid,
        status: message.status,
        correlationId
      };

    } catch (error) {
      this.logger.error('Failed to send SMS', error as Error, {
        to: request.to,
        correlationId,
        templateId: request.templateId
      });

      // Queue for retry if appropriate
      if (this.shouldRetry(error as Error)) {
        await this.messageQueue.add('sms-retry', {
          request,
          attempts: 1,
          correlationId
        });
      }

      throw error;
    }
  }

  public async checkDeliveryStatus(messageSid: string): Promise<DeliveryStatus> {
    try {
      // Check cache first
      const cacheKey = `sms:status:${messageSid}`;
      const cachedStatus = await this.redis.get(cacheKey);

      if (cachedStatus) {
        return JSON.parse(cachedStatus);
      }

      // Fetch from Twilio if not in cache
      const message = await this.twilioClient.messages(messageSid).fetch();
      
      const status: DeliveryStatus = {
        status: message.status,
        errorCode: message.errorCode || undefined,
        errorMessage: message.errorMessage || undefined,
        timestamp: new Date().toISOString(),
        attempts: 1
      };

      // Update cache
      await this.cacheDeliveryStatus(messageSid, status);

      return status;

    } catch (error) {
      this.logger.error('Failed to check delivery status', error as Error, {
        messageSid
      });
      throw error;
    }
  }

  public async processTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    try {
      // Fetch template (implementation would depend on template storage)
      const template: MessageTemplate = await this.fetchTemplate(templateId);

      // Validate variables
      const missingVars = template.allowedVariables.filter(
        v => !(v in variables)
      );
      if (missingVars.length > 0) {
        throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
      }

      // Process template
      let content = template.content;
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      // Validate length
      if (content.length > template.maxLength) {
        throw new Error(`Processed message exceeds maximum length of ${template.maxLength}`);
      }

      return content;

    } catch (error) {
      this.logger.error('Template processing failed', error as Error, {
        templateId,
        variables
      });
      throw error;
    }
  }

  private async fetchTemplate(templateId: string): Promise<MessageTemplate> {
    // Implementation would depend on template storage mechanism
    // This is a placeholder implementation
    throw new Error('Template fetching not implemented');
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'ESOCKETTIMEDOUT',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED'
    ];
    return retryableErrors.includes(error.name) || error.message.includes('timeout');
  }
}