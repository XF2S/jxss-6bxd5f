// @ts-check
import { ApplicationStatus, ProgramType } from '../types/application.types';
import { MaterialUIColors } from '@mui/material'; // v5.0.0
import { useTranslation } from 'react-i18next'; // v12.0.0

/**
 * Maximum file size for document uploads (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Accepted file types for document uploads
 */
export const ACCEPTED_FILE_TYPES = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

/**
 * Default page size for paginated lists
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Timeout for accessibility announcements (ms)
 */
export const ACCESSIBILITY_TIMEOUT = 5000;

/**
 * Interval for auto-saving form data (ms)
 */
export const FORM_AUTOSAVE_INTERVAL = 30000;

/**
 * Interface for status display configuration with accessibility support
 */
export interface StatusDisplayConfig {
  color: string;
  label: string;
  icon: string;
  description: string;
  ariaLabel: string;
  role: string;
}

/**
 * Status display mapping with accessibility support
 */
export const STATUS_DISPLAY_MAP: Record<ApplicationStatus, StatusDisplayConfig> = {
  [ApplicationStatus.DRAFT]: {
    color: MaterialUIColors.grey[500],
    label: 'Draft',
    icon: 'draft',
    description: 'Application is in draft state',
    ariaLabel: 'Application status: Draft',
    role: 'status'
  },
  [ApplicationStatus.SUBMITTED]: {
    color: MaterialUIColors.blue[500],
    label: 'Submitted',
    icon: 'send',
    description: 'Application has been submitted for review',
    ariaLabel: 'Application status: Submitted for review',
    role: 'status'
  },
  [ApplicationStatus.UNDER_REVIEW]: {
    color: MaterialUIColors.orange[500],
    label: 'Under Review',
    icon: 'review',
    description: 'Application is being reviewed',
    ariaLabel: 'Application status: Currently under review',
    role: 'status'
  },
  [ApplicationStatus.APPROVED]: {
    color: MaterialUIColors.green[500],
    label: 'Approved',
    icon: 'check_circle',
    description: 'Application has been approved',
    ariaLabel: 'Application status: Approved',
    role: 'status'
  },
  [ApplicationStatus.REJECTED]: {
    color: MaterialUIColors.red[500],
    label: 'Rejected',
    icon: 'cancel',
    description: 'Application has been rejected',
    ariaLabel: 'Application status: Rejected',
    role: 'status'
  }
};

/**
 * Interface for term configuration
 */
interface TermConfig {
  id: string;
  label: string;
  startDate: Date;
  endDate: Date;
  applicationDeadline: Date;
}

/**
 * Interface for major configuration
 */
interface MajorConfig {
  code: string;
  name: string;
  description: string;
  availableSpecializations: string[];
}

/**
 * Interface for prerequisite configuration
 */
interface PrerequisiteConfig {
  type: string;
  description: string;
  required: boolean;
}

/**
 * Interface for document requirement configuration
 */
interface DocumentRequirement {
  type: string;
  required: boolean;
  description: string;
  acceptedFormats: string[];
  maxSize: number;
}

/**
 * Interface for program configuration
 */
export interface ProgramConfig {
  label: string;
  description: string;
  requirements: string[];
  availableTerms: TermConfig[];
  majors: MajorConfig[];
  prerequisites: PrerequisiteConfig[];
  documentRequirements: DocumentRequirement[];
}

/**
 * Program configuration mapping
 */
