import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { axe, toHaveNoViolations } from 'jest-axe';
import MainLayout from './MainLayout';
import { ThemeMode } from '../../../config/theme.config';

// Mock dependencies
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn(),
}));

jest.mock('../../../hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({
    currentTheme: createTheme(),
    themeMode: ThemeMode.LIGHT,
    toggleTheme: jest.fn(),
  }),
}));

// Custom render function with theme provider
const renderWithTheme = (ui: React.ReactNode, themeMode: ThemeMode = ThemeMode.LIGHT) => {
  const theme = createTheme({
    palette: {
      mode: themeMode === ThemeMode.HIGH_CONTRAST ? 'dark' : themeMode,
    },
  });

  return render(
    <ThemeProvider theme={theme}>
      {ui}
    </ThemeProvider>
  );
};

// Helper to simulate viewport sizes
const simulateViewport = (width: number) => {
  (useMediaQuery as jest.Mock).mockImplementation((query: string) => {
    if (query.includes('(min-width:1024px)')) return width >= 1024;
    if (query.includes('(min-width:768px)')) return width >= 768;
    return width >= 320;
  });
};

describe('MainLayout', () => {
  const mockPageTitle = 'Test Page';
  const mockChildren = <div data-testid="test-content">Test Content</div>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Initialize axe
    expect.extend(toHaveNoViolations);
  });

  it('renders all core layout components', () => {
    renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>
    );

    // Verify core components
    expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
    expect(screen.getByRole('navigation')).toBeInTheDocument(); // Sidebar
    expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // Footer
    expect(screen.getByTestId('test-content')).toBeInTheDocument(); // Children
  });

  it('handles responsive layouts correctly', async () => {
    // Test mobile layout (320px)
    simulateViewport(320);
    const { rerender } = renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>
    );

    expect(screen.getByRole('navigation')).toHaveStyle({ transform: 'translateX(-240px)' });

    // Test tablet layout (768px)
    simulateViewport(768);
    rerender(
      <ThemeProvider theme={createTheme()}>
        <MainLayout pageTitle={mockPageTitle}>
          {mockChildren}
        </MainLayout>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('navigation')).not.toHaveStyle({ transform: 'translateX(-240px)' });
    });

    // Test desktop layout (1024px)
    simulateViewport(1024);
    rerender(
      <ThemeProvider theme={createTheme()}>
        <MainLayout pageTitle={mockPageTitle}>
          {mockChildren}
        </MainLayout>
      </ThemeProvider>
    );

    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(main).toHaveStyle({ marginLeft: '240px' });
    });
  });

  it('maintains accessibility standards', async () => {
    const { container } = renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>
    );

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA landmarks
    expect(screen.getByRole('banner')).toHaveAttribute('aria-label');
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label');
    expect(screen.getByRole('main')).toHaveAttribute('aria-label', mockPageTitle);
    expect(screen.getByRole('contentinfo')).toHaveAttribute('aria-label');

    // Test skip link functionality
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toHaveAttribute('href', '#main-content');
    
    fireEvent.focus(skipLink);
    expect(skipLink).toBeVisible();
    
    fireEvent.keyDown(skipLink, { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it('integrates with theme system correctly', async () => {
    // Test light theme
    const { rerender } = renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>,
      ThemeMode.LIGHT
    );

    expect(screen.getByRole('main')).toHaveStyle({
      backgroundColor: expect.stringMatching(/^rgb\(255, 255, 255\)$/)
    });

    // Test dark theme
    rerender(
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <MainLayout pageTitle={mockPageTitle}>
          {mockChildren}
        </MainLayout>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('main')).toHaveStyle({
        backgroundColor: expect.stringMatching(/^rgb\(18, 18, 18\)$/)
      });
    });

    // Test high contrast theme
    rerender(
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <MainLayout pageTitle={mockPageTitle}>
          {mockChildren}
        </MainLayout>
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('main')).toHaveStyle({
        backgroundColor: expect.stringMatching(/^rgb\(0, 0, 0\)$/)
      });
    });
  });

  it('handles mobile menu interactions correctly', async () => {
    simulateViewport(320);
    renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>
    );

    // Test menu button functionality
    const menuButton = screen.getByLabelText('Toggle navigation menu');
    fireEvent.click(menuButton);

    await waitFor(() => {
      const navigation = screen.getByRole('navigation');
      expect(navigation).toBeVisible();
      expect(navigation).not.toHaveStyle({ transform: 'translateX(-240px)' });
    });

    // Test close button functionality
    const closeButton = within(screen.getByRole('navigation')).getByRole('button');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toHaveStyle({ transform: 'translateX(-240px)' });
    });
  });

  it('updates document title correctly', () => {
    renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>
    );

    expect(document.title).toBe(`${mockPageTitle} | Enrollment System`);
  });

  it('handles keyboard navigation correctly', () => {
    renderWithTheme(
      <MainLayout pageTitle={mockPageTitle}>
        {mockChildren}
      </MainLayout>
    );

    const menuButton = screen.getByLabelText('Toggle navigation menu');
    
    // Test keyboard navigation
    fireEvent.keyDown(menuButton, { key: 'Tab' });
    expect(document.activeElement).toBe(menuButton);

    fireEvent.keyDown(menuButton, { key: 'Enter' });
    expect(screen.getByRole('navigation')).toBeVisible();

    // Test focus trap in navigation menu
    const firstNavItem = within(screen.getByRole('navigation')).getAllByRole('button')[0];
    fireEvent.keyDown(firstNavItem, { key: 'Tab' });
    expect(document.activeElement).not.toBe(menuButton);
  });
});