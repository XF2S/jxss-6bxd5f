/**
 * @fileoverview Workflow API client module for enrollment application workflow management
 * Implements comprehensive workflow state management with enhanced error handling,
 * caching, and security features.
 * @version 1.0.0
 */

import { 
  WorkflowState, 
  WorkflowTransitionRequest, 
  Workflow, 
  WorkflowResponse, 
  WorkflowStateHistory,
  isValidStateTransition,
  WorkflowStateSchema,
  WorkflowTransitionRequestSchema,
  WorkflowResponseSchema
} from '@/types/workflow.types';
import { createApiClient, ApiError } from '@/config/api.config';
import { AxiosInstance, AxiosRequestConfig, CancelToken } from 'axios'; // v1.6.0

// Initialize API client instance
const apiClient: AxiosInstance = createApiClient();

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_RETRIES = 3;

// In-memory cache implementation
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * Workflow API client interface implementation
 * Provides methods for workflow management with enhanced features
 */
class WorkflowApiClient {
  private readonly baseUrl = '/api/workflows';

  /**
   * Creates a new workflow instance for an enrollment application
   * @param applicationId - UUID of the enrollment application
   * @param config - Optional request configuration
   * @returns Promise resolving to workflow response
   * @throws ApiError if creation fails
   */
  async createWorkflow(
    applicationId: string,
    config?: AxiosRequestConfig
  ): Promise<WorkflowResponse> {
    try {
      const response = await apiClient.post<WorkflowResponse>(
        this.baseUrl,
        { applicationId },
        {
          ...config,
          headers: {
            ...config?.headers,
            'X-Workflow-Operation': 'create'
          }
        }
      );

      // Validate response data
      const validationResult = WorkflowResponseSchema.safeParse(response.data);
      if (!validationResult.success) {
        throw new ApiError('Invalid workflow response data', 422, validationResult.error);
      }

      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves a workflow instance by ID with caching
   * @param workflowId - UUID of the workflow
   * @param config - Optional request configuration
   * @returns Promise resolving to workflow response
   * @throws ApiError if retrieval fails
   */
  async getWorkflow(
    workflowId: string,
    config?: AxiosRequestConfig
  ): Promise<WorkflowResponse> {
    const cacheKey = `workflow_${workflowId}`;
    const cachedData = this.getFromCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await apiClient.get<WorkflowResponse>(
        `${this.baseUrl}/${workflowId}`,
        config
      );

      // Validate response data
      const validationResult = WorkflowResponseSchema.safeParse(response.data);
      if (!validationResult.success) {
        throw new ApiError('Invalid workflow response data', 422, validationResult.error);
      }

      this.setInCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Updates the state of a workflow instance
   * @param workflowId - UUID of the workflow
   * @param transitionRequest - State transition request data
   * @param config - Optional request configuration
   * @returns Promise resolving to workflow response
   * @throws ApiError if update fails
   */
  async updateWorkflowState(
    workflowId: string,
    transitionRequest: WorkflowTransitionRequest,
    config?: AxiosRequestConfig
  ): Promise<WorkflowResponse> {
    // Validate transition request
    const validationResult = WorkflowTransitionRequestSchema.safeParse(transitionRequest);
    if (!validationResult.success) {
      throw new ApiError('Invalid transition request', 400, validationResult.error);
    }

    try {
      const currentWorkflow = await this.getWorkflow(workflowId);
      
      // Validate state transition
      if (!isValidStateTransition(currentWorkflow.data.currentState, transitionRequest.targetState)) {
        throw new ApiError(
          'Invalid state transition',
          400,
          { 
            currentState: currentWorkflow.data.currentState,
            targetState: transitionRequest.targetState
          }
        );
      }

      const response = await apiClient.put<WorkflowResponse>(
        `${this.baseUrl}/${workflowId}/state`,
        transitionRequest,
        {
          ...config,
          headers: {
            ...config?.headers,
            'X-Workflow-Operation': 'state_transition'
          }
        }
      );

      // Invalidate cache after successful update
      this.invalidateCache(`workflow_${workflowId}`);

      return response.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Retrieves the state transition history of a workflow
   * @param workflowId - UUID of the workflow
   * @param pagination - Pagination options
   * @param filters - Filter criteria
   * @returns Promise resolving to workflow history array
   * @throws ApiError if retrieval fails
   */
  async getWorkflowHistory(
    workflowId: string,
    pagination: { page: number; limit: number },
    filters?: Record<string, unknown>
  ): Promise<WorkflowStateHistory[]> {
    const cacheKey = `workflow_history_${workflowId}_${JSON.stringify(pagination)}_${JSON.stringify(filters)}`;
    const cachedData = this.getFromCache(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await apiClient.get<{ data: WorkflowStateHistory[] }>(
        `${this.baseUrl}/${workflowId}/history`,
        {
          params: {
            ...pagination,
            ...filters
          }
        }
      );

      this.setInCache(cacheKey, response.data.data);
      return response.data.data;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  /**
   * Handles API errors with enhanced error information
   * @param error - Error object from API call
   * @returns Standardized ApiError instance
   */
  private handleApiError(error: any): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    const statusCode = error.response?.status || 500;
    const message = error.response?.data?.message || 'An unexpected error occurred';
    const details = error.response?.data?.details || {};

    return new ApiError(message, statusCode, details);
  }

  /**
   * Retrieves data from cache if valid
   * @param key - Cache key
   * @returns Cached data or null if invalid/expired
   */
  private getFromCache(key: string): any | null {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  /**
   * Sets data in cache with timestamp
   * @param key - Cache key
   * @param data - Data to cache
   */
  private setInCache(key: string, data: any): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Invalidates cache entry
   * @param key - Cache key to invalidate
   */
  private invalidateCache(key: string): void {
    cache.delete(key);
  }
}

// Export singleton instance
export const workflowApi = new WorkflowApiClient();