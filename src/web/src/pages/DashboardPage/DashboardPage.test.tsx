/**
 * @fileoverview Comprehensive test suite for DashboardPage component
 * Implements testing for rendering, interactions, accessibility, and performance
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ResizeObserver from 'resize-observer-polyfill';

import DashboardPage from './DashboardPage';
import { useAuth } from '../../hooks/useAuth';
import { ApplicationStatus } from '@/types/application.types';
import { ThemeMode } from '@/config/theme.config';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket
class MockWebSocket {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  close = vi.fn();
  send = vi.fn();
}

// Mock data
const mockMetrics = {
  activeApplications: 12,
  pendingApplications: 5,
  completedApplications: 45,
};

const mockActivities = [
  {
    id: '1',
    type: 'APPLICATION_SUBMITTED',
    timestamp: new Date().toISOString(),
    details: { applicationId: 'app-123' },
  },
];

const mockUser = {
  id: 'user-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  roles: ['applicant'],
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    }),
    ...renderOptions
  } = {}
) => {
  // Create mock store
  const mockStore = {
    getState: () => preloadedState,
    subscribe: vi.fn(),
    dispatch: vi.fn(),
  };

  // Setup all required providers
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Provider store={mockStore}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    mockStore,
    queryClient,
  };
};

// Setup function for common mocks
const setupMocks = () => {
  // Mock useAuth hook
  vi.mocked(useAuth).mockReturnValue({
    user: mockUser,
    isAuthenticated: true,
    hasPermission: (permission: string) => true,
  } as any);

  // Mock fetch for API calls
  global.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/metrics')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockMetrics),
      });
    }
    if (url.includes('/activities')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockActivities),
      });
    }
    return Promise.reject(new Error('Not found'));
  });

  // Mock WebSocket
  global.WebSocket = MockWebSocket as any;

  // Mock ResizeObserver
  global.ResizeObserver = ResizeObserver;
};

describe('DashboardPage Component', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('should render all main sections correctly', async () => {
      renderWithProviders(<DashboardPage />);

      // Verify main sections are present
      expect(screen.getByText('Applications Overview')).toBeInTheDocument();
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Recent Applications')).toBeInTheDocument();

      // Verify metrics are displayed
      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument(); // Active applications
        expect(screen.getByText('5')).toBeInTheDocument(); // Pending applications
        expect(screen.getByText('45')).toBeInTheDocument(); // Completed applications
      });
    });

    it('should show loading state initially', () => {
      renderWithProviders(<DashboardPage />);
      expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
    });

    it('should handle error states gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));
      renderWithProviders(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket updates correctly', async () => {
      const { container } = renderWithProviders(<DashboardPage />);
      const ws = new MockWebSocket();

      // Simulate WebSocket message for metrics update
      const metricsUpdate = {
        type: 'METRICS_UPDATE',
        metrics: { ...mockMetrics, activeApplications: 15 },
      };

      ws.onmessage?.({ data: JSON.stringify(metricsUpdate) } as any);

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });

    it('should handle WebSocket connection errors', async () => {
      renderWithProviders(<DashboardPage />);
      const ws = new MockWebSocket();

      ws.onerror?.({} as any);

      await waitFor(() => {
        expect(screen.getByText(/real-time updates connection failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(<DashboardPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle keyboard navigation correctly', () => {
      renderWithProviders(<DashboardPage />);
      const newAppButton = screen.getByText('New Application');

      // Test keyboard focus
      newAppButton.focus();
      expect(document.activeElement).toBe(newAppButton);

      // Test keyboard interaction
      fireEvent.keyDown(newAppButton, { key: 'Enter' });
      expect(global.window.location.pathname).toBe('/applications/new');
    });
  });

  describe('Responsive Behavior', () => {
    it('should adjust layout for mobile viewport', async () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;
      fireEvent(window, new Event('resize'));

      renderWithProviders(<DashboardPage />);

      // Verify mobile-specific layout adjustments
      const metricsSection = screen.getByText('Applications Overview').parentElement;
      expect(metricsSection).toHaveStyle({ 'grid-column': 'span 12' });
    });

    it('should handle orientation changes', async () => {
      const { rerender } = renderWithProviders(<DashboardPage />);

      // Simulate orientation change
      global.innerWidth = 667;
      global.innerHeight = 375;
      fireEvent(window, new Event('resize'));

      rerender(<DashboardPage />);

      // Verify layout adjustments after orientation change
      const actionsSection = screen.getByText('Quick Actions').parentElement;
      expect(actionsSection).toHaveStyle({ 'flex-direction': 'row' });
    });
  });

  describe('Performance', () => {
    it('should render within performance budget', async () => {
      const startTime = performance.now();
      renderWithProviders(<DashboardPage />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200); // 200ms budget
    });

    it('should handle frequent data updates efficiently', async () => {
      const { rerender } = renderWithProviders(<DashboardPage />);

      // Simulate multiple rapid updates
      for (let i = 0; i < 10; i++) {
        const ws = new MockWebSocket();
        ws.onmessage?.({
          data: JSON.stringify({
            type: 'METRICS_UPDATE',
            metrics: { ...mockMetrics, activeApplications: i },
          }),
        } as any);
        rerender(<DashboardPage />);
      }

      // Verify no memory leaks or performance degradation
      expect(performance.memory?.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    });
  });
});