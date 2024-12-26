/**
 * @fileoverview User model implementation with comprehensive security features including
 * password hashing, MFA support, role-based access control, and enhanced security tracking.
 * Compliant with ISO 27001 and NIST 800-63B guidelines.
 * @version 1.0.0
 */

import { Schema, model, Document } from 'mongoose'; // v7.0.0
import { authenticator } from 'otplib'; // v12.0.0
import { IUser, UserRole, UserStatus } from '../../shared/models/src/user.model';
import { hashPassword, verifyPassword } from '../../shared/utils/src/encryption.util';
import { authConfig } from '../config/auth.config';
import crypto from 'crypto';

/**
 * Extended user interface for Mongoose document with security features
 */
interface IUserDocument extends IUser, Document {
  passwordHistory: string[];
  mfaBackupCodes: string[];
  mfaDevices: Array<{ id: string; name: string; lastUsed: Date }>;
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  lastLoginIP: string;
  
  setPassword(password: string): Promise<void>;
  verifyPassword(password: string): Promise<boolean>;
  setupMFA(): Promise<{ secret: string; backupCodes: string[] }>;
  verifyMFAToken(token: string, deviceInfo?: { name: string }): Promise<boolean>;
  trackLoginAttempt(success: boolean, ipAddress: string): Promise<void>;
  rotateBackupCodes(): Promise<string[]>;
}

/**
 * Mongoose schema for user model with comprehensive security features
 */
const UserSchema = new Schema<IUserDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    passwordHistory: {
      type: [String],
      default: [],
      select: false,
    },
    lastPasswordChange: {
      type: Date,
      required: true,
      default: Date.now,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    roles: {
      type: [String],
      enum: Object.values(UserRole),
      required: true,
      default: [UserRole.APPLICANT],
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      required: true,
      default: UserStatus.PENDING_VERIFICATION,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    mfaBackupCodes: {
      type: [String],
      select: false,
    },
    mfaDevices: {
      type: [{
        id: String,
        name: String,
        lastUsed: Date,
      }],
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: Date,
    lastLoginIP: String,
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

/**
 * Sets user password with secure hashing and history tracking
 */
UserSchema.methods.setPassword = async function(password: string): Promise<void> {
  // Validate password complexity
  const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecialChars } = authConfig.password;
  if (password.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long`);
  }
  if (requireUppercase && !/[A-Z]/.test(password)) {
    throw new Error('Password must contain uppercase letters');
  }
  if (requireLowercase && !/[a-z]/.test(password)) {
    throw new Error('Password must contain lowercase letters');
  }
  if (requireNumbers && !/\d/.test(password)) {
    throw new Error('Password must contain numbers');
  }
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    throw new Error('Password must contain special characters');
  }

  // Check password history
  if (this.passwordHistory.length > 0) {
    for (const oldHash of this.passwordHistory) {
      if (await verifyPassword(password, oldHash)) {
        throw new Error('Password has been used recently');
      }
    }
  }

  // Hash new password and update history
  const newHash = await hashPassword(password);
  this.passwordHash = newHash;
  this.passwordHistory.push(newHash);
  if (this.passwordHistory.length > authConfig.password.history.size) {
    this.passwordHistory.shift();
  }
  this.lastPasswordChange = new Date();
};

/**
 * Verifies password and manages login attempts
 */
UserSchema.methods.verifyPassword = async function(password: string): Promise<boolean> {
  // Check account lockout
  if (this.lockoutUntil && this.lockoutUntil > new Date()) {
    throw new Error('Account is temporarily locked');
  }

  const isValid = await verifyPassword(password, this.passwordHash);
  await this.trackLoginAttempt(isValid, '');
  return isValid;
};

/**
 * Sets up multi-factor authentication with backup codes
 */
UserSchema.methods.setupMFA = async function(): Promise<{ secret: string; backupCodes: string[] }> {
  const secret = authenticator.generateSecret(authConfig.mfa.backupCodes.length);
  const backupCodes = Array.from({ length: authConfig.mfa.backupCodes.count }, () =>
    crypto.randomBytes(authConfig.mfa.backupCodes.length).toString('hex')
  );

  this.mfaSecret = secret;
  this.mfaBackupCodes = await Promise.all(backupCodes.map(code => hashPassword(code)));
  this.mfaEnabled = true;

  return { secret, backupCodes };
};

/**
 * Verifies MFA token and manages device tracking
 */
UserSchema.methods.verifyMFAToken = async function(
  token: string,
  deviceInfo?: { name: string }
): Promise<boolean> {
  if (!this.mfaEnabled || !this.mfaSecret) {
    throw new Error('MFA is not enabled');
  }

  const isValid = authenticator.verify({
    token,
    secret: this.mfaSecret,
  });

  if (isValid && deviceInfo) {
    const deviceId = crypto.randomBytes(16).toString('hex');
    this.mfaDevices.push({
      id: deviceId,
      name: deviceInfo.name,
      lastUsed: new Date(),
    });

    // Maintain device limit
    if (this.mfaDevices.length > authConfig.mfa.deviceTracking.maxDevices) {
      this.mfaDevices.shift();
    }
  }

  return isValid;
};

/**
 * Tracks failed login attempts and manages lockouts
 */
UserSchema.methods.trackLoginAttempt = async function(
  success: boolean,
  ipAddress: string
): Promise<void> {
  if (success) {
    this.failedLoginAttempts = 0;
    this.lockoutUntil = null;
    this.lastLoginAt = new Date();
    this.lastLoginIP = ipAddress;
  } else {
    this.failedLoginAttempts += 1;
    if (this.failedLoginAttempts >= authConfig.password.maxAttempts) {
      this.lockoutUntil = new Date(Date.now() + authConfig.password.lockoutDuration * 1000);
      this.status = UserStatus.LOCKED;
    }
  }
};

/**
 * Generates new MFA backup codes
 */
UserSchema.methods.rotateBackupCodes = async function(): Promise<string[]> {
  const newBackupCodes = Array.from({ length: authConfig.mfa.backupCodes.count }, () =>
    crypto.randomBytes(authConfig.mfa.backupCodes.length).toString('hex')
  );

  this.mfaBackupCodes = await Promise.all(newBackupCodes.map(code => hashPassword(code)));
  return newBackupCodes;
};

// Create and export the User model
export const User = model<IUserDocument>('User', UserSchema);