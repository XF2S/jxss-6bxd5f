/**
 * @fileoverview Authentication API client module for the Enrollment System
 * Implements secure authentication operations with comprehensive error handling,
 * token management, and security features.
 * @version 1.0.0
 */

import type { 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse 
} from '@/types/auth.types';
import createApiClient from '@/config/api.config';
import { 
  AUTH_CONFIG,
  getStoredToken,
  getStoredRefreshToken,
  storeTokens,
  clearTokens 
} from '@/config/auth.config';
import type { AxiosInstance } from 'axios';

// Initialize API client with security configurations
const apiClient: AxiosInstance = createApiClient();

// Retry configuration for authentication operations
const RETRY_CONFIG = {
  maxAttempts: AUTH_CONFIG.LOGIN_ATTEMPTS.max,
  baseDelay: 1000,
  maxDelay: 5000
};

/**
 * Authentication API client with enhanced security features
 */
export const authApi = {
  /**
   * Authenticates user with credentials and handles MFA if required
   * @param credentials - User login credentials
   * @returns Authentication response with tokens and user data
   * @throws {AuthError} On authentication failure
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate credentials before sending
      if (!credentials.email || !credentials.password) {
        throw new Error('Invalid credentials provided');
      }

      const response = await apiClient.post<AuthResponse>('/auth/login', {
        email: credentials.email,
        password: credentials.password,
        mfaCode: credentials.mfaCode,
        rememberMe: credentials.rememberMe
      });

      // Handle MFA challenge if required
      if (response.data.requiresMfa && !credentials.mfaCode) {
        return {
          ...response.data,
          requiresMfa: true
        };
      }

      // Store tokens securely
      await storeTokens(response.data);

      return response.data;
    } catch (error: any) {
      console.error('Login failed:', error);
      throw {
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed',
        details: error.details || {}
      };
    }
  },

  /**
   * Registers a new user account with enhanced validation
   * @param credentials - New user registration credentials
   * @returns Authentication response for new user
   * @throws {AuthError} On registration failure
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      // Validate registration data
      if (!credentials.email || !credentials.password || 
          !credentials.firstName || !credentials.lastName) {
        throw new Error('Invalid registration data');
      }

      const response = await apiClient.post<AuthResponse>('/auth/register', credentials);

      // Store tokens for automatic login
      await storeTokens(response.data);

      return response.data;
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw {
        code: error.code || 'REGISTRATION_ERROR',
        message: error.message || 'Registration failed',
        details: error.details || {}
      };
    }
  },

  /**
   * Enhanced token refresh with validation and retry mechanism
   * @returns New authentication response with fresh tokens
   * @throws {AuthError} On refresh failure
   */
  async refreshToken(): Promise<AuthResponse> {
    try {
      const refreshToken = await getStoredRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<AuthResponse>('/auth/refresh', {
        refreshToken
      });

      await storeTokens(response.data);
      return response.data;
    } catch (error: any) {
      console.error('Token refresh failed:', error);
      await clearTokens();
      throw {
        code: error.code || 'REFRESH_ERROR',
        message: error.message || 'Token refresh failed',
        details: error.details || {}
      };
    }
  },

  /**
   * Securely logs out user and clears authentication state
   * @throws {AuthError} On logout failure
   */
  async logout(): Promise<void> {
    try {
      const token = await getStoredToken();
      if (token) {
        await apiClient.post('/auth/logout', {
          token
        });
      }
      await clearTokens();
    } catch (error: any) {
      console.error('Logout failed:', error);
      // Always clear tokens even if API call fails
      await clearTokens();
      throw {
        code: error.code || 'LOGOUT_ERROR',
        message: error.message || 'Logout failed',
        details: error.details || {}
      };
    }
  },

  /**
   * Verifies user's email address with security token
   * @param token - Email verification token
   * @throws {AuthError} On verification failure
   */
  async verifyEmail(token: string): Promise<void> {
    try {
      if (!token) {
        throw new Error('Invalid verification token');
      }

      await apiClient.post('/auth/verify-email', { token });
    } catch (error: any) {
      console.error('Email verification failed:', error);
      throw {
        code: error.code || 'VERIFICATION_ERROR',
        message: error.message || 'Email verification failed',
        details: error.details || {}
      };
    }
  },

  /**
   * Initiates secure password reset process
   * @param email - User's email address
   * @throws {AuthError} On reset initiation failure
   */
  async resetPassword(email: string): Promise<void> {
    try {
      if (!email) {
        throw new Error('Invalid email address');
      }

      await apiClient.post('/auth/reset-password', { email });
    } catch (error: any) {
      console.error('Password reset initiation failed:', error);
      throw {
        code: error.code || 'RESET_ERROR',
        message: error.message || 'Password reset failed',
        details: error.details || {}
      };
    }
  }
};

// Export authentication API client
export default authApi;