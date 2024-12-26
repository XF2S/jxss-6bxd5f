/**
 * @fileoverview Toast notification component for the Enrollment System
 * Provides temporary visual feedback through notifications and alerts with
 * accessibility support, tracking, and analytics integration.
 * @version 1.0.0
 */

import React, { useCallback } from 'react'; // v18.0.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { Snackbar, Alert, IconButton } from '@mui/material'; // v5.0.0
import CloseIcon from '@mui/icons-material/Close'; // v5.0.0
import { useNotification } from '@/hooks/useNotification';

/**
 * Interface for Toast component props with comprehensive configuration options
 */
interface ToastProps {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  notificationId?: string;
  onClose?: () => void;
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  autoHideDuration?: number;
  disableWindowBlur?: boolean;
  className?: string;
  style?: React.CSSProperties;
  role?: 'alert' | 'status' | 'log';
  elevation?: number;
}

/**
 * Styled Snackbar component with enhanced visual presentation
 */
const StyledSnackbar = styled(Snackbar)(({ theme }) => ({
  zIndex: theme.zIndex.tooltip + 1,
  position: 'fixed',
  minWidth: '300px',
  maxWidth: '500px',
  transition: theme.transitions.create(['transform', 'opacity']),
  backdropFilter: 'blur(8px)',
  '@media (max-width: 600px)': {
    minWidth: '100%',
    margin: '0 16px'
  }
}));

/**
 * Styled Alert component with consistent design system integration
 */
const StyledAlert = styled(Alert)(({ theme }) => ({
  width: '100%',
  boxShadow: theme.shadows[3],
  borderRadius: theme.shape.borderRadius,
  padding: '6px 16px',
  alignItems: 'center',
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  fontSize: theme.typography.body2.fontSize
}));

/**
 * Toast component for displaying temporary notifications with tracking
 * and accessibility features
 */
export const Toast: React.FC<ToastProps> = ({
  open,
  message,
  severity,
  duration,
  notificationId,
  onClose,
  anchorOrigin = {
    vertical: 'top',
    horizontal: 'right'
  },
  autoHideDuration = 6000,
  disableWindowBlur = false,
  className,
  style,
  role = 'alert',
  elevation = 6
}) => {
  const { markAsRead, trackNotification } = useNotification();

  /**
   * Handles toast closure with notification tracking
   */
  const handleClose = useCallback(
    (event: React.SyntheticEvent | null, reason?: string) => {
      if (reason === 'clickaway') {
        return;
      }

      // Track notification interaction
      if (notificationId) {
        trackNotification({
          id: notificationId,
          action: 'CLOSE',
          interactionType: reason || 'manual',
          timestamp: new Date().toISOString(),
          duration: Date.now() - duration
        });

        // Mark notification as read in the system
        markAsRead(notificationId).catch((error) => {
          console.error('Failed to mark notification as read:', error);
        });
      }

      // Call parent onClose handler if provided
      if (onClose) {
        onClose();
      }
    },
    [notificationId, duration, markAsRead, trackNotification, onClose]
  );

  /**
   * Handles cleanup after toast exit animation
   */
  const handleExited = useCallback(() => {
    if (notificationId) {
      trackNotification({
        id: notificationId,
        action: 'EXITED',
        timestamp: new Date().toISOString()
      });
    }
  }, [notificationId, trackNotification]);

  return (
    <StyledSnackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={anchorOrigin}
      className={className}
      style={style}
      disableWindowBlur={disableWindowBlur}
      onExited={handleExited}
    >
      <StyledAlert
        elevation={elevation}
        variant="filled"
        severity={severity}
        role={role}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={(e) => handleClose(e)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        {message}
      </StyledAlert>
    </StyledSnackbar>
  );
};

export default Toast;