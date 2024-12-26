/// <reference types="vite/client" /> // @version ^4.4.0

/**
 * Type definitions for Vite environment variables
 * Provides strict typing for environment configuration
 */
interface ImportMetaEnv {
  /** API endpoint for the application */
  readonly VITE_API_ENDPOINT: string;
  /** Environment name (development/staging/production) */
  readonly VITE_ENV: string;
  /** Feature flag configurations */
  readonly VITE_FEATURES?: string;
  /** Authentication configuration */
  readonly VITE_AUTH_DOMAIN?: string;
  /** Application version */
  readonly VITE_APP_VERSION?: string;
  /** Base URL for the application */
  readonly VITE_BASE_URL: string;
  /** Debug mode flag */
  readonly VITE_DEBUG_MODE?: boolean;
  /** API timeout configuration */
  readonly VITE_API_TIMEOUT?: string;
  /** Analytics configuration */
  readonly VITE_ANALYTICS_ID?: string;
  /** CDN base URL */
  readonly VITE_CDN_URL?: string;
  [key: string]: string | boolean | undefined;
}

/**
 * Type augmentation for ImportMeta to include env
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Static asset imports type declarations
 * Supports modern image formats and style modules
 */

/**
 * SVG file imports
 * @returns string URL or component based on import type
 */
declare module '*.svg' {
  const content: string;
  export default content;
}

/**
 * PNG file imports
 * @returns string URL of the asset
 */
declare module '*.png' {
  const content: string;
  export default content;
}

/**
 * JPG file imports
 * @returns string URL of the asset
 */
declare module '*.jpg' {
  const content: string;
  export default content;
}

/**
 * JPEG file imports
 * @returns string URL of the asset
 */
declare module '*.jpeg' {
  const content: string;
  export default content;
}

/**
 * GIF file imports
 * @returns string URL of the asset
 */
declare module '*.gif' {
  const content: string;
  export default content;
}

/**
 * ICO file imports
 * @returns string URL of the asset
 */
declare module '*.ico' {
  const content: string;
  export default content;
}

/**
 * WebP file imports
 * @returns string URL of the asset
 */
declare module '*.webp' {
  const content: string;
  export default content;
}

/**
 * CSS Module imports with strict readonly typing
 * @returns Record of class names to their generated values
 */
declare module '*.module.css' {
  const classes: {
    readonly [key: string]: string;
  };
  export default classes;
}

/**
 * SCSS Module imports with strict readonly typing
 * @returns Record of class names to their generated values
 */
declare module '*.module.scss' {
  const classes: {
    readonly [key: string]: string;
  };
  export default classes;
}