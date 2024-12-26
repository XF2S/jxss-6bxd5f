// @ts-check
import { z } from 'zod'; // v3.0.0

/**
 * Enum defining possible application statuses
 */
export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

/**
 * Enum defining available program types
 */
export enum ProgramType {
  UNDERGRADUATE = 'UNDERGRADUATE',
  GRADUATE = 'GRADUATE',
  CERTIFICATE = 'CERTIFICATE'
}

/**
 * Interface for address information
 */
export interface Address {
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Interface for personal information section
 */
export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  address: Address;
}

/**
 * Interface for document metadata
 */
export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

/**
 * Interface for academic background information
 */
export interface AcademicInfo {
  previousInstitution: string;
  gpa: number;
  graduationDate: Date;
  major: string;
  transcripts: Document[];
}

/**
 * Interface for program selection information
 */
export interface ProgramInfo {
  programType: ProgramType;
  intendedMajor: string;
  startTerm: string;
  fullTime: boolean;
  specializations: string[];
}

/**
 * Interface for complete application form data
 */
export interface ApplicationFormData {
  personalInfo: PersonalInfo;
  academicInfo: AcademicInfo;
  programInfo: ProgramInfo;
  documents: Document[];
  additionalInfo: Record<string, unknown>;
}

/**
 * Interface for complete application with metadata
 */
export interface Application {
  id: string;
  userId: string;
  status: ApplicationStatus;
  formData: ApplicationFormData;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  comments: string[];
}

/**
 * Zod validation schema for address
 */
export const addressSchema = z.object({
  street1: z.string().min(1, 'Street address is required'),
  street2: z.string().nullable(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  country: z.string().min(1, 'Country is required')
});

/**
 * Zod validation schema for personal information
 */
export const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[\d\s-()]{10,}$/, 'Invalid phone number format'),
  dateOfBirth: z.date().max(new Date(), 'Date of birth cannot be in the future'),
  address: addressSchema
});

/**
 * Zod validation schema for document
 */
export const documentSchema = z.object({
  id: z.string().uuid('Invalid document ID'),
  name: z.string().min(1, 'Document name is required'),
  type: z.string().min(1, 'Document type is required'),
  size: z.number().positive('File size must be positive'),
  uploadedAt: z.date()
});

/**
 * Zod validation schema for academic information
 */
export const academicInfoSchema = z.object({
  previousInstitution: z.string().min(1, 'Previous institution is required'),
  gpa: z.number().min(0).max(4.0, 'GPA must be between 0 and 4.0'),
  graduationDate: z.date(),
  major: z.string().min(1, 'Major is required'),
  transcripts: z.array(documentSchema).min(1, 'At least one transcript is required')
});

/**
 * Zod validation schema for program information
 */
export const programInfoSchema = z.object({
  programType: z.nativeEnum(ProgramType),
  intendedMajor: z.string().min(1, 'Intended major is required'),
  startTerm: z.string().min(1, 'Start term is required'),
  fullTime: z.boolean(),
  specializations: z.array(z.string())
});

/**
 * Comprehensive Zod validation schema for application form data
 */
export const applicationFormDataSchema = z.object({
  personalInfo: personalInfoSchema,
  academicInfo: academicInfoSchema,
  programInfo: programInfoSchema,
  documents: z.array(documentSchema),
  additionalInfo: z.record(z.unknown())
});

/**
 * Complete application validation schema
 */
export const ApplicationValidationSchema = z.object({
  id: z.string().uuid('Invalid application ID'),
  userId: z.string().uuid('Invalid user ID'),
  status: z.nativeEnum(ApplicationStatus),
  formData: applicationFormDataSchema,
  submittedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  reviewedBy: z.string().uuid('Invalid reviewer ID').nullable(),
  reviewedAt: z.date().nullable(),
  comments: z.array(z.string())
});