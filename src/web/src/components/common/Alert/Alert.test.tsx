import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import { ThemeProvider, createTheme } from '@mui/material';
import Alert from './Alert';

// Helper function to render Alert with theme
const renderAlert = (props: any = {}, themeOptions: any = {}) => {
  const theme = createTheme({
    direction: 'ltr',
    ...themeOptions
  });
  
  return render(
    <ThemeProvider theme={theme}>
      <Alert message="Test message" severity="info" {...props} />
    </ThemeProvider>
  );
};

// Mock matchMedia for theme preference tests
const setupMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe('Alert Component Rendering', () => {
  it('renders with default props', () => {
    renderAlert();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('data-testid', 'alert');
  });

  it('displays correct message', () => {
    const message = 'Important alert message';
    renderAlert({ message });
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('applies correct severity styles', () => {
    const { rerender } = renderAlert();
    
    ['error', 'warning', 'info', 'success'].forEach((severity) => {
      rerender(
        <ThemeProvider theme={createTheme()}>
          <Alert message="Test" severity={severity as any} />
        </ThemeProvider>
      );
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(`MuiAlert-${severity}`);
    });
  });

  it('supports custom className', () => {
    const customClass = 'custom-alert';
    renderAlert({ className: customClass });
    expect(screen.getByRole('alert')).toHaveClass(customClass);
  });

  it('renders with RTL text direction', () => {
    renderAlert({}, { direction: 'rtl' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ direction: 'rtl' });
  });
});

describe('Alert Interaction', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('handles dismissible functionality', async () => {
    renderAlert({ onClose });
    const closeButton = screen.getByRole('button', { name: /close/i });
    
    await userEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard interaction', async () => {
    renderAlert({ onClose });
    const closeButton = screen.getByRole('button', { name: /close/i });
    
    await userEvent.tab();
    expect(closeButton).toHaveFocus();
    
    await userEvent.keyboard('{enter}');
    expect(onClose).toHaveBeenCalled();
  });

  it('maintains focus after close', async () => {
    renderAlert({ onClose });
    const closeButton = screen.getByRole('button', { name: /close/i });
    
    await userEvent.tab();
    await userEvent.keyboard('{enter}');
    
    expect(document.activeElement).not.toBe(closeButton);
  });

  it('prevents focus trap when closed', async () => {
    const { unmount } = renderAlert({ onClose });
    await userEvent.tab();
    unmount();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('Alert Accessibility', () => {
  it('announces messages to screen readers', () => {
    const message = 'Critical error occurred';
    renderAlert({ message, severity: 'error' });
    const alert = screen.getByRole('alert');
    
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });

  it('supports reduced motion', () => {
    setupMatchMedia(true); // Prefer reduced motion
    renderAlert();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ animation: 'none' });
  });

  it('meets touch target size requirements', () => {
    renderAlert();
    const closeButton = screen.getByRole('button', { name: /close/i });
    const { height, width } = closeButton.getBoundingClientRect();
    
    expect(height).toBeGreaterThanOrEqual(44);
    expect(width).toBeGreaterThanOrEqual(44);
  });

  it('maintains ARIA roles and labels', () => {
    renderAlert({ severity: 'error' });
    const alert = screen.getByRole('alert');
    
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });
});

describe('Alert Theming', () => {
  it('applies light theme styles', () => {
    renderAlert({ highContrast: false });
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveStyle({ border: '2px solid currentColor' });
  });

  it('applies dark theme styles', () => {
    renderAlert({ highContrast: false }, { palette: { mode: 'dark' } });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardInfo');
  });

  it('supports high contrast mode', () => {
    renderAlert({ highContrast: true });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ border: '2px solid currentColor' });
  });

  it('handles theme transitions', () => {
    const { rerender } = renderAlert({ highContrast: false });
    
    rerender(
      <ThemeProvider theme={createTheme()}>
        <Alert message="Test" severity="info" highContrast={true} />
      </ThemeProvider>
    );
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ border: '2px solid currentColor' });
  });
});

describe('Alert Error Handling', () => {
  it('maps error codes to severities', () => {
    const testCases = [
      { code: '1001', severity: 'error' },
      { code: '2001', severity: 'warning' },
      { code: '3001', severity: 'error' },
      { code: '4001', severity: 'warning' },
      { code: '5001', severity: 'error' }
    ];

    testCases.forEach(({ code, severity }) => {
      const { rerender } = renderAlert({ errorCode: code });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(`MuiAlert-${severity}`);
      
      rerender(
        <ThemeProvider theme={createTheme()}>
          <Alert message="Test" severity="info" errorCode={code} />
        </ThemeProvider>
      );
    });
  });

  it('handles unknown error codes', () => {
    renderAlert({ errorCode: '9999' });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardInfo');
  });

  it('displays error messages correctly', () => {
    const errorCode = '1001';
    const message = 'Authentication failed';
    renderAlert({ errorCode, message });
    
    expect(screen.getByText(`[${errorCode}] ${message}`)).toBeInTheDocument();
  });

  it('supports error code ranges', () => {
    const ranges = [
      { start: 1000, end: 1999, severity: 'error' },
      { start: 2000, end: 2999, severity: 'warning' },
      { start: 3000, end: 3999, severity: 'error' },
      { start: 4000, end: 4999, severity: 'warning' },
      { start: 5000, end: 5999, severity: 'error' }
    ];

    ranges.forEach(({ start, end, severity }) => {
      const code = String(start + Math.floor(Math.random() * (end - start)));
      renderAlert({ errorCode: code });
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(`MuiAlert-${severity}`);
    });
  });
});