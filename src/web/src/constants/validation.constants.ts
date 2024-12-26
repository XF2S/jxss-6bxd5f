// @ts-check
import { ApplicationFormData, PersonalInfo, AcademicInfo, ProgramInfo } from '../types/application.types';
import i18next from 'i18next'; // v22.0.0

/**
 * Regular expression patterns for field validation
 * These patterns support international formats and Unicode characters
 */
export const VALIDATION_PATTERNS = {
  // RFC 5322 compliant email pattern
  EMAIL: new RegExp('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'),
  
  // E.164 international phone number format
  PHONE: new RegExp('^\\+(?:[0-9] ?){6,14}[0-9]$'),
  
  // International phone with optional formatting
  INTERNATIONAL_PHONE: new RegExp('^\\+?[\\d\\s-()]{10,}$'),
  
  // Unicode-aware name pattern supporting international characters
  NAME: new RegExp("^[\\p{L}\\s-']+$", 'u'),
  
  // Flexible date format (YYYY-MM-DD or YYYY/MM/DD)
  DATE: new RegExp('^\\d{4}(-|/)(0[1-9]|1[0-2])(-|/)(0[1-9]|[12][0-9]|3[01])$'),
  
  // Extended Unicode name pattern with additional special characters
  UNICODE_NAME: new RegExp("^[\\p{L}\\s\\-'\\.\u0300-\u036f]+$", 'u'),
  
  // ZIP/Postal code pattern supporting international formats
  POSTAL_CODE: new RegExp('^[A-Z0-9][A-Z0-9\\s-]{0,10}[A-Z0-9]$', 'i'),
};

/**
 * Interface defining the structure of a validation rule
 */
export interface ValidationRule {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  customValidator?: (value: any, formData?: any) => boolean | Promise<boolean>;
  dependentFields?: string[];
  errorMessage?: string | ((params: any) => string);
}

/**
 * Interface for validation rule sets with conditional and cross-field validation
 */
export interface ValidationRuleSet {
  [key: string]: ValidationRule;
  conditionalRules?: Record<string, (formData: any) => ValidationRule>;
  crossFieldRules?: Record<string, ValidationRule & { dependentFields: string[] }>;
}

/**
 * Interface for internationalized message templates
 */
export interface MessageTemplate {
  key: string;
  defaultValue: string;
  parameters?: Record<string, any>;
}

/**
 * Comprehensive validation rules for all form sections
 */
export const VALIDATION_RULES: Record<string, ValidationRuleSet> = {
  personalInfo: {
    firstName: {
      required: true,
      pattern: VALIDATION_PATTERNS.UNICODE_NAME,
      minLength: 2,
      maxLength: 50,
    },
    lastName: {
      required: true,
      pattern: VALIDATION_PATTERNS.UNICODE_NAME,
      minLength: 2,
      maxLength: 50,
    },
    email: {
      required: true,
      pattern: VALIDATION_PATTERNS.EMAIL,
      customValidator: async (email: string) => {
        // Add custom email validation logic here
        return email.length > 0;
      },
    },
    phone: {
      required: true,
      pattern: VALIDATION_PATTERNS.INTERNATIONAL_PHONE,
    },
    dateOfBirth: {
      required: true,
      customValidator: (date: Date) => {
        const minAge = 16;
        const today = new Date();
        const birthDate = new Date(date);
        const age = today.getFullYear() - birthDate.getFullYear();
        return age >= minAge;
      },
    },
  },
  
  academicInfo: {
    previousInstitution: {
      required: true,
      minLength: 3,
      maxLength: 100,
    },
    gpa: {
      required: true,
      min: 0,
      max: 4.0,
    },
    graduationDate: {
      required: true,
      customValidator: (date: Date) => {
        const today = new Date();
        return new Date(date) <= today;
      },
    },
    major: {
      required: true,
      minLength: 2,
      maxLength: 50,
    },
  },
  
  programInfo: {
    programType: {
      required: true,
    },
    intendedMajor: {
      required: true,
      minLength: 2,
      maxLength: 50,
    },
    startTerm: {
      required: true,
    },
    specializations: {
      customValidator: (specializations: string[], formData: ProgramInfo) => {
        // Validate based on program type
        return formData.programType === 'GRADUATE' ? specializations.length > 0 : true;
      },
    },
  },
  
  // Cross-field validation rules
  crossFieldRules: {
    graduationDateCheck: {
      dependentFields: ['academicInfo.graduationDate', 'programInfo.startTerm'],
      customValidator: (value: any, formData: ApplicationFormData) => {
        const gradDate = new Date(formData.academicInfo.graduationDate);
        const startTerm = new Date(formData.programInfo.startTerm);
        return gradDate <= startTerm;
      },
    },
  },
  
  // Conditional validation rules
  conditionalRules: {
    transcriptRequirement: (formData: ApplicationFormData) => ({
      required: formData.programInfo.programType === 'GRADUATE',
      customValidator: (transcripts: any[]) => transcripts.length >= 1,
    }),
  },
};

/**
 * Internationalized validation messages
 */
export const VALIDATION_MESSAGES: Record<string, MessageTemplate> = {
  required: {
    key: 'validation.required',
    defaultValue: '{{field}} is required',
  },
  email: {
    key: 'validation.email',
    defaultValue: 'Please enter a valid email address',
  },
  phone: {
    key: 'validation.phone',
    defaultValue: 'Please enter a valid phone number',
  },
  date: {
    key: 'validation.date',
    defaultValue: 'Please enter a valid date',
  },
  minLength: {
    key: 'validation.minLength',
    defaultValue: '{{field}} must be at least {{min}} characters',
    parameters: { min: 0 },
  },
  maxLength: {
    key: 'validation.maxLength',
    defaultValue: '{{field}} must not exceed {{max}} characters',
    parameters: { max: 0 },
  },
  pattern: {
    key: 'validation.pattern',
    defaultValue: 'Please enter a valid {{field}}',
  },
  range: {
    key: 'validation.range',
    defaultValue: '{{field}} must be between {{min}} and {{max}}',
    parameters: { min: 0, max: 0 },
  },
  graduationDate: {
    key: 'validation.graduationDate',
    defaultValue: 'Graduation date must be before program start date',
  },
  specializations: {
    key: 'validation.specializations',
    defaultValue: 'Graduate programs require at least one specialization',
  },
  transcripts: {
    key: 'validation.transcripts',
    defaultValue: 'At least one transcript is required for graduate programs',
  },
};

/**
 * Helper function to get translated validation message
 */
export const getValidationMessage = (
  template: MessageTemplate,
  params?: Record<string, any>
): string => {
  return i18next.t(template.key, {
    defaultValue: template.defaultValue,
    ...template.parameters,
    ...params,
  });
};

/**
 * Helper function to validate a single field
 */
export const validateField = async (
  value: any,
  rules: ValidationRule,
  formData?: any
): Promise<boolean> => {
  if (rules.required && !value) {
    return false;
  }

  if (rules.pattern && !rules.pattern.test(value)) {
    return false;
  }

  if (rules.minLength && String(value).length < rules.minLength) {
    return false;
  }

  if (rules.maxLength && String(value).length > rules.maxLength) {
    return false;
  }

  if (rules.min && Number(value) < rules.min) {
    return false;
  }

  if (rules.max && Number(value) > rules.max) {
    return false;
  }

  if (rules.customValidator) {
    return await rules.customValidator(value, formData);
  }

  return true;
};