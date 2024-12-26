/**
 * @fileoverview API configuration and client setup for the Enrollment System
 * Implements comprehensive API client configuration with security, monitoring,
 * and error handling features.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // v1.6.0
import axiosRetry from 'axios-retry'; // v3.8.0
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // v3.4.0
import { AUTH_CONFIG, getStoredToken, getStoredRefreshToken, storeTokens, clearTokens } from '@/config/auth.config';
import type { AuthResponse } from '@/types/auth.types';

// Initialize fingerprint instance
const fingerprintPromise = FingerprintJS.load();

/**
 * API configuration constants
 */
export const API_CONFIG = {
  BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 5000, // 5 seconds
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_RESET_TIME: 30000, // 30 seconds
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  }
} as const;

// Circuit breaker state
let failureCount = 0;
let circuitBreakerOpen = false;
let lastFailureTime = 0;

// Request queue during token refresh
let isRefreshing = false;
const requestQueue: Array<(token: string) => void> = [];

/**
 * Creates and configures an Axios instance with comprehensive security and monitoring features
 * @returns Configured Axios instance
 */
export default function createApiClient(): AxiosInstance {
  const axiosInstance = axios.create({
    baseURL: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    headers: API_CONFIG.HEADERS,
    withCredentials: true
  });

  // Configure retry mechanism with exponential backoff
  axiosRetry(axiosInstance, {
    retries: API_CONFIG.RETRY_ATTEMPTS,
    retryDelay: (retryCount) => {
      return Math.min(
        API_CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1),
        API_CONFIG.MAX_RETRY_DELAY
      );
    },
    retryCondition: (error: AxiosError) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) &&
        !circuitBreakerOpen &&
        !error.response?.status?.toString().startsWith('4');
    }
  });

  setupRequestInterceptor(axiosInstance);
  setupResponseInterceptor(axiosInstance);

  return axiosInstance;
}

/**
 * Configures request interceptor with security and monitoring features
 * @param axiosInstance - Axios instance to configure
 */
function setupRequestInterceptor(axiosInstance: AxiosInstance): void {
  axiosInstance.interceptors.request.use(
    async (config) => {
      // Check circuit breaker
      if (circuitBreakerOpen) {
        if (Date.now() - lastFailureTime > API_CONFIG.CIRCUIT_BREAKER_RESET_TIME) {
          circuitBreakerOpen = false;
          failureCount = 0;
        } else {
          throw new Error('Circuit breaker is open');
        }
      }

      // Add request timing
      config.metadata = { startTime: Date.now() };

      // Add authentication token
      const token = await getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add browser fingerprint
      if (AUTH_CONFIG.SECURITY_FEATURES.browserFingerprinting) {
        const fp = await fingerprintPromise;
        const result = await fp.get();
        config.headers['X-Device-Fingerprint'] = result.visitorId;
      }

      // Add request correlation ID
      config.headers['X-Correlation-ID'] = crypto.randomUUID();

      return config;
    },
    (error) => Promise.reject(error)
  );
}

/**
 * Configures response interceptor with error handling and token refresh
 * @param axiosInstance - Axios instance to configure
 */
function setupResponseInterceptor(axiosInstance: AxiosInstance): void {
  axiosInstance.interceptors.response.use(
    (response) => {
      // Record response timing
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      console.debug(`Request to ${response.config.url} took ${duration}ms`);

      // Reset circuit breaker on success
      failureCount = 0;
      circuitBreakerOpen = false;

      return response;
    },
    async (error: AxiosError) => {
      // Update circuit breaker state
      failureCount++;
      if (failureCount >= API_CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreakerOpen = true;
        lastFailureTime = Date.now();
      }

      // Handle 401 errors with token refresh
      if (error.response?.status === 401) {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        
        if (!originalRequest._retry) {
          originalRequest._retry = true;

          if (!isRefreshing) {
            isRefreshing = true;

            try {
              const refreshToken = await getStoredRefreshToken();
              if (!refreshToken) {
                await clearTokens();
                throw new Error('No refresh token available');
              }

              const response = await axiosInstance.post<AuthResponse>('/auth/refresh', {
                refreshToken
              });

              await storeTokens(response.data);

              // Process queued requests
              requestQueue.forEach(callback => callback(response.data.accessToken));
              requestQueue.length = 0;

              return axiosInstance(originalRequest);
            } catch (refreshError) {
              requestQueue.forEach(callback => callback(''));
              requestQueue.length = 0;
              await clearTokens();
              throw refreshError;
            } finally {
              isRefreshing = false;
            }
          }

          // Queue request if refresh is in progress
          return new Promise(resolve => {
            requestQueue.push((token: string) => {
              if (token) {
                originalRequest.headers!.Authorization = `Bearer ${token}`;
                resolve(axiosInstance(originalRequest));
              } else {
                resolve(Promise.reject(error));
              }
            });
          });
        }
      }

      // Format error response
      const errorResponse = {
        code: error.response?.status || 500,
        message: error.response?.data?.message || 'An unexpected error occurred',
        details: error.response?.data?.details || {},
        correlationId: error.config?.headers?.['X-Correlation-ID']
      };

      return Promise.reject(errorResponse);
    }
  );
}