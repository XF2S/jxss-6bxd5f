// External dependencies
import { Request, Response, NextFunction } from 'express';  // express v4.18.2
import { StatusCodes } from 'http-status-codes';  // http-status-codes v2.2.0
import { v4 as uuidv4 } from 'uuid';  // uuid v9.0.0

// Internal dependencies
import { Logger } from '../../../shared/utils/src/logger.util';

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const ERROR_SAMPLING_RATE = parseFloat(process.env.ERROR_SAMPLING_RATE || '1.0');

// Initialize logger
const logger = new Logger('ApiGateway', {
  enableElasticsearch: true,
  additionalMetadata: { component: 'ErrorMiddleware' }
});

// Error categories for security monitoring
enum ErrorCategory {
  SECURITY = 'SECURITY',
  VALIDATION = 'VALIDATION',
  BUSINESS = 'BUSINESS',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK'
}

/**
 * Enhanced custom error class with security context and correlation tracking
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly correlationId: string;
  public readonly securityContext: Record<string, any>;
  public readonly errorCategory: ErrorCategory;
  public readonly details: Record<string, any>;
  public readonly timestamp: string;

  constructor(
    statusCode: number,
    message: string,
    details?: Record<string, any>,
    securityContext?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.correlationId = uuidv4();
    this.details = details || {};
    this.securityContext = securityContext || {};
    this.timestamp = new Date().toISOString();
    this.errorCategory = this.determineErrorCategory(statusCode);
    Error.captureStackTrace(this, this.constructor);
  }

  private determineErrorCategory(statusCode: number): ErrorCategory {
    if (statusCode >= 400 && statusCode < 500) {
      return statusCode === 401 || statusCode === 403 
        ? ErrorCategory.SECURITY 
        : ErrorCategory.VALIDATION;
    }
    return statusCode >= 500 ? ErrorCategory.SYSTEM : ErrorCategory.BUSINESS;
  }
}

/**
 * Enhanced 404 handler with security monitoring for undefined routes
 */
export const handleNotFound = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = uuidv4();
  const securityContext = {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    path: req.path,
    method: req.method
  };

  const notFoundError = new ApiError(
    StatusCodes.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    { path: req.path, method: req.method },
    securityContext
  );

  // Log 404 with security context for pattern analysis
  logger.error('Route not found', notFoundError, {
    securityContext,
    correlationId
  });

  res.status(StatusCodes.NOT_FOUND).json({
    status: 'error',
    message: 'Resource not found',
    correlationId
  });
};

/**
 * Enhanced Express error handling middleware with security context and correlation tracking
 */
export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID if not present
  const correlationId = (error as ApiError).correlationId || uuidv4();

  // Determine status code and create API error instance
  const apiError = error instanceof ApiError 
    ? error 
    : new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        error.message || 'Internal Server Error',
        {},
        {
          ip: req.ip,
          userAgent: req.get('user-agent'),
          path: req.path,
          method: req.method
        }
      );

  // Build security context
  const securityContext = {
    ...apiError.securityContext,
    userId: req.user?.id,
    sessionId: req.sessionID,
    timestamp: new Date().toISOString()
  };

  // Sample errors based on configured rate
  if (Math.random() < ERROR_SAMPLING_RATE) {
    // Log error with security context
    logger.error(apiError.message, apiError, {
      correlationId,
      securityContext,
      stack: apiError.stack,
      category: apiError.errorCategory
    });

    // Log security events for specific error categories
    if (apiError.errorCategory === ErrorCategory.SECURITY) {
      logger.error('Security event detected', apiError, {
        correlationId,
        securityContext,
        severity: 'HIGH',
        eventType: 'SECURITY_VIOLATION'
      });
    }
  }

  // Prepare sanitized error response
  const errorResponse = {
    status: 'error',
    message: apiError.message,
    correlationId,
    ...(NODE_ENV === 'development' && {
      details: apiError.details,
      stack: apiError.stack
    })
  };

  // Set security headers
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Send error response
  res.status(apiError.statusCode).json(errorResponse);
};