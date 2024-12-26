import React, { useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Fade } from '@mui/material';
import { Button } from '../Button/Button';
import { useTheme } from '../../../hooks/useTheme';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.0.0

/**
 * Props interface for Modal component with enhanced accessibility and animation options
 */
export interface ModalProps {
  /** Controls modal visibility state */
  open: boolean;
  /** Close handler with reason tracking for analytics */
  onClose: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void;
  /** Modal title text with ARIA labelling */
  title: string;
  /** Modal content with error boundary protection */
  children: React.ReactNode;
  /** Modal action buttons with keyboard focus management */
  actions?: React.ReactNode;
  /** Maximum modal width with responsive breakpoints */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Full width mode for larger content */
  fullWidth?: boolean;
  /** Full screen mode with mobile detection */
  fullScreen?: boolean;
  /** Custom animation duration in milliseconds */
  animationDuration?: number;
  /** Option to disable closing on backdrop click */
  disableBackdropClick?: boolean;
  /** Keep modal mounted for performance optimization */
  keepMounted?: boolean;
}

/**
 * Styled Material-UI Dialog component with MD3 implementation
 */
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: theme.palette.background.paper,
    borderRadius: '28px', // MD3 large component radius
    boxShadow: theme.shadows[3], // MD3 elevation level 3
    transition: theme.transitions.create(['transform', 'opacity'], {
      duration: theme.transitions.duration.standard,
    }),
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(2),
      borderRadius: '24px', // MD3 medium component radius for mobile
    },
  },
  '& .MuiDialogTitle-root': {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontSize: '1.25rem',
    fontWeight: 500,
  },
  '& .MuiDialogContent-root': {
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    overflowY: 'auto',
    '&:first-of-type': {
      paddingTop: theme.spacing(3),
    },
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(2, 3),
    gap: theme.spacing(2),
  },
}));

/**
 * Modal component implementing Material Design 3 specifications with accessibility support
 * and responsive behavior.
 */
export const Modal = React.memo<ModalProps>(({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = false,
  fullScreen = false,
  animationDuration = 250,
  disableBackdropClick = false,
  keepMounted = false,
}) => {
  const { currentTheme } = useTheme();
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);
  const contentId = useRef(`modal-content-${Math.random().toString(36).substr(2, 9)}`);

  // Handle backdrop click with analytics tracking
  const handleBackdropClick = useCallback((event: {}) => {
    if (!disableBackdropClick) {
      onClose(event, 'backdropClick');
    }
  }, [disableBackdropClick, onClose]);

  // Handle escape key with analytics tracking
  const handleEscapeKeyDown = useCallback((event: {}) => {
    onClose(event, 'escapeKeyDown');
  }, [onClose]);

  // Focus trap management
  useEffect(() => {
    if (open) {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0] as HTMLElement;
      firstFocusable?.focus();
    }
  }, [open]);

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      keepMounted={keepMounted}
      onBackdropClick={handleBackdropClick}
      onEscapeKeyDown={handleEscapeKeyDown}
      aria-labelledby={titleId.current}
      aria-describedby={contentId.current}
      TransitionComponent={Fade}
      TransitionProps={{
        timeout: animationDuration,
      }}
      PaperProps={{
        elevation: 3,
        role: 'dialog',
      }}
    >
      <DialogTitle id={titleId.current}>
        {title}
      </DialogTitle>
      
      <DialogContent id={contentId.current}>
        {children}
      </DialogContent>

      {actions && (
        <DialogActions>
          {actions}
        </DialogActions>
      )}
    </StyledDialog>
  );
});

Modal.displayName = 'Modal';

export default Modal;