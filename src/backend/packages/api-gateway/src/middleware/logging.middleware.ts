// External dependencies
import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan'; // v1.10.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal dependencies
import { Logger } from '../../../shared/utils/src/logger.util';

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const PERFORMANCE_THRESHOLD_MS = Number(process.env.PERFORMANCE_THRESHOLD_MS || 3000);

// Initialize logger
const logger = new Logger('ApiGateway', {
  enableElasticsearch: true,
  additionalMetadata: {
    component: 'middleware',
    environment: NODE_ENV
  }
});

// Sensitive data patterns for masking
const SENSITIVE_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  creditCard: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g,
  phone: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g
};

// Headers that should be masked in logs
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'password',
  'token'
];

/**
 * Sanitizes sensitive data from log entries
 * @param data Object containing data to be sanitized
 * @returns Sanitized data safe for logging
 */
export const sanitizeLogData = (data: any): any => {
  if (!data) return data;
  
  if (typeof data === 'string') {
    let sanitized = data;
    Object.entries(SENSITIVE_PATTERNS).forEach(([_, pattern]) => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    return sanitized;
  }

  if (typeof data === 'object') {
    const sanitized = Array.isArray(data) ? [] : {};
    Object.entries(data).forEach(([key, value]) => {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeLogData(value);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeLogData(value);
      } else {
        sanitized[key] = value;
      }
    });
    return sanitized;
  }

  return data;
};

/**
 * Logs detailed response information including performance metrics and security context
 * @param req Express Request object
 * @param res Express Response object
 */
const responseLogger = (req: Request, res: Response): void => {
  const endTime = process.hrtime(req.startTime);
  const responseTimeMs = (endTime[0] * 1000) + (endTime[1] / 1000000);

  const logData = {
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    responseTime: responseTimeMs,
    userContext: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      userId: req.user?.id || 'anonymous'
    },
    requestHeaders: sanitizeLogData(req.headers),
    responseHeaders: sanitizeLogData(res.getHeaders()),
    resourceUsage: process.memoryUsage()
  };

  // Log performance issues
  if (responseTimeMs > PERFORMANCE_THRESHOLD_MS) {
    logger.warn('Performance threshold exceeded', {
      ...logData,
      threshold: PERFORMANCE_THRESHOLD_MS,
      severity: 'warning'
    });
  }

  // Log based on response status
  if (res.statusCode >= 500) {
    logger.error('Server error response', new Error(`${res.statusCode} response`), logData);
  } else if (res.statusCode >= 400) {
    logger.warn('Client error response', logData);
  } else {
    logger.http(req, res, logData);
  }
};

/**
 * Express middleware for comprehensive request/response logging
 * Implements request tracing, security auditing, and performance monitoring
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Generate correlation ID for request tracing
    req.correlationId = uuidv4();
    
    // Record start time for performance measurement
    req.startTime = process.hrtime();

    // Add security context
    req.securityContext = {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      timestamp: new Date().toISOString()
    };

    // Initial request logging
    logger.info('Incoming request', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.originalUrl,
      query: sanitizeLogData(req.query),
      headers: sanitizeLogData(req.headers),
      securityContext: req.securityContext
    });

    // Use morgan for immediate console logging in development
    if (NODE_ENV === 'development') {
      morgan('dev')(req, res, (err) => {
        if (err) {
          logger.error('Morgan logging failed', err, {
            correlationId: req.correlationId
          });
        }
      });
    }

    // Attach response listener for completion logging
    res.on('finish', () => responseLogger(req, res));

    // Handle errors in the response
    res.on('error', (error) => {
      logger.error('Response error', error, {
        correlationId: req.correlationId,
        securityContext: req.securityContext
      });
    });

    next();
  } catch (error) {
    // Fallback error logging
    logger.error('Logging middleware error', error as Error, {
      url: req.url,
      method: req.method
    });
    next();
  }
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: [number, number];
      securityContext: {
        ip: string;
        userAgent: string;
        origin: string;
        timestamp: string;
      };
    }
  }
}