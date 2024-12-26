/**
 * @fileoverview Enhanced JWT service implementing secure token management with
 * advanced security features including token blacklisting, rotation, and strict validation.
 * Compliant with ISO 27001 and NIST security guidelines.
 * @version 1.0.0
 */

import { sign, verify, JwtPayload } from 'jsonwebtoken'; // v9.0.0
import Redis from 'ioredis'; // v5.3.0
import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { authConfig } from '../config/auth.config';
import { UserRole, IUser } from '../../shared/models/src/user.model';

/**
 * Extended JWT payload interface with additional security claims
 */
interface EnhancedJwtPayload extends JwtPayload {
  id: string;
  email: string;
  roles: UserRole[];
  deviceId?: string;
  sessionId?: string;
}

/**
 * Token metadata for enhanced security tracking
 */
interface TokenMetadata {
  userId: string;
  deviceId?: string;
  issuedAt: number;
  expiresAt: number;
  rotationCount: number;
}

@injectable()
export class JwtService {
  private readonly redisClient: Redis;
  private readonly refreshAttempts: Map<string, number>;
  private readonly TOKEN_PREFIX = 'token:';
  private readonly BLACKLIST_PREFIX = 'blacklist:';
  private readonly MAX_REFRESH_ATTEMPTS = 5;
  private readonly REFRESH_WINDOW = 300; // 5 minutes in seconds

  constructor() {
    // Initialize Redis client with retry strategy
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => Math.min(times * 50, 2000)
    });

    this.refreshAttempts = new Map();

    // Set up error handling for Redis connection
    this.redisClient.on('error', (error) => {
      console.error('Redis connection error:', error);
      // Implement error reporting/monitoring here
    });
  }

  /**
   * Generates a new JWT access token with enhanced security features
   * @param user - User object containing authentication claims
   * @returns Promise resolving to signed JWT access token
   * @throws Error if token generation fails
   */
  public async generateAccessToken(user: IUser): Promise<string> {
    try {
      const tokenId = uuidv4();
      const now = Math.floor(Date.now() / 1000);

      const payload: EnhancedJwtPayload = {
        id: user.id,
        email: user.email,
        roles: user.roles,
        iss: authConfig.jwt.issuer,
        aud: authConfig.jwt.audience,
        sub: user.id,
        jti: tokenId,
        iat: now,
        exp: now + parseInt(authConfig.jwt.accessTokenExpiry),
        nbf: now
      };

      const token = sign(payload, authConfig.jwt.privateKey, {
        algorithm: authConfig.jwt.algorithm,
        header: {
          typ: 'JWT',
          alg: authConfig.jwt.algorithm
        }
      });

      // Store token metadata
      await this.storeTokenMetadata(tokenId, {
        userId: user.id,
        issuedAt: now,
        expiresAt: payload.exp,
        rotationCount: 0
      });

      return token;
    } catch (error) {
      throw new Error(`Access token generation failed: ${error.message}`);
    }
  }

  /**
   * Generates a new refresh token with rotation and storage
   * @param userId - User ID for refresh token
   * @returns Promise resolving to signed refresh token
   * @throws Error if token generation fails
   */
  public async generateRefreshToken(userId: string): Promise<string> {
    try {
      const tokenId = uuidv4();
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = parseInt(authConfig.jwt.refreshTokenExpiry);

      const payload = {
        sub: userId,
        jti: tokenId,
        iat: now,
        exp: now + expiresIn,
        type: 'refresh'
      };

      const token = sign(payload, authConfig.jwt.privateKey, {
        algorithm: authConfig.jwt.algorithm
      });

      // Store refresh token metadata with TTL
      await this.redisClient.setex(
        `${this.TOKEN_PREFIX}refresh:${tokenId}`,
        expiresIn,
        JSON.stringify({ userId, issuedAt: now, expiresAt: payload.exp })
      );

      return token;
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error.message}`);
    }
  }

  /**
   * Verifies and validates a JWT token with enhanced security checks
   * @param token - JWT token to verify
   * @returns Promise resolving to verified token payload
   * @throws Error if token is invalid or verification fails
   */
  public async verifyToken(token: string): Promise<JwtPayload> {
    try {
      // Basic token format validation
      if (!token || !token.includes('.')) {
        throw new Error('Invalid token format');
      }

      // Verify token signature and decode payload
      const decoded = verify(token, authConfig.jwt.publicKey, {
        algorithms: [authConfig.jwt.algorithm],
        issuer: authConfig.jwt.issuer,
        audience: authConfig.jwt.audience
      }) as JwtPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.redisClient.exists(
        `${this.BLACKLIST_PREFIX}${decoded.jti}`
      );
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Validate token metadata
      await this.validateTokenMetadata(decoded.jti!, decoded.sub!);

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Revokes tokens with blacklisting support
   * @param tokenId - ID of token to revoke
   * @param blacklist - Whether to blacklist the token
   * @returns Promise resolving when token is revoked
   */
  public async revokeToken(tokenId: string, blacklist: boolean = true): Promise<void> {
    try {
      // Remove token metadata
      await this.redisClient.del(`${this.TOKEN_PREFIX}${tokenId}`);

      if (blacklist) {
        // Add to blacklist with TTL from config
        await this.redisClient.setex(
          `${this.BLACKLIST_PREFIX}${tokenId}`,
          authConfig.jwt.blacklist.ttl,
          '1'
        );
      }
    } catch (error) {
      throw new Error(`Token revocation failed: ${error.message}`);
    }
  }

  /**
   * Refreshes access token with refresh token rotation
   * @param refreshToken - Current refresh token
   * @returns Promise resolving to new token pair
   * @throws Error if refresh operation fails
   */
  public async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const decoded = await this.verifyToken(refreshToken);
      
      // Validate refresh token type
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Apply rate limiting for refresh operations
      const attempts = this.refreshAttempts.get(decoded.sub!) || 0;
      if (attempts >= this.MAX_REFRESH_ATTEMPTS) {
        throw new Error('Refresh rate limit exceeded');
      }
      this.refreshAttempts.set(decoded.sub!, attempts + 1);

      // Generate new token pair
      const user = await this.getUserById(decoded.sub!);
      const accessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user.id);

      // Revoke old refresh token
      await this.revokeToken(decoded.jti!, true);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Stores token metadata in Redis
   * @param tokenId - Token ID
   * @param metadata - Token metadata
   */
  private async storeTokenMetadata(
    tokenId: string,
    metadata: TokenMetadata
  ): Promise<void> {
    await this.redisClient.setex(
      `${this.TOKEN_PREFIX}${tokenId}`,
      metadata.expiresAt - metadata.issuedAt,
      JSON.stringify(metadata)
    );
  }

  /**
   * Validates token metadata from Redis
   * @param tokenId - Token ID
   * @param userId - User ID
   * @throws Error if validation fails
   */
  private async validateTokenMetadata(
    tokenId: string,
    userId: string
  ): Promise<void> {
    const metadata = await this.redisClient.get(`${this.TOKEN_PREFIX}${tokenId}`);
    if (!metadata) {
      throw new Error('Token metadata not found');
    }

    const parsed = JSON.parse(metadata) as TokenMetadata;
    if (parsed.userId !== userId) {
      throw new Error('Token user mismatch');
    }
  }

  /**
   * Retrieves user by ID (implementation placeholder)
   * @param userId - User ID
   * @returns Promise resolving to user object
   */
  private async getUserById(userId: string): Promise<IUser> {
    // Implementation should be replaced with actual user service call
    throw new Error('Not implemented');
  }
}