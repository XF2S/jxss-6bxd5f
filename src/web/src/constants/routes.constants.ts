// @version TypeScript 5.0+
// @version React Router 6.x

/**
 * Type definition for available user roles in the system
 * '*' represents all authenticated users
 */
export type UserRole = 'admin' | 'staff' | 'reviewer' | 'applicant' | '*';

/**
 * Type definition for route categories in the system
 */
export type RouteType = 'AUTH' | 'DASHBOARD' | 'APPLICATION' | 'DOCUMENT' | 'PROFILE' | 'SETTINGS';

/**
 * Interface for route parameters used in dynamic routes
 */
export interface RouteParams {
  id?: string;
  token?: string;
}

/**
 * Interface for route configuration with access control
 */
export interface RouteConfig {
  path: string;
  roles: UserRole[];
  exact: boolean;
  auth: boolean;
  params?: Record<string, string>;
}

/**
 * Authentication related routes
 */
const AUTH = {
  LOGIN: {
    path: '/auth/login',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: false
  },
  REGISTER: {
    path: '/auth/register',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: false
  },
  FORGOT_PASSWORD: {
    path: '/auth/forgot-password',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: false
  },
  RESET_PASSWORD: {
    path: '/auth/reset-password/:token',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: false,
    params: { token: 'string' }
  },
  VERIFY_EMAIL: {
    path: '/auth/verify-email/:token',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: false,
    params: { token: 'string' }
  },
  MFA_SETUP: {
    path: '/auth/mfa-setup',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: true
  }
} as const;

/**
 * Dashboard related routes
 */
const DASHBOARD = {
  HOME: {
    path: '/dashboard',
    roles: ['applicant', 'staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true
  },
  OVERVIEW: {
    path: '/dashboard/overview',
    roles: ['staff', 'admin'] as UserRole[],
    exact: true,
    auth: true
  },
  ANALYTICS: {
    path: '/dashboard/analytics',
    roles: ['admin'] as UserRole[],
    exact: true,
    auth: true
  }
} as const;

/**
 * Application management routes
 */
const APPLICATION = {
  LIST: {
    path: '/applications',
    roles: ['applicant', 'staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true
  },
  NEW: {
    path: '/applications/new',
    roles: ['applicant'] as UserRole[],
    exact: true,
    auth: true
  },
  DETAIL: {
    path: '/applications/:id',
    roles: ['applicant', 'staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true,
    params: { id: 'string' }
  },
  EDIT: {
    path: '/applications/:id/edit',
    roles: ['applicant'] as UserRole[],
    exact: true,
    auth: true,
    params: { id: 'string' }
  },
  REVIEW: {
    path: '/applications/:id/review',
    roles: ['staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true,
    params: { id: 'string' }
  }
} as const;

/**
 * Document management routes
 */
const DOCUMENT = {
  LIST: {
    path: '/documents',
    roles: ['applicant', 'staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true
  },
  UPLOAD: {
    path: '/documents/upload',
    roles: ['applicant'] as UserRole[],
    exact: true,
    auth: true
  },
  DETAIL: {
    path: '/documents/:id',
    roles: ['applicant', 'staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true,
    params: { id: 'string' }
  },
  PREVIEW: {
    path: '/documents/:id/preview',
    roles: ['applicant', 'staff', 'admin', 'reviewer'] as UserRole[],
    exact: true,
    auth: true,
    params: { id: 'string' }
  }
} as const;

/**
 * User profile routes
 */
const PROFILE = {
  VIEW: {
    path: '/profile',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: true
  },
  EDIT: {
    path: '/profile/edit',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: true
  },
  SECURITY: {
    path: '/profile/security',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: true
  },
  NOTIFICATIONS: {
    path: '/profile/notifications',
    roles: ['*'] as UserRole[],
    exact: true,
    auth: true
  }
} as const;

/**
 * System settings routes
 */
const SETTINGS = {
  GENERAL: {
    path: '/settings',
    roles: ['admin'] as UserRole[],
    exact: true,
    auth: true
  },
  ACCOUNT: {
    path: '/settings/account',
    roles: ['admin'] as UserRole[],
    exact: true,
    auth: true
  },
  PREFERENCES: {
    path: '/settings/preferences',
    roles: ['admin'] as UserRole[],
    exact: true,
    auth: true
  },
  SECURITY: {
    path: '/settings/security',
    roles: ['admin'] as UserRole[],
    exact: true,
    auth: true
  }
} as const;

/**
 * Centralized route configuration object with type safety
 * Exports all route definitions with role-based access control
 */
export const ROUTES = {
  AUTH,
  DASHBOARD,
  APPLICATION,
  DOCUMENT,
  PROFILE,
  SETTINGS
} as const;