import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest } from '@jest/globals';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';

import ProfilePage from './ProfilePage';
import { useAuth } from '@/hooks/useAuth';

// Version 14.0.0 @testing-library/react
// Version 14.0.0 @testing-library/user-event
// Version 29.0.0 @jest/globals
// Version 9.0.0 react-redux
// Version 4.7.0 jest-axe

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAuth hook
jest.mock('@/hooks/useAuth');

// Mock user data
const mockUser = {
  id: 'test-user-id',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  mfaEnabled: false,
  preferences: {
    theme: 'light',
    notifications: true,
    language: 'en',
    timezone: 'UTC'
  }
};

// Mock update functions
const mockUpdateProfile = jest.fn();
const mockUpdateSecurity = jest.fn();
const mockToggleMfa = jest.fn();

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = configureStore({
      reducer: { auth: (state = {}) => state },
      preloadedState
    }),
    ...renderOptions
  } = {}
) => {
  const user = userEvent.setup();
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    user,
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

describe('ProfilePage Component', () => {
  beforeEach(() => {
    // Setup default mock implementation
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
      isAuthenticated: true,
      updateProfile: mockUpdateProfile,
      updateSecurity: mockUpdateSecurity,
      toggleMfa: mockToggleMfa
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render profile form with user data', async () => {
    const { container } = renderWithProviders(<ProfilePage />);

    // Check if main sections are rendered
    expect(screen.getByText(/personal information/i)).toBeInTheDocument();
    expect(screen.getByText(/security settings/i)).toBeInTheDocument();
    expect(screen.getByText(/preferences/i)).toBeInTheDocument();

    // Verify form fields are populated with user data
    expect(screen.getByDisplayValue(mockUser.firstName)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockUser.lastName)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockUser.email)).toBeInTheDocument();

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle profile information updates', async () => {
    const { user } = renderWithProviders(<ProfilePage />);

    // Click edit button
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Update form fields
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Jane');
    await user.clear(lastNameInput);
    await user.type(lastNameInput, 'Smith');

    // Submit form
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Verify update function was called with correct data
    expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Jane',
      lastName: 'Smith'
    }));
  });

  it('should handle MFA toggle', async () => {
    const { user } = renderWithProviders(<ProfilePage />);

    const mfaSwitch = screen.getByRole('switch', { name: /mfa/i });
    await user.click(mfaSwitch);

    expect(mockToggleMfa).toHaveBeenCalledWith(true);
  });

  it('should validate form inputs', async () => {
    const { user } = renderWithProviders(<ProfilePage />);

    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Clear required field
    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.clear(firstNameInput);

    // Try to save
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Expect validation error
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: true,
      isAuthenticated: true
    });

    renderWithProviders(<ProfilePage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    mockUpdateProfile.mockRejectedValueOnce(new Error('Update failed'));
    const { user } = renderWithProviders(<ProfilePage />);

    // Enter edit mode and try to save
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Verify error message is displayed
    expect(await screen.findByText(/update failed/i)).toBeInTheDocument();
  });

  it('should support keyboard navigation', async () => {
    const { user } = renderWithProviders(<ProfilePage />);

    // Tab through interactive elements
    await user.tab();
    expect(screen.getByLabelText(/first name/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/last name/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });

  it('should handle theme preference changes', async () => {
    const { user } = renderWithProviders(<ProfilePage />);

    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Change theme
    const themeSelect = screen.getByLabelText(/theme/i);
    await user.selectOptions(themeSelect, 'dark');

    // Save changes
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      preferences: expect.objectContaining({
        theme: 'dark'
      })
    }));
  });

  it('should handle language preference changes', async () => {
    const { user } = renderWithProviders(<ProfilePage />);

    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Change language
    const languageSelect = screen.getByLabelText(/language/i);
    await user.selectOptions(languageSelect, 'es');

    // Save changes
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      preferences: expect.objectContaining({
        language: 'es'
      })
    }));
  });
});