import React, { useMemo } from 'react';
import { Box, Typography, Card, CardContent, Skeleton, useTheme } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { Application, ApplicationStatus as ApplicationStatusEnum } from '@/types/application.types';
import { ProgressBar } from '@/components/common/ProgressBar/ProgressBar';
import { WorkflowTimeline } from '@/components/workflow/WorkflowTimeline/WorkflowTimeline';

// Props interface with comprehensive accessibility support
interface ApplicationStatusProps {
  application: Application;
  showTimeline?: boolean;
  className?: string;
  isLoading?: boolean;
  onStatusChange?: (status: ApplicationStatusEnum) => void;
}

// Styled components with theme integration and accessibility support
const StyledCard = styled(Card, {
  shouldForwardProp: (prop) => !['status', 'highContrast', 'isLoading'].includes(prop as string),
})<{
  status: ApplicationStatusEnum;
  highContrast?: boolean;
  isLoading?: boolean;
}>(({ theme, status, highContrast, isLoading }) => ({
  position: 'relative',
  transition: theme.transitions.create(['background-color', 'box-shadow'], {
    duration: theme.transitions.duration.standard,
  }),
  backgroundColor: isLoading 
    ? theme.palette.background.paper 
    : getStatusColor(status, theme, highContrast),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  
  // High contrast mode support
  ...(highContrast && {
    border: `3px solid ${theme.palette.text.primary}`,
    backgroundColor: theme.palette.background.paper,
  }),

  // Loading state styles
  ...(isLoading && {
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: `linear-gradient(90deg, 
        ${alpha(theme.palette.background.paper, 0)} 0%, 
        ${alpha(theme.palette.background.paper, 0.2)} 50%, 
        ${alpha(theme.palette.background.paper, 0)} 100%)`,
      animation: 'pulse 1.5s ease-in-out infinite',
    },
  }),

  // Reduced motion support
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&::after': {
      animation: 'none',
    },
  },

  // Animation keyframes
  '@keyframes pulse': {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(100%)' },
  },
}));

// Helper function to calculate progress percentage
const calculateProgress = (status: ApplicationStatusEnum): number => {
  const statusWeights: Record<ApplicationStatusEnum, number> = {
    [ApplicationStatusEnum.DRAFT]: 0,
    [ApplicationStatusEnum.SUBMITTED]: 25,
    [ApplicationStatusEnum.UNDER_REVIEW]: 50,
    [ApplicationStatusEnum.APPROVED]: 75,
    [ApplicationStatusEnum.REJECTED]: 100,
  };
  return statusWeights[status] || 0;
};

// Helper function to get status-specific color with theme integration
const getStatusColor = (status: ApplicationStatusEnum, theme: any, highContrast: boolean): string => {
  if (highContrast) return theme.palette.background.paper;

  const statusColors: Record<ApplicationStatusEnum, string> = {
    [ApplicationStatusEnum.DRAFT]: alpha(theme.palette.info.light, 0.1),
    [ApplicationStatusEnum.SUBMITTED]: alpha(theme.palette.primary.light, 0.1),
    [ApplicationStatusEnum.UNDER_REVIEW]: alpha(theme.palette.warning.light, 0.1),
    [ApplicationStatusEnum.APPROVED]: alpha(theme.palette.success.light, 0.1),
    [ApplicationStatusEnum.REJECTED]: alpha(theme.palette.error.light, 0.1),
  };

  return statusColors[status] || theme.palette.background.paper;
};

/**
 * ApplicationStatus Component
 * 
 * Displays the current status of an enrollment application with visual indicators,
 * progress tracking, and optional timeline visualization.
 *
 * @param {ApplicationStatusProps} props - Component props
 * @returns {JSX.Element} Themed and accessible status display
 */
export const ApplicationStatus: React.FC<ApplicationStatusProps> = ({
  application,
  showTimeline = true,
  className = '',
  isLoading = false,
  onStatusChange,
}) => {
  const theme = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: more)');
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Memoize progress calculation
  const progress = useMemo(() => 
    calculateProgress(application.status),
    [application.status]
  );

  // Loading state renderer
  if (isLoading) {
    return (
      <StyledCard 
        status={ApplicationStatusEnum.DRAFT}
        isLoading={true}
        className={className}
      >
        <CardContent>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} />
          <Box sx={{ mt: 2 }}>
            <Skeleton variant="rectangular" height={8} />
          </Box>
          {showTimeline && (
            <Box sx={{ mt: 3 }}>
              <Skeleton variant="rectangular" height={100} />
            </Box>
          )}
        </CardContent>
      </StyledCard>
    );
  }

  return (
    <StyledCard
      status={application.status}
      highContrast={prefersHighContrast}
      className={className}
      role="region"
      aria-label={`Application status: ${application.status}`}
    >
      <CardContent>
        <Typography 
          variant="h6" 
          component="h2"
          gutterBottom
          sx={{ fontWeight: 'medium' }}
        >
          Application #{application.id}
        </Typography>
        
        <Typography 
          variant="subtitle1"
          color="textSecondary"
          gutterBottom
        >
          Status: {application.status.replace('_', ' ')}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <ProgressBar
            value={progress}
            variant="determinate"
            aria-label="Application progress"
            aria-valuetext={`${progress}% complete`}
            height={8}
          />
        </Box>

        {showTimeline && application.id && (
          <Box 
            sx={{ 
              mt: 3,
              opacity: isLoading ? 0.5 : 1,
              transition: theme.transitions.create('opacity'),
            }}
          >
            <WorkflowTimeline
              workflowId={application.id}
              showProgress={false}
              compact={isSmallScreen}
              aria-label="Application timeline"
            />
          </Box>
        )}
      </CardContent>
    </StyledCard>
  );
};

export type { ApplicationStatusProps };