export const PROGRAM_CONFIG: Record<ProgramType, ProgramConfig> = {
  [ProgramType.UNDERGRADUATE]: {
    label: 'Undergraduate Programs',
    description: 'Bachelor degree programs for first-time college students and transfers',
    requirements: ['High school diploma or equivalent', 'Minimum 2.5 GPA', 'SAT/ACT scores'],
    availableTerms: [
      {
        id: 'FALL_2024',
        label: 'Fall 2024',
        startDate: new Date('2024-08-15'),
        endDate: new Date('2024-12-15'),
        applicationDeadline: new Date('2024-07-01')
      }
    ],
    majors: [
      {
        code: 'CS',
        name: 'Computer Science',
        description: 'Bachelor of Science in Computer Science',
        availableSpecializations: ['Software Engineering', 'Data Science', 'Cybersecurity']
      }
    ],
    prerequisites: [
      {
        type: 'TRANSCRIPT',
        description: 'Official high school transcript',
        required: true
      }
    ],
    documentRequirements: [
      {
        type: 'TRANSCRIPT',
        required: true,
        description: 'Official high school transcript or GED',
        acceptedFormats: ['.pdf'],
        maxSize: MAX_FILE_SIZE
      }
    ]
  },
  // Similar configurations for GRADUATE and CERTIFICATE types...
  [ProgramType.GRADUATE]: {
    label: 'Graduate Programs',
    description: 'Master and doctoral degree programs',
    requirements: ['Bachelor degree', 'Minimum 3.0 GPA', 'GRE/GMAT scores'],
    availableTerms: [
      {
        id: 'FALL_2024',
        label: 'Fall 2024',
        startDate: new Date('2024-08-15'),
        endDate: new Date('2024-12-15'),
        applicationDeadline: new Date('2024-06-01')
      }
    ],
    majors: [
      {
        code: 'MBA',
        name: 'Master of Business Administration',
        description: 'Professional MBA Program',
        availableSpecializations: ['Finance', 'Marketing', 'Operations']
      }
    ],
    prerequisites: [
      {
        type: 'TRANSCRIPT',
        description: 'Official undergraduate transcript',
        required: true
      }
    ],
    documentRequirements: [
      {
        type: 'TRANSCRIPT',
        required: true,
        description: 'Official undergraduate transcript',
        acceptedFormats: ['.pdf'],
        maxSize: MAX_FILE_SIZE
      }
    ]
  },
  [ProgramType.CERTIFICATE]: {
    label: 'Certificate Programs',
    description: 'Professional certification programs',
    requirements: ['High school diploma', 'Relevant work experience'],
    availableTerms: [
      {
        id: 'FALL_2024',
        label: 'Fall 2024',
        startDate: new Date('2024-08-15'),
        endDate: new Date('2024-12-15'),
        applicationDeadline: new Date('2024-07-15')
      }
    ],
    majors: [
      {
        code: 'CERT_PM',
        name: 'Project Management',
        description: 'Professional Certificate in Project Management',
        availableSpecializations: ['Agile', 'Traditional']
      }
    ],
    prerequisites: [
      {
        type: 'RESUME',
        description: 'Current resume',
        required: true
      }
    ],
    documentRequirements: [
      {
        type: 'RESUME',
        required: true,
        description: 'Current professional resume',
        acceptedFormats: ['.pdf', '.doc', '.docx'],
        maxSize: MAX_FILE_SIZE
      }
    ]
  }
};

/**
 * Interface for field configuration
 */
interface FieldConfig {
  id: string;
  type: string;
  label: string;
  required: boolean;
  validation: ValidationRules;
  helpText: string;
  ariaLabel: string;
}

/**
 * Interface for validation rules
 */
interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
}

/**
 * Interface for accessibility configuration
 */
interface AccessibilityConfig {
  ariaLabel: string;
  role: string;
  tabIndex: number;
  description: string;
}

/**
 * Interface for visibility configuration
 */
interface VisibilityConfig {
  condition: string;
  dependsOn: string[];
}

/**
 * Interface for form section configuration
 */
export interface FormSectionConfig {
  title: string;
  description: string;
  order: number;
  fields: FieldConfig[];
  isRequired: boolean;
  validationRules: ValidationRules;
  dependencies: string[];
  accessibility: AccessibilityConfig;
  visibility: VisibilityConfig;
}

/**
 * Form sections configuration
 */
export const FORM_SECTIONS: Record<string, FormSectionConfig> = {
  PERSONAL_INFO: {
    title: 'Personal Information',
    description: 'Enter your personal and contact information',
    order: 1,
    fields: [
      {
        id: 'firstName',
        type: 'text',
        label: 'First Name',
        required: true,
        validation: {
          required: true,
          minLength: 2,
          maxLength: 50
        },
        helpText: 'Enter your legal first name',
        ariaLabel: 'First name input field'
      }
      // Additional fields...
    ],
    isRequired: true,
    validationRules: {
      required: true
    },
    dependencies: [],
    accessibility: {
      ariaLabel: 'Personal Information Section',
      role: 'region',
      tabIndex: 0,
      description: 'Section for entering personal information'
    },
    visibility: {
      condition: 'always',
      dependsOn: []
    }
  }
  // Additional sections...
};