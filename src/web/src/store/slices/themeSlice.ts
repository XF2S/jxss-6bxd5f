// @reduxjs/toolkit v1.9.x
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ThemeMode } from '../../config/theme.config';

// Storage keys for theme preferences
const THEME_STORAGE_KEY = 'app-theme-mode';
const SYSTEM_PREFERENCE_KEY = 'app-theme-system-preference';

// Interface for theme state
interface ThemeState {
  mode: ThemeMode;
  systemPreference: boolean;
  lastManualMode: ThemeMode;
  reducedMotion: boolean;
}

// Initial state with stored preferences or defaults
const initialState: ThemeState = {
  mode: (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || ThemeMode.LIGHT,
  systemPreference: localStorage.getItem(SYSTEM_PREFERENCE_KEY) === 'true',
  lastManualMode: (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || ThemeMode.LIGHT,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

/**
 * Redux slice for managing application theme state
 */
const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    /**
     * Updates the current theme mode with accessibility announcements
     */
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.mode = action.payload;
      state.lastManualMode = action.payload;
      localStorage.setItem(THEME_STORAGE_KEY, action.payload);
      
      // Announce theme change for screen readers
      const message = `Theme changed to ${action.payload} mode`;
      const announcement = new CustomEvent('theme-change-announcement', { 
        detail: { message } 
      });
      document.dispatchEvent(announcement);
    },

    /**
     * Cycles between available theme modes (Light -> Dark -> High Contrast)
     */
    toggleThemeMode: (state) => {
      const modes = [ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.HIGH_CONTRAST];
      const currentIndex = modes.indexOf(state.mode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      
      state.mode = nextMode;
      state.lastManualMode = nextMode;
      localStorage.setItem(THEME_STORAGE_KEY, nextMode);

      // Announce theme change for screen readers
      const message = `Theme changed to ${nextMode} mode`;
      const announcement = new CustomEvent('theme-change-announcement', { 
        detail: { message } 
      });
      document.dispatchEvent(announcement);
    },

    /**
     * Updates system preference synchronization setting
     */
    setSystemPreference: (state, action: PayloadAction<boolean>) => {
      state.systemPreference = action.payload;
      localStorage.setItem(SYSTEM_PREFERENCE_KEY, action.payload.toString());

      if (action.payload) {
        // Sync with system preference if enabled
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.mode = isDarkMode ? ThemeMode.DARK : ThemeMode.LIGHT;
      } else {
        // Restore last manual mode if disabled
        state.mode = state.lastManualMode;
      }
    },

    /**
     * Updates reduced motion preference
     */
    setReducedMotion: (state, action: PayloadAction<boolean>) => {
      state.reducedMotion = action.payload;
    }
  }
});

// Export actions
export const themeActions = themeSlice.actions;

// Selector types
interface RootState {
  theme: ThemeState;
}

/**
 * Selectors for accessing theme state
 */
export const themeSelectors = {
  /**
   * Selects the current effective theme mode
   */
  selectThemeMode: (state: RootState): ThemeMode => {
    const { theme } = state;
    if (!theme.systemPreference) return theme.mode;

    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDarkMode ? ThemeMode.DARK : ThemeMode.LIGHT;
  },

  /**
   * Selects the system preference synchronization setting
   */
  selectSystemPreference: (state: RootState): boolean => state.theme.systemPreference,

  /**
   * Selects the reduced motion preference
   */
  selectReducedMotion: (state: RootState): boolean => state.theme.reducedMotion,

  /**
   * Selects the last manually selected theme mode
   */
  selectLastManualMode: (state: RootState): ThemeMode => state.theme.lastManualMode
};

// Export reducer
export const themeReducer = themeSlice.reducer;

// Export the slice
export default themeSlice;