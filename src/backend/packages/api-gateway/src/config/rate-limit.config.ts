// @version express-rate-limit@6.7.0
// @version rate-limit-redis@3.0.0
// @version ioredis@5.3.0

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';

// Rate limit window and request constants
const PUBLIC_API_WINDOW_MS = 60 * 1000; // 1 minute
const PUBLIC_API_MAX_REQUESTS = 100;

const INTERNAL_API_WINDOW_MS = 60 * 1000;
const INTERNAL_API_MAX_REQUESTS = 1000;

const ADMIN_API_WINDOW_MS = 60 * 1000;
const ADMIN_API_MAX_REQUESTS = 50;

const WEBHOOK_API_WINDOW_MS = 60 * 1000;
const WEBHOOK_API_MAX_REQUESTS = 10;

// Redis connection URL from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Creates a Redis store instance for distributed rate limiting
 * with connection pooling and error handling
 */
const createRedisStore = (): RedisStore => {
  // Create Redis client with optimized configuration
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    retryStrategy: (times: number) => {
      return Math.min(times * 50, 2000);
    },
    lazyConnect: true
  });

  // Error handling for Redis client
  client.on('error', (err) => {
    console.error('Redis rate limit store error:', err);
  });

  client.on('connect', () => {
    console.info('Redis rate limit store connected');
  });

  // Create and return Redis store with prefix for rate limiting
  return new RedisStore({
    prefix: 'rl:',
    client: client,
    sendCommand: (...args: string[]) => client.call(...args)
  });
};

/**
 * Custom key generator for rate limiting based on IP and user ID
 */
const keyGenerator = (req: Request): string => {
  const userId = req.user?.id || 'anonymous';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${userId}`;
};

/**
 * Handler for when rate limit is exceeded
 */
const handler = (req: Request, res: Response): void => {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After')
  });
};

// Create Redis store instance
const redisStore = createRedisStore();

/**
 * Rate limiter for public API endpoints
 * Limit: 100 requests per minute
 */
export const publicApiLimiter = rateLimit({
  windowMs: PUBLIC_API_WINDOW_MS,
  max: PUBLIC_API_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  keyGenerator,
  handler,
  skip: (req: Request) => req.ip === '127.0.0.1', // Skip rate limiting for localhost
  statusCode: 429,
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Rate limiter for internal API endpoints
 * Limit: 1000 requests per minute
 */
export const internalApiLimiter = rateLimit({
  windowMs: INTERNAL_API_WINDOW_MS,
  max: INTERNAL_API_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  keyGenerator: (req: Request) => {
    const serviceId = req.headers['x-service-id'] || 'unknown';
    return `internal:${serviceId}`;
  },
  skip: (req: Request) => {
    // Skip rate limiting for whitelisted internal services
    const serviceId = req.headers['x-service-id'];
    return Array.isArray(process.env.WHITELISTED_SERVICES) &&
      process.env.WHITELISTED_SERVICES.includes(serviceId as string);
  }
});

/**
 * Rate limiter for admin API endpoints
 * Limit: 50 requests per minute
 */
export const adminApiLimiter = rateLimit({
  windowMs: ADMIN_API_WINDOW_MS,
  max: ADMIN_API_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  keyGenerator: (req: Request) => {
    const adminId = req.user?.id || 'unknown';
    return `admin:${adminId}`;
  },
  skip: (req: Request) => {
    // Skip rate limiting for super admins
    return req.user?.role === 'SUPER_ADMIN';
  }
});

/**
 * Rate limiter for webhook API endpoints
 * Limit: 10 requests per minute
 */
export const webhookApiLimiter = rateLimit({
  windowMs: WEBHOOK_API_WINDOW_MS,
  max: WEBHOOK_API_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  keyGenerator: (req: Request) => {
    const webhookId = req.headers['x-webhook-id'] || 'unknown';
    return `webhook:${webhookId}`;
  },
  skip: (req: Request) => {
    // Validate webhook signature before applying rate limit
    const signature = req.headers['x-webhook-signature'];
    return signature && validateWebhookSignature(req, signature as string);
  }
});

/**
 * Validates webhook signature to prevent abuse
 * @param req Request object
 * @param signature Webhook signature from headers
 */
const validateWebhookSignature = (req: Request, signature: string): boolean => {
  // Implementation would verify the webhook signature using your security implementation
  // This is a placeholder for the actual implementation
  return false; // Default to applying rate limit unless explicitly verified
};

// Export Redis store for testing and monitoring
export const rateLimitStore = redisStore;