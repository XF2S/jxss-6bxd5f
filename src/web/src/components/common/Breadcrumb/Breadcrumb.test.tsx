import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { axe, toHaveNoViolations } from '@testing-library/jest-axe';
import Breadcrumb, { BreadcrumbItem } from './Breadcrumb';
import { ROUTES } from '@/constants/routes.constants';

// Add jest-axe custom matcher
expect.extend(toHaveNoViolations);

// Test helper to render component within router context
const renderWithRouter = (
  component: React.ReactElement,
  initialRoute: string = '/'
) => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      {component}
    </MemoryRouter>
  );
};

// Mock breadcrumb items for testing
const mockBreadcrumbItems: BreadcrumbItem[] = [
  {
    label: 'Dashboard',
    path: ROUTES.DASHBOARD.HOME.path,
    active: false
  },
  {
    label: 'Applications',
    path: ROUTES.APPLICATION.LIST.path,
    active: false
  },
  {
    label: 'Application Details',
    path: `${ROUTES.APPLICATION.DETAIL.path.replace(':id', '123')}`,
    active: true
  }
];

describe('Breadcrumb Component', () => {
  // Basic rendering tests
  describe('Rendering', () => {
    it('renders breadcrumb navigation with correct hierarchy', () => {
      renderWithRouter(<Breadcrumb items={mockBreadcrumbItems} />);
      
      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
      
      mockBreadcrumbItems.forEach(item => {
        const element = screen.getByText(item.label);
        expect(element).toBeInTheDocument();
      });
    });

    it('applies correct styling for active/inactive items', () => {
      renderWithRouter(<Breadcrumb items={mockBreadcrumbItems} />);
      
      // Last item should be text (not a link) and have current page indicator
      const lastItem = screen.getByText('Application Details');
      expect(lastItem).toHaveAttribute('aria-current', 'page');
      
      // Other items should be links
      const dashboardLink = screen.getByRole('link', { name: /navigate to dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', ROUTES.DASHBOARD.HOME.path);
    });

    it('handles custom separator properly', () => {
      const customSeparator = '>';
      renderWithRouter(
        <Breadcrumb 
          items={mockBreadcrumbItems} 
          separator={customSeparator}
        />
      );
      
      const separators = screen.getAllByText(customSeparator);
      expect(separators).toHaveLength(mockBreadcrumbItems.length - 1);
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility guidelines', async () => {
      const { container } = renderWithRouter(
        <Breadcrumb items={mockBreadcrumbItems} />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', () => {
      renderWithRouter(<Breadcrumb items={mockBreadcrumbItems} />);
      
      const links = screen.getAllByRole('link');
      
      // Test keyboard focus
      links.forEach(link => {
        link.focus();
        expect(document.activeElement).toBe(link);
      });

      // Test Enter key navigation
      const firstLink = links[0];
      fireEvent.keyPress(firstLink, { key: 'Enter', code: 'Enter' });
      expect(window.location.href).toContain(mockBreadcrumbItems[0].path);
    });

    it('provides proper ARIA attributes', () => {
      renderWithRouter(<Breadcrumb items={mockBreadcrumbItems} />);
      
      // Check navigation landmark
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'breadcrumb');
      
      // Check current page indicator
      const currentPage = screen.getByText('Application Details');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });
  });

  // Responsive behavior tests
  describe('Responsive Behavior', () => {
    beforeEach(() => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      });
    });

    it('collapses items correctly on mobile viewport', () => {
      // Set mobile viewport
      window.innerWidth = 375;
      
      const longBreadcrumbItems: BreadcrumbItem[] = Array(6).fill(null).map((_, i) => ({
        label: `Level ${i + 1}`,
        path: `/level-${i + 1}`,
        active: i === 5
      }));

      renderWithRouter(
        <Breadcrumb 
          items={longBreadcrumbItems}
          maxItems={3}
          itemsBeforeCollapse={1}
          itemsAfterCollapse={1}
        />
      );

      // Should show collapse indicator
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  // Edge cases and error handling
  describe('Edge Cases', () => {
    it('handles single item breadcrumb correctly', () => {
      const singleItem = [mockBreadcrumbItems[0]];
      renderWithRouter(<Breadcrumb items={singleItem} />);
      
      const nav = screen.getByRole('navigation');
      expect(within(nav).getAllByRole('link')).toHaveLength(0);
      expect(screen.getByText(singleItem[0].label)).toHaveAttribute('aria-current', 'page');
    });

    it('handles empty items array gracefully', () => {
      renderWithRouter(<Breadcrumb items={[]} />);
      
      const nav = screen.getByRole('navigation');
      expect(nav).toBeEmptyDOMElement();
    });

    it('prevents default click behavior while maintaining accessibility', () => {
      renderWithRouter(<Breadcrumb items={mockBreadcrumbItems} />);
      
      const firstLink = screen.getByRole('link', { name: /navigate to dashboard/i });
      const clickEvent = fireEvent.click(firstLink);
      
      expect(clickEvent.defaultPrevented).toBe(true);
    });
  });

  // RTL support tests
  describe('RTL Support', () => {
    it('renders correctly in RTL mode', () => {
      render(
        <div dir="rtl">
          <MemoryRouter>
            <Breadcrumb items={mockBreadcrumbItems} />
          </MemoryRouter>
        </div>
      );
      
      const nav = screen.getByRole('navigation');
      expect(nav).toHaveStyle({ direction: 'rtl' });
    });
  });
});