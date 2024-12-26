import React, { useRef, useState, useCallback, useEffect } from 'react';
import { TextField } from '@mui/material'; // v5.0.0
import classnames from 'classnames'; // v2.3.1
import { useDebounce } from 'use-debounce'; // v8.0.0

import { validateField } from '../../utils/validation.utils';
import { VALIDATION_RULES, VALIDATION_MESSAGES } from '../../constants/validation.constants';

// Input types supported by the component
type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'search' | 'url';

// Validation error interface
interface ValidationError {
  code: string;
  message: string;
}

// Input mask configuration
interface InputMask {
  pattern: string | RegExp;
  placeholder?: string;
}

// Component props interface
export interface InputProps {
  name: string;
  id: string;
  type?: InputType;
  value: string;
  label: string;
  placeholder?: string;
  helperText?: string;
  error?: ValidationError;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  fullWidth?: boolean;
  mask?: InputMask;
  validationRules?: typeof VALIDATION_RULES;
  className?: string;
  onChange?: (value: string, isValid: boolean) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/**
 * Custom hook for handling input validation with debouncing
 */
const useValidation = (
  value: string,
  rules?: typeof VALIDATION_RULES,
  onChange?: (value: string, isValid: boolean) => void
) => {
  const [error, setError] = useState<ValidationError | undefined>();
  const [debouncedValue] = useDebounce(value, 300);

  const validate = useCallback(async (val: string) => {
    if (!rules) return;

    try {
      const result = await validateField(val, rules);
      
      if (!result.isValid) {
        setError({
          code: Object.keys(result.errors)[0],
          message: Object.values(result.errors)[0]
        });
      } else {
        setError(undefined);
      }

      onChange?.(val, result.isValid);
    } catch (err) {
      console.error('Validation error:', err);
      setError({
        code: 'VALIDATION_ERROR',
        message: 'An error occurred during validation'
      });
    }
  }, [rules, onChange]);

  useEffect(() => {
    validate(debouncedValue);
  }, [debouncedValue, validate]);

  return { error, validate };
};

/**
 * Enhanced Input component with accessibility and validation
 */
export const Input: React.FC<InputProps> = ({
  name,
  id,
  type = 'text',
  value,
  label,
  placeholder,
  helperText,
  error,
  required = false,
  disabled = false,
  autoComplete,
  autoFocus = false,
  fullWidth = true,
  mask,
  validationRules,
  className,
  onChange,
  onBlur,
  onFocus,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { error: validationError, validate } = useValidation(value, validationRules, onChange);
  const displayError = error || validationError;

  // Handle value changes with optional masking
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;

    if (mask?.pattern) {
      const pattern = new RegExp(mask.pattern);
      if (!pattern.test(newValue)) {
        return;
      }
    }

    validate(newValue);
  };

  // Handle blur events with validation
  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    validate(event.target.value);
    onBlur?.(event);
  };

  // Generate unique IDs for accessibility
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = classnames(
    ariaDescribedBy,
    helperText && helperId,
    displayError && errorId
  );

  return (
    <TextField
      inputRef={inputRef}
      name={name}
      id={id}
      type={type}
      value={value}
      label={label}
      placeholder={placeholder}
      helperText={displayError?.message || helperText}
      error={!!displayError}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      fullWidth={fullWidth}
      className={classnames('input-component', className, {
        'input-error': !!displayError,
        'input-disabled': disabled
      })}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      InputProps={{
        'aria-describedby': describedBy,
        'aria-label': ariaLabel || label,
        'aria-invalid': !!displayError,
        'aria-required': required,
      }}
      FormHelperTextProps={{
        id: displayError ? errorId : helperId,
        role: displayError ? 'alert' : undefined,
      }}
      {...props}
    />
  );
};

export default Input;