import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { useForm, FormProvider } from 'react-hook-form';
import Checkbox from './Checkbox';

// Version comments for external dependencies
// @testing-library/react: ^14.0.0
// @testing-library/user-event: ^14.0.0
// @mui/material: ^5.0.0
// react-hook-form: ^7.0.0

// Helper function to render Checkbox with theme
const renderCheckbox = (props: Partial<React.ComponentProps<typeof Checkbox>> = {}, theme = 'light') => {
  const defaultProps = {
    name: 'test-checkbox',
    id: 'test-checkbox',
    label: 'Test Checkbox',
    checked: false,
    onChange: jest.fn(),
    ...props,
  };

  return render(
    <ThemeProvider theme={{ palette: { mode: theme } }}>
      <div data-theme={theme}>
        <Checkbox {...defaultProps} />
      </div>
    </ThemeProvider>
  );
};

// Helper function to render Checkbox within form context
const renderWithForm = (props: Partial<React.ComponentProps<typeof Checkbox>> = {}) => {
  const FormWrapper = ({ children }: { children: React.ReactNode }) => {
    const methods = useForm();
    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  return render(
    <FormWrapper>
      <Checkbox
        name="test-checkbox"
        id="test-checkbox"
        label="Test Checkbox"
        checked={false}
        onChange={jest.fn()}
        {...props}
      />
    </FormWrapper>
  );
};

describe('Checkbox Component', () => {
  describe('Core Functionality', () => {
    it('renders unchecked by default', () => {
      renderCheckbox();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('renders with correct label association', () => {
      renderCheckbox({ label: 'Test Label' });
      const checkbox = screen.getByLabelText('Test Label');
      expect(checkbox).toBeInTheDocument();
    });

    it('handles checked state changes', async () => {
      const onChangeMock = jest.fn();
      renderCheckbox({ onChange: onChangeMock });
      
      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);
      
      expect(onChangeMock).toHaveBeenCalledWith(true);
    });

    it('supports controlled checked state', () => {
      renderCheckbox({ checked: true });
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });
  });

  describe('Accessibility', () => {
    it('maintains ARIA attributes', () => {
      renderCheckbox({
        required: true,
        disabled: false,
        error: 'Error message'
      });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-required', 'true');
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
      expect(checkbox).toHaveAttribute('aria-describedby');
    });

    it('supports keyboard interaction', async () => {
      const onChangeMock = jest.fn();
      renderCheckbox({ onChange: onChangeMock });
      
      const checkbox = screen.getByRole('checkbox');
      await userEvent.tab();
      expect(checkbox).toHaveFocus();
      
      await userEvent.keyboard('[Space]');
      expect(onChangeMock).toHaveBeenCalledWith(true);
    });

    it('displays error message with correct ARIA attributes', () => {
      renderCheckbox({ error: 'Error message' });
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Error message');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });

    it('handles disabled state correctly', () => {
      renderCheckbox({ disabled: true });
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Theme Integration', () => {
    it('applies correct MD3 styles in light theme', () => {
      renderCheckbox({}, 'light');
      const container = screen.getByTestId('checkbox-container');
      expect(container).toHaveAttribute('data-theme', 'light');
    });

    it('applies correct MD3 styles in dark theme', () => {
      renderCheckbox({}, 'dark');
      const container = screen.getByTestId('checkbox-container');
      expect(container).toHaveAttribute('data-theme', 'dark');
    });

    it('supports high contrast mode', () => {
      renderCheckbox({}, 'high-contrast');
      const container = screen.getByTestId('checkbox-container');
      expect(container).toHaveAttribute('data-theme', 'high-contrast');
    });

    it('applies custom className correctly', () => {
      renderCheckbox({ className: 'custom-checkbox' });
      const container = screen.getByTestId('checkbox-container');
      expect(container).toHaveClass('custom-checkbox');
    });
  });

  describe('Form Integration', () => {
    it('works with react-hook-form', async () => {
      const { container } = renderWithForm();
      const checkbox = screen.getByRole('checkbox');
      
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('handles form validation', async () => {
      renderWithForm({ required: true });
      const checkbox = screen.getByRole('checkbox');
      
      await userEvent.tab();
      await userEvent.tab({ shift: true });
      
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    });

    it('updates form values correctly', async () => {
      const { container } = renderWithForm();
      const checkbox = screen.getByRole('checkbox');
      
      await userEvent.click(checkbox);
      expect(checkbox).toBeChecked();
      
      await userEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('RTL Support', () => {
    it('renders correctly in RTL mode', () => {
      render(
        <div dir="rtl">
          <Checkbox
            name="test-checkbox"
            id="test-checkbox"
            label="Test Checkbox"
            checked={false}
            onChange={jest.fn()}
          />
        </div>
      );
      
      const container = screen.getByTestId('checkbox-container');
      expect(container.parentElement).toHaveAttribute('dir', 'rtl');
    });
  });
});