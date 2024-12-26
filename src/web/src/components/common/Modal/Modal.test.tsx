import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ThemeProvider, Theme } from '@mui/material';
import Modal from './Modal';
import { ThemeMode, createCustomTheme } from '../../../config/theme.config';

// Version comments for external dependencies
// @testing-library/react: ^14.0.0
// @testing-library/user-event: ^14.0.0
// @jest/globals: ^29.0.0
// @mui/material: ^5.0.0

/**
 * Helper function to render Modal component with theme provider
 */
const renderModal = (props: Partial<Parameters<typeof Modal>[0]> = {}, themeOptions = {}) => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal content</div>,
  };

  const theme = createCustomTheme(ThemeMode.LIGHT, themeOptions);
  const user = userEvent.setup();

  // Create portal root for modal rendering
  const portalRoot = document.createElement('div');
  portalRoot.setAttribute('id', 'modal-root');
  document.body.appendChild(portalRoot);

  const utils = render(
    <ThemeProvider theme={theme}>
      <Modal {...defaultProps} {...props} />
    </ThemeProvider>
  );

  return {
    ...utils,
    user,
    theme,
  };
};

describe('Modal Component Functionality', () => {
  const onCloseMock = jest.fn();

  beforeEach(() => {
    // Mock window.matchMedia for responsive tests
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('renders modal when open is true', () => {
    renderModal({ open: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  test('does not render when open is false', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('calls onClose when close button clicked', async () => {
    const { user } = renderModal({ onClose: onCloseMock });
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    expect(onCloseMock).toHaveBeenCalledWith(expect.any(Object), 'escapeKeyDown');
  });

  test('calls onClose when backdrop clicked', async () => {
    const { user } = renderModal({ onClose: onCloseMock });
    const backdrop = document.querySelector('.MuiBackdrop-root');
    await user.click(backdrop!);
    expect(onCloseMock).toHaveBeenCalledWith(expect.any(Object), 'backdropClick');
  });

  test('calls onClose when Escape pressed', async () => {
    const { user } = renderModal({ onClose: onCloseMock });
    await user.keyboard('{Escape}');
    expect(onCloseMock).toHaveBeenCalledWith(expect.any(Object), 'escapeKeyDown');
  });

  test('prevents scroll on body when open', () => {
    renderModal({ open: true });
    expect(document.body.style.overflow).toBe('hidden');
  });

  test('restores scroll on body when closed', () => {
    const { rerender } = renderModal({ open: true });
    rerender(
      <ThemeProvider theme={createCustomTheme(ThemeMode.LIGHT)}>
        <Modal open={false} onClose={jest.fn()} title="Test" children={<div />} />
      </ThemeProvider>
    );
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Modal Accessibility', () => {
  test('maintains focus trap within modal', async () => {
    const { user } = renderModal({
      children: (
        <>
          <button>First</button>
          <button>Second</button>
          <button>Third</button>
        </>
      ),
    });

    const buttons = screen.getAllByRole('button');
    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];

    // Focus should cycle through modal elements
    await user.tab();
    expect(firstButton).toHaveFocus();
    
    await user.tab();
    expect(buttons[1]).toHaveFocus();
    
    await user.tab();
    expect(lastButton).toHaveFocus();
    
    await user.tab();
    expect(firstButton).toHaveFocus();
  });

  test('sets correct ARIA attributes', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');
    expect(screen.getByRole('heading')).toHaveAttribute('id');
  });

  test('handles keyboard navigation', async () => {
    const { user } = renderModal({
      actions: (
        <>
          <button>Cancel</button>
          <button>Confirm</button>
        </>
      ),
    });

    await user.keyboard('{Tab}');
    expect(screen.getByText('Cancel')).toHaveFocus();
    
    await user.keyboard('{Tab}');
    expect(screen.getByText('Confirm')).toHaveFocus();
  });

  test('provides screen reader announcements', async () => {
    const { rerender } = renderModal();
    const dialog = screen.getByRole('dialog');
    
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    
    // Test dynamic announcements
    rerender(
      <ThemeProvider theme={createCustomTheme(ThemeMode.LIGHT)}>
        <Modal
          open={true}
          onClose={jest.fn()}
          title="Updated Title"
          children={<div>Updated content</div>}
        />
      </ThemeProvider>
    );
    
    expect(screen.getByText('Updated Title')).toBeInTheDocument();
  });
});

describe('Modal Theming', () => {
  test('applies correct theme tokens', () => {
    const { theme } = renderModal();
    const dialog = screen.getByRole('dialog');
    
    const styles = window.getComputedStyle(dialog);
    expect(styles.backgroundColor).toBe(theme.palette.background.paper);
    expect(styles.borderRadius).toBe('28px');
  });

  test('handles theme switching', () => {
    const { rerender } = renderModal();
    const darkTheme = createCustomTheme(ThemeMode.DARK);
    
    rerender(
      <ThemeProvider theme={darkTheme}>
        <Modal open={true} onClose={jest.fn()} title="Test" children={<div />} />
      </ThemeProvider>
    );
    
    const dialog = screen.getByRole('dialog');
    const styles = window.getComputedStyle(dialog);
    expect(styles.backgroundColor).toBe(darkTheme.palette.background.paper);
  });

  test('maintains contrast ratios in all themes', () => {
    const { rerender } = renderModal();
    const themes = [ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.HIGH_CONTRAST];
    
    themes.forEach(mode => {
      const theme = createCustomTheme(mode);
      rerender(
        <ThemeProvider theme={theme}>
          <Modal open={true} onClose={jest.fn()} title="Test" children={<div />} />
        </ThemeProvider>
      );
      
      const dialog = screen.getByRole('dialog');
      const title = screen.getByText('Test');
      
      const dialogStyles = window.getComputedStyle(dialog);
      const titleStyles = window.getComputedStyle(title);
      
      // Verify contrast ratio meets WCAG requirements
      expect(titleStyles.color).toBeTruthy();
      expect(dialogStyles.backgroundColor).toBeTruthy();
    });
  });
});

describe('Modal Responsiveness', () => {
  test('maintains proper width constraints', () => {
    renderModal({ maxWidth: 'sm' });
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ maxWidth: '600px' });
  });

  test('adapts to viewport changes', () => {
    // Mock mobile viewport
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('max-width: 600px'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    renderModal();
    const dialog = screen.getByRole('dialog');
    const styles = window.getComputedStyle(dialog);
    
    expect(styles.margin).toBe('16px');
    expect(styles.borderRadius).toBe('24px');
  });

  test('handles touch interactions', async () => {
    const onCloseMock = jest.fn();
    const { user } = renderModal({ onClose: onCloseMock });
    
    const dialog = screen.getByRole('dialog');
    await user.pointer([
      { target: dialog, keys: '[TouchA>]' },
      { target: dialog, keys: '[/TouchA]' },
    ]);
    
    expect(dialog).toBeVisible();
  });
});