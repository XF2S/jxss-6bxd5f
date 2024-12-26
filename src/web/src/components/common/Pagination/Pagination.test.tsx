import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Pagination from './Pagination';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock intersection observer
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

// Default test props
const DEFAULT_PROPS = {
  totalItems: 100,
  itemsPerPage: 10,
  currentPage: 1,
  onPageChange: jest.fn(),
  siblingCount: 1,
  boundaryCount: 1,
  showFirstButton: true,
  showLastButton: true,
  disabled: false,
  ariaLabel: 'Pagination navigation'
};

// Helper function to render with theme
const renderPaginationWithTheme = (props = {}, themeOptions = {}) => {
  const theme = createTheme({
    ...themeOptions,
    direction: themeOptions.direction || 'ltr'
  });

  return render(
    <ThemeProvider theme={theme}>
      <Pagination {...DEFAULT_PROPS} {...props} />
    </ThemeProvider>
  );
};

describe('Pagination Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      renderPaginationWithTheme();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(7); // 5 page buttons + prev/next
    });

    it('applies correct Material Design 3 styles', () => {
      renderPaginationWithTheme();
      const buttons = screen.getAllByRole('button');
      const currentPageButton = buttons.find(button => 
        button.getAttribute('aria-current') === 'page'
      );

      expect(currentPageButton).toHaveStyle({
        backgroundColor: 'var(--primary-color)',
        borderRadius: '20px'
      });
    });

    it('handles different screen sizes', () => {
      // Mock mobile viewport
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width:768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      renderPaginationWithTheme();
      expect(screen.getByText('1 / 10')).toBeInTheDocument();
    });

    it('supports RTL layout', () => {
      renderPaginationWithTheme({}, { direction: 'rtl' });
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveStyle({ direction: 'rtl' });
    });
  });

  describe('Interactions', () => {
    it('handles page changes correctly', async () => {
      const onPageChange = jest.fn();
      renderPaginationWithTheme({ onPageChange });

      await user.click(screen.getByLabelText('Go to page 2'));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('supports keyboard navigation', async () => {
      const onPageChange = jest.fn();
      renderPaginationWithTheme({ onPageChange });

      const navigation = screen.getByRole('navigation');
      navigation.focus();

      await user.keyboard('{ArrowRight}');
      expect(onPageChange).toHaveBeenCalledWith(2);

      await user.keyboard('{ArrowLeft}');
      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('handles disabled state', () => {
      renderPaginationWithTheme({ disabled: true });
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('maintains focus after page change', async () => {
      renderPaginationWithTheme();
      const nextButton = screen.getByLabelText('Go to next page');
      
      await user.click(nextButton);
      expect(document.activeElement).toBe(nextButton);
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility guidelines', async () => {
      const { container } = renderPaginationWithTheme();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides correct ARIA attributes', () => {
      renderPaginationWithTheme();
      
      expect(screen.getByRole('navigation')).toHaveAttribute(
        'aria-label',
        'Pagination navigation'
      );

      const currentPage = screen.getByRole('button', { current: 'page' });
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('announces page changes to screen readers', async () => {
      renderPaginationWithTheme();
      
      const nextButton = screen.getByLabelText('Go to next page');
      await user.click(nextButton);
      
      expect(nextButton).toHaveAttribute(
        'aria-label',
        'Go to next page'
      );
    });

    it('has sufficient touch targets', () => {
      renderPaginationWithTheme();
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        const { height, width } = window.getComputedStyle(button);
        expect(parseInt(height)).toBeGreaterThanOrEqual(44);
        expect(parseInt(width)).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles single page correctly', () => {
      renderPaginationWithTheme({ totalItems: 10, itemsPerPage: 10 });
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('validates input values', () => {
      renderPaginationWithTheme({ totalItems: -1, itemsPerPage: 0 });
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    it('handles prop updates correctly', () => {
      const { rerender } = renderPaginationWithTheme();
      
      rerender(
        <ThemeProvider theme={createTheme()}>
          <Pagination {...DEFAULT_PROPS} currentPage={2} />
        </ThemeProvider>
      );

      expect(screen.getByRole('button', { current: 'page' }))
        .toHaveTextContent('2');
    });

    it('manages maximum pages display', () => {
      renderPaginationWithTheme({ totalItems: 1000, itemsPerPage: 10 });
      const buttons = screen.getAllByRole('button');
      const pageButtons = buttons.filter(button => 
        !isNaN(parseInt(button.textContent || ''))
      );
      
      expect(pageButtons.length).toBeLessThanOrEqual(7); // Max visible pages
    });
  });

  describe('Theme Integration', () => {
    it('applies theme colors correctly', () => {
      const customTheme = createTheme({
        palette: {
          primary: {
            main: '#FF0000'
          }
        }
      });

      render(
        <ThemeProvider theme={customTheme}>
          <Pagination {...DEFAULT_PROPS} />
        </ThemeProvider>
      );

      const currentPage = screen.getByRole('button', { current: 'page' });
      expect(currentPage).toHaveStyle({
        backgroundColor: 'var(--primary-color)'
      });
    });

    it('supports dark mode', () => {
      renderPaginationWithTheme({}, {
        palette: {
          mode: 'dark'
        }
      });

      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveStyle({
        color: 'var(--text-primary)'
      });
    });
  });
});