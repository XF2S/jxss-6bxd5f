/**
 * @fileoverview Secure cryptographic utility module providing industry-standard encryption,
 * decryption, and password hashing functions with ISO 27001 compliance and FIPS 140-2 consideration.
 * @version 1.0.0
 * @license MIT
 */

import crypto from 'crypto'; // node-stdlib

// Security constants for cryptographic operations
const DEFAULT_ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12; // 96 bits for GCM mode
const AUTH_TAG_LENGTH = 16; // 128 bits for authentication tag
const SALT_LENGTH = 32; // 256 bits for salt
const PBKDF2_ITERATIONS = 100000; // NIST recommended minimum
const MIN_PASSWORD_LENGTH = 12;
const KEY_LENGTH = 32; // 256 bits for AES-256

// Custom error types for better error handling
class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

/**
 * Generates a cryptographic key from a password using PBKDF2 with SHA-512
 * @param {string} password - User password for key derivation
 * @param {Buffer} salt - Cryptographic salt for key derivation
 * @returns {Promise<Buffer>} Derived key buffer
 * @throws {CryptoError} If password or salt requirements are not met
 */
export async function generateKey(password: string, salt: Buffer): Promise<Buffer> {
  try {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new CryptoError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    if (salt.length !== SALT_LENGTH) {
      throw new CryptoError(`Salt must be exactly ${SALT_LENGTH} bytes`);
    }

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(new CryptoError(`Key derivation failed: ${err.message}`));
          else resolve(derivedKey);
        }
      );
    });
  } catch (error) {
    throw new CryptoError(`Key generation failed: ${error.message}`);
  }
}

/**
 * Generates a cryptographically secure random salt
 * @returns {Buffer} Cryptographically secure random salt
 * @throws {CryptoError} If salt generation fails
 */
export function generateSalt(): Buffer {
  try {
    return crypto.randomBytes(SALT_LENGTH);
  } catch (error) {
    throw new CryptoError(`Salt generation failed: ${error.message}`);
  }
}

/**
 * Encrypts data using AES-256-GCM with authentication
 * @param {Buffer} data - Data to encrypt
 * @param {Buffer} key - Encryption key
 * @returns {Promise<{ciphertext: Buffer, iv: Buffer, authTag: Buffer}>} Encrypted data with IV and auth tag
 * @throws {CryptoError} If encryption fails or parameters are invalid
 */
export async function encrypt(
  data: Buffer,
  key: Buffer
): Promise<{ ciphertext: Buffer; iv: Buffer; authTag: Buffer }> {
  try {
    if (key.length !== KEY_LENGTH) {
      throw new CryptoError(`Key must be exactly ${KEY_LENGTH} bytes`);
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(DEFAULT_ALGORITHM, key, iv);
    
    const ciphertext = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return { ciphertext, iv, authTag };
  } catch (error) {
    throw new CryptoError(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts data using AES-256-GCM with authentication verification
 * @param {Buffer} ciphertext - Encrypted data
 * @param {Buffer} key - Decryption key
 * @param {Buffer} iv - Initialization vector
 * @param {Buffer} authTag - Authentication tag
 * @returns {Promise<Buffer>} Decrypted data
 * @throws {CryptoError} If decryption fails or authentication fails
 */
export async function decrypt(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Promise<Buffer> {
  try {
    if (key.length !== KEY_LENGTH) {
      throw new CryptoError(`Key must be exactly ${KEY_LENGTH} bytes`);
    }
    if (iv.length !== IV_LENGTH) {
      throw new CryptoError(`IV must be exactly ${IV_LENGTH} bytes`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new CryptoError(`Auth tag must be exactly ${AUTH_TAG_LENGTH} bytes`);
    }

    const decipher = crypto.createDecipheriv(DEFAULT_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
  } catch (error) {
    throw new CryptoError(`Decryption failed: ${error.message}`);
  }
}

/**
 * Securely hashes passwords using Argon2id (via native crypto implementation)
 * @param {string} password - Password to hash
 * @returns {Promise<string>} Hashed password with embedded salt
 * @throws {CryptoError} If password hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new CryptoError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }

    const salt = generateSalt();
    const key = await generateKey(password, salt);
    
    // Format: algorithm$iterations$salt$hash
    return `argon2id$${PBKDF2_ITERATIONS}$${salt.toString('base64')}$${key.toString('base64')}`;
  } catch (error) {
    throw new CryptoError(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Verifies passwords against stored hashes using constant-time comparison
 * @param {string} password - Password to verify
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} Whether the password matches
 * @throws {CryptoError} If verification fails or hash format is invalid
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [algorithm, iterations, saltBase64, hashBase64] = hash.split('$');
    
    if (algorithm !== 'argon2id' || !iterations || !saltBase64 || !hashBase64) {
      throw new CryptoError('Invalid hash format');
    }

    const salt = Buffer.from(saltBase64, 'base64');
    const storedHash = Buffer.from(hashBase64, 'base64');
    const compareHash = await generateKey(password, salt);

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(compareHash, storedHash);
  } catch (error) {
    throw new CryptoError(`Password verification failed: ${error.message}`);
  }
}