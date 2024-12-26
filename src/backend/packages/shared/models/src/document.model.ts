// External dependencies
// mongoose v7.5.0 - MongoDB schema definitions and validation
import { Schema, model, Document as MongoDocument } from 'mongoose';
// mime-types v2.1.35 - MIME type validation
import * as mime from 'mime-types';

// Global constants for document management
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

export const MAX_FILE_SIZE_MB = 50;
export const STORAGE_PATH_PREFIX = 'documents/';
export const DOCUMENT_RETENTION_DAYS = 365;

// Document status enumeration
export enum DocumentStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
  EXPIRED = 'EXPIRED'
}

// Verification status enumeration
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW'
}

// Document interface definition
export interface IDocument extends MongoDocument {
  id: string;
  applicationId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSize: number;
  uploadedAt: Date;
  expiresAt: Date;
  status: DocumentStatus;
  verificationStatus: VerificationStatus;
  checksum: string;
  encryptionKeyId: string;
  metadata: Record<string, unknown>;
  lastModifiedBy: string;
  lastModifiedAt: Date;
}

// Document schema definition
export const DocumentSchema = new Schema<IDocument>({
  applicationId: {
    type: String,
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    validate: {
      validator: (value: string) => {
        // Prevent path traversal and invalid characters
        return /^[a-zA-Z0-9-_. ]+$/.test(value) && !value.includes('..');
      },
      message: 'Invalid file name format'
    }
  },
  mimeType: {
    type: String,
    required: true,
    validate: {
      validator: (value: string) => ALLOWED_MIME_TYPES.includes(value as any),
      message: 'Unsupported file type'
    }
  },
  storagePath: {
    type: String,
    required: true,
    set: (value: string) => DocumentSchema.methods.sanitizePath(value)
  },
  fileSize: {
    type: Number,
    required: true,
    validate: {
      validator: (value: number) => value > 0 && value <= MAX_FILE_SIZE_MB * 1024 * 1024,
      message: `File size must be between 0 and ${MAX_FILE_SIZE_MB}MB`
    }
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => {
      const date = new Date();
      date.setDate(date.getDate() + DOCUMENT_RETENTION_DAYS);
      return date;
    }
  },
  status: {
    type: String,
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
    required: true
  },
  verificationStatus: {
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.UNVERIFIED,
    required: true
  },
  checksum: {
    type: String,
    required: true
  },
  encryptionKeyId: {
    type: String,
    required: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  lastModifiedBy: {
    type: String,
    required: true
  },
  lastModifiedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true,
  versionKey: true,
  collection: 'documents'
});

// Indexes
DocumentSchema.index({ applicationId: 1, status: 1 });
DocumentSchema.index({ uploadedAt: 1 });
DocumentSchema.index({ expiresAt: 1 });
DocumentSchema.index({ verificationStatus: 1 });

// Schema methods
DocumentSchema.methods = {
  async validate(doc: IDocument): Promise<boolean> {
    try {
      // Validate MIME type
      if (!mime.extension(doc.mimeType)) {
        throw new Error('Invalid MIME type');
      }

      // Validate file size
      if (doc.fileSize <= 0 || doc.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
        throw new Error(`File size must be between 0 and ${MAX_FILE_SIZE_MB}MB`);
      }

      // Validate storage path
      if (!doc.storagePath.startsWith(STORAGE_PATH_PREFIX)) {
        throw new Error('Invalid storage path');
      }

      // Validate expiration date
      if (doc.expiresAt <= doc.uploadedAt) {
        throw new Error('Expiration date must be after upload date');
      }

      // Validate checksum format (assuming SHA-256)
      if (!/^[a-f0-9]{64}$/i.test(doc.checksum)) {
        throw new Error('Invalid checksum format');
      }

      return true;
    } catch (error) {
      throw error;
    }
  },

  sanitizePath(path: string): string {
    // Remove any path traversal sequences
    const sanitized = path
      .replace(/\.\./g, '')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')
      .trim();

    // Ensure path starts with storage prefix
    return sanitized.startsWith(STORAGE_PATH_PREFIX)
      ? sanitized
      : `${STORAGE_PATH_PREFIX}${sanitized}`;
  }
};

// Pre-save middleware
DocumentSchema.pre('save', async function(next) {
  this.lastModifiedAt = new Date();
  
  try {
    await DocumentSchema.methods.validate(this);
    next();
  } catch (error) {
    next(error);
  }
});

// Create and export the model
export const Document = model<IDocument>('Document', DocumentSchema);