/**
 * @fileoverview Frontend authentication configuration module
 * Implements comprehensive security settings and token management
 * for the enrollment system web application.
 * @version 1.0.0
 */

import { AuthResponse } from '@/types/auth.types';
import CryptoJS from 'crypto-js'; // v4.1.1
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // v3.4.0

// Environment variables with defaults
const VITE_AUTH_STORAGE_PREFIX = process.env.VITE_AUTH_STORAGE_PREFIX || 'enrollment_system';
const VITE_AUTH_TOKEN_EXPIRY = process.env.VITE_AUTH_TOKEN_EXPIRY || '1h';
const VITE_AUTH_ENCRYPTION_KEY = process.env.VITE_AUTH_ENCRYPTION_KEY || 'default_key';

/**
 * Authentication and security configuration object
 * Implements comprehensive security controls and authentication settings
 */
export const AUTH_CONFIG = {
  TOKEN_STORAGE_KEY: `${VITE_AUTH_STORAGE_PREFIX}_token`,
  REFRESH_TOKEN_STORAGE_KEY: `${VITE_AUTH_STORAGE_PREFIX}_refresh_token`,
  TOKEN_EXPIRY: VITE_AUTH_TOKEN_EXPIRY,
  STORAGE_TYPE: 'localStorage' as const,
  SESSION_PERSISTENCE: true,
  MFA_ENABLED: true,
  HARDWARE_KEY_ENABLED: true,

  PASSWORD_REQUIREMENTS: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    prohibitCommonWords: true,
    passwordHistory: 5,
    minUniqueChars: 8
  },

  LOGIN_ATTEMPTS: {
    max: 5,
    lockoutDuration: 1800, // 30 minutes in seconds
    progressiveDelay: true,
    ipTracking: true,
    notifyUserOnLockout: true
  },

  SECURITY_FEATURES: {
    tokenEncryption: true,
    browserFingerprinting: true,
    auditLogging: true,
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      timeWindow: 3600 // 1 hour in seconds
    },
    ipRestrictions: {
      enabled: true,
      allowlist: [],
      denylist: []
    }
  }
} as const;

// Initialize fingerprint instance
const fingerprintPromise = FingerprintJS.load();

/**
 * Retrieves and validates the stored authentication token
 * @returns Decrypted authentication token or null if invalid/not found
 */
export async function getStoredToken(): Promise<string | null> {
  try {
    const encryptedToken = window[AUTH_CONFIG.STORAGE_TYPE].getItem(AUTH_CONFIG.TOKEN_STORAGE_KEY);
    if (!encryptedToken) return null;

    // Verify browser fingerprint
    if (AUTH_CONFIG.SECURITY_FEATURES.browserFingerprinting) {
      const fp = await fingerprintPromise;
      const currentFingerprint = await fp.get();
      const storedFingerprint = window[AUTH_CONFIG.STORAGE_TYPE].getItem(`${VITE_AUTH_STORAGE_PREFIX}_fingerprint`);
      
      if (currentFingerprint.visitorId !== storedFingerprint) {
        console.error('Browser fingerprint mismatch');
        await clearTokens();
        return null;
      }
    }

    // Decrypt token
    const decryptedToken = CryptoJS.AES.decrypt(
      encryptedToken,
      VITE_AUTH_ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);

    if (!decryptedToken) return null;

    // Validate token structure and expiry
    try {
      const tokenData = JSON.parse(decryptedToken);
      if (new Date(tokenData.expiresAt) < new Date()) {
        await clearTokens();
        return null;
      }
      return tokenData.token;
    } catch {
      return null;
    }
  } catch (error) {
    console.error('Error retrieving stored token:', error);
    return null;
  }
}

/**
 * Retrieves and validates the stored refresh token
 * @returns Decrypted refresh token or null if invalid/not found
 */
