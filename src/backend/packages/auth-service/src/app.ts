/**
 * @fileoverview Main application entry point for the authentication service implementing
 * secure authentication flows with enhanced security features, monitoring, and scalability.
 * Compliant with ISO 27001 and NIST 800-63B guidelines.
 * @version 1.0.0
 */

import express, { Application, Request, Response, NextFunction } from 'express'; // v4.18.0
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import { Container } from 'inversify'; // v6.0.0
import { createClient } from 'redis'; // v4.6.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import hpp from 'hpp'; // v0.2.3
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { authConfig } from './config/auth.config';
import { AuthController } from './controllers/auth.controller';
import { Logger } from '../../shared/utils/src/logger.util';

// Initialize logger
const logger = new Logger('AuthService', {
  enableElasticsearch: true,
  additionalMetadata: {
    component: 'auth-service',
    version: '1.0.0'
  }
});

// Environment variables
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 30000;

/**
 * Configures Express application middleware with enhanced security features
 * @param app Express application instance
 */
const setupMiddleware = (app: Application): void => {
  // Basic middleware
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
  app.use(compression());

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Rate limiting
  app.use(rateLimit({
    windowMs: authConfig.security.rateLimit.ip.window * 1000,
    max: authConfig.security.rateLimit.ip.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later'
  }));

  // HTTP Parameter Pollution protection
  app.use(hpp());

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.http(req, res, {
      requestId: req.id,
      userId: req.user?.id
    });
    next();
  });
};

/**
 * Configures dependency injection container
 * @returns Configured Container instance
 */
const setupContainer = (): Container => {
  const container = new Container({ defaultScope: 'Singleton' });

  // Redis client setup
  const redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
    }
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error', err));

  // Register dependencies
  container.bind<AuthController>('AuthController').to(AuthController);
  container.bind('RedisClient').toConstantValue(redisClient);
  container.bind('Logger').toConstantValue(logger);

  return container;
};

/**
 * Initializes and starts the Express server
 */
const startServer = async (): Promise<void> => {
  try {
    const app: Application = express();
    const container = setupContainer();

    // Configure middleware
    setupMiddleware(app);

    // Initialize controller
    const authController = container.get<AuthController>('AuthController');

    // Setup routes
    app.post('/auth/login', authController.login);
    app.post('/auth/mfa/setup', authController.setupMfa);
    app.post('/auth/mfa/verify', authController.mfaVerify);

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Error handling middleware
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', err, {
        requestId: req.id,
        path: req.path
      });

      res.status(500).json({
        error: 'Internal server error',
        requestId: req.id
      });
    });

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Auth service started`, {
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });

    // Configure server timeout
    server.timeout = parseInt(REQUEST_TIMEOUT.toString());

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down auth service...');
      
      server.close(async () => {
        try {
          await container.get('RedisClient').quit();
          logger.info('Auth service shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error as Error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start auth service', error as Error);
    process.exit(1);
  }
};

// Start the application
startServer().catch((error) => {
  logger.error('Fatal error during startup', error as Error);
  process.exit(1);
});