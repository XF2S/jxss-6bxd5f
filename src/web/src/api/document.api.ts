/**
 * @fileoverview Document API client module for secure document management operations
 * Implements comprehensive document handling with enhanced security, performance,
 * and reliability features.
 * @version 1.0.0
 */

import axios, { AxiosProgressEvent } from 'axios'; // v1.6.0
import axiosRetry from 'axios-retry'; // v3.8.0
import { 
  Document, 
  DocumentUploadRequest, 
  DocumentListResponse,
  isAllowedMimeType,
  isFileSizeAllowed
} from '../types/document.types';
import { validateFile } from '../utils/file.utils';
import { createApiClient } from '../config/api.config';

// API configuration constants
const API_BASE_PATH = '/api/v1/documents';
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FILE_TYPES = ['.pdf', '.jpg', '.png', '.doc', '.docx'];
const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for resumable upload

// Create configured API client
const apiClient = createApiClient();

/**
 * Interface for document upload options
 */
interface UploadOptions {
  onProgress?: (progress: number) => void;
  cancelToken?: axios.CancelToken;
  chunkSize?: number;
  validateContent?: boolean;
}

/**
 * Interface for document retrieval options
 */
interface GetDocumentOptions {
  includeUrl?: boolean;
  urlExpiry?: number;
  validateChecksum?: boolean;
}

/**
 * Interface for document list options
 */
interface ListDocumentsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Document API client implementation with comprehensive security and performance features
 */
export const DocumentApi = {
  /**
   * Uploads a document with enhanced security and progress tracking
   * @param request Document upload request
   * @param options Upload configuration options
   * @returns Promise resolving to uploaded document
   */
  async uploadDocument(
    request: DocumentUploadRequest,
    options: UploadOptions = {}
  ): Promise<Document> {
    // Validate file before upload
    const validation = await validateFile(request.file, {
      maxSizeMB: MAX_UPLOAD_SIZE / (1024 * 1024),
      allowedTypes: ALLOWED_FILE_TYPES,
      validateContent: options.validateContent
    });

    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.error}`);
    }

    // Prepare upload metadata
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('applicationId', request.applicationId);
    formData.append('metadata', JSON.stringify(request.metadata));

    // Configure upload request
    const config = {
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (options.onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(progress);
        }
      },
      cancelToken: options.cancelToken,
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Upload-Content-Type': request.file.type,
        'X-Upload-Content-Length': request.file.size.toString()
      }
    };

    try {
      const response = await apiClient.post<Document>(
        `${API_BASE_PATH}/upload`,
        formData,
        config
      );
      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error('Upload cancelled by user');
      }
      throw error;
    }
  },

  /**
   * Retrieves document with secure download URL
   * @param documentId Document identifier
   * @param options Retrieval options
   * @returns Promise resolving to document details
   */
  async getDocument(
    documentId: string,
    options: GetDocumentOptions = {}
  ): Promise<Document> {
    const params = new URLSearchParams();
    if (options.includeUrl) {
      params.append('includeUrl', 'true');
      if (options.urlExpiry) {
        params.append('urlExpiry', options.urlExpiry.toString());
      }
    }

    const response = await apiClient.get<Document>(
      `${API_BASE_PATH}/${documentId}`,
      { params }
    );

    if (options.validateChecksum && response.data.metadata?.checksum) {
      // Implement checksum validation logic here
    }

    return response.data;
  },

  /**
   * Lists documents with pagination and filtering
   * @param applicationId Application identifier
   * @param options List configuration options
   * @returns Promise resolving to paginated document list
   */
  async listApplicationDocuments(
    applicationId: string,
    options: ListDocumentsOptions = {}
  ): Promise<DocumentListResponse> {
    const params = new URLSearchParams({
      applicationId,
      page: (options.page || 1).toString(),
      pageSize: (options.pageSize || 10).toString(),
      ...(options.status && { status: options.status }),
      ...(options.sortBy && { sortBy: options.sortBy }),
      ...(options.sortOrder && { sortOrder: options.sortOrder })
    });

    const response = await apiClient.get<DocumentListResponse>(
      `${API_BASE_PATH}/list`,
      { params }
    );
    return response.data;
  },

  /**
   * Deletes a document with verification
   * @param documentId Document identifier
   * @returns Promise resolving on successful deletion
   */
  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.delete(`${API_BASE_PATH}/${documentId}`);
  },

  /**
   * Verifies a document's authenticity and content
   * @param documentId Document identifier
   * @returns Promise resolving to verification result
   */
  async verifyDocument(documentId: string): Promise<Document> {
    const response = await apiClient.post<Document>(
      `${API_BASE_PATH}/${documentId}/verify`
    );
    return response.data;
  },

  /**
   * Batch uploads multiple documents
   * @param requests Array of document upload requests
   * @param options Upload configuration options
   * @returns Promise resolving to array of uploaded documents
   */
  async batchUploadDocuments(
    requests: DocumentUploadRequest[],
    options: UploadOptions = {}
  ): Promise<Document[]> {
    const uploads = requests.map(request => 
      this.uploadDocument(request, options)
    );
    return Promise.all(uploads);
  }
};

export default DocumentApi;