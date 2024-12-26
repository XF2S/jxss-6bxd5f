// @ts-check
import { z } from 'zod'; // v3.0.0
import { get, set } from 'lodash'; // v4.17.21
import { 
  ApplicationFormData, 
  PersonalInfo, 
  AcademicInfo, 
  ProgramInfo 
} from '../types/application.types';
import {
  VALIDATION_PATTERNS,
  VALIDATION_RULES,
  VALIDATION_MESSAGES,
  ValidationRule,
  getValidationMessage
} from '../constants/validation.constants';

/**
 * Interface for validation error object
 */
export interface ValidationError {
  fieldName: string;
  message: string;
}

// Global constants for date and phone formatting
const DATE_FORMAT = 'YYYY-MM-DD';
const PHONE_FORMAT = '+1-###-###-####';

/**
 * Validates a single form field against defined validation rules
 * @param fieldName - Name of the field to validate
 * @param value - Value to validate
 * @param rules - Validation rules to apply
 * @returns Error message if validation fails, null if passes
 */
export const validateField = async (
  fieldName: string,
  value: any,
  rules: ValidationRule
): Promise<string | null> => {
  try {
    // Required field check
    if (rules.required && !value) {
      return getValidationMessage(VALIDATION_MESSAGES.required, { field: fieldName });
    }

    // Pattern validation
    if (rules.pattern && value && !rules.pattern.test(value)) {
      return getValidationMessage(VALIDATION_MESSAGES.pattern, { field: fieldName });
    }

    // Length validations
    if (rules.minLength && String(value).length < rules.minLength) {
      return getValidationMessage(VALIDATION_MESSAGES.minLength, {
        field: fieldName,
        min: rules.minLength
      });
    }

    if (rules.maxLength && String(value).length > rules.maxLength) {
      return getValidationMessage(VALIDATION_MESSAGES.maxLength, {
        field: fieldName,
        max: rules.maxLength
      });
    }

    // Range validations
    if (rules.min !== undefined && Number(value) < rules.min) {
      return getValidationMessage(VALIDATION_MESSAGES.range, {
        field: fieldName,
        min: rules.min,
        max: rules.max
      });
    }

    if (rules.max !== undefined && Number(value) > rules.max) {
      return getValidationMessage(VALIDATION_MESSAGES.range, {
        field: fieldName,
        min: rules.min,
        max: rules.max
      });
    }

    // Custom validation
    if (rules.customValidator) {
      const isValid = await rules.customValidator(value);
      if (!isValid) {
        return rules.errorMessage as string || 
          getValidationMessage(VALIDATION_MESSAGES.pattern, { field: fieldName });
      }
    }

    return null;
  } catch (error) {
    console.error(`Validation error for field ${fieldName}:`, error);
    return 'An unexpected error occurred during validation';
  }
};

/**
 * Validates entire form data against defined validation rules
 * @param formData - Complete form data object to validate
 * @returns Object containing validation errors by field
 */
export const validateForm = async (
  formData: ApplicationFormData
): Promise<Record<string, string>> => {
  const errors: Record<string, string> = {};

  try {
    // Validate personal information
    for (const [field, rules] of Object.entries(VALIDATION_RULES.personalInfo)) {
      const value = get(formData.personalInfo, field);
      const error = await validateField(field, value, rules);
      if (error) {
        errors[`personalInfo.${field}`] = error;
      }
    }

    // Validate academic information
    for (const [field, rules] of Object.entries(VALIDATION_RULES.academicInfo)) {
      const value = get(formData.academicInfo, field);
      const error = await validateField(field, value, rules);
      if (error) {
        errors[`academicInfo.${field}`] = error;
      }
    }

    // Validate program information
    for (const [field, rules] of Object.entries(VALIDATION_RULES.programInfo)) {
      const value = get(formData.programInfo, field);
      const error = await validateField(field, value, rules);
      if (error) {
        errors[`programInfo.${field}`] = error;
      }
    }

    // Apply cross-field validations
    for (const [rule, validation] of Object.entries(VALIDATION_RULES.crossFieldRules)) {
      const isValid = await validation.customValidator(null, formData);
      if (!isValid) {
        errors[rule] = getValidationMessage(VALIDATION_MESSAGES[rule]);
      }
    }

    // Apply conditional validations
    for (const [field, getRule] of Object.entries(VALIDATION_RULES.conditionalRules)) {
      const rule = getRule(formData);
      const value = get(formData, field);
      const error = await validateField(field, value, rule);
      if (error) {
        errors[field] = error;
      }
    }

    return errors;
  } catch (error) {
    console.error('Form validation error:', error);
    throw new Error('Failed to validate form data');
  }
};

