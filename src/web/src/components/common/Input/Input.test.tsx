import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { expect, describe, it, beforeEach, jest } from '@jest/globals'; // v29.0.0
import { ThemeProvider, createTheme } from '@mui/material'; // v5.0.0

import Input from './Input';
import { validateField } from '../../../utils/validation.utils';
import { VALIDATION_PATTERNS } from '../../../constants/validation.constants';

// Mock validation utilities
jest.mock('../../../utils/validation.utils', () => ({
  validateField: jest.fn()
}));

// Create Material Design 3 theme for testing
const theme = createTheme({
  // Material Design 3 spacing units (4px base)
  spacing: 4,
  // Material Design 3 typography scale (1.2 ratio)
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 16,
    htmlFontSize: 16,
  },
});

// Helper function to render Input with theme
const renderInput = (props = {}) => {
  const defaultProps = {
    id: 'test-input',
    name: 'test',
    label: 'Test Input',
    value: '',
    onChange: jest.fn(),
    onBlur: jest.fn(),
  };

  const mergedProps = { ...defaultProps, ...props };

  return {
    ...render(
      <ThemeProvider theme={theme}>
        <Input {...mergedProps} />
      </ThemeProvider>
    ),
    props: mergedProps,
  };
};

describe('Input Component Rendering', () => {
  it('renders with required props and correct styling', () => {
    const { container } = renderInput();
    const input = screen.getByRole('textbox');
    
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'test-input');
    expect(container.querySelector('.input-component')).toBeInTheDocument();
  });

  it('applies Material Design spacing and typography', () => {
    const { container } = renderInput();
    const inputWrapper = container.querySelector('.MuiFormControl-root');
    
    // Verify Material Design 3 spacing (4px base)
    expect(inputWrapper).toHaveStyle('margin-bottom: 16px'); // 4 * 4px
    
    // Verify typography scale
    const label = container.querySelector('.MuiInputLabel-root');
    expect(label).toHaveStyle({
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: '16px',
    });
  });

  it('renders in different variants', () => {
    const variants = ['outlined', 'filled', 'standard'];
    
    variants.forEach(variant => {
      const { container } = renderInput({ variant });
      expect(container.querySelector(`.MuiInput-${variant}`)).toBeInTheDocument();
    });
  });

  it('applies theme color tokens correctly', () => {
    const { container } = renderInput({ error: true });
    const errorInput = container.querySelector('.Mui-error');
    
    expect(errorInput).toHaveStyle({
      color: theme.palette.error.main,
    });
  });
});

describe('Input Component Accessibility', () => {
  it('provides proper ARIA labels and roles', () => {
    const { props } = renderInput({
      'aria-label': 'Custom Label',
      'aria-describedby': 'helper-text',
      helperText: 'Helper text',
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Custom Label');
    expect(input).toHaveAttribute('aria-describedby', 'helper-text');
    expect(screen.getByText('Helper text')).toBeInTheDocument();
  });

  it('handles keyboard navigation correctly', async () => {
    const onFocus = jest.fn();
    renderInput({ onFocus });
    
    const input = screen.getByRole('textbox');
    await userEvent.tab();
    
    expect(input).toHaveFocus();
    expect(onFocus).toHaveBeenCalled();
  });

  it('maintains focus indicators', async () => {
    const { container } = renderInput();
    const input = screen.getByRole('textbox');
    
    await userEvent.tab();
    expect(input).toHaveFocus();
    expect(container.querySelector('.Mui-focused')).toBeInTheDocument();
  });

  it('announces validation errors to screen readers', async () => {
    const error = { code: 'required', message: 'This field is required' };
    renderInput({ error });
    
    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toHaveTextContent('This field is required');
  });
});

describe('Input Component Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('performs real-time validation with debounce', async () => {
    const onChange = jest.fn();
    renderInput({
      onChange,
      validationRules: {
        pattern: VALIDATION_PATTERNS.EMAIL,
      },
    });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'test@example.com');

    // Wait for debounce
    await waitFor(() => {
      expect(validateField).toHaveBeenCalledWith('test@example.com', {
        pattern: VALIDATION_PATTERNS.EMAIL,
      });
    }, { timeout: 350 });
  });

  it('displays error messages correctly', async () => {
    const error = { code: 'pattern', message: 'Invalid email format' };
    renderInput({ error });
    
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('handles different validation rules', async () => {
    const validationRules = {
      required: true,
      minLength: 3,
      pattern: VALIDATION_PATTERNS.EMAIL,
    };

    (validateField as jest.Mock).mockResolvedValue({ isValid: false, errors: { email: 'Invalid email' } });

    renderInput({ validationRules });
    const input = screen.getByRole('textbox');
    
    await userEvent.type(input, 'a@');
    await waitFor(() => {
      expect(validateField).toHaveBeenCalledWith('a@', validationRules);
    });
  });

  it('supports custom validation functions', async () => {
    const customValidator = jest.fn().mockResolvedValue(true);
    const validationRules = {
      customValidator,
    };

    renderInput({ validationRules });
    const input = screen.getByRole('textbox');
    
    await userEvent.type(input, 'test');
    await waitFor(() => {
      expect(customValidator).toHaveBeenCalledWith('test');
    });
  });
});

describe('Input Component Performance', () => {
  it('renders within performance budget', async () => {
    const startTime = performance.now();
    renderInput();
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // 100ms budget
  });

  it('debounces validation efficiently', async () => {
    const onChange = jest.fn();
    renderInput({ onChange });
    const input = screen.getByRole('textbox');

    // Rapid typing simulation
    for (let i = 0; i < 10; i++) {
      await userEvent.type(input, 'a');
    }

    // Should only call validation once after debounce
    await waitFor(() => {
      expect(validateField).toHaveBeenCalledTimes(1);
    }, { timeout: 350 });
  });

  it('handles rapid input changes', async () => {
    const onChange = jest.fn();
    renderInput({ onChange });
    const input = screen.getByRole('textbox');

    const user = userEvent.setup({ delay: 1 }); // Minimum delay
    await user.type(input, 'test@example.com');

    expect(input).toHaveValue('test@example.com');
    expect(onChange).toHaveBeenCalled();
  });

  it('maintains smooth animations', async () => {
    const { container } = renderInput();
    const input = screen.getByRole('textbox');

    // Focus animation
    await userEvent.tab();
    const focusAnimation = container.querySelector('.Mui-focused');
    
    expect(focusAnimation).toHaveStyle({
      transition: expect.stringContaining('all'),
    });
  });
});