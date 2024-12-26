import React, { useCallback, useId } from 'react';
import { useFormContext } from 'react-hook-form';
import '../../styles/theme.css';

/**
 * Props interface for the Checkbox component following Material Design 3 specifications
 * @version 1.0.0
 */
export interface CheckboxProps {
  /** Input name attribute for form integration */
  name: string;
  /** Unique identifier for the checkbox */
  id: string;
  /** Label text to display next to checkbox */
  label: string;
  /** Controlled checked state */
  checked: boolean;
  /** Optional initial checked state */
  defaultChecked?: boolean;
  /** Optional disabled state */
  disabled?: boolean;
  /** Optional required state */
  required?: boolean;
  /** Optional error message */
  error?: string;
  /** Change handler for checkbox state */
  onChange: (checked: boolean) => void;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * A reusable checkbox component that follows Material Design 3 specifications
 * with support for accessibility, theming, and form integration.
 * Implements WCAG 2.1 Level AA compliance.
 */
const Checkbox: React.FC<CheckboxProps> = ({
  name,
  id,
  label,
  checked,
  defaultChecked,
  disabled = false,
  required = false,
  error,
  onChange,
  className = '',
}) => {
  // Generate unique IDs for accessibility
  const uniqueId = useId();
  const errorId = `${uniqueId}-error`;
  const checkboxId = id || `checkbox-${uniqueId}`;

  // Optional form context integration
  const formContext = useFormContext();

  // Memoized change handler
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
    formContext?.setValue(name, event.target.checked, { shouldValidate: true });
  }, [onChange, name, formContext]);

  return (
    <div 
      className={`checkbox-container ${className} ${disabled ? 'checkbox-disabled' : ''} ${error ? 'checkbox-error' : ''}`}
      data-theme={formContext?.watch('theme') || 'light'}
    >
      <input
        type="checkbox"
        id={checkboxId}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        required={required}
        onChange={handleChange}
        className="checkbox-input"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
      />
      <label 
        htmlFor={checkboxId}
        className="checkbox-label"
      >
        {label}
        {required && <span className="visually-hidden">(required)</span>}
      </label>
      {error && (
        <span 
          id={errorId}
          className="error-message"
          role="alert"
          aria-live="polite"
        >
          {error}
        </span>
      )}
      <style jsx>{`
        .checkbox-container {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-sm);
          position: relative;
          margin: var(--spacing-xs) 0;
        }

        .checkbox-input {
          position: absolute;
          opacity: 0;
          width: var(--touch-target-size);
          height: var(--touch-target-size);
          margin: 0;
          cursor: pointer;
        }

        .checkbox-input:disabled {
          cursor: not-allowed;
        }

        .checkbox-label {
          position: relative;
          padding-left: calc(var(--touch-target-size) + var(--spacing-xs));
          min-height: var(--touch-target-size);
          display: flex;
          align-items: center;
          color: var(--text-primary);
          cursor: pointer;
          user-select: none;
        }

        .checkbox-label::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          border: 2px solid var(--outline-color);
          border-radius: 2px;
          background-color: var(--surface-color);
          transition: all var(--animation-duration-base) var(--animation-easing-standard);
        }

        .checkbox-input:checked + .checkbox-label::before {
          background-color: var(--primary-color);
          border-color: var(--primary-color);
        }

        .checkbox-input:checked + .checkbox-label::after {
          content: '';
          position: absolute;
          left: 6px;
          top: 50%;
          transform: translateY(-50%) rotate(45deg);
          width: 6px;
          height: 10px;
          border: solid var(--on-primary);
          border-width: 0 2px 2px 0;
        }

        .checkbox-input:focus-visible + .checkbox-label::before {
          outline: var(--focus-ring-width) solid var(--focus-ring-color);
          outline-offset: var(--focus-ring-offset);
        }

        .checkbox-disabled .checkbox-label {
          color: var(--text-disabled);
          cursor: not-allowed;
        }

        .checkbox-disabled .checkbox-label::before {
          background-color: var(--surface-variant);
          border-color: var(--outline-color);
          opacity: 0.38;
        }

        .checkbox-error .checkbox-label::before {
          border-color: var(--error-color);
        }

        .error-message {
          font-size: var(--font-size-sm);
          color: var(--error-color);
          margin-top: var(--spacing-xs);
        }

        .visually-hidden {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* RTL Support */
        [dir="rtl"] .checkbox-label {
          padding-left: 0;
          padding-right: calc(var(--touch-target-size) + var(--spacing-xs));
        }

        [dir="rtl"] .checkbox-label::before {
          left: auto;
          right: 0;
        }

        [dir="rtl"] .checkbox-input:checked + .checkbox-label::after {
          left: auto;
          right: 6px;
        }

        /* High Contrast Mode */
        [data-theme="high-contrast"] .checkbox-label::before {
          border-width: 3px;
        }

        [data-theme="high-contrast"] .checkbox-input:checked + .checkbox-label::before {
          background-color: var(--primary-color);
          border-color: var(--primary-color);
        }
      `}</style>
    </div>
  );
};

export default Checkbox;