import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import Pagination from '../Pagination/Pagination';
import Checkbox from '../Checkbox/Checkbox';
import Card from '../Card/Card';
import '../../../styles/theme.css';

// Types and Interfaces
export interface TableColumn<T> {
  id: string;
  label: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  renderCell?: (item: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  selectable?: boolean;
  sortable?: boolean;
  resizable?: boolean;
  expandable?: boolean;
  stickyHeader?: boolean;
  loading?: boolean;
  highContrast?: boolean;
  pageSize?: number;
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
  onSelect?: (selectedItems: T[]) => void;
  onRowClick?: (item: T) => void;
  className?: string;
}

interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

// Styled Components
const TableContainer = styled(Card)(({ theme }) => ({
  width: '100%',
  overflow: 'hidden',
  position: 'relative',
  backgroundColor: 'var(--surface-color)',
}));

const StyledTable = styled('table')<{ $stickyHeader?: boolean }>(({ $stickyHeader }) => ({
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  position: 'relative',
  
  '& th': {
    position: $stickyHeader ? 'sticky' : 'relative',
    top: 0,
    backgroundColor: 'var(--surface-color)',
    zIndex: 2,
    padding: 'var(--spacing-md)',
    textAlign: 'left',
    fontWeight: 'bold',
    borderBottom: '1px solid var(--outline-color)',
    color: 'var(--text-primary)',
    transition: 'background-color var(--animation-duration-base) var(--animation-easing-standard)',
    
    '&[aria-sort]': {
      cursor: 'pointer',
      userSelect: 'none',
      
      '&:hover': {
        backgroundColor: 'var(--surface-variant)',
      },
    },
  },
  
  '& td': {
    padding: 'var(--spacing-md)',
    borderBottom: '1px solid var(--outline-color)',
    color: 'var(--text-primary)',
  },
}));

const ResizeHandle = styled('div')({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: '4px',
  cursor: 'col-resize',
  backgroundColor: 'var(--outline-color)',
  opacity: 0,
  transition: 'opacity var(--animation-duration-base) var(--animation-easing-standard)',
  
  '&:hover, &.resizing': {
    opacity: 1,
  },
});

const LoadingOverlay = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(var(--surface-color), 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 3,
});

// Main Component
export const Table = <T extends Record<string, any>>({
  data,
  columns,
  selectable = false,
  sortable = false,
  resizable = false,
  expandable = false,
  stickyHeader = false,
  loading = false,
  highContrast = false,
  pageSize = 10,
  onSort,
  onSelect,
  onRowClick,
  className,
}: TableProps<T>) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>({});
  const resizingRef = useRef<{ columnId: string; startX: number } | null>(null);

  // Pagination calculation
  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  // Handle column sorting
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;
    
    setSortState(prev => ({
      columnId,
      direction: prev?.columnId === columnId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    
    onSort?.(columnId, sortState?.columnId === columnId && sortState?.direction === 'asc' ? 'desc' : 'asc');
  }, [sortable, onSort, sortState]);

  // Handle row selection
  const handleSelectAll = useCallback((checked: boolean) => {
    const newSelected = new Set<string>();
    if (checked) {
      paginatedData.forEach(item => newSelected.add(String(item.id)));
    }
    setSelectedRows(newSelected);
    onSelect?.(checked ? paginatedData : []);
  }, [paginatedData, onSelect]);

  // Handle individual row selection
  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  // Handle column resize
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    if (!resizable) return;
    
    resizingRef.current = {
      columnId,
      startX: e.clientX
    };
    
    const handleResizeMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      
      const diff = e.clientX - resizingRef.current.startX;
      setColumnWidths(prev => ({
        ...prev,
        [resizingRef.current!.columnId]: `${parseInt(prev[resizingRef.current!.columnId] || '0') + diff}px`
      }));
      
      resizingRef.current.startX = e.clientX;
    };
    
    const handleResizeEnd = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [resizable]);

  return (
    <TableContainer 
      className={className}
      elevation={1}
      role="region"
      aria-label="Data table"
    >
      <StyledTable $stickyHeader={stickyHeader}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '48px' }}>
                <Checkbox
                  id="select-all"
                  name="select-all"
                  label="Select all rows"
                  checked={selectedRows.size === paginatedData.length}
                  onChange={handleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map(column => (
              <th
                key={column.id}
                style={{ width: columnWidths[column.id] || column.width }}
                aria-sort={sortState?.columnId === column.id ? sortState.direction : undefined}
                onClick={() => column.sortable && handleSort(column.id)}
              >
                {column.label}
                {resizable && (
                  <ResizeHandle
                    onMouseDown={(e) => handleResizeStart(e, column.id)}
                    aria-hidden="true"
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((item, index) => (
            <tr
              key={String(item.id)}
              onClick={() => onRowClick?.(item)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              tabIndex={0}
              role="row"
            >
              {selectable && (
                <td>
                  <Checkbox
                    id={`select-${item.id}`}
                    name={`select-${item.id}`}
                    label={`Select row ${index + 1}`}
                    checked={selectedRows.has(String(item.id))}
                    onChange={(checked) => handleSelectRow(String(item.id), checked)}
                  />
                </td>
              )}
              {columns.map(column => (
                <td
                  key={`${item.id}-${column.id}`}
                  style={{ textAlign: column.align || 'left' }}
                >
                  {column.renderCell?.(item) ?? 
                    (typeof column.accessor === 'function' 
                      ? column.accessor(item)
                      : item[column.accessor])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>

      {loading && (
        <LoadingOverlay role="alert" aria-busy="true">
          Loading...
        </LoadingOverlay>
      )}

      {totalPages > 1 && (
        <Pagination
          totalItems={data.length}
          itemsPerPage={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}
    </TableContainer>
  );
};

export default Table;