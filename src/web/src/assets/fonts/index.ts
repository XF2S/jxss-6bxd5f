/**
 * @fileoverview Central font management system implementing Material Design 3 typography
 * with support for multiple weights, styles, and internationalization.
 * @version 1.0.0
 */

// External imports
// @fontsource/roboto v5.0.8 - Primary font family
import '@fontsource/roboto/300.css';  // Light
import '@fontsource/roboto/400.css';  // Regular
import '@fontsource/roboto/500.css';  // Medium
import '@fontsource/roboto/700.css';  // Bold
import '@fontsource/roboto/300-italic.css';
import '@fontsource/roboto/400-italic.css';
import '@fontsource/roboto/500-italic.css';
import '@fontsource/roboto/700-italic.css';

// @fontsource/roboto-mono v5.0.8 - Monospace font
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/700.css';

// Type definitions
export type FontWeightKey = 'light' | 'regular' | 'medium' | 'bold';
export type FontStyleKey = 'normal' | 'italic';
export type FontDisplayKey = 'swap' | 'block' | 'fallback';

export interface FontOptions {
  weight?: FontWeightKey;
  style?: FontStyleKey;
  display?: FontDisplayKey;
  useSystemFallback?: boolean;
}

export interface FontLoadOptions extends FontOptions {
  preload?: boolean;
  weights?: FontWeightKey[];
  styles?: FontStyleKey[];
}

// Font configuration constants
export const FONT_WEIGHTS: Record<FontWeightKey, number> = {
  light: 300,
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

export const FONT_STYLES: Record<FontStyleKey, string> = {
  normal: 'normal',
  italic: 'italic',
} as const;

export const FONT_DISPLAY: Record<FontDisplayKey, string> = {
  swap: 'swap',
  block: 'block',
  fallback: 'fallback',
} as const;

// Font family definitions with comprehensive fallbacks
export const FONT_FAMILIES = {
  primary: 'Roboto',
  monospace: 'Roboto Mono',
} as const;

// System font fallbacks by platform
const SYSTEM_FALLBACKS = {
  apple: '-apple-system, BlinkMacSystemFont',
  microsoft: 'Segoe UI',
  android: 'Roboto',
  linux: 'Ubuntu, Cantarell',
} as const;

// Unicode fallbacks for international character support
const UNICODE_FALLBACKS = {
  chinese: '"Noto Sans SC", "Microsoft YaHei"',
  japanese: '"Noto Sans JP", "Hiragino Sans"',
  korean: '"Noto Sans KR", "Malgun Gothic"',
  arabic: '"Noto Sans Arabic", "Arabic UI Display"',
} as const;

/**
 * Generates a complete font stack with appropriate fallbacks for a given font family
 * @param fontFamily - Primary font family name
 * @param options - Font configuration options
 * @returns Complete font stack string with system and Unicode fallbacks
 */
export const getFontFamilyStack = (
  fontFamily: string,
  options: FontOptions = {}
): string => {
  const {
    weight = 'regular',
    style = 'normal',
    useSystemFallback = true,
  } = options;

  // Build the primary font family string
  let fontStack = `"${fontFamily}"`;

  // Add system-specific fallbacks if enabled
  if (useSystemFallback) {
    fontStack += `, ${Object.values(SYSTEM_FALLBACKS).join(', ')}`;
  }

  // Add Unicode fallbacks for international character support
  fontStack += `, ${Object.values(UNICODE_FALLBACKS).join(', ')}`;

  // Add generic fallback category based on font family
  const genericFallback = fontFamily === FONT_FAMILIES.monospace
    ? 'monospace'
    : 'sans-serif';
  
  return `${fontStack}, ${genericFallback}`;
};

/**
 * Dynamically loads a font family with specified weights and styles
 * @param fontFamily - Font family to load
 * @param options - Font loading configuration options
 * @returns Promise that resolves when font loading is complete
 */
export const loadFontFamily = async (
  fontFamily: string,
  options: FontLoadOptions = {}
): Promise<void> => {
  const {
    weights = ['regular'],
    styles = ['normal'],
    preload = false,
    display = 'swap',
  } = options;

  try {
    // Track loading performance
    const startTime = performance.now();

    // Create font loading promises for each combination
    const loadingPromises = weights.flatMap(weight =>
      styles.map(async style => {
        const fontWeight = FONT_WEIGHTS[weight];
        const fontStyle = FONT_STYLES[style];
        
        // Construct font face observer
        const fontFace = new FontFace(
          fontFamily,
          `local('${fontFamily}'), url(${fontFamily}-${fontWeight}${style === 'italic' ? '-italic' : ''}.woff2)`,
          {
            weight: fontWeight.toString(),
            style: fontStyle,
            display: display,
          }
        );

        // Preload if specified
        if (preload) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'font';
          link.href = `${fontFamily}-${fontWeight}${style === 'italic' ? '-italic' : ''}.woff2`;
          document.head.appendChild(link);
        }

        // Load the font
        await fontFace.load();
        document.fonts.add(fontFace);
      })
    );

    // Wait for all fonts to load
    await Promise.all(loadingPromises);

    // Log performance metrics
    const loadTime = performance.now() - startTime;
    console.debug(`Font family ${fontFamily} loaded in ${loadTime}ms`);

  } catch (error) {
    console.error(`Error loading font family ${fontFamily}:`, error);
    throw error;
  }
};

// Default exports for common font configurations
export default {
  weights: FONT_WEIGHTS,
  styles: FONT_STYLES,
  display: FONT_DISPLAY,
  families: FONT_FAMILIES,
  getFontFamilyStack,
  loadFontFamily,
};