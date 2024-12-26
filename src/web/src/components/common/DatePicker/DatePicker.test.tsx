import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { vi } from 'vitest'; // v0.34.0
import DatePicker from './DatePicker';
import { formatDate, parseDate, isValidDate } from '../../utils/date.utils';

// Test constants
const TEST_DATE = new Date('2024-01-01');
const MIN_DATE = new Date('2023-01-01');
const MAX_DATE = new Date('2024-12-31');
const TEST_LABEL = 'Test Date';
const TEST_ERROR = 'Test error message';

// Mock date utils to ensure consistent behavior
vi.mock('../../utils/date.utils', () => ({
  formatDate: vi.fn((date) => date ? '01/01/2024' : ''),
  parseDate: vi.fn((dateStr) => new Date('2024-01-01')),
  isValidDate: vi.fn((date) => true),
}));

describe('DatePicker Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    it('should render with proper accessibility attributes', () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={TEST_DATE}
          onChange={onChange}
          label={TEST_LABEL}
          required
          ariaLabel="Select date"
        />
      );

      const datePicker = screen.getByRole('textbox');
      expect(datePicker).toHaveAttribute('aria-label', 'Select date');
      expect(datePicker).toHaveAttribute('aria-required', 'true');
      expect(datePicker).not.toHaveAttribute('aria-invalid');
      expect(screen.getByTestId('date-picker-testDate')).toBeInTheDocument();
    });

    it('should handle keyboard navigation', async () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={TEST_DATE}
          onChange={onChange}
          label={TEST_LABEL}
        />
      );

      const datePicker = screen.getByRole('textbox');
      fireEvent.keyDown(datePicker, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.keyDown(datePicker, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Date Selection and Formatting', () => {
    it('should handle date selection and call onChange', async () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={null}
          onChange={onChange}
          label={TEST_LABEL}
        />
      );

      const datePicker = screen.getByRole('textbox');
      await userEvent.type(datePicker, '01/01/2024');
      await userEvent.tab();

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(expect.any(Date), true);
      });
      expect(formatDate).toHaveBeenCalled();
    });

    it('should display formatted date value', () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={TEST_DATE}
          onChange={onChange}
          label={TEST_LABEL}
        />
      );

      expect(screen.getByRole('textbox')).toHaveValue('01/01/2024');
      expect(formatDate).toHaveBeenCalledWith(TEST_DATE);
    });
  });

  describe('Validation and Error Handling', () => {
    it('should display error message when provided', () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={TEST_DATE}
          onChange={onChange}
          label={TEST_LABEL}
          error={TEST_ERROR}
        />
      );

      expect(screen.getByText(TEST_ERROR)).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should validate date range restrictions', async () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={null}
          onChange={onChange}
          label={TEST_LABEL}
          minDate={MIN_DATE}
          maxDate={MAX_DATE}
        />
      );

      const datePicker = screen.getByRole('textbox');
      await userEvent.type(datePicker, '12/31/2022');
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.getByText('Date cannot be before minimum allowed date')).toBeInTheDocument();
      });
    });

    it('should handle required field validation', async () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={null}
          onChange={onChange}
          label={TEST_LABEL}
          required
        />
      );

      const datePicker = screen.getByRole('textbox');
      await userEvent.clear(datePicker);
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.getByText('This field is required')).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('should respect disabled prop', () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={TEST_DATE}
          onChange={onChange}
          label={TEST_LABEL}
          disabled
        />
      );

      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('Integration with Date Utils', () => {
    it('should use date utils for formatting and validation', async () => {
      const onChange = vi.fn();
      render(
        <DatePicker
          name="testDate"
          value={TEST_DATE}
          onChange={onChange}
          label={TEST_LABEL}
        />
      );

      expect(formatDate).toHaveBeenCalledWith(TEST_DATE);
      
      const datePicker = screen.getByRole('textbox');
      await userEvent.type(datePicker, '01/01/2024');
      await userEvent.tab();

      await waitFor(() => {
        expect(isValidDate).toHaveBeenCalled();
      });
    });
  });
});