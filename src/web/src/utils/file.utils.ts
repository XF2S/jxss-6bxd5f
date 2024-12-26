/**
 * File Utility Module
 * Provides comprehensive file handling, validation, and formatting utilities
 * with strong security measures for the enrollment system web frontend
 * @module utils/file
 * @version 1.0.0
 */

import { Document } from '../types/document.types';
import CryptoJS from 'crypto-js'; // v4.1.1

// Constants for file handling
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

const MAX_FILE_SIZE_MB = 50;
const BYTES_PER_MB = 1048576;
const MAX_FILENAME_LENGTH = 255;
const INVALID_FILENAME_CHARS = /[/\\?%*:|"<>\[\]\{\},;=+]/g;

/**
 * Validation options interface for file validation
 */
interface ValidationOptions {
  strictMimeCheck?: boolean;
  allowedTypes?: string[];
  maxSizeMB?: number;
  validateContent?: boolean;
}

/**
 * Validation details interface for comprehensive validation results
 */
interface ValidationDetails {
  mimeType: string;
  fileSize: number;
  filename: string;
  extension: string;
  securityChecks: {
    mimeValid: boolean;
    sizeValid: boolean;
    nameValid: boolean;
    contentValid: boolean;
  };
}

/**
 * Format options interface for file size formatting
 */
interface FormatOptions {
  locale?: string;
  decimals?: number;
  binary?: boolean;
  spaceBetweenNumberAndUnit?: boolean;
}

/**
 * Sanitize options interface for filename sanitization
 */
interface SanitizeOptions {
  replacement?: string;
  lowercase?: boolean;
  addHash?: boolean;
  maxLength?: number;
}

/**
 * Validates a file against security and system constraints
 * @param file - The file to validate
 * @param options - Optional validation configuration
 * @returns Validation result with detailed information
 */
export const validateFile = (
  file: File,
  options: ValidationOptions = {}
): { isValid: boolean; error?: string; details?: ValidationDetails } => {
  try {
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    const maxSize = (options.maxSizeMB || MAX_FILE_SIZE_MB) * BYTES_PER_MB;
    const allowedTypes = options.allowedTypes || ALLOWED_MIME_TYPES;

    // Create validation details object
    const details: ValidationDetails = {
      mimeType: file.type,
      fileSize: file.size,
      filename: file.name,
      extension: getFileExtension(file.name),
      securityChecks: {
        mimeValid: false,
        sizeValid: false,
        nameValid: false,
        contentValid: false
      }
    };

    // Size validation
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        details
      };
    }
    details.securityChecks.sizeValid = true;

    // MIME type validation
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Invalid file type',
        details
      };
    }
    details.securityChecks.mimeValid = true;

    // Filename validation
    const sanitizedName = sanitizeFileName(file.name);
    if (sanitizedName !== file.name) {
      return {
        isValid: false,
        error: 'Filename contains invalid characters',
        details
      };
    }
    details.securityChecks.nameValid = true;

    // Deep content validation if requested
    if (options.validateContent) {
      // Additional content validation could be implemented here
      // For example, checking file headers or scanning for malicious content
    }
    details.securityChecks.contentValid = true;

    return { isValid: true, details };
  } catch (error) {
    return {
      isValid: false,
      error: 'File validation failed: ' + (error as Error).message
    };
  }
};

/**
 * Formats file size with localization support
 * @param bytes - File size in bytes
 * @param options - Formatting options
 * @returns Formatted file size string
 */
export const formatFileSize = (
  bytes: number,
  options: FormatOptions = {}
): string => {
  if (typeof bytes !== 'number' || isNaN(bytes)) {
    return '0 B';
  }

  const {
    locale = 'en-US',
    decimals = 2,
    binary = true,
    spaceBetweenNumberAndUnit = true
  } = options;

  const units = binary
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    : ['B', 'KB', 'MB', 'GB', 'TB'];
  
  const base = binary ? 1024 : 1000;
  const i = bytes === 0 ? 0 : Math.floor(Math.log(bytes) / Math.log(base));
  const value = bytes / Math.pow(base, i);

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  const space = spaceBetweenNumberAndUnit ? ' ' : '';
  return `${formatter.format(value)}${space}${units[i]}`;
};

/**
 * Extracts and validates file extension
 * @param filename - The filename to process
 * @returns Validated file extension
 */
export const getFileExtension = (filename: string): string => {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext.replace(INVALID_FILENAME_CHARS, '');
};

/**
 * Sanitizes filename for security
 * @param filename - The filename to sanitize
 * @param options - Sanitization options
 * @returns Sanitized filename
 */
export const sanitizeFileName = (
  filename: string,
  options: SanitizeOptions = {}
): string => {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  const {
    replacement = '-',
    lowercase = true,
    addHash = false,
    maxLength = MAX_FILENAME_LENGTH
  } = options;

  let sanitized = filename
    .replace(INVALID_FILENAME_CHARS, replacement)
    .trim();

  if (lowercase) {
    sanitized = sanitized.toLowerCase();
  }

  if (addHash) {
    const hash = CryptoJS.MD5(filename + Date.now()).toString().slice(0, 8);
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length - 1);
    sanitized = `${nameWithoutExt}-${hash}.${ext}`;
  }

  // Ensure the filename doesn't exceed maximum length
  if (sanitized.length > maxLength) {
    const ext = getFileExtension(sanitized);
    const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length - 1);
    const truncatedLength = maxLength - ext.length - 1;
    sanitized = `${nameWithoutExt.slice(0, truncatedLength)}.${ext}`;
  }

  return sanitized;
};

// Type guard for Document interface
export const isDocument = (obj: any): obj is Document => {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.mimeType === 'string' &&
    typeof obj.fileSize === 'number';
};