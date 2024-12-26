/**
 * @fileoverview Authentication Redux slice for the Enrollment System
 * Implements comprehensive authentication state management with MFA support,
 * token refresh, and role-based authorization.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v2.0.0
import type { LoginCredentials, AuthState, AuthResponse, AuthError } from '@/types/auth.types';
import { authApi } from '@/api/auth.api';
import { UserRole } from '@backend/shared/models/user.model';

// Constants for authentication operations
const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Initial authentication state
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: {
    login: false,
    refresh: false,
    logout: false
  },
  error: null,
  mfaPending: false,
  tokenRefreshInProgress: false
};

/**
 * Async thunk for user login with MFA support
 */
export const login = createAsyncThunk<
  AuthResponse,
  LoginCredentials,
  { rejectValue: AuthError }
>(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue, dispatch }) => {
    try {
      const response = await authApi.login(credentials);

      // Handle MFA challenge
      if (response.requiresMfa && !credentials.mfaCode) {
        return {
          ...response,
          mfaPending: true
        };
      }

      // Schedule token refresh
      const refreshInterval = setInterval(() => {
        dispatch(refreshToken());
      }, TOKEN_REFRESH_INTERVAL);

      // Store refresh interval ID for cleanup
      window.__refreshTokenInterval = refreshInterval;

      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed',
        details: error.details || {}
      });
    }
  }
);

/**
 * Async thunk for token refresh with retry mechanism
 */
export const refreshToken = createAsyncThunk<
  AuthResponse,
  void,
  { rejectValue: AuthError }
>(
  'auth/refreshToken',
  async (_, { rejectWithValue, getState }) => {
    const state = getState() as { auth: AuthState };
    
    if (state.auth.tokenRefreshInProgress) {
      return rejectWithValue({
        code: 'REFRESH_IN_PROGRESS',
        message: 'Token refresh already in progress',
        details: {}
      });
    }

    try {
      return await authApi.refreshToken();
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'REFRESH_ERROR',
        message: error.message || 'Token refresh failed',
        details: error.details || {}
      });
    }
  }
);

/**
 * Async thunk for user logout
 */
export const logout = createAsyncThunk<
  void,
  void,
  { rejectValue: AuthError }
>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
      
      // Clear token refresh interval
      if (window.__refreshTokenInterval) {
        clearInterval(window.__refreshTokenInterval);
      }
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'LOGOUT_ERROR',
        message: error.message || 'Logout failed',
        details: error.details || {}
      });
    }
  }
);

/**
 * Authentication slice with comprehensive state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetMfaStatus: (state) => {
      state.mfaPending = false;
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder
      .addCase(login.pending, (state) => {
        state.loading.login = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        if (action.payload.requiresMfa) {
          state.mfaPending = true;
        } else {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.mfaPending = false;
        }
        state.loading.login = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading.login = false;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
          details: {}
        };
      })

    // Token refresh action handlers
    builder
      .addCase(refreshToken.pending, (state) => {
        state.loading.refresh = true;
        state.tokenRefreshInProgress = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.loading.refresh = false;
        state.tokenRefreshInProgress = false;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.loading.refresh = false;
        state.tokenRefreshInProgress = false;
        state.isAuthenticated = false;
        state.user = null;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
          details: {}
        };
      })

    // Logout action handlers
    builder
      .addCase(logout.pending, (state) => {
        state.loading.logout = true;
      })
      .addCase(logout.fulfilled, (state) => {
        return { ...initialState };
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading.logout = false;
        state.error = action.payload || {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
          details: {}
        };
      });
  }
});

// Export actions
export const { clearError, resetMfaStatus } = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectMfaPending = (state: { auth: AuthState }) => state.auth.mfaPending;

// Permission check selector
export const selectHasPermission = (permission: string) => 
  (state: { auth: AuthState }) => {
    const user = state.auth.user;
    if (!user) return false;
    
    // Super admin has all permissions
    if (user.roles.includes(UserRole.SUPER_ADMIN)) return true;
    
    // Check specific permission based on user role
    return user.roles.some(role => {
      const permissions = DEFAULT_ROLE_PERMISSIONS[role];
      return permissions.includes(permission) || permissions.includes('*');
    });
  };

// Export reducer
export default authSlice.reducer;

// Declare refresh interval for TypeScript
declare global {
  interface Window {
    __refreshTokenInterval?: NodeJS.Timeout;
  }
}