/**
 * @fileoverview Secure and accessible file upload component with advanced features
 * Implements comprehensive file upload capabilities with security validation,
 * chunked uploads, and progress tracking.
 * @version 1.0.0
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone'; // v14.0.0
import { LinearProgress } from '@mui/material'; // v5.0.0
import { validateFile, formatFileSize } from '@/utils/file.utils';
import { useNotification } from '@/hooks/useNotification';
import { NotificationTemplate, NotificationPriority } from '@/types/notification.types';

// Constants from globals
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const MAX_FILE_SIZE_MB = 50;
const CHUNK_SIZE_KB = 512;
const MAX_CONCURRENT_UPLOADS = 3;
const RETRY_ATTEMPTS = 3;

// Types
interface ValidatedFile extends File {
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface UploadProgress {
  fileId: string;
  progress: number;
  speed: number;
  remainingTime: number;
}

interface UploadError {
  fileId: string;
  error: string;
  retryCount: number;
}

interface FileUploadProps {
  onFilesSelected: (files: ValidatedFile[]) => void;
  onFileRemoved?: (fileId: string) => void;
  onUploadProgress?: (progress: UploadProgress) => void;
  onUploadError?: (error: UploadError) => void;
  maxFiles?: number;
  maxConcurrentUploads?: number;
  chunkSize?: number;
  disabled?: boolean;
}

/**
 * FileUpload Component
 * Provides secure file upload functionality with comprehensive validation and progress tracking
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  onFileRemoved,
  onUploadProgress,
  onUploadError,
  maxFiles = 5,
  maxConcurrentUploads = MAX_CONCURRENT_UPLOADS,
  chunkSize = CHUNK_SIZE_KB,
  disabled = false
}) => {
  const [files, setFiles] = useState<ValidatedFile[]>([]);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const uploadRefs = useRef<Map<string, { abort: () => void }>>(new Map());
  const { send: sendNotification } = useNotification();

  /**
   * Handles file drop events with enhanced security validation
   */
  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled) return;

    const validatedFiles: ValidatedFile[] = [];
    const errors: string[] = [];

    for (const file of acceptedFiles) {
      if (files.length + validatedFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        break;
      }

      // Validate file with enhanced security checks
      const validation = await validateFile(file, {
        strictMimeCheck: true,
        allowedTypes: ALLOWED_MIME_TYPES,
        maxSizeMB: MAX_FILE_SIZE_MB,
        validateContent: true
      });

      if (validation.isValid && validation.details) {
        const validatedFile: ValidatedFile = Object.assign(file, {
          id: crypto.randomUUID(),
          status: 'pending' as const,
          progress: 0,
          error: undefined
        });
        validatedFiles.push(validatedFile);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (validatedFiles.length > 0) {
      setFiles(prev => [...prev, ...validatedFiles]);
      setUploadQueue(prev => [...prev, ...validatedFiles.map(f => f.id)]);
      onFilesSelected(validatedFiles);

      // Notify success
      sendNotification(
        'SYSTEM',
        NotificationTemplate.DOCUMENT_UPLOADED,
        { count: validatedFiles.length },
        NotificationPriority.LOW
      );
    }

    if (errors.length > 0) {
      onUploadError?.({
        fileId: 'VALIDATION_ERROR',
        error: errors.join('; '),
        retryCount: 0
      });
    }
  }, [files, maxFiles, disabled, onFilesSelected, onUploadError, sendNotification]);

  /**
   * Handles file upload with chunked upload support
   */
  const handleUpload = useCallback(async (file: ValidatedFile) => {
    if (file.status !== 'pending') return;

    const chunkSizeBytes = chunkSize * 1024;
    const totalChunks = Math.ceil(file.size / chunkSizeBytes);
    let uploadedChunks = 0;
    let retryCount = 0;
    let startTime = Date.now();

    const updateProgress = (chunkIndex: number) => {
      const progress = (chunkIndex / totalChunks) * 100;
      const timeElapsed = Date.now() - startTime;
      const speed = (chunkIndex * chunkSizeBytes) / (timeElapsed / 1000);
      const remainingBytes = (totalChunks - chunkIndex) * chunkSizeBytes;
      const remainingTime = remainingBytes / speed;

      setFiles(prev => 
        prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'uploading', progress } 
            : f
        )
      );

      onUploadProgress?.({
        fileId: file.id,
        progress,
        speed,
        remainingTime
      });
    };

    try {
      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const start = chunk * chunkSizeBytes;
        const end = Math.min(start + chunkSizeBytes, file.size);
        const chunkBlob = file.slice(start, end);

        let chunkUploaded = false;
        while (!chunkUploaded && retryCount < RETRY_ATTEMPTS) {
          try {
            // Implement actual chunk upload logic here
            // This is a placeholder for demonstration
            await new Promise(resolve => setTimeout(resolve, 100));
            uploadedChunks++;
            updateProgress(uploadedChunks);
            chunkUploaded = true;
          } catch (error) {
            retryCount++;
            if (retryCount === RETRY_ATTEMPTS) {
              throw new Error(`Failed to upload chunk ${chunk} after ${RETRY_ATTEMPTS} attempts`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      setFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, status: 'completed', progress: 100 }
            : f
        )
      );

      sendNotification(
        'SYSTEM',
        NotificationTemplate.DOCUMENT_VERIFIED,
        { fileName: file.name },
        NotificationPriority.LOW
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      );

      onUploadError?.({
        fileId: file.id,
        error: errorMessage,
        retryCount
      });
    } finally {
      setActiveUploads(prev => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    }
  }, [chunkSize, onUploadProgress, onUploadError, sendNotification]);

  /**
   * Handles file removal with cleanup
   */
  const handleRemoveFile = useCallback((fileId: string) => {
    const uploadAbort = uploadRefs.current.get(fileId);
    if (uploadAbort) {
      uploadAbort.abort();
      uploadRefs.current.delete(fileId);
    }

    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadQueue(prev => prev.filter(id => id !== fileId));
    setActiveUploads(prev => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });

    onFileRemoved?.(fileId);
  }, [onFileRemoved]);

  // Process upload queue
  useEffect(() => {
    if (disabled || activeUploads.size >= maxConcurrentUploads) return;

    const processQueue = async () => {
      const availableSlots = maxConcurrentUploads - activeUploads.size;
      const nextUploads = uploadQueue
        .slice(0, availableSlots)
        .filter(id => !activeUploads.has(id));

      if (nextUploads.length === 0) return;

      setActiveUploads(prev => {
        const next = new Set(prev);
        nextUploads.forEach(id => next.add(id));
        return next;
      });

      setUploadQueue(prev => prev.filter(id => !nextUploads.includes(id)));

      nextUploads.forEach(fileId => {
        const file = files.find(f => f.id === fileId);
        if (file) {
          handleUpload(file);
        }
      });
    };

    processQueue();
  }, [
    disabled,
    files,
    uploadQueue,
    activeUploads,
    maxConcurrentUploads,
    handleUpload
  ]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    accept: ALLOWED_MIME_TYPES.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    disabled,
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024
  });

  return (
    <div className="file-upload-container">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        role="button"
        aria-label="File upload dropzone"
      >
        <input {...getInputProps()} />
        <div className="dropzone-content">
          <p>Drag & drop files here, or click to select files</p>
          <p className="file-requirements">
            Accepted formats: PDF, JPEG, PNG, DOC, DOCX
            <br />
            Maximum file size: {MAX_FILE_SIZE_MB}MB
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list" role="list">
          {files.map(file => (
            <div
              key={file.id}
              className={`file-item ${file.status}`}
              role="listitem"
            >
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">
                  {formatFileSize(file.size)}
                </span>
              </div>
              
              {file.status === 'uploading' && (
                <LinearProgress
                  variant="determinate"
                  value={file.progress}
                  aria-label={`Upload progress: ${Math.round(file.progress)}%`}
                />
              )}

              {file.error && (
                <div className="file-error" role="alert">
                  {file.error}
                </div>
              )}

              <button
                onClick={() => handleRemoveFile(file.id)}
                className="remove-file"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;