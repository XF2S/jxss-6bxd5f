import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import ReportPage from './ReportPage';

// Add jest-axe matcher
expect.extend(toHaveNoViolations);

// Mock API responses
const mockReportData = [
  {
    id: '1',
    date: '2023-01-01',
    type: 'Enrollment Report',
    status: 'Completed'
  },
  {
    id: '2',
    date: '2023-01-02',
    type: 'Applications Report',
    status: 'Processing'
  }
];

// Mock API functions
const mockGenerateReport = vi.fn();
const mockDownloadReport = vi.fn();

// Setup test providers wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={{ breakpoints: { down: () => false } }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('ReportPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch API
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/reports/generate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: '123' })
        });
      }
      if (url.includes('/download')) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob())
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockReportData)
      });
    });
  });

  describe('UI Rendering', () => {
    it('renders all required UI elements', () => {
      render(<ReportPage />, { wrapper: createWrapper() });

      expect(screen.getByRole('main', { name: /reports/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /report type/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /export format/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate report/i })).toBeInTheDocument();
    });

    it('displays loading state correctly', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const loadingIndicator = screen.getByRole('alert', { name: /loading reports/i });
      expect(loadingIndicator).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByRole('alert', { name: /loading reports/i })).not.toBeInTheDocument();
      });
    });

    it('handles error states appropriately', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));
      
      render(<ReportPage />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByText(/error loading reports/i)).toBeInTheDocument();
      });
    });
  });

  describe('Report Generation', () => {
    it('validates required fields before generating report', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const generateButton = screen.getByRole('button', { name: /generate report/i });
      expect(generateButton).toBeDisabled();

      const reportTypeSelect = screen.getByRole('combobox', { name: /report type/i });
      await userEvent.selectOptions(reportTypeSelect, 'enrollment');
      
      expect(generateButton).toBeEnabled();
    });

    it('successfully generates a report', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const reportTypeSelect = screen.getByRole('combobox', { name: /report type/i });
      await userEvent.selectOptions(reportTypeSelect, 'enrollment');
      
      const generateButton = screen.getByRole('button', { name: /generate report/i });
      await userEvent.click(generateButton);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/reports/generate', expect.any(Object));
      });
    });

    it('handles concurrent report generation requests', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const reportTypeSelect = screen.getByRole('combobox', { name: /report type/i });
      await userEvent.selectOptions(reportTypeSelect, 'enrollment');
      
      const generateButton = screen.getByRole('button', { name: /generate report/i });
      await userEvent.click(generateButton);
      await userEvent.click(generateButton);
      
      expect(generateButton).toBeDisabled();
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    });
  });

  describe('Data Export', () => {
    it('supports all export formats', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const formatSelect = screen.getByRole('combobox', { name: /export format/i });
      const formats = within(formatSelect).getAllByRole('option');
      
      expect(formats).toHaveLength(3); // PDF, CSV, Excel
      formats.forEach(format => {
        expect(['PDF', 'CSV', 'Excel']).toContain(format.textContent);
      });
    });

    it('handles large dataset exports', async () => {
      const largeDataset = Array(1000).fill(mockReportData[0]);
      global.fetch = vi.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(largeDataset)
        })
      );

      render(<ReportPage />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('shows download progress indicator', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const downloadButton = screen.getAllByRole('button', { name: /download/i })[0];
      await userEvent.click(downloadButton);
      
      expect(screen.getByRole('progressbar', { name: /download progress/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = render(<ReportPage />, { wrapper: createWrapper() });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const reportTypeSelect = screen.getByRole('combobox', { name: /report type/i });
      reportTypeSelect.focus();
      expect(document.activeElement).toBe(reportTypeSelect);
      
      fireEvent.keyDown(reportTypeSelect, { key: 'Tab' });
      expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /export format/i }));
    });

    it('provides proper ARIA labels', () => {
      render(<ReportPage />, { wrapper: createWrapper() });
      
      expect(screen.getByRole('main', { name: /reports/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Reports table');
    });
  });

  describe('Performance', () => {
    it('renders initial content within performance budget', async () => {
      const startTime = performance.now();
      
      render(<ReportPage />, { wrapper: createWrapper() });
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      expect(renderTime).toBeLessThan(200); // 200ms budget
    });

    it('handles pagination efficiently', async () => {
      const largeDataset = Array(100).fill(mockReportData[0]);
      global.fetch = vi.fn().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(largeDataset)
        })
      );

      render(<ReportPage />, { wrapper: createWrapper() });
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      const startTime = performance.now();
      const nextPageButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextPageButton);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // 100ms budget for pagination
    });
  });
});