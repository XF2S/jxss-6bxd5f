import React from 'react';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import Button from './Button';

// Version comments for external dependencies
// @testing-library/react: ^14.0.0
// @testing-library/user-event: ^14.0.0
// @mui/material: ^5.0.0

// Helper function to render Button within ThemeProvider
const renderButton = (props = {}, themeOptions = {}) => {
  return render(
    <ThemeProvider theme={themeOptions}>
      <Button {...props} />
    </ThemeProvider>
  );
};

// Mock functions
const mockOnClick = jest.fn();
const mockOnFocus = jest.fn();
const mockOnBlur = jest.fn();

describe('Button Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      renderButton({ children: 'Test Button' });
      const button = screen.getByRole('button', { name: 'Test Button' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('type', 'button');
    });

    it('applies correct Material Design 3 classes', () => {
      renderButton({ children: 'MD3 Button', variant: 'contained' });
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'var(--primary-color)',
        borderRadius: '20px',
        height: '44px', // MD3 standard height for medium buttons
      });
    });

    it('renders with custom className', () => {
      const customClass = 'custom-button';
      renderButton({ children: 'Custom Class', className: customClass });
      expect(screen.getByRole('button')).toHaveClass(customClass);
    });
  });

  describe('Variants', () => {
    it('renders contained variant with elevation', () => {
      renderButton({ children: 'Contained', variant: 'contained', elevation: 2 });
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'var(--primary-color)',
        boxShadow: 'var(--elevation-2)',
      });
    });

    it('renders outlined variant with border', () => {
      renderButton({ children: 'Outlined', variant: 'outlined' });
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'transparent',
        border: '1px solid var(--outline-color)',
      });
    });

    it('renders text variant without background', () => {
      renderButton({ children: 'Text', variant: 'text' });
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'transparent',
      });
    });
  });

  describe('Sizes', () => {
    it('renders with correct dimensions for each size', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      sizes.forEach(size => {
        const { rerender } = renderButton({ children: size, size });
        const button = screen.getByRole('button');
        const expectedHeight = {
          small: '32px',
          medium: '44px',
          large: '48px',
        }[size];
        expect(button).toHaveStyle({ height: expectedHeight });
        rerender(<Button size={size}>{size}</Button>);
      });
    });

    it('maintains minimum touch target size', () => {
      renderButton({ children: 'Touch Target', size: 'small' });
      const button = screen.getByRole('button');
      const { height } = window.getComputedStyle(button);
      expect(parseInt(height)).toBeGreaterThanOrEqual(44); // WCAG touch target requirement
    });
  });

  describe('States', () => {
    it('handles disabled state correctly', () => {
      renderButton({ children: 'Disabled', disabled: true, onClick: mockOnClick });
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('shows loading indicator and prevents interaction', async () => {
      renderButton({ children: 'Loading', loading: true, onClick: mockOnClick });
      const button = screen.getByRole('button');
      const spinner = within(button).getByLabelText('Loading');
      expect(spinner).toBeInTheDocument();
      expect(button).toBeDisabled();
      await userEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('displays focus ring on keyboard focus', async () => {
      renderButton({ children: 'Focus Test' });
      const button = screen.getByRole('button');
      await userEvent.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveStyle({
        outline: 'var(--focus-ring-width) solid var(--focus-ring-color)',
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      renderButton({
        children: 'ARIA Test',
        disabled: true,
        ariaLabel: 'Custom Label',
      });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });

    it('supports keyboard navigation', async () => {
      renderButton({ children: 'Keyboard Nav', onClick: mockOnClick });
      const button = screen.getByRole('button');
      await userEvent.tab();
      expect(button).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      await userEvent.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Icons', () => {
    const TestIcon = () => <span data-testid="test-icon">icon</span>;

    it('renders start icon in correct position', () => {
      renderButton({
        children: 'Icon Button',
        icon: <TestIcon />,
        iconPosition: 'start',
      });
      const button = screen.getByRole('button');
      const icon = within(button).getByTestId('test-icon');
      expect(icon).toBeInTheDocument();
      expect(button.firstElementChild).toContainElement(icon);
    });

    it('renders end icon in correct position', () => {
      renderButton({
        children: 'Icon Button',
        icon: <TestIcon />,
        iconPosition: 'end',
      });
      const button = screen.getByRole('button');
      const icon = within(button).getByTestId('test-icon');
      expect(icon).toBeInTheDocument();
      expect(button.lastElementChild).toContainElement(icon);
    });
  });

  describe('Performance', () => {
    it('renders efficiently without unnecessary updates', () => {
      const { rerender } = renderButton({ children: 'Performance Test' });
      const button = screen.getByRole('button');
      const initialHTML = button.innerHTML;
      
      rerender(<Button>Performance Test</Button>);
      expect(button.innerHTML).toBe(initialHTML);
    });

    it('maintains ripple effect performance', async () => {
      renderButton({ children: 'Ripple Test' });
      const button = screen.getByRole('button');
      const rippleCount = () => button.querySelectorAll('[data-mui-ripple]').length;
      
      expect(rippleCount()).toBe(0);
      await userEvent.click(button);
      expect(rippleCount()).toBeGreaterThan(0);
    });
  });
});