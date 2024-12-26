import React, { useState, useEffect, useCallback, useMemo } from 'react'; // v18.0.0
import { TextField } from '@mui/material'; // v5.0.0
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers'; // v6.0.0
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'; // v6.0.0
import { formatDate, parseDate, isValidDate } from '../../utils/date.utils';

// Constants for date handling
const DEBOUNCE_DELAY = 300;
const ERROR_MESSAGES = {
  required: 'This field is required',
  invalid: 'Please enter a valid date',
  minDate: 'Date cannot be before minimum allowed date',
  maxDate: 'Date cannot be after maximum allowed date',
};

/**
 * Props interface for the DatePicker component
 */
interface DatePickerProps {
  name: string;
  value: Date | null;
  onChange: (date: Date | null, isValid: boolean) => void;
  label: string;
  error?: string;
  minDate?: Date | null;
  maxDate?: Date | null;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  locale?: Locale;
}

/**
 * Enhanced DatePicker component with validation and accessibility features
 */
const DatePicker: React.FC<DatePickerProps> = ({
  name,
  value,
  onChange,
  label,
  error,
  minDate,
  maxDate,
  disabled = false,
  required = false,
  ariaLabel,
  locale,
}) => {
  // Internal state management
  const [internalValue, setInternalValue] = useState<Date | null>(value);
  const [internalError, setInternalError] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Memoized date adapter
  const dateAdapter = useMemo(() => new AdapterDateFns({ locale }), [locale]);

  /**
   * Validates the date against all constraints
   */
  const validateDate = useCallback((date: Date | null): boolean => {
    if (!date) {
      if (required) {
        setInternalError(ERROR_MESSAGES.required);
        return false;
      }
      return true;
    }

    if (!isValidDate(date)) {
      setInternalError(ERROR_MESSAGES.invalid);
      return false;
    }

    if (minDate && date < minDate) {
      setInternalError(ERROR_MESSAGES.minDate);
      return false;
    }

    if (maxDate && date > maxDate) {
      setInternalError(ERROR_MESSAGES.maxDate);
      return false;
    }

    setInternalError('');
    return true;
  }, [required, minDate, maxDate]);

  /**
   * Handles date change with debouncing and validation
   */
  const handleDateChange = useCallback((newDate: Date | null) => {
    setInternalValue(newDate);
    
    // Clear timeout on component unmount
    const timeoutId = setTimeout(() => {
      const isValid = validateDate(newDate);
      onChange(newDate, isValid);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [onChange, validateDate]);

  /**
   * Effect to sync external and internal value
   */
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
      validateDate(value);
    }
  }, [value, validateDate]);

  /**
   * Keyboard event handlers for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      setIsOpen(true);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  /**
   * Formats the date for display
   */
  const displayValue = useMemo(() => {
    if (!internalValue) return '';
    return formatDate(internalValue);
  }, [internalValue]);

  /**
   * Error message handling
   */
  const displayError = error || internalError;

  return (
    <MuiDatePicker
      value={internalValue}
      onChange={handleDateChange}
      disabled={disabled}
      minDate={minDate}
      maxDate={maxDate}
      open={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      slotProps={{
        textField: {
          name,
          label,
          error: !!displayError,
          helperText: displayError,
          required,
          inputProps: {
            'aria-label': ariaLabel || label,
            'aria-required': required,
            'aria-invalid': !!displayError,
            'aria-describedby': displayError ? `${name}-error` : undefined,
            onKeyDown: handleKeyDown,
          },
        },
        popper: {
          placement: 'bottom-start',
        },
      }}
      componentsProps={{
        actionBar: {
          actions: ['clear', 'today', 'accept'],
        },
      }}
      format="MM/dd/yyyy"
      closeOnSelect
      showDaysOutsideCurrentMonth
      disableHighlightToday={false}
      data-testid={`date-picker-${name}`}
      aria-label={ariaLabel || label}
    />
  );
};

export default DatePicker;