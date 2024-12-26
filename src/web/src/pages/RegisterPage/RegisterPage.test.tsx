import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import RegisterPage from './RegisterPage';
import { useAuth } from '@/hooks/useAuth';
import { VALIDATION_PATTERNS } from '@/constants/validation.constants';
import { AUTH_CONFIG } from '@/config/auth.config';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    register: vi.fn().mockResolvedValue({ success: true }),
    loading: false,
    error: null
  }))
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// Mock FingerprintJS
vi.mock('@fingerprintjs/fingerprintjs', () => ({
  load: () => Promise.resolve({
    get: () => Promise.resolve({ visitorId: 'test-fingerprint' })
  })
}));

// Test data
const validFormData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  password: 'Test@123456',
  confirmPassword: 'Test@123456',
  acceptedTerms: true
};

// Helper function to render component with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

// Setup function for common test scenarios
const setupTest = async (customProps = {}) => {
  const user = userEvent.setup();
  const utils = renderWithProviders(<RegisterPage {...customProps} />);
  
  return {
    user,
    ...utils
  };
};

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form with all required fields', async () => {
    await setupTest();

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /terms/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('displays validation errors for empty required fields', async () => {
    const { user } = await setupTest();

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format with proper error messages', async () => {
    const { user } = await setupTest();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    await user.clear(emailInput);
    await user.type(emailInput, 'valid@example.com');

    await waitFor(() => {
      expect(screen.queryByText(/please enter a valid email address/i)).not.toBeInTheDocument();
    });
  });

  it('enforces password complexity requirements', async () => {
    const { user } = await setupTest();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'weak');

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`Password must be at least ${AUTH_CONFIG.PASSWORD_REQUIREMENTS.minLength} characters`))).toBeInTheDocument();
      expect(screen.getByText(/must contain at least one uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/must contain at least one number/i)).toBeInTheDocument();
      expect(screen.getByText(/must contain at least one special character/i)).toBeInTheDocument();
    });
  });

  it('performs cross-field validation for password confirmation', async () => {
    const { user } = await setupTest();

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(passwordInput, 'Test@123456');
    await user.type(confirmPasswordInput, 'Test@123457');

    await waitFor(() => {
      expect(screen.getByText(/passwords must match/i)).toBeInTheDocument();
    });
  });

  it('handles successful registration flow', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockImplementation(() => ({
      register: mockRegister,
      loading: false,
      error: null
    }));

    const { user } = await setupTest();

    // Fill form with valid data
    await user.type(screen.getByLabelText(/first name/i), validFormData.firstName);
    await user.type(screen.getByLabelText(/last name/i), validFormData.lastName);
    await user.type(screen.getByLabelText(/email address/i), validFormData.email);
    await user.type(screen.getByLabelText(/^password$/i), validFormData.password);
    await user.type(screen.getByLabelText(/confirm password/i), validFormData.confirmPassword);
    await user.click(screen.getByRole('checkbox', { name: /terms/i }));

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
        ...validFormData,
        deviceFingerprint: expect.any(String)
      }));
    });
  });

  it('maintains WCAG 2.1 Level AA compliance', async () => {
    const { container } = await setupTest();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('implements proper focus management', async () => {
    const { user } = await setupTest();

    // Test tab order
    await user.tab();
    expect(screen.getByLabelText(/first name/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/last name/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/email address/i)).toHaveFocus();
  });

  it('handles registration failure scenarios', async () => {
    const mockError = {
      code: 'REGISTRATION_ERROR',
      message: 'Registration failed',
      details: { email: 'Email already exists' }
    };

    vi.mocked(useAuth).mockImplementation(() => ({
      register: vi.fn().mockRejectedValue(mockError),
      loading: false,
      error: mockError
    }));

    const { user } = await setupTest();

    // Fill and submit form
    await user.type(screen.getByLabelText(/first name/i), validFormData.firstName);
    await user.type(screen.getByLabelText(/last name/i), validFormData.lastName);
    await user.type(screen.getByLabelText(/email address/i), validFormData.email);
    await user.type(screen.getByLabelText(/^password$/i), validFormData.password);
    await user.type(screen.getByLabelText(/confirm password/i), validFormData.confirmPassword);
    await user.click(screen.getByRole('checkbox', { name: /terms/i }));

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('supports international character input', async () => {
    const { user } = await setupTest();

    const firstNameInput = screen.getByLabelText(/first name/i);
    await user.type(firstNameInput, 'José');

    expect(firstNameInput).toHaveValue('José');
    expect(screen.queryByText(/please enter a valid first name/i)).not.toBeInTheDocument();
  });

  it('implements proper loading states', async () => {
    vi.mocked(useAuth).mockImplementation(() => ({
      register: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100))),
      loading: true,
      error: null
    }));

    const { user } = await setupTest();

    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });
});