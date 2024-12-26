/**
 * @fileoverview Redux Toolkit slice for workflow state management
 * Implements comprehensive workflow state handling with optimistic updates,
 * caching, and real-time status tracking.
 * @version 1.0.0
 */

import { 
  createSlice, 
  createAsyncThunk, 
  createEntityAdapter,
  PayloadAction
} from '@reduxjs/toolkit'; // v2.0.0
import { 
  WorkflowState, 
  WorkflowTransitionRequest, 
  Workflow, 
  WorkflowResponse, 
  WorkflowError,
  isValidStateTransition 
} from '@/types/workflow.types';
import { workflowApi } from '@/api/workflow.api';
import type { RootState } from '@/store/store';

// Entity adapter for normalized workflow state management
const workflowAdapter = createEntityAdapter<Workflow>({
  selectId: (workflow) => workflow.id,
  sortComparer: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
});

// Interface for the workflow slice state
interface WorkflowSliceState {
  currentWorkflow: Workflow | null;
  workflowCache: Record<string, Workflow>;
  operationLoading: Record<string, boolean>;
  error: WorkflowError | null;
  lastUpdated: number;
  pendingRequests: Record<string, AbortController>;
}

// Initial state with entity adapter state
const initialState = workflowAdapter.getInitialState<WorkflowSliceState>({
  currentWorkflow: null,
  workflowCache: {},
  operationLoading: {},
  error: null,
  lastUpdated: 0,
  pendingRequests: {}
});

/**
 * Async thunk for creating a new workflow
 */
export const createWorkflow = createAsyncThunk<
  WorkflowResponse,
  string,
  { rejectValue: WorkflowError }
>(
  'workflow/create',
  async (applicationId, { rejectWithValue, signal }) => {
    try {
      const response = await workflowApi.createWorkflow(applicationId, { signal });
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'WORKFLOW_CREATE_ERROR',
        message: error.message || 'Failed to create workflow',
        details: error.details || {}
      });
    }
  }
);

/**
 * Async thunk for updating workflow state
 */
export const updateWorkflowState = createAsyncThunk<
  WorkflowResponse,
  { workflowId: string; transitionRequest: WorkflowTransitionRequest },
  { rejectValue: WorkflowError }
>(
  'workflow/updateState',
  async ({ workflowId, transitionRequest }, { getState, rejectWithValue }) => {
    try {
      // Validate state transition
      const state = getState() as RootState;
      const currentWorkflow = state.workflow.workflowCache[workflowId];
      
      if (!isValidStateTransition(currentWorkflow.currentState, transitionRequest.targetState)) {
        throw new Error('Invalid workflow state transition');
      }

      const response = await workflowApi.updateWorkflowState(workflowId, transitionRequest);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'WORKFLOW_UPDATE_ERROR',
        message: error.message || 'Failed to update workflow state',
        details: error.details || {}
      });
    }
  }
);

/**
 * Workflow slice definition with reducers and actions
 */
const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    setCurrentWorkflow: (state, action: PayloadAction<Workflow | null>) => {
      state.currentWorkflow = action.payload;
    },
    clearWorkflowError: (state) => {
      state.error = null;
    },
    invalidateCache: (state, action: PayloadAction<string>) => {
      delete state.workflowCache[action.payload];
    },
    abortPendingRequests: (state) => {
      Object.values(state.pendingRequests).forEach(controller => controller.abort());
      state.pendingRequests = {};
    }
  },
  extraReducers: (builder) => {
    builder
      // Create workflow reducers
      .addCase(createWorkflow.pending, (state, action) => {
        state.operationLoading[action.meta.requestId] = true;
        state.error = null;
      })
      .addCase(createWorkflow.fulfilled, (state, action) => {
        const workflow = action.payload.data;
        workflowAdapter.addOne(state, workflow);
        state.workflowCache[workflow.id] = workflow;
        state.currentWorkflow = workflow;
        state.operationLoading[action.meta.requestId] = false;
        state.lastUpdated = Date.now();
      })
      .addCase(createWorkflow.rejected, (state, action) => {
        state.operationLoading[action.meta.requestId] = false;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
          details: {}
        };
      })
      // Update workflow state reducers
      .addCase(updateWorkflowState.pending, (state, action) => {
        state.operationLoading[action.meta.requestId] = true;
        state.error = null;
      })
      .addCase(updateWorkflowState.fulfilled, (state, action) => {
        const workflow = action.payload.data;
        workflowAdapter.updateOne(state, {
          id: workflow.id,
          changes: workflow
        });
        state.workflowCache[workflow.id] = workflow;
        if (state.currentWorkflow?.id === workflow.id) {
          state.currentWorkflow = workflow;
        }
        state.operationLoading[action.meta.requestId] = false;
        state.lastUpdated = Date.now();
      })
      .addCase(updateWorkflowState.rejected, (state, action) => {
        state.operationLoading[action.meta.requestId] = false;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'An unexpected error occurred',
          details: {}
        };
      });
  }
});

// Export actions
export const {
  setCurrentWorkflow,
  clearWorkflowError,
  invalidateCache,
  abortPendingRequests
} = workflowSlice.actions;

// Export selectors
export const {
  selectById: selectWorkflowById,
  selectIds: selectWorkflowIds,
  selectEntities: selectWorkflowEntities,
  selectAll: selectAllWorkflows,
  selectTotal: selectTotalWorkflows
} = workflowAdapter.getSelectors<RootState>((state) => state.workflow);

// Custom memoized selectors
export const selectCurrentWorkflow = (state: RootState) => state.workflow.currentWorkflow;
export const selectWorkflowError = (state: RootState) => state.workflow.error;
export const selectWorkflowLoading = (state: RootState, requestId: string) => 
  state.workflow.operationLoading[requestId];
export const selectWorkflowFromCache = (state: RootState, workflowId: string) => 
  state.workflow.workflowCache[workflowId];
export const selectLastUpdated = (state: RootState) => state.workflow.lastUpdated;

// Export reducer
export default workflowSlice.reducer;