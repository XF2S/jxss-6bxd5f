// @version path@latest
import path from 'path';

/**
 * Base path for all image assets
 */
const IMAGE_BASE_PATH = '/assets/images/';

/**
 * Supported image formats in order of preference
 */
const SUPPORTED_FORMATS = ['webp', 'png', 'svg'] as const;
type ImageFormat = typeof SUPPORTED_FORMATS[number];

/**
 * Standard image sizes following Material Design 3 guidelines
 */
const IMAGE_SIZES = {
  sm: 24,  // Small icons and avatars
  md: 48,  // Medium components
  lg: 96,  // Large display elements
  xl: 192  // Extra large hero images
} as const;
type ImageSize = keyof typeof IMAGE_SIZES;

/**
 * Type definition for image asset configuration
 */
export type ImageAsset = {
  path: string;
  alt: string;
  formats: {
    [key in ImageFormat]?: {
      [size in ImageSize]?: string;
    };
  };
};

/**
 * Constructs the full path for an image asset with format fallback support
 * @param imageName - Base name of the image file
 * @param format - Desired image format
 * @param size - Optional size variant
 * @returns Full path to the image asset
 */
export const getImagePath = (
  imageName: string,
  format: ImageFormat,
  size?: ImageSize
): string => {
  const basePath = path.join(IMAGE_BASE_PATH, imageName);
  const sizeStr = size ? `_${IMAGE_SIZES[size]}` : '';
  return `${basePath}${sizeStr}.${format}`;
};

/**
 * Validates the existence and integrity of an image asset
 * @param asset - Image asset to validate
 * @returns Boolean indicating validation result
 */
export const validateImageAsset = (asset: ImageAsset): boolean => {
  if (!asset.path || !asset.formats) return false;
  
  // Check if at least one supported format is available
  return SUPPORTED_FORMATS.some(format => 
    Object.keys(asset.formats).includes(format)
  );
};

/**
 * Light theme application logo
 */
export const logoLight: ImageAsset = {
  path: 'logo/light',
  alt: 'Enrollment System Logo - Light Theme',
  formats: {
    webp: {
      md: getImagePath('logo/light', 'webp', 'md'),
      lg: getImagePath('logo/light', 'webp', 'lg')
    },
    png: {
      md: getImagePath('logo/light', 'png', 'md'),
      lg: getImagePath('logo/light', 'png', 'lg')
    }
  }
};

/**
 * Dark theme application logo
 */
export const logoDark: ImageAsset = {
  path: 'logo/dark',
  alt: 'Enrollment System Logo - Dark Theme',
  formats: {
    webp: {
      md: getImagePath('logo/dark', 'webp', 'md'),
      lg: getImagePath('logo/dark', 'webp', 'lg')
    },
    png: {
      md: getImagePath('logo/dark', 'png', 'md'),
      lg: getImagePath('logo/dark', 'png', 'lg')
    }
  }
};

/**
 * Default user avatar placeholder
 */
export const defaultAvatar: ImageAsset = {
  path: 'avatars/default',
  alt: 'Default User Avatar',
  formats: {
    webp: {
      sm: getImagePath('avatars/default', 'webp', 'sm'),
      md: getImagePath('avatars/default', 'webp', 'md')
    },
    png: {
      sm: getImagePath('avatars/default', 'png', 'sm'),
      md: getImagePath('avatars/default', 'png', 'md')
    }
  }
};

/**
 * Login page background images
 */
export const loginBackground: ImageAsset = {
  path: 'backgrounds/login',
  alt: 'Login Page Background',
  formats: {
    webp: {
      lg: getImagePath('backgrounds/login', 'webp', 'lg'),
      xl: getImagePath('backgrounds/login', 'webp', 'xl')
    },
    png: {
      lg: getImagePath('backgrounds/login', 'png', 'lg'),
      xl: getImagePath('backgrounds/login', 'png', 'xl')
    }
  }
};

/**
 * Document preview placeholder
 */
export const documentPlaceholder: ImageAsset = {
  path: 'placeholders/document',
  alt: 'Document Preview Placeholder',
  formats: {
    svg: {
      md: getImagePath('placeholders/document', 'svg', 'md')
    },
    png: {
      md: getImagePath('placeholders/document', 'png', 'md')
    }
  }
};

/**
 * Empty state illustrations
 */
export const emptyState: ImageAsset = {
  path: 'illustrations/empty-state',
  alt: 'No Content Available',
  formats: {
    svg: {
      lg: getImagePath('illustrations/empty-state', 'svg', 'lg')
    },
    webp: {
      lg: getImagePath('illustrations/empty-state', 'webp', 'lg')
    },
    png: {
      lg: getImagePath('illustrations/empty-state', 'png', 'lg')
    }
  }
};

// Export all image assets as a collection for easy access
export const images = {
  logoLight,
  logoDark,
  defaultAvatar,
  loginBackground,
  documentPlaceholder,
  emptyState
} as const;

export default images;