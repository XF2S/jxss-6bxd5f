/**
 * CORS Configuration for API Gateway
 * @version 1.0.0
 * @module config/cors
 * 
 * Implements secure CORS (Cross-Origin Resource Sharing) policies with:
 * - Environment-specific configurations
 * - Strict origin validation
 * - Enhanced security headers
 * - Comprehensive access controls
 */

// @ts-ignore External import: cors@2.8.5
import { CorsOptions } from 'cors';

/**
 * Environment-specific allowed origins
 * Defaults to localhost:3000 for development if not specified
 */
const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

/**
 * Current environment
 * Defaults to 'development' if not specified
 */
const NODE_ENV: string = process.env.NODE_ENV || 'development';

/**
 * Creates environment-specific CORS configuration with enhanced security measures
 * @returns {CorsOptions} Secure CORS configuration object
 */
const createCorsOptions = (): CorsOptions => {
  // Development environment configuration
  if (NODE_ENV === 'development') {
    return {
      origin: true, // Allow all origins in development
      credentials: true,
      optionsSuccessStatus: 204,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-CSRF-Token',
        'X-API-Key'
      ]
    };
  }

  // Production environment configuration
  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }

      // Check against allowed origins
      if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
      'X-API-Key'
    ],
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'X-Total-Count',
      'X-Rate-Limit-Remaining'
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
};

/**
 * Exported CORS configuration
 * Provides secure, environment-specific settings for API Gateway
 */
export const corsOptions: CorsOptions = createCorsOptions();

/**
 * Export individual CORS settings for granular access
 */
export const {
  origin,
  methods,
  allowedHeaders,
  exposedHeaders
} = corsOptions;