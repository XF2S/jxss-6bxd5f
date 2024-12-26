import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import userEvent from '@testing-library/user-event'; // v14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // v7.0.0
import { ThemeProvider, createTheme } from '@mui/material'; // v5.0.0
import { FormProvider, useForm } from 'react-hook-form'; // v7.0.0
import { Dropdown } from './Dropdown';
import { ProgramType } from '../../types/application.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock theme for testing
const mockTheme = createTheme({
  palette: {
    mode: 'light',
  },
});

// Mock options for testing
const mockOptions = [
  { value: 'UNDERGRADUATE', label: 'Undergraduate' },
  { value: 'GRADUATE', label: 'Graduate' },
  { value: 'CERTIFICATE', label: 'Certificate' },
];

// Helper function to render Dropdown with providers
const renderDropdown = (props: Partial<typeof Dropdown.defaultProps> = {}, formValues = {}) => {
  const methods = useForm({ defaultValues: formValues });
  
  return render(
    <ThemeProvider theme={mockTheme}>
      <FormProvider {...methods}>
        <Dropdown
          id="test-dropdown"
          label="Test Dropdown"
          options={mockOptions}
          value=""
          onChange={() => {}}
          {...props}
        />
      </FormProvider>
    </ThemeProvider>
  );
};

describe('Dropdown Component', () => {
  // Material Design 3 Compliance Tests
  describe('Material Design 3 Compliance', () => {
    it('should render with correct Material Design 3 styles', () => {
      renderDropdown();
      const dropdown = screen.getByRole('combobox');
      
      expect(dropdown).toHaveClass('dropdown-select');
      expect(dropdown).toHaveStyle({
        minHeight: '44px', // Touch target size compliance
      });
    });

    it('should apply correct theme variants', () => {
      renderDropdown({ error: true });
      const dropdown = screen.getByRole('combobox');
      
      expect(dropdown.closest('.MuiFormControl-root')).toHaveClass('dropdown-error');
    });

    it('should handle high contrast mode styles', () => {
      const highContrastTheme = createTheme({
        palette: {
          mode: 'light',
          contrastThreshold: 4.5,
        },
      });

      render(
        <ThemeProvider theme={highContrastTheme}>
          <Dropdown
            id="test-dropdown"
            label="Test Dropdown"
            options={mockOptions}
            value=""
            onChange={() => {}}
          />
        </ThemeProvider>
      );

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toHaveStyle({
        border: '2px solid', // High contrast mode border
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderDropdown();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide correct ARIA attributes', () => {
      renderDropdown({
        required: true,
        error: true,
        helperText: 'Error message',
      });

      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toHaveAttribute('aria-required', 'true');
      expect(dropdown).toHaveAttribute('aria-invalid', 'true');
      expect(dropdown).toHaveAttribute('aria-describedby');
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      renderDropdown();
      
      const dropdown = screen.getByRole('combobox');
      await user.tab();
      expect(dropdown).toHaveFocus();

      await user.keyboard('{Enter}');
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveFocus();
    });

    it('should support type-ahead search', async () => {
      const user = userEvent.setup();
      renderDropdown();

      await user.tab();
      await user.keyboard('g');
      
      const graduateOption = screen.getByText('Graduate');
      expect(graduateOption).toHaveAttribute('aria-selected', 'true');
    });
  });

  // Form Integration Tests
  describe('Form Integration', () => {
    it('should integrate with form validation', async () => {
      const onSubmit = jest.fn();
      const methods = useForm({
        defaultValues: {
          programType: '',
        },
      });

      render(
        <ThemeProvider theme={mockTheme}>
          <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)}>
              <Dropdown
                id="program-type"
                label="Program Type"
                name="programType"
                options={mockOptions}
                value=""
                onChange={() => {}}
                required
              />
              <button type="submit">Submit</button>
            </form>
          </FormProvider>
        </ThemeProvider>
      );

      await userEvent.click(screen.getByText('Submit'));
      expect(await screen.findByText(/required/i)).toBeInTheDocument();
    });

    it('should update form values on change', async () => {
      const onChange = jest.fn();
      renderDropdown({ onChange });

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(screen.getByText('Graduate'));

      expect(onChange).toHaveBeenCalledWith(
        'GRADUATE',
        expect.any(Object)
      );
    });
  });

  // Performance Tests
  describe('Performance', () => {
    it('should virtualize large option lists', async () => {
      const largeOptions = Array.from({ length: 1000 }, (_, i) => ({
        value: `option-${i}`,
        label: `Option ${i}`,
      }));

      renderDropdown({ options: largeOptions });
      await userEvent.click(screen.getByRole('combobox'));

      const listbox = screen.getByRole('listbox');
      const renderedOptions = within(listbox).getAllByRole('option');
      
      // Should only render a subset of options due to virtualization
      expect(renderedOptions.length).toBeLessThan(largeOptions.length);
    });

    it('should debounce search input', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      
      renderDropdown();
      await user.click(screen.getByRole('combobox'));
      
      await user.keyboard('grad');
      jest.advanceTimersByTime(300);

      const graduateOption = screen.getByText('Graduate');
      expect(graduateOption).toBeVisible();
      
      jest.useRealTimers();
    });
  });

  // Edge Cases
  describe('Edge Cases', () => {
    it('should handle empty options array', () => {
      renderDropdown({ options: [] });
      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toBeDisabled();
    });

    it('should handle disabled options', () => {
      const optionsWithDisabled = [
        ...mockOptions,
        { value: 'disabled', label: 'Disabled Option', disabled: true },
      ];

      renderDropdown({ options: optionsWithDisabled });
      userEvent.click(screen.getByRole('combobox'));

      const disabledOption = screen.getByText('Disabled Option');
      expect(disabledOption.closest('li')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should handle multi-select mode', async () => {
      const onChange = jest.fn();
      renderDropdown({ multiple: true, onChange });

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(screen.getByText('Graduate'));
      await userEvent.click(screen.getByText('Certificate'));

      expect(onChange).toHaveBeenLastCalledWith(
        ['GRADUATE', 'CERTIFICATE'],
        expect.any(Object)
      );
    });
  });
});