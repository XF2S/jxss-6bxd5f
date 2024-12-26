// @package uuid v9.0.0
import { v4 as uuidv4 } from 'uuid';

/**
 * Defines the hierarchical user roles in the enrollment system.
 * Roles are ordered from highest (SUPER_ADMIN) to lowest (APPLICANT) privilege level.
 */
export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    STAFF = 'STAFF',
    REVIEWER = 'REVIEWER',
    APPLICANT = 'APPLICANT'
}

/**
 * Defines possible user account statuses with security implications.
 * Used for account lifecycle and security management.
 */
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    LOCKED = 'LOCKED', // Account locked due to security concerns
    PENDING_VERIFICATION = 'PENDING_VERIFICATION',
    PASSWORD_RESET_REQUIRED = 'PASSWORD_RESET_REQUIRED'
}

/**
 * Core user interface defining the structure and properties of a user in the system.
 * Implements Level 3 (Confidential) data classification with enhanced security measures.
 */
export interface IUser {
    /** Unique identifier for the user (UUID v4) */
    readonly id: string;

    /** User's email address (unique identifier for authentication) */
    readonly email: string;

    /** Argon2id password hash with salt */
    readonly passwordHash: string;

    /** User's first name */
    firstName: string;

    /** User's last name */
    lastName: string;

    /** Array of assigned roles determining user permissions */
    readonly roles: UserRole[];

    /** Current account status */
    status: UserStatus;

    /** Indicates if Multi-Factor Authentication is enabled */
    readonly mfaEnabled: boolean;

    /** TOTP secret for MFA (encrypted at rest) */
    readonly mfaSecret: string;

    /** Token for password reset functionality (null if not in reset process) */
    readonly passwordResetToken: string | null;

    /** Expiration timestamp for password reset token */
    readonly passwordResetExpiry: Date | null;

    /** Counter for failed login attempts (for account lockout) */
    failedLoginAttempts: number;

    /** Timestamp of last password change (for password expiry) */
    readonly lastPasswordChange: Date;

    /** Timestamp of last successful login */
    readonly lastLoginAt: Date;

    /** Account creation timestamp */
    readonly createdAt: Date;

    /** Last account update timestamp */
    readonly updatedAt: Date;
}

/**
 * Defines the structure of role-based permissions.
 * Maps roles to their allowed operations in the system.
 */
export interface IUserPermission {
    /** The role to which permissions are assigned */
    readonly role: UserRole;

    /** Array of permission strings defining allowed operations */
    readonly permissions: string[];
}

/**
 * Type guard to check if a string is a valid UserRole
 * @param role - String to validate as UserRole
 */
export const isValidUserRole = (role: string): role is UserRole => {
    return Object.values(UserRole).includes(role as UserRole);
};

/**
 * Type guard to check if a string is a valid UserStatus
 * @param status - String to validate as UserStatus
 */
export const isValidUserStatus = (status: string): status is UserStatus => {
    return Object.values(UserStatus).includes(status as UserStatus);
};

/**
 * Generates a new user ID using UUID v4
 * @returns A new UUID v4 string
 */
export const generateUserId = (): string => {
    return uuidv4();
};

/**
 * Validates an email address format
 * @param email - Email address to validate
 * @returns Boolean indicating if email format is valid
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};

/**
 * Default permission sets for each role
 * Defines the base permissions assigned to each role level
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: ['*'], // All permissions
    [UserRole.ADMIN]: [
        'user.read',
        'user.create',
        'user.update',
        'user.delete',
        'application.read',
        'application.process',
        'report.generate'
    ],
    [UserRole.STAFF]: [
        'user.read',
        'application.read',
        'application.process',
        'report.generate'
    ],
    [UserRole.REVIEWER]: [
        'application.read',
        'application.review'
    ],
    [UserRole.APPLICANT]: [
        'application.submit',
        'application.view.own',
        'document.upload'
    ]
};

/**
 * Security configuration constants for user management
 */
export const USER_SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 5,
    PASSWORD_RESET_EXPIRY_HOURS: 24,
    PASSWORD_MIN_LENGTH: 12,
    PASSWORD_EXPIRY_DAYS: 90,
    MFA_SECRET_LENGTH: 32,
    SESSION_TIMEOUT_MINUTES: 30
} as const;