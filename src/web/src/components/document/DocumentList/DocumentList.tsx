import React, { useCallback, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@mui/material';
import Table from '../../common/Table/Table';
import DocumentApi from '../../../api/document.api';
import { Document, DocumentStatus, VerificationStatus } from '../../../types/document.types';
import { formatFileSize } from '../../../utils/file.utils';

// Constants for document list configuration
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT_COLUMN = 'uploadedAt';
const DEFAULT_SORT_DIRECTION = 'desc';

// Interface for component props
export interface DocumentListProps {
  applicationId: string;
  onDocumentSelect?: (document: Document) => void;
  onDocumentDelete?: (document: Document) => Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * DocumentList Component
 * Implements a secure, accessible, and responsive document management interface
 * following Material Design 3 specifications and WCAG 2.1 Level AA compliance.
 *
 * @version 1.0.0
 * @component
 */
export const DocumentList: React.FC<DocumentListProps> = ({
  applicationId,
  onDocumentSelect,
  onDocumentDelete,
  onError
}) => {
  // Theme and state management
  const theme = useTheme();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortColumn, setSortColumn] = useState(DEFAULT_SORT_COLUMN);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(DEFAULT_SORT_DIRECTION);

  // Fetch documents using React Query
  const {
    data: documentList,
    isLoading,
    error,
    refetch
  } = useQuery(
    ['documents', applicationId, page, pageSize, sortColumn, sortDirection],
    () => DocumentApi.listApplicationDocuments(applicationId, {
      page,
      pageSize,
      sortBy: sortColumn,
      sortOrder: sortDirection
    }),
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
      onError: (err) => onError?.(err as Error)
    }
  );

  // Handle document deletion
  const handleDelete = useCallback(async (document: Document) => {
    try {
      await DocumentApi.deleteDocument(document.id);
      await refetch();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [refetch, onError]);

  // Table columns configuration
  const columns = [
    {
      id: 'fileName',
      label: 'Document Name',
      accessor: 'fileName',
      sortable: true,
      renderCell: (document: Document) => (
        <button
          onClick={() => onDocumentSelect?.(document)}
          className="document-name-button"
          aria-label={`View document: ${document.fileName}`}
        >
          {document.fileName}
        </button>
      )
    },
    {
      id: 'mimeType',
      label: 'Type',
      accessor: 'mimeType',
      sortable: true,
      renderCell: (document: Document) => (
        <span className="document-type">
          {document.mimeType.split('/')[1].toUpperCase()}
        </span>
      )
    },
    {
      id: 'fileSize',
      label: 'Size',
      accessor: 'fileSize',
      sortable: true,
      renderCell: (document: Document) => (
        <span className="document-size">
          {formatFileSize(document.fileSize)}
        </span>
      )
    },
    {
      id: 'uploadedAt',
      label: 'Upload Date',
      accessor: 'uploadedAt',
      sortable: true,
      renderCell: (document: Document) => (
        <span className="document-date">
          {new Date(document.uploadedAt).toLocaleDateString()}
        </span>
      )
    },
    {
      id: 'verificationStatus',
      label: 'Status',
      accessor: 'verificationStatus',
      sortable: true,
      renderCell: (document: Document) => (
        <span 
          className={`status-badge status-${document.verificationStatus.toLowerCase()}`}
          aria-label={`Status: ${document.verificationStatus}`}
        >
          {document.verificationStatus}
        </span>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      accessor: 'id',
      renderCell: (document: Document) => (
        <div className="document-actions">
          <button
            onClick={() => onDocumentSelect?.(document)}
            className="action-button view-button"
            aria-label={`View ${document.fileName}`}
          >
            View
          </button>
          {onDocumentDelete && (
            <button
              onClick={() => handleDelete(document)}
              className="action-button delete-button"
              aria-label={`Delete ${document.fileName}`}
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ];

  // Handle sort changes
  const handleSort = useCallback((columnId: string, direction: 'asc' | 'desc') => {
    setSortColumn(columnId);
    setSortDirection(direction);
  }, []);

  // Handle page changes
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  return (
    <div 
      className="document-list-container"
      role="region"
      aria-label="Document List"
    >
      <Table
        data={documentList?.documents || []}
        columns={columns}
        loading={isLoading}
        sortable
        onSort={handleSort}
        onPageChange={handlePageChange}
        className="document-table"
      />

      <style jsx>{`
        .document-list-container {
          width: 100%;
          overflow: hidden;
          background-color: var(--surface-color);
          border-radius: var(--border-radius-lg);
          box-shadow: var(--elevation-1);
        }

        .document-name-button {
          color: var(--primary-color);
          background: none;
          border: none;
          padding: var(--spacing-xs);
          cursor: pointer;
          text-align: left;
          font-weight: 500;
          text-decoration: underline;
        }

        .document-name-button:hover {
          color: var(--primary-dark);
        }

        .status-badge {
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--border-radius-sm);
          font-size: var(--font-size-sm);
          font-weight: 500;
        }

        .status-verified {
          background-color: var(--success-color);
          color: var(--on-success);
        }

        .status-rejected {
          background-color: var(--error-color);
          color: var(--on-error);
        }

        .status-pending {
          background-color: var(--warning-color);
          color: var(--on-warning);
        }

        .document-actions {
          display: flex;
          gap: var(--spacing-sm);
        }

        .action-button {
          padding: var(--spacing-xs) var(--spacing-sm);
          border-radius: var(--border-radius-sm);
          border: none;
          cursor: pointer;
          font-weight: 500;
          transition: all var(--animation-duration-base) var(--animation-easing-standard);
        }

        .view-button {
          background-color: var(--primary-color);
          color: var(--on-primary);
        }

        .delete-button {
          background-color: var(--error-color);
          color: var(--on-error);
        }

        @media (prefers-reduced-motion: reduce) {
          .action-button {
            transition: none;
          }
        }

        @media (prefers-contrast: more) {
          .document-name-button {
            text-decoration: underline solid 3px;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentList;