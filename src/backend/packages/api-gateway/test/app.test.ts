/**
 * @fileoverview Comprehensive API Gateway integration test suite validating core functionality,
 * security controls, and performance requirements.
 * @version 1.0.0
 */

// External dependencies
import supertest from 'supertest'; // v6.3.3
import { describe, beforeEach, afterEach, it, expect } from '@jest/globals'; // v29.0.0
import { StatusCodes } from 'http-status-codes'; // v2.2.0

// Internal dependencies
import { app } from '../src/app';
import { authenticate, authorize, RoleType } from '../src/middleware/auth.middleware';

// Test constants
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'test-jwt-token';
const TEST_ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';
const TEST_TIMEOUT = 3000; // 3 seconds

// Initialize test client
const request = supertest(app);

describe('API Gateway Integration Tests', () => {
  // Test setup and cleanup
  beforeEach(() => {
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should allow access to public endpoints without authentication', async () => {
      const response = await request
        .get('/api/v1/public/health')
        .expect(StatusCodes.OK);

      expect(response.body).toHaveProperty('status', 'healthy');
    });

    it('should reject requests to protected endpoints without token', async () => {
      const response = await request
        .get('/api/v1/applications')
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body).toHaveProperty('message', 'Authentication token required');
    });

    it('should accept valid JWT token for protected endpoints', async () => {
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.OK);

      expect(response.headers).toHaveProperty('x-correlation-id');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = 'expired.jwt.token';
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(StatusCodes.UNAUTHORIZED);

      expect(response.body).toHaveProperty('message', 'Token has expired');
    });

    it('should include security headers in responses', async () => {
      const response = await request.get('/api/v1/public/health');

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });

  describe('Authorization Tests', () => {
    it('should allow admin access to admin endpoints', async () => {
      const response = await request
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${TEST_ADMIN_TOKEN}`)
        .expect(StatusCodes.OK);

      expect(response.body).toBeDefined();
    });

    it('should deny user access to admin endpoints', async () => {
      const response = await request
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.FORBIDDEN);

      expect(response.body).toHaveProperty('message', 'Insufficient permissions');
    });

    it('should validate role-based access control', async () => {
      const response = await request
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.OK);

      expect(response.headers).toHaveProperty('x-correlation-id');
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits on public endpoints', async () => {
      // Make requests up to limit
      for (let i = 0; i < 100; i++) {
        await request.get('/api/v1/public/health');
      }

      // Next request should be rate limited
      const response = await request
        .get('/api/v1/public/health')
        .expect(StatusCodes.TOO_MANY_REQUESTS);

      expect(response.headers).toHaveProperty('retry-after');
    });

    it('should enforce different rate limits for authenticated endpoints', async () => {
      // Make requests up to limit
      for (let i = 0; i < 1000; i++) {
        await request
          .get('/api/v1/applications')
          .set('Authorization', `Bearer ${TEST_USER_TOKEN}`);
      }

      // Next request should be rate limited
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.TOO_MANY_REQUESTS);

      expect(response.headers).toHaveProperty('retry-after');
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle 404 not found errors', async () => {
      const response = await request
        .get('/api/v1/nonexistent')
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('correlationId');
    });

    it('should handle validation errors', async () => {
      const response = await request
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .send({}) // Empty payload
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toHaveProperty('message', 'Validation Error');
    });

    it('should handle internal server errors', async () => {
      // Mock internal error
      jest.spyOn(app, 'handle').mockImplementationOnce(() => {
        throw new Error('Internal error');
      });

      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body).toHaveProperty('correlationId');
    });
  });

  describe('Performance Tests', () => {
    it('should respond within performance SLA (3 seconds)', async () => {
      const startTime = Date.now();
      
      await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.OK);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(3000);
    });

    it('should include timing headers in response', async () => {
      const response = await request
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
        .expect(StatusCodes.OK);

      expect(response.headers).toHaveProperty('x-response-time');
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(10).fill(null).map(() => 
        request
          .get('/api/v1/applications')
          .set('Authorization', `Bearer ${TEST_USER_TOKEN}`)
          .expect(StatusCodes.OK)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.headers).toHaveProperty('x-correlation-id');
      });
    });
  });
});