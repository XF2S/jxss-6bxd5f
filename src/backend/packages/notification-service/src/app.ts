// External imports with versions
import { Server, ServerCredentials } from '@grpc/grpc-js'; // ^1.9.0
import { Container } from 'inversify'; // ^6.0.1
import { loadPackageDefinition, PackageDefinition } from '@grpc/proto-loader'; // ^0.7.0
import * as dotenv from 'dotenv'; // ^16.0.0
import { promisify } from 'util';
import { RateLimiter } from 'rate-limiter-flexible';
import { CircuitBreaker } from 'opossum';
import Redis from 'ioredis';

// Internal imports
import { NotificationController } from './controllers/notification.controller';
import { EmailConfig } from './config/email.config';
import { Logger } from '../../shared/utils/src/logger.util';

// Load environment variables
dotenv.config();

// Constants
const GRPC_PORT = process.env.GRPC_PORT || 50051;
const PROTO_PATH = '../../../shared/grpc/proto/notification.proto';
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000');
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '1000');

/**
 * Enhanced NotificationServer class that manages the notification service lifecycle
 * with comprehensive monitoring and reliability features
 */
export class NotificationServer {
  private server: Server;
  private container: Container;
  private logger: Logger;
  private metricsCollector: any;
  private healthCheck: any;
  private circuitBreaker: CircuitBreaker;
  private isShuttingDown: boolean = false;

  constructor() {
    this.logger = new Logger('NotificationServer', {
      enableElasticsearch: true,
      additionalMetadata: {
        service: 'notification-service',
        version: process.env.SERVICE_VERSION
      }
    });

    this.container = new Container({ defaultScope: 'Singleton' });
    this.server = new Server({
      'grpc.max_concurrent_streams': MAX_CONNECTIONS,
      'grpc.keepalive_time_ms': 30000,
      'grpc.keepalive_timeout_ms': 10000,
      'grpc.http2.max_pings_without_data': 0,
      'grpc.http2.min_time_between_pings_ms': 10000
    });
  }

  /**
   * Initializes the dependency injection container with enhanced service bindings
   */
  private async setupDependencyInjection(): Promise<void> {
    try {
      // Bind core services
      this.container.bind<Logger>('Logger').toConstantValue(this.logger);
      
      // Configure and bind EmailConfig
      const emailConfig = new EmailConfig(
        process.env.SMTP_CONFIG!,
        process.env.EMAIL_DEFAULTS!,
        process.env.RATE_LIMITS!
      );
      this.container.bind<EmailConfig>('EmailConfig').toConstantValue(emailConfig);

      // Configure rate limiter with Redis
      const redis = new Redis(process.env.REDIS_URL!, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });
      
      const rateLimiter = new RateLimiter({
        storeClient: redis,
        points: 100,
        duration: 60,
        blockDuration: 60
      });
      this.container.bind<RateLimiter>('RateLimiter').toConstantValue(rateLimiter);

      // Configure circuit breaker
      this.circuitBreaker = new CircuitBreaker(async () => {}, {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      });
      this.container.bind<CircuitBreaker>('CircuitBreaker')
        .toConstantValue(this.circuitBreaker);

      // Bind NotificationController
      this.container.bind<NotificationController>('NotificationController')
        .to(NotificationController);

      this.logger.info('Dependency injection setup completed');
    } catch (error) {
      this.logger.error('Failed to setup dependency injection', error as Error);
      throw error;
    }
  }

  /**
   * Loads and parses the notification service proto file
   */
  private async loadProtoFile(): Promise<PackageDefinition> {
    try {
      const loadProto = promisify(loadPackageDefinition);
      const packageDefinition = await loadProto({
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [PROTO_PATH]
      });

      this.logger.info('Proto file loaded successfully');
      return packageDefinition;
    } catch (error) {
      this.logger.error('Failed to load proto file', error as Error);
      throw error;
    }
  }

  /**
   * Starts the notification server with comprehensive monitoring
   */
  public async start(): Promise<void> {
    try {
      // Setup dependencies
      await this.setupDependencyInjection();

      // Load proto definition
      const protoDefinition = await this.loadProtoFile();

      // Get controller instance
      const notificationController = this.container
        .get<NotificationController>('NotificationController');

      // Add service implementation
      this.server.addService(
        protoDefinition.notification_service,
        {
          sendEmail: notificationController.sendEmail.bind(notificationController),
          sendBulkEmails: notificationController.sendBulkEmails.bind(notificationController),
          sendSMS: notificationController.sendSMS.bind(notificationController),
          checkDeliveryStatus: notificationController.checkDeliveryStatus.bind(notificationController)
        }
      );

      // Start server with TLS if configured
      const credentials = process.env.TLS_CERT && process.env.TLS_KEY
        ? ServerCredentials.createSsl(
            Buffer.from(process.env.TLS_CERT),
            [{
              private_key: Buffer.from(process.env.TLS_KEY),
              cert_chain: Buffer.from(process.env.TLS_CERT)
            }],
            true
          )
        : ServerCredentials.createInsecure();

      await new Promise<void>((resolve, reject) => {
        this.server.bindAsync(
          `0.0.0.0:${GRPC_PORT}`,
          credentials,
          (error, port) => {
            if (error) {
              reject(error);
              return;
            }
            this.server.start();
            this.logger.info(`Server started on port ${port}`);
            resolve();
          }
        );
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start server', error as Error);
      throw error;
    }
  }

  /**
   * Gracefully stops the notification server with connection draining
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Initiating graceful shutdown');

    try {
      // Stop accepting new requests
      this.server.tryShutdown(async () => {
        try {
          // Wait for ongoing requests to complete
          await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT));

          // Force shutdown if still running
          this.server.forceShutdown();
          this.logger.info('Server shutdown completed');
        } catch (error) {
          this.logger.error('Error during shutdown', error as Error);
          this.server.forceShutdown();
        }
      });
    } catch (error) {
      this.logger.error('Failed to stop server', error as Error);
      this.server.forceShutdown();
      throw error;
    }
  }

  /**
   * Sets up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal} signal`);
        await this.stop();
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception', error);
      await this.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      this.logger.error('Unhandled rejection', reason as Error);
      await this.stop();
      process.exit(1);
    });
  }
}

// Start server if running directly
if (require.main === module) {
  const server = new NotificationServer();
  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}