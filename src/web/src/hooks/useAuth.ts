/**
 * @fileoverview Enhanced authentication hook for the Enrollment System
 * Implements secure authentication, MFA, session management, and RBAC
 * @version 1.0.0
 */

import { useDispatch, useSelector } from 'react-redux'; // v9.0.0
import { useCallback, useEffect } from 'react'; // v18.0.0
import jwtDecode from 'jwt-decode'; // v4.0.0

import { 
  LoginCredentials, 
  AuthState, 
  User, 
  AuthError 
} from '@/types/auth.types';
import { UserRole, DEFAULT_ROLE_PERMISSIONS } from '@backend/shared/models/user.model';

// Constants for authentication configuration
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1000;
const MFA_CODE_LENGTH = 6;
const TOKEN_STORAGE_KEY = 'auth_tokens';
const FINGERPRINT_KEY = 'device_fingerprint';

/**
 * Enhanced authentication hook providing comprehensive auth functionality
 * Implements secure session management, MFA, and role-based access control
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  
  // Select auth state from Redux store
  const authState = useSelector((state: { auth: AuthState }) => state.auth);
  
  /**
   * Generates a device fingerprint for enhanced security
   * @returns Promise<string> Device fingerprint hash
   */
  const generateDeviceFingerprint = useCallback(async (): Promise<string> => {
    try {
      const userAgent = window.navigator.userAgent;
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const fingerprintData = `${userAgent}-${screenRes}-${timeZone}`;
      
      // Generate SHA-256 hash of fingerprint data
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprintData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      return '';
    }
  }, []);

  /**
   * Validates JWT token expiration
   * @param token JWT token to validate
   * @returns boolean indicating if token is expired
   */
  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const decoded = jwtDecode<{ exp: number }>(token);
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }, []);

  /**
   * Securely stores authentication tokens
   * @param accessToken JWT access token
   * @param refreshToken JWT refresh token
   */
  const storeTokens = useCallback((accessToken: string, refreshToken: string): void => {
    try {
      const tokens = { accessToken, refreshToken };
      const encryptedTokens = btoa(JSON.stringify(tokens));
      sessionStorage.setItem(TOKEN_STORAGE_KEY, encryptedTokens);
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }, []);

  /**
   * Enhanced login function with MFA and device fingerprinting
   * @param credentials Login credentials including MFA code
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      // Generate device fingerprint
      const deviceFingerprint = await generateDeviceFingerprint();
      
      // Dispatch login action with enhanced security
      const response = await dispatch({
        type: 'auth/login',
        payload: {
          ...credentials,
          deviceFingerprint
        }
      }).unwrap();

      if (response.requiresMfa && !credentials.mfaCode) {
        dispatch({ type: 'auth/setMfaRequired', payload: true });
        return;
      }

      // Store tokens securely
      storeTokens(response.accessToken, response.refreshToken);
      
      // Store device fingerprint
      localStorage.setItem(FINGERPRINT_KEY, deviceFingerprint);
      
    } catch (error) {
      console.error('Login failed:', error);
      dispatch({
        type: 'auth/setError',
        payload: {
          code: 'AUTH_ERROR',
          message: 'Login failed. Please try again.',
          details: error
        }
      });
    }
  }, [dispatch, generateDeviceFingerprint, storeTokens]);

  /**
   * Handles MFA verification
   * @param code TOTP verification code
   */
  const verifyMfa = useCallback(async (code: string): Promise<void> => {
    if (code.length !== MFA_CODE_LENGTH) {
      dispatch({
        type: 'auth/setError',
        payload: {
          code: 'MFA_ERROR',
          message: 'Invalid MFA code length',
          details: { requiredLength: MFA_CODE_LENGTH }
        }
      });
      return;
    }

    try {
      const response = await dispatch({
        type: 'auth/verifyMfa',
        payload: { code }
      }).unwrap();

      storeTokens(response.accessToken, response.refreshToken);
      dispatch({ type: 'auth/setMfaRequired', payload: false });
    } catch (error) {
      console.error('MFA verification failed:', error);
      dispatch({
        type: 'auth/setError',
        payload: {
          code: 'MFA_ERROR',
          message: 'MFA verification failed. Please try again.',
          details: error
        }
      });
    }
  }, [dispatch, storeTokens]);

  /**
   * Implements secure logout with token revocation
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await dispatch({ type: 'auth/logout' }).unwrap();
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(FINGERPRINT_KEY);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [dispatch]);

  /**
   * Refreshes authentication tokens with exponential backoff
   * @param attempt Current retry attempt number
   */
  const refreshToken = useCallback(async (attempt: number = 0): Promise<void> => {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      await logout();
      return;
    }

    try {
      const response = await dispatch({ type: 'auth/refreshToken' }).unwrap();
      storeTokens(response.accessToken, response.refreshToken);
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Implement exponential backoff
      const backoffTime = RETRY_BACKOFF_MS * Math.pow(2, attempt);
      setTimeout(() => refreshToken(attempt + 1), backoffTime);
    }
  }, [dispatch, logout, storeTokens]);

  /**
   * Checks if user has required permission
   * @param permission Permission to check
   * @returns boolean indicating if user has permission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.user?.roles) return false;

    return authState.user.roles.some(role => {
      const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role as UserRole];
      return rolePermissions.includes('*') || rolePermissions.includes(permission);
    });
  }, [authState.user]);

  // Setup automatic token refresh
  useEffect(() => {
    if (authState.isAuthenticated) {
      const refreshInterval = setInterval(() => {
        refreshToken();
      }, TOKEN_REFRESH_INTERVAL);

      return () => clearInterval(refreshInterval);
    }
  }, [authState.isAuthenticated, refreshToken]);

  return {
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    login,
    logout,
    refreshToken,
    verifyMfa,
    hasPermission
  };
};