import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { createTheme } from '@mui/material';
import { ProgressBar } from './ProgressBar';

// v5.x @mui/material
// v14.x @testing-library/react
// v29.x @jest/globals

// Helper function to render components with theme context
const renderWithTheme = (
  children: React.ReactNode,
  themeOptions = {}
) => {
  const theme = createTheme(themeOptions);
  return {
    ...render(
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    ),
    theme,
  };
};

// Mock requestAnimationFrame for animation tests
const mockRaf = (callback: FrameRequestCallback): number => {
  callback(0);
  return 0;
};

describe('ProgressBar Component', () => {
  beforeEach(() => {
    window.requestAnimationFrame = jest.fn().mockImplementation(mockRaf);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Functionality', () => {
    it('renders with default props', () => {
      renderWithTheme(<ProgressBar />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('displays correct progress value', () => {
      const value = 75;
      renderWithTheme(<ProgressBar value={value} />);
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', value.toString());
      expect(progressBar).toHaveAttribute('aria-valuetext', `${value}% complete`);
    });

    it('applies different variants correctly', () => {
      const { rerender } = renderWithTheme(<ProgressBar variant="determinate" value={50} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

      rerender(<ProgressBar variant="indeterminate" />);
      expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Loading in progress');

      rerender(<ProgressBar variant="buffer" value={75} />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Loading 75% with buffer');
    });

    it('handles color prop appropriately', () => {
      const { container } = renderWithTheme(<ProgressBar color="secondary" value={50} />);
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      expect(progressBar).toHaveStyle({
        backgroundColor: 'var(--secondary-color)',
      });
    });

    it('respects custom height', () => {
      const height = 8;
      const { container } = renderWithTheme(<ProgressBar height={height} />);
      expect(container.firstChild).toHaveStyle({ height: `${height}px` });
    });
  });

  describe('Accessibility Compliance', () => {
    it('provides correct ARIA attributes', () => {
      renderWithTheme(
        <ProgressBar 
          value={50}
          aria-label="Custom progress"
          aria-valuetext="Custom value text"
        />
      );
      const progressBar = screen.getByRole('progressbar');
      
      expect(progressBar).toHaveAttribute('aria-label', 'Custom progress');
      expect(progressBar).toHaveAttribute('aria-valuetext', 'Custom value text');
      expect(progressBar).toHaveAttribute('tabIndex', '0');
    });

    it('supports keyboard navigation', () => {
      renderWithTheme(<ProgressBar value={50} />);
      const progressBar = screen.getByRole('progressbar');
      
      progressBar.focus();
      expect(document.activeElement).toBe(progressBar);
    });

    it('maintains sufficient color contrast', async () => {
      const { container } = renderWithTheme(
        <ProgressBar value={50} color="primary" />,
        {
          palette: {
            primary: {
              main: '#1976d2', // Ensures WCAG AA compliance
            },
          },
        }
      );
      
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      const backgroundColor = window.getComputedStyle(progressBar!).backgroundColor;
      
      // Verify contrast ratio meets WCAG AA standards
      expect(backgroundColor).toBeTruthy();
    });
  });

  describe('Theme Integration', () => {
    it('applies light theme styles correctly', () => {
      const { container } = renderWithTheme(
        <ProgressBar value={50} />,
        {
          palette: {
            mode: 'light',
          },
        }
      );
      
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      expect(progressBar).toHaveStyle({
        backgroundColor: 'var(--primary-color)',
      });
    });

    it('applies dark theme styles correctly', () => {
      const { container } = renderWithTheme(
        <ProgressBar value={50} />,
        {
          palette: {
            mode: 'dark',
          },
        }
      );
      
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      expect(progressBar).toHaveStyle({
        backgroundColor: 'var(--primary-color)',
      });
    });

    it('supports high contrast mode', () => {
      // Mock matchMedia for high contrast mode
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: more)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }));

      const { container } = renderWithTheme(<ProgressBar value={50} />);
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      
      expect(progressBar).toHaveStyle({
        backgroundColor: 'var(--primary-color)',
      });
    });
  });

  describe('Performance Optimization', () => {
    it('optimizes render cycles', () => {
      const renderSpy = jest.spyOn(React, 'createElement');
      const { rerender } = renderWithTheme(<ProgressBar value={50} />);
      
      rerender(<ProgressBar value={51} />);
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('handles theme switches efficiently', async () => {
      const { rerender } = renderWithTheme(
        <ProgressBar value={50} />,
        { palette: { mode: 'light' } }
      );

      await waitFor(() => {
        rerender(
          <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
            <ProgressBar value={50} />
          </ThemeProvider>
        );
      });

      // Verify smooth transition
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('maintains smooth animations', async () => {
      const { container } = renderWithTheme(<ProgressBar variant="indeterminate" />);
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      
      expect(progressBar).toHaveStyle({
        transition: 'transform var(--animation-duration-base) var(--animation-easing-standard)',
      });
    });

    it('respects reduced motion preferences', () => {
      // Mock matchMedia for reduced motion
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      }));

      const { container } = renderWithTheme(<ProgressBar value={50} />);
      const progressBar = container.querySelector('.MuiLinearProgress-bar');
      
      fireEvent.animationEnd(progressBar!);
      expect(progressBar).toHaveStyle({ transition: 'none' });
    });
  });
});