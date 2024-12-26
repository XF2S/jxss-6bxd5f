/**
 * @fileoverview Frontend API client module for notification operations
 * Implements comprehensive notification handling with support for email, SMS,
 * and system notifications including templates, delivery tracking, and error handling.
 * @version 1.0.0
 */

import axios from 'axios'; // v1.6.0
import { createApiClient } from '@/config/api.config';
import {
  EmailRequest,
  EmailResponse,
  BulkEmailRequest,
  BulkEmailResponse,
  SMSRequest,
  SMSResponse,
  DeliveryStatusRequest,
  DeliveryStatusResponse,
  NotificationTemplate,
  NotificationPriority,
  DeliveryMetadata,
  TemplateValidationResult,
  isValidTemplate,
  isValidPriority,
  NotificationStatus
} from '@/types/notification.types';

/**
 * API endpoint constants
 */
const API_ENDPOINTS = {
  EMAIL: '/api/notifications/email',
  BULK_EMAIL: '/api/notifications/email/bulk',
  SMS: '/api/notifications/sms',
  STATUS: '/api/notifications/status'
} as const;

/**
 * Configuration constants
 */
const REQUEST_CACHE_TTL = 300000; // 5 minutes in milliseconds
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Request deduplication cache
const requestCache = new Map<string, { timestamp: number; response: any }>();

/**
 * Validates notification request parameters
 * @param request - The notification request to validate
 * @throws Error if validation fails
 */
const validateRequest = (request: EmailRequest | SMSRequest): void => {
  if (!isValidTemplate(request.templateId)) {
    throw new Error(`Invalid template ID: ${request.templateId}`);
  }
  if (!isValidPriority(request.priority)) {
    throw new Error(`Invalid priority level: ${request.priority}`);
  }
  if (!request.templateData || typeof request.templateData !== 'object') {
    throw new Error('Template data must be provided as an object');
  }
};

/**
 * Generates a cache key for request deduplication
 * @param request - The request to generate a key for
 * @returns Cache key string
 */
const generateCacheKey = (request: any): string => {
  return JSON.stringify({
    type: request.constructor.name,
    data: request
  });
};

/**
 * Checks and manages the request cache
 * @param key - Cache key to check
 * @param ttl - Time-to-live in milliseconds
 * @returns Cached response or null
 */
const checkCache = (key: string, ttl: number): any | null => {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.response;
  }
  requestCache.delete(key);
  return null;
};

/**
 * Sends a single email notification using a template with priority handling
 * @param request - Email notification request
 * @returns Promise resolving to email response
 */
export async function sendEmail(request: EmailRequest): Promise<EmailResponse> {
  validateRequest(request);
  
  const cacheKey = generateCacheKey(request);
  const cached = checkCache(cacheKey, REQUEST_CACHE_TTL);
  if (cached) {
    return cached;
  }

  const apiClient = createApiClient();
  apiClient.defaults.headers['X-Priority'] = request.priority;

  try {
    const response = await apiClient.post<EmailResponse>(
      API_ENDPOINTS.EMAIL,
      request
    );

    requestCache.set(cacheKey, {
      timestamp: Date.now(),
      response: response.data
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Email notification failed: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

/**
 * Sends bulk email notifications with batching and optimization
 * @param request - Bulk email notification request
 * @returns Promise resolving to bulk email response
 */
export async function sendBulkEmails(request: BulkEmailRequest): Promise<BulkEmailResponse> {
  validateRequest(request);

  const apiClient = createApiClient();
  apiClient.defaults.headers['X-Priority'] = request.priority;

  const batches = [];
  for (let i = 0; i < request.recipients.length; i += BATCH_SIZE) {
    batches.push(request.recipients.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.allSettled(
    batches.map(async (batchRecipients) => {
      const batchRequest = {
        ...request,
        recipients: batchRecipients
      };

      try {
        const response = await apiClient.post<BulkEmailResponse>(
          API_ENDPOINTS.BULK_EMAIL,
          batchRequest
        );
        return response.data;
      } catch (error) {
        throw new Error(`Batch send failed: ${error.message}`);
      }
    })
  );

  // Aggregate results
  return results.reduce((acc, result) => {
    if (result.status === 'fulfilled') {
      acc.successCount += result.value.successCount;
      acc.failureCount += result.value.failureCount;
      acc.errors.push(...result.value.errors);
    } else {
      acc.failureCount += BATCH_SIZE;
      acc.errors.push(result.reason.message);
    }
    return acc;
  }, { successCount: 0, failureCount: 0, errors: [] as string[] });
}

/**
 * Sends an SMS notification with retry support
 * @param request - SMS notification request
 * @returns Promise resolving to SMS response
 */
export async function sendSMS(request: SMSRequest): Promise<SMSResponse> {
  validateRequest(request);

  const apiClient = createApiClient();
  apiClient.defaults.headers['X-Priority'] = request.priority;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await apiClient.post<SMSResponse>(
        API_ENDPOINTS.SMS,
        request
      );
      return response.data;
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }

  throw new Error(`SMS notification failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Checks the delivery status of a notification
 * @param request - Delivery status request
 * @returns Promise resolving to delivery status response
 */
export async function checkDeliveryStatus(
  request: DeliveryStatusRequest
): Promise<DeliveryStatusResponse> {
  const apiClient = createApiClient();

  try {
    const response = await apiClient.get<DeliveryStatusResponse>(
      `${API_ENDPOINTS.STATUS}/${request.messageId}`,
      {
        params: {
          type: request.type
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Status check failed: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}