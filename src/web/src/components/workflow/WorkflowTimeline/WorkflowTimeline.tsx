import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme, useMediaQuery } from '@mui/material';
import { 
  Timeline, 
  TimelineItem, 
  TimelineSeparator, 
  TimelineConnector, 
  TimelineContent, 
  TimelineDot 
} from '@mui/lab';
import { Typography, Box, Skeleton } from '@mui/material';
import { WorkflowState, WorkflowStateHistory, Workflow } from '@/types/workflow.types';
import { ProgressBar } from '@/components/common/ProgressBar';

// Props interface with accessibility support
interface WorkflowTimelineProps {
  workflowId: string;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}

// Helper function to determine state color with proper contrast
const getStateColor = (state: WorkflowState, theme: any): string => {
  const colorMap: Record<WorkflowState, string> = {
    [WorkflowState.CREATED]: 'info',
    [WorkflowState.DOCUMENT_VERIFICATION]: 'primary',
    [WorkflowState.ACADEMIC_REVIEW]: 'primary',
    [WorkflowState.FINAL_REVIEW]: 'primary',
    [WorkflowState.APPROVED]: 'success',
    [WorkflowState.REJECTED]: 'error',
    [WorkflowState.COMPLETED]: 'success'
  };
  
  return colorMap[state] || 'default';
};

// Calculate workflow progress percentage
const calculateProgress = (currentState: WorkflowState, history: WorkflowStateHistory[]): number => {
  const stateWeights: Record<WorkflowState, number> = {
    [WorkflowState.CREATED]: 0,
    [WorkflowState.DOCUMENT_VERIFICATION]: 20,
    [WorkflowState.ACADEMIC_REVIEW]: 40,
    [WorkflowState.FINAL_REVIEW]: 60,
    [WorkflowState.APPROVED]: 80,
    [WorkflowState.COMPLETED]: 100,
    [WorkflowState.REJECTED]: 100
  };

  return stateWeights[currentState] || 0;
};

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  workflowId,
  showProgress = true,
  compact = false,
  className = '',
  ariaLabel
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isRTL = i18n.dir() === 'rtl';
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  
  // Get workflow data from Redux store
  const workflow = useSelector((state: any) => 
    state.workflows.entities[workflowId]
  ) as Workflow | undefined;

  // Memoize timeline items to prevent unnecessary re-renders
  const timelineItems = useMemo(() => {
    if (!workflow) {
      return Array(3).fill(null).map((_, index) => (
        <TimelineItem key={`skeleton-${index}`}>
          <TimelineSeparator>
            <TimelineDot>
              <Skeleton variant="circular" width={24} height={24} />
            </TimelineDot>
            {index < 2 && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent>
            <Skeleton width={200} />
            <Skeleton width={100} />
          </TimelineContent>
        </TimelineItem>
      ));
    }

    return workflow.history.map((item, index) => {
      const isLast = index === workflow.history.length - 1;
      const stateColor = getStateColor(item.state, theme);
      
      return (
        <TimelineItem
          key={item.id}
          sx={{ 
            minHeight: compact ? 'auto' : undefined,
            '&:before': {
              flex: compact ? 0 : undefined
            }
          }}
        >
          <TimelineSeparator>
            <TimelineDot 
              color={stateColor}
              sx={{
                transition: prefersReducedMotion ? 'none' : undefined
              }}
            />
            {!isLast && <TimelineConnector />}
          </TimelineSeparator>
          <TimelineContent>
            <Typography 
              variant={compact ? 'body2' : 'body1'}
              component="div"
              color="textPrimary"
            >
              {t(`workflow.states.${item.state}`)}
            </Typography>
            <Typography 
              variant={compact ? 'caption' : 'body2'}
              color="textSecondary"
            >
              {new Intl.DateTimeFormat(i18n.language, {
                dateStyle: 'medium',
                timeStyle: 'short'
              }).format(new Date(item.timestamp))}
            </Typography>
            {item.comment && (
              <Typography 
                variant={compact ? 'caption' : 'body2'}
                color="textSecondary"
                sx={{ mt: 0.5 }}
              >
                {item.comment}
              </Typography>
            )}
          </TimelineContent>
        </TimelineItem>
      );
    });
  }, [workflow, compact, theme, t, i18n.language, prefersReducedMotion]);

  // Calculate and memoize progress
  const progress = useMemo(() => {
    if (!workflow) return 0;
    return calculateProgress(workflow.currentState, workflow.history);
  }, [workflow]);

  return (
    <Box
      className={className}
      sx={{
        '& .MuiTimelineItem-root': {
          minHeight: compact ? 'auto' : undefined
        }
      }}
    >
      {showProgress && (
        <Box sx={{ mb: 2 }}>
          <ProgressBar
            value={progress}
            variant="determinate"
            color="primary"
            aria-label={t('workflow.progress.label')}
            aria-valuetext={t('workflow.progress.valueText', { progress })}
          />
        </Box>
      )}
      <Timeline
        sx={{
          [`& .MuiTimelineItem-root:before`]: {
            flex: compact ? 0 : undefined
          },
          direction: isRTL ? 'rtl' : 'ltr'
        }}
        role="list"
        aria-label={ariaLabel || t('workflow.timeline.label')}
      >
        {timelineItems}
      </Timeline>
    </Box>
  );
};

export type { WorkflowTimelineProps };