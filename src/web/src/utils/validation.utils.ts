// @ts-check
import { z } from 'zod'; // v3.0.0
import { isDate, isNumber, isString, memoize } from 'lodash'; // v4.17.21
import { parsePhoneNumberFromString } from 'libphonenumber-js'; // v1.10.0

import {
  VALIDATION_PATTERNS,
  VALIDATION_RULES,
  VALIDATION_MESSAGES,
  FIELD_CONSTRAINTS,
  ValidationRule,
  getValidationMessage
} from '../constants/validation.constants';

import {
  ApplicationFormData,
  PersonalInfo,
  AcademicInfo,
  ProgramInfo,
  ApplicationStatus,
  ProgramType
} from '../types/application.types';

// Constants for validation configuration
const VALIDATION_CACHE_SIZE = 1000;
const VALIDATION_CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

/**
 * Interface for validation result metadata
 */
interface ValidationMetadata {
  timestamp: number;
  field: string;
  validationType: string[];
  locale: string;
}

/**
 * Interface for validation performance metrics
 */
interface ValidationPerformance {
  duration: number;
  cached: boolean;
  asyncValidation: boolean;
}

/**
 * Interface for validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  metadata: ValidationMetadata;
  performanceMetrics: ValidationPerformance;
}

/**
 * Interface for validation options
 */
export interface ValidateOptions {
  locale?: string;
  async?: boolean;
  cache?: boolean;
  timeout?: number;
}

/**
 * Sanitizes input value to prevent XSS attacks
 */
const sanitizeValue = (value: any): any => {
  if (isString(value)) {
    return value.replace(/[<>]/g, '');
  }
  return value;
};

/**
 * Memoized function to check if a value matches a regex pattern
 */
const memoizedPatternTest = memoize(
  (pattern: RegExp, value: string): boolean => pattern.test(value),
  (pattern, value) => `${pattern.source}-${value}`
);

/**
 * Enhanced type checking with support for custom types
 */
const typeCheckers = {
  isString: (value: any): boolean => isString(value) && value.trim().length > 0,
  isNumber: (value: any): boolean => isNumber(value) && !isNaN(value),
  isDate: (value: any): boolean => isDate(value) && !isNaN(value.getTime()),
  isPhone: (value: string): boolean => {
    const phoneNumber = parsePhoneNumberFromString(value);
    return phoneNumber ? phoneNumber.isValid() : false;
  }
};

/**
 * Validates a single field with caching support
 */
export const validateField = async (
  fieldName: string,
  value: any,
  rules: ValidationRule,
  options: ValidateOptions = {}
): Promise<ValidationResult> => {
  const startTime = performance.now();
  const locale = options.locale || 'en';
  
  // Initialize validation result
  const result: ValidationResult = {
    isValid: true,
    errors: {},
    metadata: {
      timestamp: Date.now(),
      field: fieldName,
      validationType: [],
      locale
    },
    performanceMetrics: {
      duration: 0,
      cached: false,
      asyncValidation: false
    }
  };

  try {
    // Sanitize input
    const sanitizedValue = sanitizeValue(value);

    // Required field validation
    if (rules.required && !sanitizedValue) {
      result.isValid = false;
      result.errors[fieldName] = getValidationMessage(VALIDATION_MESSAGES.required, { field: fieldName });
      result.metadata.validationType.push('required');
    }

    // Type validation
    if (sanitizedValue) {
      if (rules.type && !typeCheckers[rules.type](sanitizedValue)) {
        result.isValid = false;
        result.errors[fieldName] = getValidationMessage(VALIDATION_MESSAGES[rules.type], { field: fieldName });
        result.metadata.validationType.push('type');
      }

      // Pattern validation
      if (rules.pattern && isString(sanitizedValue)) {
        const patternValid = memoizedPatternTest(rules.pattern, sanitizedValue);
        if (!patternValid) {
          result.isValid = false;
          result.errors[fieldName] = getValidationMessage(VALIDATION_MESSAGES.pattern, { field: fieldName });
          result.metadata.validationType.push('pattern');
        }
      }

      // Length validation
      if (isString(sanitizedValue)) {
        if (rules.minLength && sanitizedValue.length < rules.minLength) {
          result.isValid = false;
          result.errors[fieldName] = getValidationMessage(VALIDATION_MESSAGES.minLength, {
            field: fieldName,
            min: rules.minLength
          });
          result.metadata.validationType.push('minLength');
        }

        if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
          result.isValid = false;
          result.errors[fieldName] = getValidationMessage(VALIDATION_MESSAGES.maxLength, {
            field: fieldName,
            max: rules.maxLength
          });
          result.metadata.validationType.push('maxLength');
        }
      }

      // Custom validation
      if (rules.customValidator && options.async) {
        result.performanceMetrics.asyncValidation = true;
        const customValid = await Promise.race([
          rules.customValidator(sanitizedValue),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Validation timeout')), options.timeout || 5000)
          )
        ]);

        if (!customValid) {
          result.isValid = false;
          result.errors[fieldName] = rules.errorMessage || 
            getValidationMessage(VALIDATION_MESSAGES.custom, { field: fieldName });
          result.metadata.validationType.push('custom');
        }
      }
    }
  } catch (error) {
    result.isValid = false;
    result.errors[fieldName] = 'Validation error occurred';
    console.error(`Validation error for field ${fieldName}:`, error);
  }

  // Calculate performance metrics
  result.performanceMetrics.duration = performance.now() - startTime;
  
  return result;
};

/**
 * Validates complete form data
 */
export const validateForm = async (
  formData: ApplicationFormData,
  options: ValidateOptions = {}
): Promise<ValidationResult> => {
  const startTime = performance.now();
  const results: ValidationResult[] = [];

  // Validate personal information
  for (const [field, value] of Object.entries(formData.personalInfo)) {
    const rules = VALIDATION_RULES.personalInfo[field];
    if (rules) {
      results.push(await validateField(field, value, rules, options));
    }
  }

  // Validate academic information
  for (const [field, value] of Object.entries(formData.academicInfo)) {
    const rules = VALIDATION_RULES.academicInfo[field];
    if (rules) {
      results.push(await validateField(field, value, rules, options));
    }
  }

  // Validate program information
  for (const [field, value] of Object.entries(formData.programInfo)) {
    const rules = VALIDATION_RULES.programInfo[field];
    if (rules) {
      results.push(await validateField(field, value, rules, options));
    }
  }

  // Cross-field validation
  if (VALIDATION_RULES.crossFieldRules) {
    for (const [ruleName, rule] of Object.entries(VALIDATION_RULES.crossFieldRules)) {
      if (rule.dependentFields) {
        const dependentValues = rule.dependentFields.map(field => {
          const [section, fieldName] = field.split('.');
          return formData[section][fieldName];
        });

        results.push(await validateField(
          ruleName,
          dependentValues,
          rule,
          { ...options, async: true }
        ));
      }
    }
  }

  // Combine all validation results
  const finalResult: ValidationResult = {
    isValid: results.every(r => r.isValid),
    errors: results.reduce((acc, r) => ({ ...acc, ...r.errors }), {}),
    metadata: {
      timestamp: Date.now(),
      field: 'form',
      validationType: results.flatMap(r => r.metadata.validationType),
      locale: options.locale || 'en'
    },
    performanceMetrics: {
      duration: performance.now() - startTime,
      cached: false,
      asyncValidation: results.some(r => r.performanceMetrics.asyncValidation)
    }
  };

  return finalResult;
};