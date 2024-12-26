import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from '@testing-library/jest-axe';
import { LoginPage } from './LoginPage';
import { useAuth } from '@/hooks/useAuth';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Mock useNavigate hook
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

describe('LoginPage', () => {
  // Test data
  const validCredentials = {
    email: 'test@example.com',
    password: 'Password123!@#',
    rememberMe: false
  };

  const validMfaCode = '123456';

  // Setup mocks before each test
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock useAuth implementation
    (useAuth as jest.Mock).mockReturnValue({
      login: vi.fn(),
      verifyMfa: vi.fn(),
      loading: false,
      error: null
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = render(<LoginPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      render(<LoginPage />);
      
      // Check tab order
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const rememberMeCheckbox = screen.getByLabelText(/remember me/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      expect(document.body).toHaveFocus();
      
      await userEvent.tab();
      expect(emailInput).toHaveFocus();
      
      await userEvent.tab();
      expect(passwordInput).toHaveFocus();
      
      await userEvent.tab();
      expect(rememberMeCheckbox).toHaveFocus();
      
      await userEvent.tab();
      expect(submitButton).toHaveFocus();
    });

    it('provides proper ARIA attributes', () => {
      render(<LoginPage />);
      
      // Check form labeling
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-labelledby', 'login-title');

      // Check error message associations
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('aria-describedby', 'password-error');
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      render(<LoginPage />);
      
      // Submit empty form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await userEvent.click(submitButton);

      // Check error messages
      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    });

    it('validates email format', async () => {
      render(<LoginPage />);
      
      // Enter invalid email
      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, 'invalid-email');
      await userEvent.tab(); // Trigger blur validation

      // Check error message
      expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    it('validates password requirements', async () => {
      render(<LoginPage />);
      
      // Enter short password
      const passwordInput = screen.getByLabelText(/password/i);
      await userEvent.type(passwordInput, 'short');
      await userEvent.tab(); // Trigger blur validation

      // Check error message
      expect(await screen.findByText(/password must be at least 12 characters/i)).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('handles successful login without MFA', async () => {
      const mockLogin = vi.fn().mockResolvedValue({ requiresMfa: false });
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        loading: false,
        error: null
      });

      render(<LoginPage />);
      
      // Fill and submit form
      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify login called with correct credentials
      expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining(validCredentials));
    });

    it('handles MFA verification flow', async () => {
      // Mock login to require MFA
      const mockLogin = vi.fn().mockResolvedValue({ requiresMfa: true });
      const mockVerifyMfa = vi.fn().mockResolvedValue({});
      
      (useAuth as jest.Mock).mockReturnValue({
        login: mockLogin,
        verifyMfa: mockVerifyMfa,
        loading: false,
        error: null
      });

      render(<LoginPage />);
      
      // Complete initial login
      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify MFA screen shown
      expect(await screen.findByText(/enter mfa code/i)).toBeInTheDocument();

      // Enter and submit MFA code
      await userEvent.type(screen.getByLabelText(/mfa code/i), validMfaCode);
      await userEvent.click(screen.getByRole('button', { name: /verify/i }));

      // Verify MFA verification called
      expect(mockVerifyMfa).toHaveBeenCalledWith(validMfaCode);
    });

    it('displays loading state during authentication', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        loading: true,
        error: null
      });

      render(<LoginPage />);
      
      // Submit form
      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify loading state
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
      expect(within(submitButton).getByRole('progressbar')).toBeInTheDocument();
    });

    it('handles authentication errors', async () => {
      const errorMessage = 'Invalid credentials';
      (useAuth as jest.Mock).mockReturnValue({
        login: vi.fn().mockRejectedValue(new Error(errorMessage)),
        loading: false,
        error: { message: errorMessage }
      });

      render(<LoginPage />);
      
      // Submit form
      await userEvent.type(screen.getByLabelText(/email/i), validCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), validCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify error message
      expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Material Design Implementation', () => {
    it('renders Material Design components correctly', () => {
      render(<LoginPage />);
      
      // Verify Material UI components
      expect(screen.getByRole('form')).toHaveClass('MuiPaper-root');
      expect(screen.getByLabelText(/email/i)).toHaveClass('MuiInputBase-input');
      expect(screen.getByLabelText(/password/i)).toHaveClass('MuiInputBase-input');
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveClass('MuiButton-root');
    });

    it('applies correct theme styles', () => {
      render(<LoginPage />);
      
      const form = screen.getByRole('form');
      const computedStyle = window.getComputedStyle(form);
      
      // Verify theme-based styling
      expect(computedStyle.backgroundColor).toBe('var(--surface-color)');
      expect(computedStyle.borderRadius).toBe('8px');
      expect(computedStyle.boxShadow).toBe('var(--elevation-2)');
    });
  });
});