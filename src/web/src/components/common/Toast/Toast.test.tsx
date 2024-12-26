/**
 * @fileoverview Test suite for Toast notification component
 * Verifies Material Design 3 compliance, accessibility requirements,
 * and notification functionality including visual behavior, interaction
 * patterns, and state management.
 * @version 1.0.0
 */

import React from 'react'; // v18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.x
import { act } from 'react-dom/test-utils'; // v18.x
import userEvent from '@testing-library/user-event'; // v14.x
import { axe, toHaveNoViolations } from 'jest-axe'; // v7.x
import { Toast } from './Toast';
import { useNotification } from '@/hooks/useNotification';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useNotification hook
jest.mock('@/hooks/useNotification', () => ({
  useNotification: jest.fn()
}));

// Mock intersection observer for animation testing
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

describe('Toast Component', () => {
  // Common test props
  const defaultProps = {
    open: true,
    message: 'Test notification message',
    severity: 'info' as const,
    duration: Date.now(),
    notificationId: 'test-notification-123',
    onClose: jest.fn()
  };

  // Mock notification hook functions
  const mockMarkAsRead = jest.fn();
  const mockTrackNotification = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotification as jest.Mock).mockReturnValue({
      markAsRead: mockMarkAsRead,
      trackNotification: mockTrackNotification
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should render with correct Material Design 3 styles', () => {
    const { container } = render(<Toast {...defaultProps} />);
    
    // Verify Snackbar styling
    const snackbar = container.querySelector('.MuiSnackbar-root');
    expect(snackbar).toHaveStyle({
      zIndex: expect.any(Number),
      minWidth: '300px',
      backdropFilter: 'blur(8px)'
    });

    // Verify Alert styling
    const alert = container.querySelector('.MuiAlert-root');
    expect(alert).toHaveStyle({
      borderRadius: expect.any(String),
      padding: '6px 16px'
    });
  });

  it('should meet accessibility requirements', async () => {
    const { container } = render(<Toast {...defaultProps} />);

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA attributes
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');

    // Verify close button accessibility
    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveAttribute('aria-label', 'close');
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<Toast {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /close/i });

    // Tab to close button
    await user.tab();
    expect(closeButton).toHaveFocus();

    // Trigger close with keyboard
    await user.keyboard('{Enter}');
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle notification lifecycle', async () => {
    jest.useFakeTimers();
    
    render(
      <Toast
        {...defaultProps}
        autoHideDuration={3000}
      />
    );

    // Verify initial render
    expect(screen.getByText('Test notification message')).toBeInTheDocument();

    // Verify auto-dismiss
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(mockTrackNotification).toHaveBeenCalledWith({
        id: defaultProps.notificationId,
        action: 'CLOSE',
        interactionType: 'timeout',
        timestamp: expect.any(String),
        duration: expect.any(Number)
      });
    });
  });

  it('should handle manual close', async () => {
    const user = userEvent.setup();
    render(<Toast {...defaultProps} />);

    // Click close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    // Verify tracking and cleanup
    expect(mockTrackNotification).toHaveBeenCalledWith({
      id: defaultProps.notificationId,
      action: 'CLOSE',
      interactionType: 'manual',
      timestamp: expect.any(String),
      duration: expect.any(Number)
    });

    expect(mockMarkAsRead).toHaveBeenCalledWith(defaultProps.notificationId);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render different severity variants correctly', () => {
    const severities = ['success', 'error', 'warning', 'info'] as const;
    
    severities.forEach(severity => {
      const { rerender } = render(
        <Toast {...defaultProps} severity={severity} />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(`MuiAlert-${severity}`);

      rerender(<></>);
    });
  });

  it('should handle custom anchor positions', () => {
    const { rerender } = render(
      <Toast
        {...defaultProps}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      />
    );

    let snackbar = screen.getByRole('alert').closest('.MuiSnackbar-root');
    expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginBottomLeft');

    rerender(
      <Toast
        {...defaultProps}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    );

    snackbar = screen.getByRole('alert').closest('.MuiSnackbar-root');
    expect(snackbar).toHaveClass('MuiSnackbar-anchorOriginTopCenter');
  });

  it('should handle error tracking for markAsRead', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockMarkAsRead.mockRejectedValue(new Error('Failed to mark as read'));

    const user = userEvent.setup();
    render(<Toast {...defaultProps} />);

    // Trigger close
    await user.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to mark notification as read:',
        expect.any(Error)
      );
    });

    consoleError.mockRestore();
  });

  it('should track notification exit', async () => {
    const { rerender } = render(<Toast {...defaultProps} />);

    // Trigger exit
    rerender(<Toast {...defaultProps} open={false} />);

    await waitFor(() => {
      expect(mockTrackNotification).toHaveBeenCalledWith({
        id: defaultProps.notificationId,
        action: 'EXITED',
        timestamp: expect.any(String)
      });
    });
  });
});