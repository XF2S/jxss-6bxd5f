import React, { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { styled } from '@mui/material/styles';
import { 
  Chip, 
  IconButton, 
  useMediaQuery, 
  CircularProgress, 
  Skeleton 
} from '@mui/material';
import { debounce } from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';

import { Table } from '@/components/common/Table/Table';
import { Application, ApplicationStatus } from '@/types/application.types';
import { applicationApi } from '@/api/application.api';

// Styled components
const StyledTableContainer = styled('div')(({ theme }) => ({
  width: '100%',
  backgroundColor: 'var(--surface-color)',
  borderRadius: 'var(--border-radius-lg)',
  boxShadow: 'var(--elevation-1)',
  transition: 'all var(--animation-duration-base) var(--animation-easing-standard)',
  padding: 'var(--spacing-md)',
  
  '@media (max-width: 768px)': {
    padding: 'var(--spacing-sm)',
  }
}));

const StatusChip = styled(Chip)<{ status: ApplicationStatus }>(({ status, theme }) => ({
  '& .MuiChip-label': {
    fontWeight: 500,
  },
  backgroundColor: getStatusColor(status),
  color: 'var(--on-primary)',
}));

// Props interface
export interface ApplicationListProps {
  userId?: string;
  status?: ApplicationStatus;
  onStatusChange?: (applicationId: string, newStatus: ApplicationStatus) => void;
  initialPageSize?: number;
}

// Helper function to get status color
const getStatusColor = (status: ApplicationStatus): string => {
  const colors = {
    [ApplicationStatus.DRAFT]: 'var(--secondary-color)',
    [ApplicationStatus.SUBMITTED]: 'var(--primary-color)',
    [ApplicationStatus.UNDER_REVIEW]: 'var(--warning-color)',
    [ApplicationStatus.APPROVED]: 'var(--success-color)',
    [ApplicationStatus.REJECTED]: 'var(--error-color)',
  };
  return colors[status];
};

// Helper function to format dates
const formatDate = (date: Date, locale: string = 'en-US'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

// Custom hook for application data management
const useApplicationData = (props: ApplicationListProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(props.initialPageSize || 10);
  const [sortColumn, setSortColumn] = useState<string>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Query for fetching applications
  const { data, isLoading, error, refetch } = useQuery(
    ['applications', page, pageSize, sortColumn, sortDirection, props.userId, props.status],
    () => applicationApi.getUserApplications(page, pageSize, {
      sort: `${sortColumn}:${sortDirection}`,
      filter: {
        ...(props.userId && { userId: props.userId }),
        ...(props.status && { status: props.status }),
      }
    }),
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    }
  );

  // Mutation for updating application status
  const statusMutation = useMutation(
    ({ applicationId, newStatus }: { applicationId: string; newStatus: ApplicationStatus }) =>
      applicationApi.updateApplicationStatus(applicationId, newStatus),
    {
      onSuccess: () => {
        refetch();
      }
    }
  );

  return {
    data,
    isLoading,
    error,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortColumn,
    sortDirection,
    handleSort: (column: string, direction: 'asc' | 'desc') => {
      setSortColumn(column);
      setSortDirection(direction);
    },
    updateStatus: statusMutation.mutate,
  };
};

// Main component
export const ApplicationList: React.FC<ApplicationListProps> = (props) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const {
    data,
    isLoading,
    error,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleSort,
    updateStatus,
  } = useApplicationData(props);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      id: 'id',
      label: 'Application ID',
      accessor: (app: Application) => app.id.slice(0, 8),
      width: '120px',
    },
    {
      id: 'status',
      label: 'Status',
      accessor: (app: Application) => (
        <StatusChip
          status={app.status}
          label={app.status}
          size="small"
          role="status"
          aria-label={`Application status: ${app.status}`}
        />
      ),
      width: '150px',
    },
    {
      id: 'programInfo',
      label: 'Program',
      accessor: (app: Application) => app.formData.programInfo.intendedMajor,
      width: '200px',
    },
    {
      id: 'submittedAt',
      label: 'Submitted',
      accessor: (app: Application) => app.submittedAt ? formatDate(app.submittedAt) : 'Not submitted',
      width: '180px',
      sortable: true,
    },
    {
      id: 'updatedAt',
      label: 'Last Updated',
      accessor: (app: Application) => formatDate(app.updatedAt),
      width: '180px',
      sortable: true,
    },
  ], [isMobile]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" className="error-container">
      <h3>Error loading applications</h3>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );

  if (error) {
    return <ErrorFallback error={error} resetErrorBoundary={() => window.location.reload()} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StyledTableContainer>
        <Table
          data={data?.data || []}
          columns={columns}
          loading={isLoading}
          sortable
          stickyHeader
          pageSize={pageSize}
          onSort={handleSort}
          aria-label="Applications list"
          aria-busy={isLoading}
        />
      </StyledTableContainer>
    </ErrorBoundary>
  );
};

export default ApplicationList;