/**
 * @fileoverview Authentication service configuration module implementing comprehensive
 * security parameters, JWT settings, and advanced security controls in compliance with
 * ISO 27001 and NIST 800-63B guidelines.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { authenticator } from 'otplib'; // v12.0.0
import { hashPassword, verifyPassword } from '../../shared/utils/src/encryption.util';
import { UserRole } from '../../shared/models/src/user.model';

// Load environment variables
config();

// JWT Configuration Constants
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
const SESSION_ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY;
const MFA_ISSUER = process.env.MFA_ISSUER || 'Enrollment System';

// Configure TOTP settings for MFA
authenticator.options = {
  algorithm: 'sha512',
  digits: 6,
  step: 30,
  window: 1
};

/**
 * Comprehensive authentication configuration object implementing
 * multi-layered security controls and enhanced session management.
 */
export const authConfig = {
  /**
   * JWT configuration with RSA-256 signatures and token rotation
   */
  jwt: {
    publicKey: JWT_PUBLIC_KEY,
    privateKey: JWT_PRIVATE_KEY,
    algorithm: 'RS256' as const,
    accessTokenExpiry: JWT_EXPIRY,
    refreshTokenExpiry: REFRESH_TOKEN_EXPIRY,
    issuer: 'enrollment-system',
    audience: 'enrollment-api',
    rotation: {
      enabled: true,
      interval: '24h' // Key rotation interval
    },
    blacklist: {
      enabled: true,
      ttl: 86400 // 24 hours in seconds
    }
  },

  /**
   * Session management with Redis backing and encryption
   */
  session: {
    store: 'redis' as const,
    prefix: 'sess:',
    ttl: 86400, // 24 hours in seconds
    rolling: true, // Extend session on activity
    secure: true, // Require HTTPS
    httpOnly: true,
    sameSite: 'strict' as const,
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      key: SESSION_ENCRYPTION_KEY
    },
    fixation: {
      regenerate: true,
      interval: 3600 // Regenerate session hourly
    }
  },

  /**
   * Multi-Factor Authentication configuration
   */
  mfa: {
    issuer: MFA_ISSUER,
    algorithm: 'SHA512' as const,
    digits: 6,
    step: 30, // TOTP step size in seconds
    window: 1, // Allowed windows for validation
    backupCodes: {
      count: 10,
      length: 16
    },
    rateLimit: {
      attempts: 3,
      window: 300 // 5 minutes in seconds
    },
    deviceTracking: {
      enabled: true,
      maxDevices: 5
    }
  },

  /**
   * Password policy configuration with NIST 800-63B compliance
   */
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAttempts: 5,
    lockoutDuration: 1800, // 30 minutes in seconds
    history: {
      enabled: true,
      size: 5 // Remember last 5 passwords
    }
  },

  /**
   * Additional security controls and restrictions
   */
  security: {
    rateLimit: {
      ip: {
        window: 3600, // 1 hour in seconds
        max: 1000 // Maximum requests per IP
      },
      user: {
        window: 3600,
        max: 100 // Maximum requests per user
      }
    },
    geofencing: {
      enabled: true,
      allowedCountries: ['US', 'CA']
    },
    audit: {
      enabled: true,
      retention: '90d' // Audit log retention period
    }
  }
} as const;

// Type definitions for enhanced type safety
export type AuthConfig = typeof authConfig;
export type JWTConfig = typeof authConfig.jwt;
export type SessionConfig = typeof authConfig.session;
export type MFAConfig = typeof authConfig.mfa;
export type PasswordConfig = typeof authConfig.password;
export type SecurityConfig = typeof authConfig.security;

// Validate critical configuration at startup
(() => {
  if (!JWT_PUBLIC_KEY || !JWT_PRIVATE_KEY) {
    throw new Error('JWT keys must be configured');
  }
  if (!SESSION_ENCRYPTION_KEY) {
    throw new Error('Session encryption key must be configured');
  }
})();