export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    const encryptedRefreshToken = window[AUTH_CONFIG.STORAGE_TYPE].getItem(
      AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY
    );
    if (!encryptedRefreshToken) return null;

    // Verify browser fingerprint
    if (AUTH_CONFIG.SECURITY_FEATURES.browserFingerprinting) {
      const fp = await fingerprintPromise;
      const currentFingerprint = await fp.get();
      const storedFingerprint = window[AUTH_CONFIG.STORAGE_TYPE].getItem(`${VITE_AUTH_STORAGE_PREFIX}_fingerprint`);
      
      if (currentFingerprint.visitorId !== storedFingerprint) {
        console.error('Browser fingerprint mismatch');
        await clearTokens();
        return null;
      }
    }

    // Decrypt refresh token
    const decryptedRefreshToken = CryptoJS.AES.decrypt(
      encryptedRefreshToken,
      VITE_AUTH_ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);

    return decryptedRefreshToken || null;
  } catch (error) {
    console.error('Error retrieving stored refresh token:', error);
    return null;
  }
}

/**
 * Securely stores authentication tokens with encryption and fingerprinting
 * @param response Authentication response containing tokens
 */
export async function storeTokens(response: AuthResponse): Promise<void> {
  try {
    const { accessToken, refreshToken } = response;

    // Generate and store browser fingerprint
    if (AUTH_CONFIG.SECURITY_FEATURES.browserFingerprinting) {
      const fp = await fingerprintPromise;
      const fingerprint = await fp.get();
      window[AUTH_CONFIG.STORAGE_TYPE].setItem(
        `${VITE_AUTH_STORAGE_PREFIX}_fingerprint`,
        fingerprint.visitorId
      );
    }

    // Encrypt and store access token with expiry
    const tokenData = {
      token: accessToken,
      expiresAt: new Date(Date.now() + parseTokenExpiry(AUTH_CONFIG.TOKEN_EXPIRY))
    };
    const encryptedToken = CryptoJS.AES.encrypt(
      JSON.stringify(tokenData),
      VITE_AUTH_ENCRYPTION_KEY
    ).toString();
    window[AUTH_CONFIG.STORAGE_TYPE].setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, encryptedToken);

    // Encrypt and store refresh token
    const encryptedRefreshToken = CryptoJS.AES.encrypt(
      refreshToken,
      VITE_AUTH_ENCRYPTION_KEY
    ).toString();
    window[AUTH_CONFIG.STORAGE_TYPE].setItem(
      AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY,
      encryptedRefreshToken
    );

    // Log security audit event if enabled
    if (AUTH_CONFIG.SECURITY_FEATURES.auditLogging) {
      console.info('Authentication tokens stored securely');
    }
  } catch (error) {
    console.error('Error storing authentication tokens:', error);
    throw new Error('Failed to store authentication tokens securely');
  }
}

/**
 * Securely clears all authentication data from storage
 */
export async function clearTokens(): Promise<void> {
  try {
    // Remove all authentication-related items
    window[AUTH_CONFIG.STORAGE_TYPE].removeItem(AUTH_CONFIG.TOKEN_STORAGE_KEY);
    window[AUTH_CONFIG.STORAGE_TYPE].removeItem(AUTH_CONFIG.REFRESH_TOKEN_STORAGE_KEY);
    window[AUTH_CONFIG.STORAGE_TYPE].removeItem(`${VITE_AUTH_STORAGE_PREFIX}_fingerprint`);

    // Log security audit event if enabled
    if (AUTH_CONFIG.SECURITY_FEATURES.auditLogging) {
      console.info('Authentication tokens cleared successfully');
    }
  } catch (error) {
    console.error('Error clearing authentication tokens:', error);
    throw new Error('Failed to clear authentication tokens');
  }
}

/**
 * Parses token expiry string to milliseconds
 * @param expiry Token expiry string (e.g., '1h', '30m')
 * @returns Expiry in milliseconds
 */
function parseTokenExpiry(expiry: string): number {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1));
  
  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return 3600000; // Default 1 hour
  }
}