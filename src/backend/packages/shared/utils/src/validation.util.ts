// External imports with versions
import { z } from 'zod'; // v3.0.0
import validator from 'validator'; // v13.0.0
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js'; // v1.10.0

// Internal imports
import { ApplicationStatus, ApplicationSchema } from '../models/application.model';
import { Logger } from './logger.util';

// Initialize logger
const logger = new Logger('ValidationUtil');

// Constants for validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
  PHONE: '^\\+?[1-9]\\d{1,14}$',
  NAME: "^[\\p{L}\\s'-]{2,50}$",
  STUDENT_ID: '^[A-Z0-9]{8,12}$',
  INTERNATIONAL_STUDENT_ID: '^[A-Z0-9-]{8,15}$'
};

// Constants for file validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Cache TTL for validation results
const VALIDATION_CACHE_TTL = 3600; // 1 hour

// Interfaces
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  details?: Record<string, any>;
  timestamp: Date;
}

interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  hash?: string;
}

/**
 * Validates email format and performs enhanced domain verification
 * @param email - Email address to validate
 * @returns Promise<ValidationResult>
 */
export async function validateEmail(email: string): Promise<ValidationResult> {
  try {
    logger.debug('Validating email', { email: email.toLowerCase() });

    const emailRegex = new RegExp(VALIDATION_PATTERNS.EMAIL);
    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        errors: ['Invalid email format'],
        timestamp: new Date()
      };
    }

    // Basic validation using validator
    if (!validator.isEmail(email)) {
      return {
        isValid: false,
        errors: ['Invalid email address'],
        timestamp: new Date()
      };
    }

    // Check for disposable email providers
    if (await validator.isDisposableEmail(email)) {
      return {
        isValid: false,
        errors: ['Disposable email addresses are not allowed'],
        timestamp: new Date()
      };
    }

    return {
      isValid: true,
      errors: [],
      details: {
        normalizedEmail: email.toLowerCase(),
        domain: email.split('@')[1]
      },
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Email validation error', error, { email });
    throw error;
  }
}

/**
 * Validates phone number format using E.164 standard
 * @param phone - Phone number to validate
 * @param countryCode - ISO country code
 * @returns ValidationResult
 */
export function validatePhone(phone: string, countryCode: string): ValidationResult {
  try {
    logger.debug('Validating phone number', { phone, countryCode });

    if (!phone || !countryCode) {
      return {
        isValid: false,
        errors: ['Phone number and country code are required'],
        timestamp: new Date()
      };
    }

    const phoneNumber = parsePhoneNumber(phone, countryCode);
    
    if (!phoneNumber || !isValidPhoneNumber(phone, countryCode)) {
      return {
        isValid: false,
        errors: ['Invalid phone number for specified country'],
        timestamp: new Date()
      };
    }

    return {
      isValid: true,
      errors: [],
      details: {
        e164Format: phoneNumber.format('E.164'),
        countryCode: phoneNumber.country,
        nationalFormat: phoneNumber.format('NATIONAL')
      },
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Phone validation error', error, { phone, countryCode });
    throw error;
  }
}

/**
 * Validates document metadata and content
 * @param documentMetadata - Document metadata object
 * @returns Promise<ValidationResult>
 */
export async function validateDocument(documentMetadata: DocumentMetadata): Promise<ValidationResult> {
  try {
    logger.debug('Validating document', { fileName: documentMetadata.fileName });

    const errors: string[] = [];

    // Validate file size
    if (documentMetadata.fileSize > MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(documentMetadata.mimeType)) {
      errors.push('File type not allowed');
    }

    // Additional security checks
    if (documentMetadata.fileName.includes('..')) {
      errors.push('Invalid file name');
    }

    return {
      isValid: errors.length === 0,
      errors,
      details: {
        fileSize: documentMetadata.fileSize,
        mimeType: documentMetadata.mimeType,
        hash: documentMetadata.hash
      },
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Document validation error', error, { documentMetadata });
    throw error;
  }
}

/**
 * Validates complete enrollment application data
 * @param applicationData - Application data object
 * @returns Promise<ValidationResult>
 */
export async function validateApplication(applicationData: Record<string, any>): Promise<ValidationResult> {
  try {
    logger.debug('Validating application data', { applicationId: applicationData.id });

    // Validate against Zod schema
    try {
      ApplicationSchema.parse(applicationData);
    } catch (zodError) {
      return {
        isValid: false,
        errors: zodError.errors.map((e: any) => e.message),
        timestamp: new Date()
      };
    }

    const errors: string[] = [];
    
    // Validate required documents based on application type
    if (applicationData.programDetails?.programType === 'International') {
      const requiredDocs = ['passport', 'visa', 'transcripts'];
      const uploadedDocTypes = applicationData.documents?.map((doc: any) => doc.type) || [];
      
      requiredDocs.forEach(docType => {
        if (!uploadedDocTypes.includes(docType)) {
          errors.push(`Missing required document: ${docType}`);
        }
      });
    }

    // Validate status transitions
    if (applicationData.status) {
      const currentStatus = applicationData.currentStatus || ApplicationStatus.DRAFT;
      const newStatus = applicationData.status;
      
      if (!isValidStatusTransition(currentStatus, newStatus)) {
        errors.push(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      details: {
        applicationId: applicationData.id,
        programType: applicationData.programDetails?.programType,
        documentsCount: applicationData.documents?.length || 0
      },
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Application validation error', error, { applicationId: applicationData.id });
    throw error;
  }
}

/**
 * Helper function to validate status transitions
 * @param currentStatus - Current application status
 * @param newStatus - New application status
 * @returns boolean
 */
function isValidStatusTransition(currentStatus: ApplicationStatus, newStatus: ApplicationStatus): boolean {
  const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
    [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED, ApplicationStatus.WITHDRAWN],
    [ApplicationStatus.SUBMITTED]: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WITHDRAWN],
    [ApplicationStatus.UNDER_REVIEW]: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
    [ApplicationStatus.APPROVED]: [ApplicationStatus.WITHDRAWN],
    [ApplicationStatus.REJECTED]: [ApplicationStatus.WITHDRAWN],
    [ApplicationStatus.WITHDRAWN]: []
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}