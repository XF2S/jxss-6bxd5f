import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { ThemeProvider, useMediaQuery, useTheme } from '@mui/material';
import { createTheme } from '@mui/material/styles';

import Sidebar from './Sidebar';
import { ROUTES } from '@/constants/routes.constants';
import { UserRole } from '@backend/shared/models/user.model';

// Mock hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('@mui/material/useMediaQuery');
vi.mock('@mui/material/styles', async () => {
  const actual = await vi.importActual('@mui/material/styles');
  return {
    ...actual,
    useTheme: vi.fn(),
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    hasPermission: (role: string) => role === '*' || role === 'admin',
    user: {
      roles: ['admin'],
    },
  })),
}));

// Test utilities
const theme = createTheme({
  direction: 'ltr',
  components: {
    MuiDrawer: {
      defaultProps: {
        'aria-label': 'main navigation',
      },
    },
  },
});

interface RenderOptions {
  isOpen?: boolean;
  variant?: 'permanent' | 'temporary' | 'persistent';
  isMobile?: boolean;
  roles?: string[];
}

const renderWithProviders = (options: RenderOptions = {}) => {
  const {
    isOpen = true,
    variant = 'permanent',
    isMobile = false,
    roles = ['admin'],
  } = options;

  const navigate = vi.fn();
  (useNavigate as jest.Mock).mockReturnValue(navigate);
  (useMediaQuery as jest.Mock).mockReturnValue(isMobile);
  (useTheme as jest.Mock).mockReturnValue(theme);

  vi.mocked(useAuth).mockImplementation(() => ({
    isAuthenticated: true,
    hasPermission: (role: string) => role === '*' || roles.includes(role),
    user: { roles },
  }));

  return {
    ...render(
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          <Sidebar
            open={isOpen}
            onClose={vi.fn()}
            variant={variant}
          />
        </ThemeProvider>
      </MemoryRouter>
    ),
    navigate,
  };
};

describe('Sidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all navigation items for admin role', () => {
      renderWithProviders({ roles: ['admin'] });
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render limited navigation items for applicant role', () => {
      renderWithProviders({ roles: ['applicant'] });
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('should implement correct ARIA attributes', () => {
      renderWithProviders();
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'main navigation');
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('should handle RTL layout', () => {
      const rtlTheme = createTheme({ direction: 'rtl' });
      (useTheme as jest.Mock).mockReturnValue(rtlTheme);
      
      renderWithProviders();
      const drawer = screen.getByRole('navigation');
      expect(drawer).toHaveStyle({ direction: 'rtl' });
    });
  });

  describe('Navigation', () => {
    it('should navigate to correct route on click', async () => {
      const { navigate } = renderWithProviders();
      
      const dashboardButton = screen.getByText('Dashboard');
      await userEvent.click(dashboardButton);
      
      expect(navigate).toHaveBeenCalledWith(ROUTES.DASHBOARD.HOME.path);
    });

    it('should handle keyboard navigation', async () => {
      const { navigate } = renderWithProviders();
      
      const nav = screen.getByRole('navigation');
      await userEvent.tab();
      
      expect(nav.contains(document.activeElement)).toBe(true);
      
      await userEvent.keyboard('{Enter}');
      expect(navigate).toHaveBeenCalled();
    });

    it('should close sidebar on mobile after navigation', async () => {
      const onClose = vi.fn();
      renderWithProviders({ isMobile: true, variant: 'temporary' });
      
      const dashboardButton = screen.getByText('Dashboard');
      await userEvent.click(dashboardButton);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render in mobile view below breakpoint', () => {
      renderWithProviders({ isMobile: true, variant: 'temporary' });
      
      const drawer = screen.getByRole('navigation').parentElement;
      expect(drawer).toHaveClass('MuiDrawer-temporary');
    });

    it('should render in desktop view above breakpoint', () => {
      renderWithProviders({ isMobile: false, variant: 'permanent' });
      
      const drawer = screen.getByRole('navigation').parentElement;
      expect(drawer).toHaveClass('MuiDrawer-permanent');
    });

    it('should handle touch interactions', async () => {
      const onClose = vi.fn();
      renderWithProviders({ isMobile: true, variant: 'temporary' });
      
      const drawer = screen.getByRole('navigation');
      await userEvent.click(drawer);
      
      fireEvent.touchStart(drawer, { touches: [{ clientX: 0, clientY: 0 }] });
      fireEvent.touchMove(drawer, { touches: [{ clientX: 250, clientY: 0 }] });
      fireEvent.touchEnd(drawer);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Access Control', () => {
    it('should hide restricted routes for unauthorized roles', () => {
      renderWithProviders({ roles: ['applicant'] });
      
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      expect(screen.queryByText('Review Applications')).not.toBeInTheDocument();
    });

    it('should show all routes for admin role', () => {
      renderWithProviders({ roles: ['admin'] });
      
      const allRoutes = [
        'Dashboard',
        'Applications',
        'Documents',
        'Profile',
        'Settings'
      ];
      
      allRoutes.forEach(route => {
        expect(screen.getByText(route)).toBeInTheDocument();
      });
    });

    it('should handle unauthenticated state', () => {
      vi.mocked(useAuth).mockImplementation(() => ({
        isAuthenticated: false,
        hasPermission: () => false,
        user: null,
      }));

      renderWithProviders();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should maintain focus management', async () => {
      renderWithProviders();
      
      const firstButton = screen.getAllByRole('button')[0];
      const lastButton = screen.getAllByRole('button')[screen.getAllByRole('button').length - 1];
      
      // Focus first item
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);
      
      // Tab to last item
      await userEvent.tab();
      expect(document.activeElement).toBe(lastButton);
      
      // Shift+Tab back to first item
      await userEvent.tab({ shift: true });
      expect(document.activeElement).toBe(firstButton);
    });

    it('should have sufficient color contrast', () => {
      renderWithProviders();
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        expect(styles.color).toHaveContrastRatio(styles.backgroundColor, 4.5);
      });
    });
  });
});