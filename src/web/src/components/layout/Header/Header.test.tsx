/**
 * @fileoverview Comprehensive test suite for the Header component
 * Verifies Material Design 3 implementation, navigation, theme management,
 * and accessibility requirements.
 * @version 1.0.0
 */

// External imports - v14.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { vi } from 'vitest';

// Internal imports
import Header from './Header';
import { ThemeMode } from '@/config/theme.config';
import { UserRole, UserStatus } from '@backend/shared/models/user.model';

// Add custom matchers
expect.extend(toHaveNoViolations);

// Mock hooks
vi.mock('@/hooks/useAuth', () => ({
  default: vi.fn(() => ({
    user: null,
    logout: vi.fn(),
    isAuthenticated: false
  }))
}));

vi.mock('@/hooks/useTheme', () => ({
  default: vi.fn(() => ({
    themeMode: ThemeMode.LIGHT,
    toggleTheme: vi.fn(),
    isDarkMode: false
  }))
}));

// Mock Material-UI hooks
vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false)
}));

describe('Header Component', () => {
  // Test setup
  const mockOnMenuClick = vi.fn();
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    roles: [UserRole.APPLICANT],
    status: UserStatus.ACTIVE,
    mfaEnabled: false,
    lastLoginAt: new Date(),
    createdAt: new Date()
  };

  const renderHeader = () => {
    return render(
      <Header 
        onMenuClick={mockOnMenuClick}
        testId="header-component"
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with all features', async () => {
    const { container } = renderHeader();

    // Verify basic structure
    expect(screen.getByTestId('header-component')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveStyle({ height: '64px' });
    expect(screen.getByText('Enrollment System')).toBeInTheDocument();

    // Verify accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA labels
    expect(screen.getByLabelText('Toggle navigation menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle theme mode')).toBeInTheDocument();
    expect(screen.getByLabelText(/View notifications/)).toBeInTheDocument();
  });

  it('handles theme switching correctly', async () => {
    const mockToggleTheme = vi.fn();
    const useTheme = vi.requireMock('@/hooks/useTheme').default;
    useTheme.mockImplementation(() => ({
      themeMode: ThemeMode.LIGHT,
      toggleTheme: mockToggleTheme,
      isDarkMode: false
    }));

    renderHeader();

    // Click theme toggle button
    const themeButton = screen.getByLabelText('Toggle theme mode');
    await userEvent.click(themeButton);

    // Verify theme toggle was called
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);

    // Verify theme icon changes
    useTheme.mockImplementation(() => ({
      themeMode: ThemeMode.DARK,
      toggleTheme: mockToggleTheme,
      isDarkMode: true
    }));

    renderHeader();
    expect(screen.getByTestId('header-component')).toHaveAttribute('data-theme', 'dark');
  });

  it('manages user authentication state correctly', async () => {
    const mockLogout = vi.fn();
    const useAuth = vi.requireMock('@/hooks/useAuth').default;
    
    // Test unauthenticated state
    useAuth.mockImplementation(() => ({
      user: null,
      logout: mockLogout,
      isAuthenticated: false
    }));

    renderHeader();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();

    // Test authenticated state
    useAuth.mockImplementation(() => ({
      user: mockUser,
      logout: mockLogout,
      isAuthenticated: true
    }));

    renderHeader();
    
    // Verify user avatar and logout button
    expect(screen.getByAltText(`${mockUser.firstName} ${mockUser.lastName}`)).toBeInTheDocument();
    const logoutButton = screen.getByText('Logout');
    expect(logoutButton).toBeInTheDocument();

    // Test logout functionality
    await userEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('handles notifications correctly', async () => {
    renderHeader();

    // Test notification badge
    const notificationButton = screen.getByLabelText(/View notifications/);
    expect(notificationButton).toBeInTheDocument();

    // Simulate new notification
    const badge = within(notificationButton).getByTestId('NotificationBadge');
    expect(badge).toBeInTheDocument();

    // Click notification button
    await userEvent.click(notificationButton);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('handles responsive behavior correctly', () => {
    const useMediaQuery = vi.requireMock('@mui/material/useMediaQuery').default;

    // Test mobile view
    useMediaQuery.mockImplementation(() => true);
    renderHeader();
    expect(screen.queryByText('Enrollment System')).not.toBeVisible();

    // Test desktop view
    useMediaQuery.mockImplementation(() => false);
    renderHeader();
    expect(screen.getByText('Enrollment System')).toBeVisible();
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderHeader();

    // Test keyboard navigation
    const menuButton = screen.getByLabelText('Toggle navigation menu');
    menuButton.focus();
    expect(menuButton).toHaveFocus();

    // Test focus trap
    fireEvent.keyDown(menuButton, { key: 'Tab' });
    const themeButton = screen.getByLabelText('Toggle theme mode');
    expect(themeButton).toHaveFocus();

    // Verify high contrast support
    const useTheme = vi.requireMock('@/hooks/useTheme').default;
    useTheme.mockImplementation(() => ({
      themeMode: ThemeMode.HIGH_CONTRAST,
      toggleTheme: vi.fn(),
      isDarkMode: false
    }));

    renderHeader();
    expect(screen.getByTestId('header-component')).toHaveAttribute('data-theme', 'high-contrast');

    // Run full accessibility audit
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});