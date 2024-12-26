/**
 * @fileoverview API Gateway main application entry point implementing comprehensive
 * request handling, security controls, and performance monitoring.
 * @version 1.0.0
 */

// External dependencies
import express, { Express, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import { validationResult } from 'express-validator'; // v7.0.0
import cors from 'cors'; // v2.8.5

// Internal dependencies
import { corsOptions } from './config/cors.config';
import { 
  publicApiLimiter, 
  internalApiLimiter, 
  adminApiLimiter, 
  webhookApiLimiter 
} from './config/rate-limit.config';
import { authenticate, authorize } from './middleware/auth.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { errorHandler, handleNotFound, ApiError } from './middleware/error.middleware';
import { Logger } from '../../shared/utils/src/logger.util';

// Environment variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 30000;

// Initialize logger
const logger = new Logger('ApiGateway', {
  enableElasticsearch: true,
  additionalMetadata: { component: 'Application' }
});

/**
 * Creates and configures the Express application with comprehensive security,
 * performance, and monitoring features.
 * @returns Configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Basic middleware setup
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
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
    expectCt: { enforce: true, maxAge: 30 },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors(corsOptions));

  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Request logging
  app.use(requestLogger);

  // Rate limiting by route type
  app.use('/api/public', publicApiLimiter);
  app.use('/api/internal', internalApiLimiter);
  app.use('/api/admin', adminApiLimiter);
  app.use('/api/webhooks', webhookApiLimiter);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API routes with versioning
  app.use('/api/v1', setupApiRoutes());

  // Error handling
  app.use(handleNotFound);
  app.use(errorHandler);

  return app;
}

/**
 * Sets up versioned API routes with authentication and authorization
 * @returns Express Router with configured routes
 */
function setupApiRoutes() {
  const router = express.Router();

  // Validation middleware
  const validateRequest = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Validation Error', { errors: errors.array() });
    }
    next();
  };

  // Public routes
  router.use('/auth', require('./routes/auth.routes'));
  router.use('/public', require('./routes/public.routes'));

  // Protected routes with authentication
  router.use('/applications', authenticate, require('./routes/applications.routes'));
  router.use('/documents', authenticate, require('./routes/documents.routes'));
  
  // Admin routes with role-based authorization
  router.use('/admin', 
    authenticate, 
    authorize(['ADMIN', 'SUPER_ADMIN']), 
    require('./routes/admin.routes')
  );

  return router;
}

/**
 * Starts the API Gateway server with graceful shutdown and health monitoring
 * @param app Configured Express application
 */
export async function startServer(app: Express): Promise<void> {
  try {
    const server = app.listen(PORT, () => {
      logger.info(`API Gateway started`, {
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });

    // Configure server timeouts
    server.timeout = parseInt(REQUEST_TIMEOUT as string);
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      
      server.close(async () => {
        try {
          // Cleanup operations
          logger.info('Server closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', error as Error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled Rejection', reason);
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Export configured app for testing
export const app = createApp();