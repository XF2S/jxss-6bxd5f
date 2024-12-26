import { format, parse, isValid, differenceInDays, isBefore, isAfter } from 'date-fns'; // v2.30.0
import { enUS } from 'date-fns/locale'; // v2.30.0
import { ApplicationStatus } from '../types/application.types';

// Global constants for date formatting
export const DEFAULT_DATE_FORMAT = 'MM/dd/yyyy';
export const DEFAULT_TIME_FORMAT = 'HH:mm';
export const TIMELINE_DATE_FORMAT = 'MM/dd/yyyy hh:mm a';
export const MIN_VALID_DATE = new Date('1900-01-01');
export const MAX_VALID_DATE = new Date('2100-12-31');

/**
 * Interface for date formatting options
 */
interface DateFormatOptions {
  locale?: Locale;
  throwError?: boolean;
}

/**
 * Interface for timeline date formatting options
 */
interface TimelineDateOptions {
  includeTime?: boolean;
  timezone?: string;
}

/**
 * Formats a date object or string into a standardized display format
 * @param date - Date to format
 * @param formatString - Format string (defaults to DEFAULT_DATE_FORMAT)
 * @param options - Formatting options
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (
  date: Date | string | null,
  formatString: string = DEFAULT_DATE_FORMAT,
  options: DateFormatOptions = {}
): string => {
  try {
    // Handle null/undefined input
    if (!date) {
      if (options.throwError) {
        throw new Error('Date input is null or undefined');
      }
      return '';
    }

    // Convert string to Date if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Validate date
    if (!isValid(dateObj)) {
      if (options.throwError) {
        throw new Error('Invalid date input');
      }
      return '';
    }

    // Format date with locale support
    const formattedDate = format(dateObj, formatString, {
      locale: options.locale || enUS
    });

    // Add ARIA attributes for accessibility
    return `<time datetime="${dateObj.toISOString()}" aria-label="${formattedDate}">${formattedDate}</time>`;
  } catch (error) {
    if (options.throwError) {
      throw error;
    }
    console.error('Date formatting error:', error);
    return '';
  }
};

/**
 * Parses a date string into a Date object
 * @param dateString - String to parse
 * @param formatString - Expected format of the input string
 * @param options - Parsing options
 * @returns Parsed Date object or null if invalid
 */
export const parseDate = (
  dateString: string,
  formatString: string = DEFAULT_DATE_FORMAT,
  options: DateFormatOptions = {}
): Date | null => {
  try {
    if (!dateString) {
      return null;
    }

    const parsedDate = parse(dateString, formatString, new Date(), {
      locale: options.locale || enUS
    });

    if (!isValid(parsedDate)) {
      return null;
    }

    // Additional validation
    if (isBefore(parsedDate, MIN_VALID_DATE) || isAfter(parsedDate, MAX_VALID_DATE)) {
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

/**
 * Validates if a date is valid and within acceptable range
 * @param date - Date to validate
 * @param minDate - Optional minimum valid date
 * @param maxDate - Optional maximum valid date
 * @param options - Validation options
 * @returns Boolean indicating validity
 */
export const isValidDate = (
  date: Date | string,
  minDate: Date | null = MIN_VALID_DATE,
  maxDate: Date | null = MAX_VALID_DATE,
  options: { strict?: boolean } = {}
): boolean => {
  try {
    // Convert string to Date if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Basic validity check
    if (!isValid(dateObj)) {
      return false;
    }

    // Range validation
    if (minDate && isBefore(dateObj, minDate)) {
      return false;
    }

    if (maxDate && isAfter(dateObj, maxDate)) {
      return false;
    }

    // Strict mode additional checks
    if (options.strict) {
      // Ensure date is not on weekend for application dates
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false;
      }

      // Ensure reasonable year range
      const year = dateObj.getFullYear();
      if (year < 1900 || year > 2100) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Date validation error:', error);
    return false;
  }
};

/**
 * Formats dates specifically for application timeline display
 * @param date - Date to format
 * @param options - Timeline formatting options
 * @returns Formatted date string for timeline display
 */
export const formatTimelineDate = (
  date: Date,
  options: TimelineDateOptions = {}
): string => {
  try {
    if (!isValid(date)) {
      throw new Error('Invalid date for timeline formatting');
    }

    // Apply timezone adjustment if specified
    let adjustedDate = date;
    if (options.timezone) {
      adjustedDate = new Date(date.toLocaleString('en-US', { timeZone: options.timezone }));
    }

    // Format with or without time based on options
    const formatString = options.includeTime ? TIMELINE_DATE_FORMAT : DEFAULT_DATE_FORMAT;
    
    const formattedDate = format(adjustedDate, formatString, { locale: enUS });

    // Add ARIA attributes for accessibility
    const ariaLabel = options.includeTime
      ? `Updated on ${formattedDate}`
      : `Date: ${formattedDate}`;

    return `<time datetime="${adjustedDate.toISOString()}" aria-label="${ariaLabel}">${formattedDate}</time>`;
  } catch (error) {
    console.error('Timeline date formatting error:', error);
    return format(new Date(), DEFAULT_DATE_FORMAT, { locale: enUS });
  }
};

/**
 * Utility type guard for Date objects
 * @param value - Value to check
 * @returns Boolean indicating if value is a valid Date
 */
export const isDate = (value: unknown): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};