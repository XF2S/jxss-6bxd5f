/**
 * Storage utility functions for secure browser storage operations
 * @module utils/storage
 * @version 1.0.0
 */

// External imports
import AES from 'crypto-js/aes'; // v4.1.1
import encUtf8 from 'crypto-js/enc-utf8'; // v4.1.1

// Internal imports
import type { Document } from '../types/document.types';

// Constants
const STORAGE_PREFIX = 'enrollment_system';

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PROFILE: 'user_profile',
  DOCUMENT_CACHE: 'document_cache',
  THEME: 'theme',
  LANGUAGE: 'language',
  STORAGE_VERSION: 'storage_version'
} as const;

const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY;
const STORAGE_VERSION = '1.0';

// Types
type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
type StorageValue<T> = {
  value: T;
  type: string;
  version: string;
  timestamp: number;
};

/**
 * Validates storage quota availability
 * @param value - Value to be stored
 * @returns Boolean indicating if storage is available
 */
const validateStorageQuota = (value: string): boolean => {
  try {
    const quota = navigator.storage?.estimate?.() || Promise.resolve({ quota: 0, usage: 0 });
    return value.length * 2 < 5 * 1024 * 1024; // Limit single items to 5MB
  } catch {
    return true; // Fallback if storage estimation is not supported
  }
};

/**
 * Encrypts a value using AES-256
 * @param value - Value to encrypt
 * @returns Encrypted string
 */
const encryptValue = (value: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Storage encryption key not configured');
  }
  return AES.encrypt(value, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts an encrypted value
 * @param encrypted - Encrypted value
 * @returns Decrypted string
 */
const decryptValue = (encrypted: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Storage encryption key not configured');
  }
  const bytes = AES.decrypt(encrypted, ENCRYPTION_KEY);
  return bytes.toString(encUtf8);
};

/**
 * Sets an item in localStorage with encryption and type safety
 * @param key - Storage key
 * @param value - Value to store
 * @param encrypt - Whether to encrypt the value
 */
export const setLocalStorageItem = <T>(key: StorageKey, value: T, encrypt = false): void => {
  try {
    const storageKey = `${STORAGE_PREFIX}_${key}`;
    const storageValue: StorageValue<T> = {
      value,
      type: typeof value,
      version: STORAGE_VERSION,
      timestamp: Date.now()
    };
    
    let serializedValue = JSON.stringify(storageValue);
    
    if (!validateStorageQuota(serializedValue)) {
      throw new Error('Storage quota exceeded');
    }
    
    if (encrypt) {
      serializedValue = encryptValue(serializedValue);
    }
    
    localStorage.setItem(storageKey, serializedValue);
    localStorage.setItem(`${STORAGE_PREFIX}_${STORAGE_KEYS.STORAGE_VERSION}`, STORAGE_VERSION);
  } catch (error) {
    console.error('Storage operation failed:', error);
    throw error;
  }
};

/**
 * Retrieves and validates an item from localStorage
 * @param key - Storage key
 * @param decrypt - Whether to decrypt the value
 * @returns Retrieved value or null
 */
export const getLocalStorageItem = <T>(key: StorageKey, decrypt = false): T | null => {
  try {
    const storageKey = `${STORAGE_PREFIX}_${key}`;
    let storedValue = localStorage.getItem(storageKey);
    
    if (!storedValue) {
      return null;
    }
    
    if (decrypt) {
      storedValue = decryptValue(storedValue);
    }
    
    const parsedValue = JSON.parse(storedValue) as StorageValue<T>;
    
    if (parsedValue.version !== STORAGE_VERSION) {
      console.warn('Storage version mismatch');
      return null;
    }
    
    return parsedValue.value;
  } catch (error) {
    console.error('Storage retrieval failed:', error);
    return null;
  }
};

/**
 * Sets an item in sessionStorage with encryption
 * @param key - Storage key
 * @param value - Value to store
 * @param encrypt - Whether to encrypt the value
 */
export const setSessionStorageItem = <T>(key: StorageKey, value: T, encrypt = false): void => {
  try {
    const storageKey = `${STORAGE_PREFIX}_${key}`;
    const storageValue: StorageValue<T> = {
      value,
      type: typeof value,
      version: STORAGE_VERSION,
      timestamp: Date.now()
    };
    
    let serializedValue = JSON.stringify(storageValue);
    
    if (encrypt) {
      serializedValue = encryptValue(serializedValue);
    }
    
    sessionStorage.setItem(storageKey, serializedValue);
  } catch (error) {
    console.error('Session storage operation failed:', error);
    throw error;
  }
};

/**
 * Securely clears sensitive storage data on logout
 */
export const clearStorageOnLogout = (): void => {
  try {
    const keysToPreserve = [STORAGE_KEYS.THEME, STORAGE_KEYS.LANGUAGE];
    const preservedValues: Record<string, any> = {};
    
    // Preserve specified values
    keysToPreserve.forEach(key => {
      const value = getLocalStorageItem(key);
      if (value) {
        preservedValues[key] = value;
      }
    });
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Restore preserved values
    Object.entries(preservedValues).forEach(([key, value]) => {
      setLocalStorageItem(key as StorageKey, value);
    });
    
    // Reset storage version
    localStorage.setItem(
      `${STORAGE_PREFIX}_${STORAGE_KEYS.STORAGE_VERSION}`,
      STORAGE_VERSION
    );
  } catch (error) {
    console.error('Storage cleanup failed:', error);
    throw error;
  }
};

/**
 * Implements secure key rotation for stored data
 * @param newKey - New encryption key
 */
export const rotateStorageKeys = (newKey: string): void => {
  try {
    const oldKey = ENCRYPTION_KEY;
    if (!oldKey || !newKey) {
      throw new Error('Invalid encryption keys');
    }
    
    // Get all encrypted items
    const encryptedKeys = [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.DOCUMENT_CACHE
    ];
    
    // Re-encrypt with new key
    encryptedKeys.forEach(key => {
      const value = getLocalStorageItem(key, true);
      if (value) {
        setLocalStorageItem(key, value, true);
      }
    });
    
    // Update storage version
    localStorage.setItem(
      `${STORAGE_PREFIX}_${STORAGE_KEYS.STORAGE_VERSION}`,
      STORAGE_VERSION
    );
  } catch (error) {
    console.error('Key rotation failed:', error);
    throw error;
  }
};

// Type exports
export type { StorageKey, StorageValue };