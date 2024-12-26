// @ts-check
/**
 * Document management type definitions for the enrollment system web frontend
 * @version 1.0.0
 * @module types/document
 */

// External imports
// Using File from lib.dom.d.ts - TypeScript 5.0+

/**
 * Allowed MIME types for document uploads
 * Restricted to common document and image formats
 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

/**
 * Maximum file size in megabytes for document uploads
 */
export const MAX_FILE_SIZE_MB = 50 as const;

/**
 * Expiry time in minutes for signed upload URLs
 */
export const UPLOAD_URL_EXPIRY_MINUTES = 15 as const;

/**
 * Document processing status enumeration
 * Represents the lifecycle states of a document in the system
 */
export enum DocumentStatus {
  PENDING = "PENDING",
  UPLOADED = "UPLOADED",
  PROCESSING = "PROCESSING",
  FAILED = "FAILED",
  DELETED = "DELETED"
}

/**
 * Document verification status enumeration
 * Represents the verification states of a document
 */
export enum VerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  IN_REVIEW = "IN_REVIEW",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED"
}

/**
 * Document metadata interface
 * Comprehensive type definition for document information with strict readonly constraints
 */
export interface Document {
  readonly id: string;
  readonly applicationId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly storagePath: string;
  readonly fileSize: number;
  readonly uploadedAt: Date;
  readonly status: DocumentStatus;
  readonly verificationStatus: VerificationStatus;
  readonly downloadUrl: string;
  readonly lastModifiedAt: Date;
  readonly verifiedAt: Date | null;
  readonly verifiedBy: string | null;
  readonly rejectionReason: string | null;
}

/**
 * Document upload request interface
 * Type definition for document upload requests with required metadata
 */
export interface DocumentUploadRequest {
  readonly file: File;
  readonly applicationId: string;
  readonly documentType: string;
  readonly description: string;
}

/**
 * Document upload response interface
 * Type definition for document upload responses with security-focused fields
 */
export interface DocumentUploadResponse {
  readonly document: Document;
  readonly uploadUrl: string;
  readonly expiresAt: Date;
}

/**
 * Paginated document list response interface
 * Type definition for paginated document list responses with metadata
 */
export interface DocumentListResponse {
  readonly documents: readonly Document[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
}

/**
 * Type guard to check if a MIME type is allowed
 * @param mimeType - The MIME type to check
 */
export const isAllowedMimeType = (mimeType: string): mimeType is typeof ALLOWED_MIME_TYPES[number] => {
  return ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number]);
};

/**
 * Type guard to check if a file size is within limits
 * @param sizeInBytes - The file size in bytes to check
 */
export const isFileSizeAllowed = (sizeInBytes: number): boolean => {
  return sizeInBytes <= MAX_FILE_SIZE_MB * 1024 * 1024;
};