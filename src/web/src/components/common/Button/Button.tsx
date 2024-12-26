import React, { useRef, useState, useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import { useRipple } from '@mui/material';
import '../../styles/theme.css';

// Types
export type ButtonVariant = 'contained' | 'outlined' | 'text' | 'elevated' | 'tonal';
export type ButtonSize = 'small' | 'medium' | 'large';
export type ButtonState = 'default' | 'hover' | 'focus' | 'pressed' | 'disabled';

// Props interface
export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  elevation?: number;
  icon?: React.ReactNode;
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  ariaLabel?: string;
}

// Button dimensions following MD3 specs and accessibility requirements
const getButtonDimensions = (size: ButtonSize) => {
  const dimensions = {
    small: {
      height: '32px',
      padding: '0 var(--spacing-md)',
      fontSize: 'var(--font-size-xs)',
      minWidth: '64px',
    },
    medium: {
      height: '44px', // Meets minimum touch target size
      padding: '0 var(--spacing-lg)',
      fontSize: 'var(--font-size-sm)',
      minWidth: '96px',
    },
    large: {
      height: '48px',
      padding: '0 var(--spacing-xl)',
      fontSize: 'var(--font-size-md)',
      minWidth: '128px',
    },
  };
  return dimensions[size];
};

// Styled button component with MD3 specifications
const StyledButton = styled('button')<{
  variant: ButtonVariant;
  size: ButtonSize;
  state: ButtonState;
  elevation?: number;
  $fullWidth?: boolean;
}>(({ theme, variant, size, state, elevation = 0, $fullWidth }) => {
  const dimensions = getButtonDimensions(size);
  
  // Base styles
  const baseStyles = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    outline: 'none',
    textDecoration: 'none',
    userSelect: 'none',
    verticalAlign: 'middle',
    WebkitTapHighlightColor: 'transparent',
    width: $fullWidth ? '100%' : 'auto',
    transition: 'all var(--animation-duration-base) var(--animation-easing-standard)',
    ...dimensions,
  };

  // Variant-specific styles
  const variantStyles = {
    contained: {
      backgroundColor: 'var(--primary-color)',
      color: 'var(--on-primary)',
      boxShadow: `var(--elevation-${elevation})`,
    },
    outlined: {
      backgroundColor: 'transparent',
      color: 'var(--primary-color)',
      border: '1px solid var(--outline-color)',
    },
    text: {
      backgroundColor: 'transparent',
      color: 'var(--primary-color)',
    },
    elevated: {
      backgroundColor: 'var(--surface-color)',
      color: 'var(--primary-color)',
      boxShadow: `var(--elevation-${elevation || 1})`,
    },
    tonal: {
      backgroundColor: 'var(--secondary-container)',
      color: 'var(--on-secondary-container)',
    },
  };

  // State-specific styles
  const stateStyles = {
    hover: {
      filter: 'brightness(1.08)',
    },
    focus: {
      outline: 'var(--focus-ring-width) solid var(--focus-ring-color)',
      outlineOffset: 'var(--focus-ring-offset)',
    },
    pressed: {
      transform: 'scale(0.98)',
    },
    disabled: {
      opacity: 0.38,
      cursor: 'not-allowed',
      boxShadow: 'none',
    },
  };

  return {
    ...baseStyles,
    ...variantStyles[variant],
    ...(state !== 'default' && stateStyles[state]),
  };
});

// Custom hook for button interaction management
const useButtonInteraction = (props: ButtonProps) => {
  const [state, setState] = useState<ButtonState>('default');
  const rippleRef = useRipple();

  const handlers = {
    onMouseEnter: () => !props.disabled && setState('hover'),
    onMouseLeave: () => !props.disabled && setState('default'),
    onFocus: () => !props.disabled && setState('focus'),
    onBlur: () => !props.disabled && setState('default'),
    onMouseDown: () => !props.disabled && setState('pressed'),
    onMouseUp: () => !props.disabled && setState('hover'),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!props.disabled && (e.key === 'Enter' || e.key === ' ')) {
        setState('pressed');
      }
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      if (!props.disabled && (e.key === 'Enter' || e.key === ' ')) {
        setState('focus');
      }
    },
  };

  return { state, handlers, rippleRef };
};

// Button component
export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  children,
  className,
  type = 'button',
  elevation,
  icon,
  iconPosition = 'start',
  fullWidth = false,
  ariaLabel,
  ...props
}) => {
  const theme = useTheme();
  const { state, handlers, rippleRef } = useButtonInteraction({ disabled, ...props });
  
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading && onClick) {
      onClick(event);
    }
  }, [disabled, loading, onClick]);

  return (
    <StyledButton
      ref={rippleRef}
      variant={variant}
      size={size}
      state={disabled ? 'disabled' : state}
      elevation={elevation}
      $fullWidth={fullWidth}
      disabled={disabled || loading}
      onClick={handleClick}
      type={type}
      className={className}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      {...handlers}
      {...props}
    >
      {loading && (
        <CircularProgress
          size={size === 'small' ? 16 : 20}
          color="inherit"
          aria-label="Loading"
        />
      )}
      {!loading && icon && iconPosition === 'start' && icon}
      {children}
      {!loading && icon && iconPosition === 'end' && icon}
    </StyledButton>
  );
};

export default Button;