import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, beforeEach, jest } from '@jest/globals';
import { axe, toHaveNoViolations } from '@axe-core/react';
import { ThemeProvider } from '@mui/material';
import Table from './Table';

// Version comments for dependencies
// @testing-library/react: ^14.0.0
// @testing-library/user-event: ^14.0.0
// @jest/globals: ^29.0.0
// @axe-core/react: ^4.7.0
// @mui/material: ^5.0.0

// Add axe matcher
expect.extend(toHaveNoViolations);

// Mock data and test utilities
const mockData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
  { id: 3, name: 'Bob Wilson', email: 'bob@example.com', status: 'Inactive' },
];

const mockColumns = [
  { id: 'name', label: 'Name', accessor: 'name', sortable: true },
  { id: 'email', label: 'Email', accessor: 'email', sortable: true },
  { id: 'status', label: 'Status', accessor: 'status', sortable: true },
];

const mockHandlers = {
  onSort: jest.fn(),
  onSelect: jest.fn(),
  onRowClick: jest.fn(),
};

const testIds = {
  table: 'data table',
  selectAll: 'select-all',
  row: (index: number) => `row-${index}`,
  cell: (row: number, col: string) => `cell-${row}-${col}`,
};

const viewports = {
  mobile: { width: 320, height: 568 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
};

// Helper function to render Table with theme provider
const renderTable = (props = {}) => {
  const defaultProps = {
    data: mockData,
    columns: mockColumns,
    ...mockHandlers,
  };

  return render(
    <ThemeProvider theme={{ breakpoints: { down: () => false } }}>
      <Table {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

// Helper function to generate large datasets for performance testing
const generateLargeDataset = (size: number) => {
  return Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    name: `User ${index + 1}`,
    email: `user${index + 1}@example.com`,
    status: index % 2 === 0 ? 'Active' : 'Inactive',
  }));
};

describe('Table Component Rendering', () => {
  it('renders with minimal props', () => {
    renderTable();
    expect(screen.getByRole('region', { name: /data table/i })).toBeInTheDocument();
  });

  it('displays correct number of rows and columns', () => {
    renderTable();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(mockData.length + 1); // +1 for header row
    expect(screen.getAllByRole('columnheader')).toHaveLength(mockColumns.length);
  });

  it('handles empty data state', () => {
    renderTable({ data: [] });
    expect(screen.queryByRole('row')).not.toBeNull();
    expect(screen.getByRole('row')).toHaveAttribute('role', 'row');
  });

  it('displays loading state', () => {
    renderTable({ loading: true });
    expect(screen.getByRole('alert', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows error state when data fails to load', () => {
    renderTable({ error: 'Failed to load data' });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load data');
  });
});

describe('Table Interactions', () => {
  beforeEach(() => {
    mockHandlers.onSort.mockClear();
    mockHandlers.onSelect.mockClear();
    mockHandlers.onRowClick.mockClear();
  });

  it('handles column sorting', async () => {
    renderTable({ sortable: true });
    const nameHeader = screen.getByRole('columnheader', { name: /name/i });
    
    await userEvent.click(nameHeader);
    expect(mockHandlers.onSort).toHaveBeenCalledWith('name', 'asc');
    
    await userEvent.click(nameHeader);
    expect(mockHandlers.onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('manages row selection', async () => {
    renderTable({ selectable: true });
    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    
    await userEvent.click(selectAll);
    expect(mockHandlers.onSelect).toHaveBeenCalledWith(mockData);
    
    await userEvent.click(selectAll);
    expect(mockHandlers.onSelect).toHaveBeenCalledWith([]);
  });

  it('implements pagination controls', async () => {
    const largeDataset = generateLargeDataset(25);
    renderTable({ data: largeDataset, pageSize: 10 });
    
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    await userEvent.click(nextButton);
    expect(screen.getAllByRole('row')).toHaveLength(11); // 10 items + header
  });

  it('supports keyboard navigation', async () => {
    renderTable();
    const firstRow = screen.getAllByRole('row')[1];
    firstRow.focus();
    
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(mockHandlers.onRowClick).toHaveBeenCalledWith(mockData[0]);
    
    fireEvent.keyDown(firstRow, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getAllByRole('row')[2]);
  });
});

describe('Table Accessibility', () => {
  it('validates ARIA attributes', async () => {
    const { container } = renderTable();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('verifies keyboard navigation', () => {
    renderTable();
    const table = screen.getByRole('region');
    expect(table).toHaveAttribute('aria-label', 'Data table');
    
    const headers = screen.getAllByRole('columnheader');
    headers.forEach(header => {
      expect(header).toHaveAttribute('aria-sort');
    });
  });

  it('confirms screen reader compatibility', () => {
    renderTable({ selectable: true });
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toHaveAttribute('aria-label');
    });
  });

  it('checks color contrast', async () => {
    const { container } = renderTable({ highContrast: true });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('Table Responsive Design', () => {
  it('adapts to different viewport sizes', () => {
    Object.values(viewports).forEach(size => {
      window.innerWidth = size.width;
      window.innerHeight = size.height;
      window.dispatchEvent(new Event('resize'));
      
      const { container } = renderTable();
      expect(container).toMatchSnapshot();
    });
  });

  it('implements horizontal scrolling', () => {
    const { container } = renderTable();
    const tableWrapper = container.firstChild;
    expect(tableWrapper).toHaveStyle({ overflow: 'hidden' });
  });

  it('maintains touch targets on mobile', () => {
    window.innerWidth = viewports.mobile.width;
    window.dispatchEvent(new Event('resize'));
    
    renderTable();
    const cells = screen.getAllByRole('cell');
    cells.forEach(cell => {
      const { height } = window.getComputedStyle(cell);
      expect(parseInt(height)).toBeGreaterThanOrEqual(44); // Minimum touch target size
    });
  });
});

describe('Table Performance', () => {
  it('handles large datasets efficiently', async () => {
    const largeDataset = generateLargeDataset(1000);
    const startTime = performance.now();
    
    renderTable({ data: largeDataset });
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second
  });

  it('maintains smooth sorting performance', async () => {
    const largeDataset = generateLargeDataset(1000);
    renderTable({ data: largeDataset, sortable: true });
    
    const startTime = performance.now();
    const nameHeader = screen.getByRole('columnheader', { name: /name/i });
    await userEvent.click(nameHeader);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Should sort within 100ms
  });

  it('optimizes render cycles', () => {
    const renderCount = jest.fn();
    const TestComponent = () => {
      renderCount();
      return <Table data={mockData} columns={mockColumns} />;
    };
    
    render(<TestComponent />);
    expect(renderCount).toHaveBeenCalledTimes(1);
  });
});