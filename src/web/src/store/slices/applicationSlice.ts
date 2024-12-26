/**
 * @fileoverview Redux slice for managing enrollment application state
 * Implements comprehensive state management with optimized performance,
 * real-time status tracking, and strict type safety.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit'; // v2.0.0
import { 
  Application, 
  ApplicationFormData, 
  ApplicationStatus, 
  ApplicationError 
} from '@/types/application.types';
import { applicationApi } from '@/api/application.api';

/**
 * Interface for application slice state with enhanced loading states
 */
interface ApplicationState {
  applications: Application[];
  currentApplication: Application | null;
  loadingStates: { [key: string]: boolean };
  error: ApplicationError | null;
  totalApplications: number;
  currentPage: number;
  pageSize: number;
  lastUpdated: number;
}

/**
 * Initial state with type safety and default values
 */
const initialState: ApplicationState = {
  applications: [],
  currentApplication: null,
  loadingStates: {},
  error: null,
  totalApplications: 0,
  currentPage: 1,
  pageSize: 10,
  lastUpdated: 0
};

/**
 * Async thunk for creating a new application with validation
 */
export const createApplication = createAsyncThunk(
  'application/create',
  async (formData: ApplicationFormData, { rejectWithValue }) => {
    try {
      const response = await applicationApi.createApplication(formData);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'CREATE_ERROR',
        message: error.message || 'Failed to create application',
        details: error.details || {}
      });
    }
  },
  {
    condition: (_, { getState }) => !selectIsLoading(getState())
  }
);

/**
 * Async thunk for submitting an application with optimistic updates
 */
export const submitApplication = createAsyncThunk(
  'application/submit',
  async (applicationId: string, { rejectWithValue, dispatch }) => {
    try {
      // Optimistic update
      dispatch(applicationSlice.actions.setApplicationStatus({
        id: applicationId,
        status: ApplicationStatus.SUBMITTED
      }));

      const response = await applicationApi.submitApplication(applicationId);
      return response;
    } catch (error: any) {
      // Rollback optimistic update on error
      dispatch(applicationSlice.actions.setApplicationStatus({
        id: applicationId,
        status: ApplicationStatus.DRAFT
      }));
      return rejectWithValue({
        code: error.code || 'SUBMIT_ERROR',
        message: error.message || 'Failed to submit application',
        details: error.details || {}
      });
    }
  },
  {
    condition: (_, { getState }) => !selectIsLoading(getState())
  }
);

/**
 * Async thunk for fetching applications with pagination and caching
 */
export const fetchApplications = createAsyncThunk(
  'application/fetchAll',
  async ({ page, pageSize, filters }: { 
    page: number; 
    pageSize: number; 
    filters?: Record<string, unknown>;
  }, { rejectWithValue }) => {
    try {
      const response = await applicationApi.getUserApplications(page, pageSize, filters);
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'FETCH_ERROR',
        message: error.message || 'Failed to fetch applications',
        details: error.details || {}
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { application: ApplicationState };
      const lastUpdate = state.application.lastUpdated;
      const CACHE_DURATION = 30000; // 30 seconds
      return Date.now() - lastUpdate > CACHE_DURATION;
    }
  }
);

/**
 * Async thunk for updating application status with comments
 */
export const updateStatus = createAsyncThunk(
  'application/updateStatus',
  async ({ applicationId, status, comments }: {
    applicationId: string;
    status: ApplicationStatus;
    comments: string;
  }, { rejectWithValue }) => {
    try {
      const response = await applicationApi.updateApplicationStatus(
        applicationId,
        status,
        comments
      );
      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'UPDATE_ERROR',
        message: error.message || 'Failed to update application status',
        details: error.details || {}
      });
    }
  },
  {
    condition: (_, { getState }) => !selectIsLoading(getState())
  }
);

/**
 * Application slice with comprehensive state management
 */
const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    setApplicationStatus: (state, action) => {
      const { id, status } = action.payload;
      const application = state.applications.find(app => app.id === id);
      if (application) {
        application.status = status;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      // Create application reducers
      .addCase(createApplication.pending, (state) => {
        state.loadingStates['create'] = true;
        state.error = null;
      })
      .addCase(createApplication.fulfilled, (state, action) => {
        state.applications.unshift(action.payload);
        state.loadingStates['create'] = false;
        state.lastUpdated = Date.now();
      })
      .addCase(createApplication.rejected, (state, action) => {
        state.loadingStates['create'] = false;
        state.error = action.payload as ApplicationError;
      })

      // Submit application reducers
      .addCase(submitApplication.pending, (state) => {
        state.loadingStates['submit'] = true;
        state.error = null;
      })
      .addCase(submitApplication.fulfilled, (state, action) => {
        const index = state.applications.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications[index] = action.payload;
        }
        state.loadingStates['submit'] = false;
        state.lastUpdated = Date.now();
      })
      .addCase(submitApplication.rejected, (state, action) => {
        state.loadingStates['submit'] = false;
        state.error = action.payload as ApplicationError;
      })

      // Fetch applications reducers
      .addCase(fetchApplications.pending, (state) => {
        state.loadingStates['fetch'] = true;
        state.error = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.applications = action.payload.data;
        state.totalApplications = action.payload.total;
        state.loadingStates['fetch'] = false;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.loadingStates['fetch'] = false;
        state.error = action.payload as ApplicationError;
      })

      // Update status reducers
      .addCase(updateStatus.pending, (state) => {
        state.loadingStates['update'] = true;
        state.error = null;
      })
      .addCase(updateStatus.fulfilled, (state, action) => {
        const index = state.applications.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications[index] = action.payload;
        }
        state.loadingStates['update'] = false;
        state.lastUpdated = Date.now();
      })
      .addCase(updateStatus.rejected, (state, action) => {
        state.loadingStates['update'] = false;
        state.error = action.payload as ApplicationError;
      });
  }
});

// Memoized selectors for optimized state access
export const selectApplications = createSelector(
  [(state: { application: ApplicationState }) => state.application.applications],
  (applications) => applications
);

export const selectCurrentApplication = createSelector(
  [(state: { application: ApplicationState }) => state.application.currentApplication],
  (currentApplication) => currentApplication
);

export const selectIsLoading = createSelector(
  [(state: { application: ApplicationState }) => state.application.loadingStates],
  (loadingStates) => Object.values(loadingStates).some(Boolean)
);

export const selectError = createSelector(
  [(state: { application: ApplicationState }) => state.application.error],
  (error) => error
);

export const selectPaginationInfo = createSelector(
  [(state: { application: ApplicationState }) => state.application],
  (application) => ({
    currentPage: application.currentPage,
    pageSize: application.pageSize,
    totalApplications: application.totalApplications
  })
);

// Export actions and reducer
export const { setApplicationStatus, clearError, resetState } = applicationSlice.actions;
export default applicationSlice.reducer;