// @mui/material v5.14.x
import { createTheme, ThemeOptions, PaletteOptions, Components } from '@mui/material';
import type { Theme, TypographyOptions } from '@mui/material/styles';

// Storage key for persisting theme preference
export const THEME_STORAGE_KEY = 'app-theme-mode';

// Media query for system dark mode preference
export const SYSTEM_DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

// Base configuration constants
export const SPACING_UNIT = 4;
export const TYPOGRAPHY_SCALE_RATIO = 1.2;
export const MIN_CONTRAST_RATIO = 4.5;
export const HIGH_CONTRAST_RATIO = 7;

// Theme mode enumeration
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  HIGH_CONTRAST = 'high-contrast'
}

// Interface for accessibility options
export interface AccessibilityOptions {
  focusRingColor: string;
  focusRingWidth: number;
  contrastRatio: number;
  reducedMotion: boolean;
}

// Extended theme options interface
export interface CustomThemeOptions extends ThemeOptions {
  mode: ThemeMode;
  accessibility?: AccessibilityOptions;
}

/**
 * Calculates relative luminance of a color
 * @param r Red value (0-255)
 * @param g Green value (0-255)
 * @param b Blue value (0-255)
 * @returns Relative luminance value
 */
const calculateRelativeLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(val => 
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Validates contrast ratio between two colors
 * @param foreground Foreground color in hex format
 * @param background Background color in hex format
 * @param minRatio Minimum required contrast ratio
 * @returns Boolean indicating if contrast ratio is sufficient
 */
export const validateContrastRatio = (
  foreground: string,
  background: string,
  minRatio: number = MIN_CONTRAST_RATIO
): boolean => {
  const hexToRgb = (hex: string): number[] => {
    const rgb = hex.replace('#', '').match(/.{2}/g);
    return rgb ? rgb.map(x => parseInt(x, 16)) : [0, 0, 0];
  };

  const [fR, fG, fB] = hexToRgb(foreground);
  const [bR, bG, bB] = hexToRgb(background);

  const l1 = calculateRelativeLuminance(fR, fG, fB);
  const l2 = calculateRelativeLuminance(bR, bG, bB);

  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio >= minRatio;
};

/**
 * Generates theme palette based on selected mode
 * @param mode Selected theme mode
 * @returns Material-UI palette configuration
 */
export const getThemePalette = (mode: ThemeMode): PaletteOptions => {
  const palettes = {
    [ThemeMode.LIGHT]: {
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
        contrastText: '#ffffff'
      },
      secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
        contrastText: '#ffffff'
      },
      background: {
        default: '#ffffff',
        paper: '#f5f5f5'
      },
      text: {
        primary: '#1c1c1c',
        secondary: '#616161'
      }
    },
    [ThemeMode.DARK]: {
      primary: {
        main: '#90caf9',
        light: '#e3f2fd',
        dark: '#42a5f5',
        contrastText: '#000000'
      },
      secondary: {
        main: '#ce93d8',
        light: '#f3e5f5',
        dark: '#ab47bc',
        contrastText: '#000000'
      },
      background: {
        default: '#121212',
        paper: '#1e1e1e'
      },
      text: {
        primary: '#ffffff',
        secondary: '#b0b0b0'
      }
    },
    [ThemeMode.HIGH_CONTRAST]: {
      primary: {
        main: '#ffffff',
        light: '#ffffff',
        dark: '#ffffff',
        contrastText: '#000000'
      },
      secondary: {
        main: '#ffffff',
        light: '#ffffff',
        dark: '#ffffff',
        contrastText: '#000000'
      },
      background: {
        default: '#000000',
        paper: '#000000'
      },
      text: {
        primary: '#ffffff',
        secondary: '#ffffff'
      }
    }
  };

  const basePalette = palettes[mode];

  // Ensure all color combinations meet contrast requirements
  Object.entries(basePalette).forEach(([key, value]) => {
    if (typeof value === 'object' && 'main' in value && 'contrastText' in value) {
      const minRatio = mode === ThemeMode.HIGH_CONTRAST ? HIGH_CONTRAST_RATIO : MIN_CONTRAST_RATIO;
      if (!validateContrastRatio(value.contrastText, value.main, minRatio)) {
        console.warn(`Contrast ratio not met for ${key} color combination`);
      }
    }
  });

  return {
    ...basePalette,
    mode: mode === ThemeMode.HIGH_CONTRAST ? 'dark' : mode,
    error: {
      main: mode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#f44336',
      light: mode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#e57373',
      dark: mode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#d32f2f',
      contrastText: mode === ThemeMode.HIGH_CONTRAST ? '#000000' : '#ffffff'
    },
    warning: {
      main: mode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#ffa726',
      light: mode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#ffb74d',
      dark: mode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#f57c00',
      contrastText: mode === ThemeMode.HIGH_CONTRAST ? '#000000' : '#000000'
    }
  };
};

/**
 * Creates a custom Material-UI theme with accessibility features
 * @param mode Selected theme mode
 * @param options Additional theme options
 * @returns Configured Material-UI theme
 */
export const createCustomTheme = (
  mode: ThemeMode,
  options?: Partial<CustomThemeOptions>
): Theme => {
  const baseTypography: TypographyOptions = {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 16,
    htmlFontSize: 16,
    h1: { fontSize: `${Math.pow(TYPOGRAPHY_SCALE_RATIO, 6)}rem` },
    h2: { fontSize: `${Math.pow(TYPOGRAPHY_SCALE_RATIO, 5)}rem` },
    h3: { fontSize: `${Math.pow(TYPOGRAPHY_SCALE_RATIO, 4)}rem` },
    h4: { fontSize: `${Math.pow(TYPOGRAPHY_SCALE_RATIO, 3)}rem` },
    h5: { fontSize: `${Math.pow(TYPOGRAPHY_SCALE_RATIO, 2)}rem` },
    h6: { fontSize: `${Math.pow(TYPOGRAPHY_SCALE_RATIO, 1)}rem` }
  };

  const componentOverrides: Components = {
    MuiCssBaseline: {
      styleOverrides: {
        '@media (prefers-reduced-motion: reduce)': {
          '*': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important'
          }
        }
      }
    },
    MuiFocusRing: {
      styleOverrides: {
        root: {
          outline: `${options?.accessibility?.focusRingWidth || 2}px solid ${options?.accessibility?.focusRingColor || '#1976d2'}`
        }
      }
    }
  };

  return createTheme({
    palette: getThemePalette(mode),
    typography: baseTypography,
    spacing: SPACING_UNIT,
    components: componentOverrides,
    ...options
  });
};