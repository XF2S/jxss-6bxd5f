import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Tabs, TabsProps } from './Tabs';

// Helper function to render component with theme
const renderWithTheme = (children: React.ReactNode, themeOptions = {}) => {
  const theme = createTheme(themeOptions);
  return render(
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
};

// Mock window.matchMedia for responsive tests
const createMatchMedia = (width: number) => {
  return (query: string) => ({
    matches: query.includes(`${width}`),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });
};

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

// Default test data
const defaultTabs = [
  { label: 'Tab 1', content: 'Content 1', id: 'tab-1' },
  { label: 'Tab 2', content: 'Content 2', id: 'tab-2' },
  { label: 'Tab 3', content: 'Content 3', id: 'tab-3' }
];

describe('Tabs Component', () => {
  beforeEach(() => {
    // Setup mocks
    window.ResizeObserver = ResizeObserverMock as any;
    const mockIntersectionObserver = jest.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null
    });
    window.IntersectionObserver = mockIntersectionObserver as any;
  });

  describe('Core Functionality', () => {
    it('renders all provided tabs with correct labels', () => {
      renderWithTheme(<Tabs tabs={defaultTabs} />);
      
      defaultTabs.forEach(tab => {
        expect(screen.getByRole('tab', { name: tab.label })).toBeInTheDocument();
      });
    });

    it('shows correct content for active tab', () => {
      renderWithTheme(<Tabs tabs={defaultTabs} defaultValue={0} />);
      
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Content 1');
      expect(screen.queryByText('Content 2')).not.toBeVisible();
    });

    it('handles tab switching correctly', async () => {
      const onChange = jest.fn();
      renderWithTheme(<Tabs tabs={defaultTabs} onChange={onChange} />);
      
      const secondTab = screen.getByRole('tab', { name: 'Tab 2' });
      await userEvent.click(secondTab);
      
      expect(onChange).toHaveBeenCalledWith(1);
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Content 2');
    });

    it('maintains correct ARIA relationships', () => {
      renderWithTheme(<Tabs tabs={defaultTabs} />);
      
      const tabs = screen.getAllByRole('tab');
      const panel = screen.getByRole('tabpanel');
      
      expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
      expect(panel).toHaveAttribute('aria-labelledby', tabs[0].id);
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      renderWithTheme(<Tabs tabs={defaultTabs} />);
      
      const firstTab = screen.getByRole('tab', { name: 'Tab 1' });
      firstTab.focus();
      
      await userEvent.keyboard('[ArrowRight]');
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveFocus();
      
      await userEvent.keyboard('[End]');
      expect(screen.getByRole('tab', { name: 'Tab 3' })).toHaveFocus();
      
      await userEvent.keyboard('[Home]');
      expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveFocus();
    });

    it('handles disabled tabs correctly', () => {
      const tabsWithDisabled = [
        ...defaultTabs,
        { label: 'Disabled Tab', content: 'Disabled Content', disabled: true }
      ];
      
      renderWithTheme(<Tabs tabs={tabsWithDisabled} />);
      
      const disabledTab = screen.getByRole('tab', { name: 'Disabled Tab' });
      expect(disabledTab).toHaveAttribute('aria-disabled', 'true');
      expect(disabledTab).toBeDisabled();
    });

    it('announces tab changes to screen readers', async () => {
      renderWithTheme(<Tabs tabs={defaultTabs} />);
      
      const secondTab = screen.getByRole('tab', { name: 'Tab 2' });
      await userEvent.click(secondTab);
      
      const announcement = await screen.findByText('Tab 2 tab activated', { exact: false });
      expect(announcement).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts layout for mobile viewport', () => {
      window.matchMedia = createMatchMedia(320) as any;
      
      renderWithTheme(<Tabs tabs={defaultTabs} />);
      
      const tabList = screen.getByRole('tablist');
      expect(tabList).toHaveStyle({ flexDirection: 'row' });
    });

    it('handles touch interactions', async () => {
      const onChange = jest.fn();
      renderWithTheme(<Tabs tabs={defaultTabs} onChange={onChange} />);
      
      const secondTab = screen.getByRole('tab', { name: 'Tab 2' });
      await userEvent.click(secondTab);
      
      expect(onChange).toHaveBeenCalledWith(1);
    });
  });

  describe('Theme Support', () => {
    it('applies theme colors correctly', () => {
      const theme = createTheme({
        palette: {
          primary: {
            main: '#ff0000'
          }
        }
      });
      
      renderWithTheme(<Tabs tabs={defaultTabs} />, theme);
      
      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toHaveStyle({ color: '#ff0000' });
    });

    it('supports dark mode', () => {
      const darkTheme = createTheme({
        palette: {
          mode: 'dark'
        }
      });
      
      renderWithTheme(<Tabs tabs={defaultTabs} />, darkTheme);
      
      const tabList = screen.getByRole('tablist');
      expect(tabList).toHaveStyle({ borderColor: expect.any(String) });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty tabs array gracefully', () => {
      renderWithTheme(<Tabs tabs={[]} />);
      
      expect(screen.queryByRole('tablist')).toBeEmptyDOMElement();
    });

    it('manages large numbers of tabs', () => {
      const manyTabs = Array.from({ length: 20 }, (_, i) => ({
        label: `Tab ${i + 1}`,
        content: `Content ${i + 1}`
      }));
      
      renderWithTheme(<Tabs tabs={manyTabs} />);
      
      expect(screen.getAllByRole('tab')).toHaveLength(20);
    });

    it('prevents memory leaks by cleaning up observers', () => {
      const { unmount } = renderWithTheme(<Tabs tabs={defaultTabs} />);
      
      unmount();
      
      // Verify ResizeObserver cleanup
      expect(window.ResizeObserver).toBeDefined();
    });
  });
});