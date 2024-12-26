import React, { memo, useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import '../../../styles/theme.css';
import '../../../styles/variables.css';

// Interface for Card component props
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: number;
  interactive?: boolean;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
}

// Styled component for the card using Material Design 3 specifications
const StyledCard = styled('div')<{ elevation: number; interactive: boolean }>(
  ({ elevation, interactive, theme }) => ({
    padding: 'var(--spacing-md)',
    borderRadius: 'var(--border-radius-lg)',
    backgroundColor: 'var(--surface-color)',
    color: 'var(--text-primary)',
    transition: 'all var(--animation-duration-base) var(--animation-easing-standard)',
    cursor: interactive ? 'pointer' : 'default',
    outline: 'none',
    minHeight: 'var(--touch-target-size)',
    minWidth: 'var(--touch-target-size)',
    position: 'relative',
    boxShadow: `var(--elevation-${elevation})`,
    
    // Hover state for interactive cards
    '&:hover': {
      transform: interactive ? 'translateY(-2px)' : 'none',
      boxShadow: interactive ? `var(--elevation-${Math.min(elevation + 1, 5)})` : `var(--elevation-${elevation})`,
    },
    
    // Focus state for accessibility
    '&:focus-visible': {
      outlineWidth: 'var(--focus-ring-width)',
      outlineColor: 'var(--focus-ring-color)',
      outlineStyle: 'solid',
      outlineOffset: 'var(--focus-ring-offset)',
    },
    
    // Active state for interactive cards
    '&:active': {
      transform: interactive ? 'translateY(1px)' : 'none',
      boxShadow: interactive ? `var(--elevation-${Math.max(elevation - 1, 0)})` : `var(--elevation-${elevation})`,
    },
    
    // High contrast mode support
    '@media (prefers-contrast: more)': {
      border: 'var(--high-contrast-mode-border)',
      boxShadow: 'none',
    },
    
    // Reduced motion support
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      transform: 'none',
    },
  })
);

/**
 * Card component implementing Material Design 3 specifications
 * with full accessibility support and responsive design
 * 
 * @version 1.0.0
 * @component
 */
export const Card: React.FC<CardProps> = memo(({
  children,
  className = '',
  elevation = 1,
  interactive = false,
  onClick,
  role = interactive ? 'button' : 'article',
  tabIndex = interactive ? 0 : undefined,
  ariaLabel,
}) => {
  // Validate elevation range
  const validatedElevation = useMemo(() => {
    return Math.max(0, Math.min(5, elevation));
  }, [elevation]);

  // Handle keyboard interactions for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
  }, [interactive, onClick]);

  // Combine class names
  const combinedClassName = useMemo(() => {
    return `md3-card ${className}`.trim();
  }, [className]);

  return (
    <StyledCard
      className={combinedClassName}
      elevation={validatedElevation}
      interactive={interactive}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      data-testid="md3-card"
    >
      {children}
    </StyledCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

// Default export
export default Card;