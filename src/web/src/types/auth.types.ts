/**
 * @fileoverview Authentication type definitions for the Enrollment System
 * Implements comprehensive types for authentication, authorization, and session management
 * with strict type safety and immutability.
 */

import { UserRole, UserStatus } from '@backend/shared/models/user.model';

/**
 * Login credentials interface with MFA support
 * Implements password-based authentication with optional TOTP verification
 */
export interface LoginCredentials {
  /** User's email address for authentication */
  readonly email: string;
  /** User's password (will be hashed using Argon2id) */
  readonly password: string;
  /** Optional MFA verification code (TOTP-based) */
  readonly mfaCode?: string;
  /** Flag to enable extended session duration */
  readonly rememberMe: boolean;
}

/**
 * Registration credentials interface with required user information
 * Enforces data requirements for new user account creation
 */
export interface RegisterCredentials {
  /** User's email address (must be unique) */
  readonly email: string;
  /** User's password (must meet complexity requirements) */
  readonly password: string;
  /** User's first name */
  readonly firstName: string;
  /** User's last name */
  readonly lastName: string;
  /** Terms and conditions acceptance flag */
  readonly acceptedTerms: boolean;
}

/**
 * User interface excluding sensitive data
 * Represents the authenticated user's public profile
 */
export interface User {
  /** Unique identifier (UUID v4) */
  readonly id: string;
  /** User's email address */
  readonly email: string;
  /** User's first name */
  readonly firstName: string;
  /** User's last name */
  readonly lastName: string;
  /** Array of assigned user roles */
  readonly roles: readonly UserRole[];
  /** Current account status */
  readonly status: UserStatus;
  /** Flag indicating if MFA is enabled */
  readonly mfaEnabled: boolean;
  /** Timestamp of last successful login */
  readonly lastLoginAt: Date;
  /** Account creation timestamp */
  readonly createdAt: Date;
}

/**
 * Authentication response interface
 * Contains JWT tokens and session information
 */
export interface AuthResponse {
  /** Authenticated user information */
  readonly user: User;
  /** JWT access token for API authorization */
  readonly accessToken: string;
  /** JWT refresh token for session renewal */
  readonly refreshToken: string;
  /** Flag indicating if MFA verification is required */
  readonly requiresMfa: boolean;
  /** Token expiration timestamp */
  readonly expiresAt: Date;
}

/**
 * Authentication state interface for frontend state management
 * Tracks authentication status and related UI states
 */
export interface AuthState {
  /** Flag indicating if user is authenticated */
  readonly isAuthenticated: boolean;
  /** Currently authenticated user (null if not authenticated) */
  readonly user: User | null;
  /** Flag indicating authentication operation in progress */
  readonly loading: boolean;
  /** Current authentication error (null if no error) */
  readonly error: AuthError | null;
  /** Flag indicating pending MFA verification */
  readonly mfaPending: boolean;
}

/**
 * Authentication error type
 * Provides structured error information for authentication failures
 */
export type AuthError = {
  /** Error code for programmatic handling */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Additional error context and details */
  readonly details: Record<string, unknown>;
};

/**
 * Password validation requirements type
 * Defines password complexity rules
 */
export type PasswordRequirements = {
  /** Minimum password length */
  readonly minLength: number;
  /** Requires uppercase characters */
  readonly requiresUppercase: boolean;
  /** Requires lowercase characters */
  readonly requiresLowercase: boolean;
  /** Requires numeric characters */
  readonly requiresNumbers: boolean;
  /** Requires special characters */
  readonly requiresSpecial: boolean;
};

/**
 * MFA configuration type
 * Defines multi-factor authentication settings
 */
export type MFAConfig = {
  /** TOTP code length */
  readonly codeLength: number;
  /** TOTP code validity duration in seconds */
  readonly validityDuration: number;
  /** Maximum allowed verification attempts */
  readonly maxAttempts: number;
};

/**
 * Session configuration type
 * Defines session management settings
 */
export type SessionConfig = {
  /** Access token validity duration in minutes */
  readonly accessTokenDuration: number;
  /** Refresh token validity duration in days */
  readonly refreshTokenDuration: number;
  /** Extended session duration in days (for "Remember Me") */
  readonly extendedSessionDuration: number;
};