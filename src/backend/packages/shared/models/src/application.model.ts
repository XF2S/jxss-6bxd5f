// External imports with versions
import { z } from 'zod'; // v3.0.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

/**
 * Enum defining all possible application statuses
 */
export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN'
}

/**
 * Status transition map defining allowed status transitions
 */
const STATUS_TRANSITION_MAP: Record<ApplicationStatus, Set<ApplicationStatus>> = {
  [ApplicationStatus.DRAFT]: new Set([ApplicationStatus.SUBMITTED, ApplicationStatus.WITHDRAWN]),
  [ApplicationStatus.SUBMITTED]: new Set([ApplicationStatus.UNDER_REVIEW, ApplicationStatus.WITHDRAWN]),
  [ApplicationStatus.UNDER_REVIEW]: new Set([ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN]),
  [ApplicationStatus.APPROVED]: new Set([ApplicationStatus.WITHDRAWN]),
  [ApplicationStatus.REJECTED]: new Set([ApplicationStatus.WITHDRAWN]),
  [ApplicationStatus.WITHDRAWN]: new Set()
};

/**
 * Interface for validation results
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  timestamp: Date;
}

/**
 * Interface for status update results
 */
interface StatusUpdateResult {
  success: boolean;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  timestamp: Date;
  reason?: string;
}

/**
 * Interface for submission results
 */
interface SubmissionResult {
  success: boolean;
  errors: string[];
  timestamp: Date;
  applicationId: string;
}

/**
 * Zod schema for application form data validation
 */
export const ApplicationSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/)
  }),
  programDetails: z.object({
    programType: z.enum(['Undergraduate', 'Graduate', 'Certificate']),
    term: z.string(),
    major: z.string().min(1)
  }),
  documents: z.array(z.object({
    type: z.string(),
    fileId: z.string().uuid(),
    fileName: z.string(),
    uploadedAt: z.date()
  }))
});

/**
 * Validates if a status transition is allowed
 */
function isValidStatus(currentStatus: ApplicationStatus, nextStatus: ApplicationStatus): boolean {
  if (!STATUS_TRANSITION_MAP[currentStatus]) {
    return false;
  }
  return STATUS_TRANSITION_MAP[currentStatus].has(nextStatus);
}

/**
 * Validates application form data against schema
 */
function validateFormData(formData: Record<string, any>): ValidationResult {
  try {
    ApplicationSchema.parse(formData);
    return {
      isValid: true,
      errors: [],
      timestamp: new Date()
    };
  } catch (error) {
    return {
      isValid: false,
      errors: error.errors.map((e: any) => e.message),
      timestamp: new Date()
    };
  }
}

/**
 * Core Application class representing an enrollment application
 */
@auditLog
export class Application {
  public readonly id: string;
  public readonly userId: string;
  public status: ApplicationStatus;
  public formData: Record<string, any>;
  public submittedAt?: Date;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public statusHistory: Array<{
    status: ApplicationStatus;
    timestamp: Date;
    reason?: string;
  }>;
  public lastValidation?: ValidationResult;

  constructor(data: Partial<Application>) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.status = data.status || ApplicationStatus.DRAFT;
    this.formData = data.formData || {};
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.statusHistory = [{
      status: this.status,
      timestamp: this.createdAt
    }];
    
    this.validate();
  }

  /**
   * Updates application status with validation and history tracking
   */
  public updateStatus(newStatus: ApplicationStatus, reason?: string): StatusUpdateResult {
    if (!isValidStatus(this.status, newStatus)) {
      return {
        success: false,
        previousStatus: this.status,
        newStatus: newStatus,
        timestamp: new Date(),
        reason: 'Invalid status transition'
      };
    }

    const previousStatus = this.status;
    this.status = newStatus;
    this.updatedAt = new Date();
    
    this.statusHistory.push({
      status: newStatus,
      timestamp: this.updatedAt,
      reason
    });

    return {
      success: true,
      previousStatus,
      newStatus,
      timestamp: this.updatedAt,
      reason
    };
  }

  /**
   * Submits application with comprehensive validation
   */
  public submit(): SubmissionResult {
    const validation = this.validate();
    
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        timestamp: new Date(),
        applicationId: this.id
      };
    }

    const statusUpdate = this.updateStatus(ApplicationStatus.SUBMITTED, 'Application submitted');
    
    if (!statusUpdate.success) {
      return {
        success: false,
        errors: ['Failed to update application status'],
        timestamp: new Date(),
        applicationId: this.id
      };
    }

    this.submittedAt = new Date();
    
    return {
      success: true,
      errors: [],
      timestamp: this.submittedAt,
      applicationId: this.id
    };
  }

  /**
   * Performs comprehensive validation of application data
   */
  public validate(): ValidationResult {
    const formValidation = validateFormData(this.formData);
    
    // Additional business rule validations
    const businessRuleErrors: string[] = [];
    
    if (this.status === ApplicationStatus.SUBMITTED && !this.formData.documents?.length) {
      businessRuleErrors.push('Required documents must be uploaded before submission');
    }

    const isValid = formValidation.isValid && businessRuleErrors.length === 0;
    
    this.lastValidation = {
      isValid,
      errors: [...formValidation.errors, ...businessRuleErrors],
      timestamp: new Date()
    };

    return this.lastValidation;
  }
}