/**
 * @fileoverview Enhanced authentication controller implementing secure authentication flows
 * with advanced security features including device tracking, rate limiting, and MFA support.
 * Compliant with ISO 27001 and NIST 800-63B guidelines.
 * @version 1.0.0
 */

import { Request, Response } from 'express';
import { injectable } from 'inversify';
import httpStatus from 'http-status';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

import { authConfig } from '../config/auth.config';
import { JwtService } from '../services/jwt.service';
import { MfaService } from '../services/mfa.service';
import { verifyPassword } from '../../../shared/utils/src/encryption.util';
import { UserStatus, isValidEmail } from '../../../shared/models/src/user.model';

// Custom error types for better error handling
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Request body interfaces for type safety
interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  mfaToken?: string;
}

interface DeviceInfo {
  deviceId: string;
  userAgent: string;
  ipAddress: string;
  lastUsed: Date;
}

@injectable()
export class AuthController {
  private readonly jwtService: JwtService;
  private readonly mfaService: MfaService;
  private readonly loginRateLimiter: any;

  constructor(jwtService: JwtService, mfaService: MfaService) {
    this.jwtService = jwtService;
    this.mfaService = mfaService;

    // Configure rate limiting for login attempts
    this.loginRateLimiter = rateLimit({
      windowMs: authConfig.security.rateLimit.user.window * 1000,
      max: authConfig.security.rateLimit.user.max,
      message: 'Too many login attempts, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  /**
   * Handles user login with enhanced security features
   * @param req Express request object
   * @param res Express response object
   */
  public login = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { email, password, deviceId, mfaToken } = req.body as LoginRequest;

      // Input validation
      if (!email || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'Email and password are required'
        });
      }

      if (!isValidEmail(email)) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'Invalid email format'
        });
      }

      // Get user from database (implementation needed)
      const user = await this.getUserByEmail(email);

      // Check user status
      if (user.status !== UserStatus.ACTIVE) {
        return res.status(httpStatus.FORBIDDEN).json({
          error: 'Account is not active',
          status: user.status
        });
      }

      // Check account lockout
      if (user.failedLoginAttempts >= authConfig.password.maxAttempts) {
        return res.status(httpStatus.FORBIDDEN).json({
          error: 'Account is locked due to too many failed attempts'
        });
      }

      // Verify password with timing attack protection
      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        // Increment failed attempts
        user.failedLoginAttempts += 1;
        await this.updateUser(user);

        return res.status(httpStatus.UNAUTHORIZED).json({
          error: 'Invalid credentials'
        });
      }

      // Device tracking
      const deviceInfo: DeviceInfo = {
        deviceId: deviceId || uuidv4(),
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip,
        lastUsed: new Date()
      };

      // Handle MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaToken) {
          return res.status(httpStatus.BAD_REQUEST).json({
            error: 'MFA token required',
            requiresMfa: true
          });
        }

        const isMfaValid = await this.mfaService.verifyMfa(
          user,
          mfaToken,
          deviceInfo
        );

        if (!isMfaValid) {
          return res.status(httpStatus.UNAUTHORIZED).json({
            error: 'Invalid MFA token'
          });
        }
      }

      // Generate tokens
      const accessToken = await this.jwtService.generateAccessToken(user);
      const refreshToken = await this.jwtService.generateRefreshToken(user.id);

      // Reset failed attempts on successful login
      user.failedLoginAttempts = 0;
      user.lastLoginAt = new Date();
      await this.updateUser(user);

      // Set secure cookie with refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.status(httpStatus.OK).json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          mfaEnabled: user.mfaEnabled
        },
        deviceId: deviceInfo.deviceId
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Authentication failed'
      });
    }
  };

  /**
   * Handles MFA setup for users
   * @param req Express request object
   * @param res Express response object
   */
  public setupMfa = async (req: Request, res: Response): Promise<Response> => {
    try {
      const userId = req.user.id; // Set by auth middleware
      const user = await this.getUserById(userId);

      const deviceInfo: DeviceInfo = {
        deviceId: req.body.deviceId || uuidv4(),
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip,
        lastUsed: new Date()
      };

      const mfaSetup = await this.mfaService.setupMfa(user, deviceInfo);

      return res.status(httpStatus.OK).json({
        qrCode: mfaSetup.qrCode,
        backupCodes: mfaSetup.backupCodes,
        recoveryKey: mfaSetup.recoveryKey
      });
    } catch (error) {
      console.error('MFA setup error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to setup MFA'
      });
    }
  };

  /**
   * Handles user logout with token revocation
   * @param req Express request object
   * @param res Express response object
   */
  public logout = async (req: Request, res: Response): Promise<Response> => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        await this.jwtService.revokeToken(token, true);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return res.status(httpStatus.OK).json({
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Logout failed'
      });
    }
  };

  /**
   * Handles access token refresh
   * @param req Express request object
   * @param res Express response object
   */
  public refreshToken = async (req: Request, res: Response): Promise<Response> => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(httpStatus.UNAUTHORIZED).json({
          error: 'Refresh token required'
        });
      }

      const tokens = await this.jwtService.refreshAccessToken(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.status(httpStatus.OK).json({
        accessToken: tokens.accessToken
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(httpStatus.UNAUTHORIZED).json({
        error: 'Token refresh failed'
      });
    }
  };

  // Placeholder methods for user data access
  private async getUserByEmail(email: string) {
    throw new Error('Not implemented');
  }

  private async getUserById(id: string) {
    throw new Error('Not implemented');
  }

  private async updateUser(user: any) {
    throw new Error('Not implemented');
  }
}