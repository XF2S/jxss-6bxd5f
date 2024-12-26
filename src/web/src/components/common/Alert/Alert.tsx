import React, { useEffect, useRef } from 'react';
import { Alert as MuiAlert, AlertProps as MuiAlertProps, styled } from '@mui/material';
import { 
  ErrorOutline, 
  CheckCircleOutline, 
  InfoOutline, 
  WarningAmberOutlined,
  Error,
  CheckCircle,
  Info,
  Warning
} from '@mui/icons-material';
import '../../styles/theme.css';

// Type definitions
type AlertSeverity = 'error' | 'warning' | 'info' | 'success';

interface AlertProps extends Omit<MuiAlertProps, 'severity'> {
  message: string;
  severity: AlertSeverity;
  dismissible?: boolean;
  onClose?: () => void;
  className?: string;
  testId?: string;
  errorCode?: string;
  highContrast?: boolean;
  autoFocus?: boolean;
  disableAnimation?: boolean;
}

// Styled components with theme support
const StyledAlert = styled(MuiAlert, {
  shouldForwardProp: (prop) => 
    !['highContrast', 'disableAnimation'].includes(prop as string),
})<{ highContrast?: boolean; disableAnimation?: boolean }>(
  ({ theme, highContrast, disableAnimation }) => ({
    marginBottom: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    fontSize: 'var(--font-size-base)',
    minHeight: 'var(--touch-target-size)',
    
    // High contrast mode styles
    ...(highContrast && {
      border: '2px solid currentColor',
      backgroundColor: 'var(--surface-color)',
      color: 'var(--text-primary)',
      '& .MuiAlert-icon': {
        color: 'currentColor',
      },
    }),

    // Animation styles
    ...(!disableAnimation && {
      animation: 'fadeIn var(--animation-duration-base) var(--animation-easing-standard)',
    }),

    // RTL support
    '& .MuiAlert-icon': {
      marginRight: theme.direction === 'rtl' ? 0 : theme.spacing(1),
      marginLeft: theme.direction === 'rtl' ? theme.spacing(1) : 0,
    },

    // Touch target sizing
    '& .MuiAlert-action': {
      padding: 'calc((var(--touch-target-size) - 24px) / 2)',
    },
  })
);

// Error code to severity mapping function
const mapErrorCodeToSeverity = (errorCode?: string): AlertSeverity => {
  if (!errorCode) return 'info';
  
  const codeNumber = parseInt(errorCode);
  
  if (codeNumber >= 1000 && codeNumber < 2000) return 'error';  // Authentication errors
  if (codeNumber >= 2000 && codeNumber < 3000) return 'warning';  // Application errors
  if (codeNumber >= 3000 && codeNumber < 4000) return 'error';  // Document errors
  if (codeNumber >= 4000 && codeNumber < 5000) return 'warning';  // Workflow errors
  if (codeNumber >= 5000 && codeNumber < 6000) return 'error';  // System errors
  
  return 'info';
};

// Icon selection based on severity and contrast mode
const getAlertIcon = (severity: AlertSeverity, highContrast: boolean) => {
  if (highContrast) {
    switch (severity) {
      case 'error': return <Error />;
      case 'warning': return <Warning />;
      case 'success': return <CheckCircle />;
      case 'info': return <Info />;
    }
  }

  switch (severity) {
    case 'error': return <ErrorOutline />;
    case 'warning': return <WarningAmberOutlined />;
    case 'success': return <CheckCircleOutline />;
    case 'info': return <InfoOutline />;
  }
};

// Main Alert component
export const Alert: React.FC<AlertProps> = ({
  message,
  severity: propSeverity,
  dismissible = true,
  onClose,
  className,
  testId = 'alert',
  errorCode,
  highContrast = false,
  autoFocus = false,
  disableAnimation = false,
  ...props
}) => {
  const alertRef = useRef<HTMLDivElement>(null);
  const severity = errorCode ? mapErrorCodeToSeverity(errorCode) : propSeverity;

  // Handle auto-focus for high-priority alerts
  useEffect(() => {
    if (autoFocus && alertRef.current && (severity === 'error' || severity === 'warning')) {
      alertRef.current.focus();
    }
  }, [autoFocus, severity]);

  // Handle reduced motion preference
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      disableAnimation = true;
    }
  }, []);

  return (
    <StyledAlert
      ref={alertRef}
      severity={severity}
      icon={getAlertIcon(severity, highContrast)}
      onClose={dismissible ? onClose : undefined}
      className={className}
      data-testid={testId}
      highContrast={highContrast}
      disableAnimation={disableAnimation}
      role="alert"
      aria-atomic="true"
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
      tabIndex={autoFocus ? 0 : undefined}
      {...props}
    >
      {errorCode ? `[${errorCode}] ${message}` : message}
    </StyledAlert>
  );
};

// Default export
export default Alert;

// CSS animations
const fadeInKeyframes = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject animations into document
const style = document.createElement('style');
style.innerHTML = fadeInKeyframes;
document.head.appendChild(style);