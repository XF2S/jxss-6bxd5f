import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material';
import { configureStore } from '@reduxjs/toolkit';

import SettingsPage from './SettingsPage';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { ThemeMode } from '@/config/theme.config';
import { NotificationPriority } from '@/types/notification.types';
import { themeReducer } from '@/store/slices/themeSlice';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock hooks
jest.mock('@/hooks/useAuth');
jest.mock('@/hooks/useTheme');
jest.mock('@/hooks/useNotification');

describe('SettingsPage', () => {
  // Test store setup
  const store = configureStore({
    reducer: {
      theme: themeReducer
    }
  });

  // Mock user data
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    mfaEnabled: false,
    roles: ['APPLICANT']
  };

  // Mock theme data
  const mockTheme = {
    themeMode: ThemeMode.LIGHT,
    setTheme: jest.fn(),
    highContrastMode: false
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup auth mock
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      updateSecuritySettings: jest.fn()
    });

    // Setup theme mock
    (useTheme as jest.Mock).mockReturnValue(mockTheme);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <Provider store={store}>
        <ThemeProvider theme={mockTheme}>
          {ui}
        </ThemeProvider>
      </Provider>
    );
  };

  describe('Theme Settings', () => {
    it('should render theme mode selector with current theme', () => {
      renderWithProviders(<SettingsPage />);
      
      const themeSelect = screen.getByLabelText(/Theme Mode/i);
      expect(themeSelect).toHaveValue(ThemeMode.LIGHT);
    });

    it('should handle theme mode changes', async () => {
      renderWithProviders(<SettingsPage />);
      
      const themeSelect = screen.getByLabelText(/Theme Mode/i);
      await userEvent.click(themeSelect);
      const darkModeOption = screen.getByText(/Dark Mode/i);
      await userEvent.click(darkModeOption);

      expect(mockTheme.setTheme).toHaveBeenCalledWith(ThemeMode.DARK);
    });

    it('should handle high contrast mode toggle', async () => {
      renderWithProviders(<SettingsPage />);
      
      const highContrastSwitch = screen.getByRole('switch', { name: /High Contrast Mode/i });
      await userEvent.click(highContrastSwitch);

      expect(mockTheme.setTheme).toHaveBeenCalledWith(ThemeMode.HIGH_CONTRAST);
    });

    it('should announce theme changes to screen readers', async () => {
      renderWithProviders(<SettingsPage />);
      
      const themeSelect = screen.getByLabelText(/Theme Mode/i);
      await userEvent.click(themeSelect);
      const darkModeOption = screen.getByText(/Dark Mode/i);
      await userEvent.click(darkModeOption);

      // Check for aria-live announcement
      const announcement = screen.getByRole('alert');
      expect(announcement).toHaveTextContent(/Theme settings updated successfully/i);
    });
  });

  describe('Security Settings', () => {
    it('should render MFA toggle with current status', () => {
      renderWithProviders(<SettingsPage />);
      
      const mfaSwitch = screen.getByRole('switch', { name: /Enable Two-Factor Authentication/i });
      expect(mfaSwitch).not.toBeChecked();
    });

    it('should handle MFA toggle', async () => {
      const updateSecuritySettings = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        updateSecuritySettings
      });

      renderWithProviders(<SettingsPage />);
      
      const mfaSwitch = screen.getByRole('switch', { name: /Enable Two-Factor Authentication/i });
      await userEvent.click(mfaSwitch);

      expect(updateSecuritySettings).toHaveBeenCalledWith({
        mfaEnabled: true,
        loginNotifications: true,
        sessionTimeout: 30,
        passwordChangeRequired: false
      });
    });

    it('should handle session timeout changes', async () => {
      const updateSecuritySettings = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        updateSecuritySettings
      });

      renderWithProviders(<SettingsPage />);
      
      const timeoutInput = screen.getByLabelText(/Session Timeout/i);
      await userEvent.clear(timeoutInput);
      await userEvent.type(timeoutInput, '60');

      expect(updateSecuritySettings).toHaveBeenCalledWith(expect.objectContaining({
        sessionTimeout: 60
      }));
    });
  });

  describe('Notification Preferences', () => {
    it('should render notification toggles with current preferences', () => {
      renderWithProviders(<SettingsPage />);
      
      const emailToggle = screen.getByRole('switch', { name: /Email Notifications/i });
      const inAppToggle = screen.getByRole('switch', { name: /In-App Notifications/i });

      expect(emailToggle).toBeInTheDocument();
      expect(inAppToggle).toBeInTheDocument();
    });

    it('should handle notification priority changes', async () => {
      renderWithProviders(<SettingsPage />);
      
      const prioritySelect = screen.getByLabelText(/Notification Priority/i);
      await userEvent.click(prioritySelect);
      const highPriorityOption = screen.getByText(/High Priority/i);
      await userEvent.click(highPriorityOption);

      // Verify the change was applied
      expect(prioritySelect).toHaveValue(NotificationPriority.HIGH);
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(<SettingsPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be keyboard navigable', async () => {
      renderWithProviders(<SettingsPage />);
      
      const firstInput = screen.getByLabelText(/Theme Mode/i);
      firstInput.focus();

      // Tab through all interactive elements
      for (let i = 0; i < 10; i++) {
        fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
        expect(document.activeElement).not.toBe(null);
      }
    });

    it('should handle focus management when opening dialogs', async () => {
      renderWithProviders(<SettingsPage />);
      
      const mfaSwitch = screen.getByRole('switch', { name: /Enable Two-Factor Authentication/i });
      await userEvent.click(mfaSwitch);

      // Check if focus is trapped in the MFA setup dialog
      const dialog = screen.getByRole('dialog');
      expect(document.activeElement).toBeInTheDocument();
      expect(dialog).toContainElement(document.activeElement);
    });

    it('should provide appropriate ARIA labels and descriptions', () => {
      renderWithProviders(<SettingsPage />);
      
      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveAttribute('aria-label');
      });

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error messages when settings updates fail', async () => {
      const updateSecuritySettings = jest.fn().mockRejectedValue(new Error('Update failed'));
      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        updateSecuritySettings
      });

      renderWithProviders(<SettingsPage />);
      
      const mfaSwitch = screen.getByRole('switch', { name: /Enable Two-Factor Authentication/i });
      await userEvent.click(mfaSwitch);

      const errorMessage = await screen.findByText(/Failed to update security settings/i);
      expect(errorMessage).toBeInTheDocument();
    });

    it('should provide retry functionality for failed operations', async () => {
      const updateSecuritySettings = jest.fn()
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({ success: true });

      (useAuth as jest.Mock).mockReturnValue({
        user: mockUser,
        updateSecuritySettings
      });

      renderWithProviders(<SettingsPage />);
      
      const mfaSwitch = screen.getByRole('switch', { name: /Enable Two-Factor Authentication/i });
      await userEvent.click(mfaSwitch);

      const retryButton = await screen.findByRole('button', { name: /Retry/i });
      await userEvent.click(retryButton);

      expect(updateSecuritySettings).toHaveBeenCalledTimes(2);
    });
  });
});