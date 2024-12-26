// @react v18.x
import { useEffect, useCallback } from 'react';
// @react-redux v8.x
import { useDispatch, useSelector } from 'react-redux';

import { ThemeMode, createCustomTheme } from '../../config/theme.config';
import { themeActions, selectThemeMode } from '../../store/slices/themeSlice';

// Constants for theme management
const SYSTEM_DARK_MODE_QUERY = '(prefers-color-scheme: dark)';
const THEME_STORAGE_KEY = 'app-theme-mode';
const THEME_CHANGE_ANNOUNCEMENT = 'Theme changed to {mode} mode';

/**
 * Interface defining the return type of the useTheme hook
 */
interface UseThemeReturn {
  currentTheme: ReturnType<typeof createCustomTheme>;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

/**
 * Custom hook for managing application theme with system preference synchronization
 * and accessibility support.
 * 
 * Features:
 * - Material Design 3 theming implementation
 * - Light/Dark/High Contrast modes
 * - System preference synchronization
 * - Theme persistence
 * - Accessibility announcements
 * - Performance optimized with memoization
 * 
 * @returns {UseThemeReturn} Theme state and control functions
 */
const useTheme = (): UseThemeReturn => {
  const dispatch = useDispatch();
  const themeMode = useSelector(selectThemeMode);

  /**
   * Memoized theme creation to prevent unnecessary recalculations
   */
  const currentTheme = useCallback(() => {
    return createCustomTheme(themeMode, {
      accessibility: {
        focusRingColor: themeMode === ThemeMode.HIGH_CONTRAST ? '#ffffff' : '#1976d2',
        focusRingWidth: 3,
        contrastRatio: themeMode === ThemeMode.HIGH_CONTRAST ? 7 : 4.5,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      }
    });
  }, [themeMode]);

  /**
   * Memoized theme mode setter with accessibility announcement
   */
  const setTheme = useCallback((mode: ThemeMode) => {
    dispatch(themeActions.setThemeMode(mode));
    
    // Announce theme change for screen readers
    const message = THEME_CHANGE_ANNOUNCEMENT.replace('{mode}', mode);
    const announcement = new CustomEvent('theme-change-announcement', {
      detail: { message }
    });
    document.dispatchEvent(announcement);
  }, [dispatch]);

  /**
   * Memoized theme toggle function
   */
  const toggleTheme = useCallback(() => {
    dispatch(themeActions.toggleThemeMode());
  }, [dispatch]);

  /**
   * Effect for system preference synchronization
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_DARK_MODE_QUERY);
    
    const handleSystemPreferenceChange = (event: MediaQueryListEvent) => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (!storedTheme) {
        setTheme(event.matches ? ThemeMode.DARK : ThemeMode.LIGHT);
      }
    };

    // Initialize theme from storage or system preference
    const initializeTheme = () => {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
      if (!storedTheme) {
        setTheme(mediaQuery.matches ? ThemeMode.DARK : ThemeMode.LIGHT);
      }
    };

    mediaQuery.addEventListener('change', handleSystemPreferenceChange);
    initializeTheme();

    // Cleanup listener on unmount
    return () => {
      mediaQuery.removeEventListener('change', handleSystemPreferenceChange);
    };
  }, [setTheme]);

  return {
    currentTheme: currentTheme(),
    themeMode,
    toggleTheme,
    setTheme
  };
};

export default useTheme;