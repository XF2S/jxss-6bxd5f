import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { Button } from '../Button/Button';
import '../../../styles/theme.css';

// Interfaces
export interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
  showFirstButton?: boolean;
  showLastButton?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  getItemAriaLabel?: (type: 'page' | 'first' | 'last' | 'next' | 'previous', page: number) => string;
  className?: string;
}

// Styled components
const StyledPaginationContainer = styled('nav')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: {
    xs: theme.spacing(1),
    sm: theme.spacing(2),
  },
  margin: theme.spacing(2, 0),
  flexWrap: 'wrap',
  padding: theme.spacing(1),
}));

const StyledPageButton = styled(Button)(({ theme }) => ({
  minWidth: {
    xs: '36px',
    sm: '40px',
  },
  height: {
    xs: '36px',
    sm: '40px',
  },
  padding: '0',
  borderRadius: '20px',
  touchAction: 'manipulation',
}));

// Custom hooks
const usePaginationRange = (
  totalItems: number,
  itemsPerPage: number,
  currentPage: number,
  siblingCount: number,
  boundaryCount: number
) => {
  return useMemo(() => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const totalNumbers = (siblingCount * 2) + (boundaryCount * 2) + 3; // +3 for current page and ellipses
    
    if (totalPages <= totalNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, boundaryCount + 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages - boundaryCount);

    const shouldShowLeftEllipsis = leftSiblingIndex > boundaryCount + 2;
    const shouldShowRightEllipsis = rightSiblingIndex < totalPages - (boundaryCount + 1);

    const leftBoundary = Array.from({ length: boundaryCount }, (_, i) => i + 1);
    const rightBoundary = Array.from({ length: boundaryCount }, (_, i) => totalPages - boundaryCount + i + 1);
    const centerRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );

    const result = [
      ...leftBoundary,
      ...(shouldShowLeftEllipsis ? ['ellipsis'] : []),
      ...centerRange,
      ...(shouldShowRightEllipsis ? ['ellipsis'] : []),
      ...rightBoundary,
    ];

    return result;
  }, [totalItems, itemsPerPage, currentPage, siblingCount, boundaryCount]);
};

const useKeyboardNavigation = (
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void
) => {
  const containerRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current?.contains(event.target as Node)) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (currentPage > 1) onPageChange(currentPage - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (currentPage < totalPages) onPageChange(currentPage + 1);
        break;
      case 'Home':
        event.preventDefault();
        onPageChange(1);
        break;
      case 'End':
        event.preventDefault();
        onPageChange(totalPages);
        break;
      default:
        if (/^\d$/.test(event.key)) {
          const page = parseInt(event.key, 10);
          if (page > 0 && page <= totalPages) {
            event.preventDefault();
            onPageChange(page);
          }
        }
    }
  }, [currentPage, totalPages, onPageChange]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return containerRef;
};

// Main component
export const Pagination: React.FC<PaginationProps> = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  showFirstButton = true,
  showLastButton = true,
  disabled = false,
  ariaLabel = 'Pagination navigation',
  getItemAriaLabel = (type, page) => {
    switch (type) {
      case 'first': return 'Go to first page';
      case 'last': return 'Go to last page';
      case 'next': return 'Go to next page';
      case 'previous': return 'Go to previous page';
      default: return `Go to page ${page}`;
    }
  },
  className,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const containerRef = useKeyboardNavigation(currentPage, totalPages, onPageChange);

  const paginationRange = usePaginationRange(
    totalItems,
    itemsPerPage,
    currentPage,
    siblingCount,
    boundaryCount
  );

  const handlePageClick = useCallback((page: number) => {
    if (!disabled && page !== currentPage) {
      onPageChange(page);
    }
  }, [disabled, currentPage, onPageChange]);

  if (totalPages <= 1) return null;

  return (
    <StyledPaginationContainer
      ref={containerRef}
      aria-label={ariaLabel}
      className={className}
      role="navigation"
    >
      {showFirstButton && (
        <StyledPageButton
          variant="text"
          onClick={() => handlePageClick(1)}
          disabled={disabled || currentPage === 1}
          aria-label={getItemAriaLabel('first', 1)}
        >
          «
        </StyledPageButton>
      )}

      <StyledPageButton
        variant="text"
        onClick={() => handlePageClick(currentPage - 1)}
        disabled={disabled || currentPage === 1}
        aria-label={getItemAriaLabel('previous', currentPage - 1)}
      >
        ‹
      </StyledPageButton>

      {!isMobile && paginationRange.map((pageNumber, index) => (
        pageNumber === 'ellipsis' ? (
          <StyledPageButton
            key={`ellipsis-${index}`}
            variant="text"
            disabled={true}
            aria-hidden="true"
          >
            …
          </StyledPageButton>
        ) : (
          <StyledPageButton
            key={pageNumber}
            variant={currentPage === pageNumber ? 'contained' : 'text'}
            onClick={() => handlePageClick(pageNumber as number)}
            disabled={disabled}
            aria-current={currentPage === pageNumber ? 'page' : undefined}
            aria-label={getItemAriaLabel('page', pageNumber as number)}
          >
            {pageNumber}
          </StyledPageButton>
        )
      ))}

      {isMobile && (
        <StyledPageButton
          variant="text"
          disabled={true}
          aria-current="page"
        >
          {currentPage} / {totalPages}
        </StyledPageButton>
      )}

      <StyledPageButton
        variant="text"
        onClick={() => handlePageClick(currentPage + 1)}
        disabled={disabled || currentPage === totalPages}
        aria-label={getItemAriaLabel('next', currentPage + 1)}
      >
        ›
      </StyledPageButton>

      {showLastButton && (
        <StyledPageButton
          variant="text"
          onClick={() => handlePageClick(totalPages)}
          disabled={disabled || currentPage === totalPages}
          aria-label={getItemAriaLabel('last', totalPages)}
        >
          »
        </StyledPageButton>
      )}
    </StyledPaginationContainer>
  );
};

export default Pagination;