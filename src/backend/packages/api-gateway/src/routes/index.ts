/**
 * @fileoverview Main routing configuration for the API Gateway implementing
 * centralized routing with enhanced security, monitoring, and rate limiting.
 * @version 1.0.0
 */

import express, { Express, Request, Response } from 'express'; // express v4.18.2
import cors from 'cors'; // cors v2.8.5
import helmet from 'helmet'; // helmet v7.0.0
import compression from 'compression'; // compression v1.7.4

// Internal imports
import { authenticate, authorize } from '../middleware/auth.middleware';
import { requestLogger } from '../middleware/logging.middleware';
import { errorHandler, handleNotFound } from '../middleware/error.middleware';
import { 
  publicApiLimiter, 
  internalApiLimiter, 
  adminApiLimiter, 
  webhookApiLimiter 
} from '../config/rate-limit.config';
import { corsOptions } from '../config/cors.config';
import { UserRole } from '../../../shared/models/src/user.model';

// Constants
const API_PREFIX = '/api/v1';
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password', '/health'];
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUEST_SIZE = '10mb';

/**
 * Configures all routes and middleware for the API Gateway
 * @param app Express application instance
 */
export const configureRoutes = (app: Express): void => {
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
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration
  app.use(cors(corsOptions));

  // Request parsing and compression
  app.use(compression());
  app.use(express.json({ limit: MAX_REQUEST_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_SIZE }));

  // Logging and monitoring
  app.use(requestLogger);

  // Health check endpoint (no auth required)
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API routes with rate limiting
  app.use(`${API_PREFIX}/public`, publicApiLimiter);
  app.use(`${API_PREFIX}/internal`, internalApiLimiter);
  app.use(`${API_PREFIX}/admin`, adminApiLimiter);
  app.use(`${API_PREFIX}/webhooks`, webhookApiLimiter);

  // Authentication middleware (except for public routes)
  app.use((req: Request, res: Response, next) => {
    if (PUBLIC_ROUTES.some(route => req.path.includes(route))) {
      return next();
    }
    authenticate(req, res, next);
  });

  // Route configurations
  configureAuthRoutes(app);
  configureApplicationRoutes(app);
  configureDocumentRoutes(app);
  configureUserRoutes(app);
  configureAdminRoutes(app);
  configureWebhookRoutes(app);

  // Error handling
  app.use(handleNotFound);
  app.use(errorHandler);
};

/**
 * Configure authentication routes
 */
const configureAuthRoutes = (app: Express): void => {
  const router = express.Router();

  router.post('/login', publicApiLimiter);
  router.post('/register', publicApiLimiter);
  router.post('/forgot-password', publicApiLimiter);
  router.post('/reset-password', publicApiLimiter);
  router.post('/refresh-token', publicApiLimiter);

  app.use(`${API_PREFIX}/auth`, router);
};

/**
 * Configure application processing routes
 */
const configureApplicationRoutes = (app: Express): void => {
  const router = express.Router();

  router.get('/', authorize([UserRole.ADMIN, UserRole.STAFF]));
  router.post('/', authorize([UserRole.APPLICANT]));
  router.get('/:id', authorize([UserRole.ADMIN, UserRole.STAFF, UserRole.APPLICANT]));
  router.put('/:id', authorize([UserRole.ADMIN, UserRole.STAFF]));
  router.delete('/:id', authorize([UserRole.ADMIN]));

  app.use(`${API_PREFIX}/applications`, router);
};

/**
 * Configure document management routes
 */
const configureDocumentRoutes = (app: Express): void => {
  const router = express.Router();

  router.post('/upload', authorize([UserRole.APPLICANT, UserRole.STAFF]));
  router.get('/:id', authorize([UserRole.ADMIN, UserRole.STAFF, UserRole.APPLICANT]));
  router.delete('/:id', authorize([UserRole.ADMIN, UserRole.STAFF]));

  app.use(`${API_PREFIX}/documents`, router);
};

/**
 * Configure user management routes
 */
const configureUserRoutes = (app: Express): void => {
  const router = express.Router();

  router.get('/profile', authorize([UserRole.APPLICANT, UserRole.STAFF, UserRole.ADMIN]));
  router.put('/profile', authorize([UserRole.APPLICANT, UserRole.STAFF, UserRole.ADMIN]));
  router.put('/password', authorize([UserRole.APPLICANT, UserRole.STAFF, UserRole.ADMIN]));

  app.use(`${API_PREFIX}/users`, router);
};

/**
 * Configure admin routes
 */
const configureAdminRoutes = (app: Express): void => {
  const router = express.Router();

  router.get('/users', authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]));
  router.post('/users', authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]));
  router.get('/reports', authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]));
  router.get('/audit-logs', authorize([UserRole.SUPER_ADMIN]));

  app.use(`${API_PREFIX}/admin`, router);
};

/**
 * Configure webhook routes
 */
const configureWebhookRoutes = (app: Express): void => {
  const router = express.Router();

  router.post('/status-update', webhookApiLimiter);
  router.post('/document-processed', webhookApiLimiter);

  app.use(`${API_PREFIX}/webhooks`, router);
};

export default configureRoutes;