import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { expect, describe, it, jest, beforeEach, afterEach } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { ThemeProvider, createTheme } from '@mui/material';
import Card from './Card';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock intersection observer
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

// Helper function to render Card with theme
const renderCard = (props = {}) => {
  const user = userEvent.setup();
  const theme = createTheme({
    palette: {
      mode: 'light'
    }
  });

  const result = render(
    <ThemeProvider theme={theme}>
      <Card {...props} />
    </ThemeProvider>
  );

  return { ...result, user };
};

describe('Card Component', () => {
  // Mock handlers
  const mockClick = jest.fn();
  const mockKeyDown = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderCard({ children: 'Test Content' });
      expect(screen.getByTestId('md3-card')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      renderCard({ children: <div data-testid="child">Child Content</div> });
      expect(screen.getByTestId('child')).toHaveTextContent('Child Content');
    });

    it('applies custom className', () => {
      renderCard({ children: 'Content', className: 'custom-class' });
      expect(screen.getByTestId('md3-card')).toHaveClass('md3-card', 'custom-class');
    });

    it('maintains proper DOM structure', () => {
      renderCard({ children: 'Content' });
      const card = screen.getByTestId('md3-card');
      expect(card.tagName).toBe('DIV');
      expect(card).toHaveStyle({ position: 'relative' });
    });
  });

  describe('Elevation and Styling', () => {
    it.each([0, 1, 2, 3, 4, 5])('applies correct elevation %i', (elevation) => {
      renderCard({ children: 'Content', elevation });
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveStyle({ boxShadow: `var(--elevation-${elevation})` });
    });

    it('clamps elevation values to valid range', () => {
      renderCard({ children: 'Content', elevation: 10 });
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveStyle({ boxShadow: 'var(--elevation-5)' });
    });

    it('handles negative elevation values', () => {
      renderCard({ children: 'Content', elevation: -1 });
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveStyle({ boxShadow: 'var(--elevation-0)' });
    });

    it('supports high contrast mode', () => {
      // Simulate high contrast mode
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: more)',
        media: query,
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      renderCard({ children: 'Content' });
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveStyle({ border: 'var(--high-contrast-mode-border)' });
    });
  });

  describe('Interaction', () => {
    it('handles click events when interactive', async () => {
      const { user } = renderCard({ 
        children: 'Content', 
        interactive: true, 
        onClick: mockClick 
      });

      const card = screen.getByTestId('md3-card');
      await user.click(card);
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('does not handle click events when non-interactive', async () => {
      const { user } = renderCard({ 
        children: 'Content', 
        interactive: false, 
        onClick: mockClick 
      });

      const card = screen.getByTestId('md3-card');
      await user.click(card);
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('supports keyboard navigation', async () => {
      const { user } = renderCard({ 
        children: 'Content', 
        interactive: true, 
        onClick: mockClick 
      });

      const card = screen.getByTestId('md3-card');
      await user.tab();
      expect(card).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockClick).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(mockClick).toHaveBeenCalledTimes(2);
    });

    it('handles touch interactions', async () => {
      const { user } = renderCard({ 
        children: 'Content', 
        interactive: true, 
        onClick: mockClick 
      });

      const card = screen.getByTestId('md3-card');
      await user.click(card); // simulates touch event
      expect(mockClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderCard({ children: 'Content' });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides correct ARIA roles', () => {
      renderCard({ children: 'Content', interactive: true });
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveAttribute('role', 'button');

      renderCard({ children: 'Content', interactive: false });
      const staticCard = screen.getByTestId('md3-card');
      expect(staticCard).toHaveAttribute('role', 'article');
    });

    it('supports custom ARIA label', () => {
      renderCard({ 
        children: 'Content', 
        ariaLabel: 'Custom Card Label' 
      });
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveAttribute('aria-label', 'Custom Card Label');
    });

    it('manages focus correctly', async () => {
      const { user } = renderCard({ 
        children: 'Content', 
        interactive: true 
      });

      const card = screen.getByTestId('md3-card');
      await user.tab();
      expect(card).toHaveFocus();
      expect(card).toHaveStyle({ outline: expect.stringContaining('solid') });
    });
  });

  describe('Theming', () => {
    it('applies theme correctly', () => {
      const darkTheme = createTheme({ palette: { mode: 'dark' } });
      render(
        <ThemeProvider theme={darkTheme}>
          <Card>Content</Card>
        </ThemeProvider>
      );
      const card = screen.getByTestId('md3-card');
      expect(card).toHaveStyle({ backgroundColor: 'var(--surface-color)' });
    });

    it('supports RTL layout', () => {
      const rtlTheme = createTheme({ direction: 'rtl' });
      render(
        <ThemeProvider theme={rtlTheme}>
          <Card>Content</Card>
        </ThemeProvider>
      );
      const card = screen.getByTestId('md3-card');
      expect(document.dir).toBe('rtl');
    });

    it('maintains proper contrast ratios', async () => {
      const { container } = renderCard({ children: 'Content' });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});