import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Card, Typography, Box, Chip, CircularProgress, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { styled, useTheme } from '@mui/material/styles';
import { 
  WorkflowState, 
  Workflow, 
  WorkflowStateHistory,
  isWorkflowState 
} from '@/types/workflow.types';
import { workflowApi } from '@/api/workflow.api';
import { ProgressBar } from '@/components/common/ProgressBar';

// Styled components for enhanced visual hierarchy
const StatusContainer = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'var(--surface-color)',
}));

const StatusHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 'var(--spacing-md)',
});

const HistoryContainer = styled(Box)({
  marginTop: 'var(--spacing-lg)',
  '& > *:not(:last-child)': {
    marginBottom: 'var(--spacing-md)',
  },
});

// Props interface with comprehensive configuration options
interface WorkflowStatusProps {
  workflowId: string;
  refreshInterval?: number;
  onStateChange?: (state: WorkflowState) => void;
  errorBoundary?: boolean;
  showHistory?: boolean;
  theme?: 'light' | 'dark' | 'high-contrast';
}

// Calculate progress percentage based on workflow state
const calculateProgress = (currentState: WorkflowState, transitions: WorkflowStateHistory[]): number => {
  const stateWeights: Record<WorkflowState, number> = {
    [WorkflowState.CREATED]: 0,
    [WorkflowState.DOCUMENT_VERIFICATION]: 20,
    [WorkflowState.ACADEMIC_REVIEW]: 40,
    [WorkflowState.FINAL_REVIEW]: 60,
    [WorkflowState.APPROVED]: 80,
    [WorkflowState.COMPLETED]: 100,
    [WorkflowState.REJECTED]: 100
  };

  const baseProgress = stateWeights[currentState] || 0;
  const transitionWeight = transitions.length > 0 ? 
    Math.min(20, transitions.length * 5) : 0;

  return Math.min(100, baseProgress + transitionWeight);
};

// Get status color based on workflow state
const getStatusColor = (state: WorkflowState): string => {
  const colorMap: Record<WorkflowState, string> = {
    [WorkflowState.CREATED]: 'var(--primary-color)',
    [WorkflowState.DOCUMENT_VERIFICATION]: 'var(--secondary-color)',
    [WorkflowState.ACADEMIC_REVIEW]: 'var(--secondary-color)',
    [WorkflowState.FINAL_REVIEW]: 'var(--secondary-color)',
    [WorkflowState.APPROVED]: 'var(--success-color)',
    [WorkflowState.REJECTED]: 'var(--error-color)',
    [WorkflowState.COMPLETED]: 'var(--success-color)'
  };

  return colorMap[state] || 'var(--primary-color)';
};

export const WorkflowStatus: React.FC<WorkflowStatusProps> = ({
  workflowId,
  refreshInterval = 30000,
  onStateChange,
  errorBoundary = true,
  showHistory = true,
  theme = 'light'
}) => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [history, setHistory] = useState<WorkflowStateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const { t } = useTranslation();
  const muiTheme = useTheme();

  // Fetch workflow data with error handling
  const fetchWorkflowData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await workflowApi.getWorkflow(workflowId);
      setWorkflow(response.data);
      
      if (showHistory) {
        const historyResponse = await workflowApi.getWorkflowHistory(
          workflowId,
          { page: 1, limit: 10 }
        );
        setHistory(historyResponse);
      }

      setError(null);
      setRetryCount(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workflow data';
      setError(errorMessage);
      
      if (retryCount < 3) {
        setRetryCount(prev => prev + 1);
        setTimeout(fetchWorkflowData, 1000 * Math.pow(2, retryCount));
      }
    } finally {
      setLoading(false);
    }
  }, [workflowId, showHistory, retryCount]);

  // Setup real-time updates and polling
  useEffect(() => {
    fetchWorkflowData();

    if (refreshInterval > 0) {
      refreshTimeoutRef.current = setInterval(fetchWorkflowData, refreshInterval);
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, [fetchWorkflowData, refreshInterval]);

  // Notify parent component of state changes
  useEffect(() => {
    if (workflow?.currentState && onStateChange) {
      onStateChange(workflow.currentState);
    }
  }, [workflow?.currentState, onStateChange]);

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (!workflow) return 0;
    return calculateProgress(workflow.currentState, history);
  }, [workflow, history]);

  // Generate accessible status text
  const statusText = useMemo(() => {
    if (!workflow) return '';
    return t(`workflow.status.${workflow.currentState.toLowerCase()}`, {
      defaultValue: workflow.currentState
    });
  }, [workflow, t]);

  if (loading && !workflow) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress aria-label={t('workflow.loading')} />
      </Box>
    );
  }

  if (error && errorBoundary) {
    return (
      <Alert 
        severity="error"
        aria-live="polite"
        role="alert"
      >
        {t('workflow.error', { error })}
      </Alert>
    );
  }

  if (!workflow) {
    return null;
  }

  return (
    <StatusContainer>
      <StatusHeader>
        <Typography variant="h6" component="h2">
          {t('workflow.status.title')}
        </Typography>
        <Chip
          label={statusText}
          color={workflow.currentState === WorkflowState.REJECTED ? 'error' : 'default'}
          sx={{ backgroundColor: getStatusColor(workflow.currentState) }}
        />
      </StatusHeader>

      <Box my={3}>
        <ProgressBar
          value={progress}
          variant="determinate"
          color={getStatusColor(workflow.currentState)}
          height={8}
          aria-label={t('workflow.progress.label')}
          aria-valuetext={t('workflow.progress.value', { progress })}
        />
      </Box>

      {showHistory && history.length > 0 && (
        <HistoryContainer>
          <Typography variant="subtitle1" gutterBottom>
            {t('workflow.history.title')}
          </Typography>
          {history.map((entry) => (
            <Box
              key={entry.id}
              p={2}
              bgcolor="var(--surface-variant)"
              borderRadius={1}
              role="listitem"
            >
              <Typography variant="body2" color="textSecondary">
                {new Date(entry.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body1">
                {t(`workflow.state.${entry.state.toLowerCase()}`, {
                  defaultValue: entry.state
                })}
              </Typography>
              {entry.comment && (
                <Typography variant="body2" color="textSecondary" mt={1}>
                  {entry.comment}
                </Typography>
              )}
            </Box>
          ))}
        </HistoryContainer>
      )}
    </StatusContainer>
  );
};

export type { WorkflowStatusProps };