/**
 * Transforms raw form data into the required format for submission
 * @param rawFormData - Raw form data to transform
 * @returns Transformed and validated form data
 */
export const transformFormData = (
  rawFormData: Record<string, any>
): ApplicationFormData => {
  try {
    // Transform personal information
    const personalInfo: PersonalInfo = {
      firstName: String(rawFormData.personalInfo.firstName).trim(),
      lastName: String(rawFormData.personalInfo.lastName).trim(),
      email: String(rawFormData.personalInfo.email).toLowerCase().trim(),
      phone: formatPhoneNumber(rawFormData.personalInfo.phone),
      dateOfBirth: new Date(rawFormData.personalInfo.dateOfBirth),
      address: {
        street1: String(rawFormData.personalInfo.address.street1).trim(),
        street2: rawFormData.personalInfo.address.street2 ? 
          String(rawFormData.personalInfo.address.street2).trim() : null,
        city: String(rawFormData.personalInfo.address.city).trim(),
        state: String(rawFormData.personalInfo.address.state).trim(),
        zipCode: String(rawFormData.personalInfo.address.zipCode).trim(),
        country: String(rawFormData.personalInfo.address.country).trim()
      }
    };

    // Transform academic information
    const academicInfo: AcademicInfo = {
      previousInstitution: String(rawFormData.academicInfo.previousInstitution).trim(),
      gpa: Number(rawFormData.academicInfo.gpa),
      graduationDate: new Date(rawFormData.academicInfo.graduationDate),
      major: String(rawFormData.academicInfo.major).trim(),
      transcripts: rawFormData.academicInfo.transcripts.map(sanitizeDocument)
    };

    // Transform program information
    const programInfo: ProgramInfo = {
      programType: rawFormData.programInfo.programType,
      intendedMajor: String(rawFormData.programInfo.intendedMajor).trim(),
      startTerm: String(rawFormData.programInfo.startTerm).trim(),
      fullTime: Boolean(rawFormData.programInfo.fullTime),
      specializations: rawFormData.programInfo.specializations.map(
        (s: string) => String(s).trim()
      )
    };

    return {
      personalInfo,
      academicInfo,
      programInfo,
      documents: rawFormData.documents.map(sanitizeDocument),
      additionalInfo: sanitizeAdditionalInfo(rawFormData.additionalInfo)
    };
  } catch (error) {
    console.error('Form data transformation error:', error);
    throw new Error('Failed to transform form data');
  }
};

/**
 * Helper function to format phone numbers
 * @private
 */
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  // Format according to E.164 standard
  return cleaned.length === 10 ? `+1${cleaned}` : 
    cleaned.startsWith('1') ? `+${cleaned}` : `+${cleaned}`;
};

/**
 * Helper function to sanitize document objects
 * @private
 */
const sanitizeDocument = (doc: any) => ({
  id: String(doc.id),
  name: String(doc.name).trim(),
  type: String(doc.type).trim(),
  size: Number(doc.size),
  uploadedAt: new Date(doc.uploadedAt)
});

/**
 * Helper function to sanitize additional info
 * @private
 */
const sanitizeAdditionalInfo = (info: Record<string, unknown>): Record<string, unknown> => {
  return Object.entries(info).reduce((acc, [key, value]) => ({
    ...acc,
    [key]: typeof value === 'string' ? value.trim() : value
  }), {});
};