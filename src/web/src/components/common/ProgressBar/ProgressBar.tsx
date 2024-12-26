import React, { useCallback, useMemo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { LinearProgress, useMediaQuery } from '@mui/material';
import '../../styles/theme.css';

// Interface for component props with comprehensive accessibility support
interface ProgressBarProps {
  value?: number;
  variant?: 'determinate' | 'indeterminate' | 'buffer';
  color?: 'primary' | 'secondary' | 'success' | 'error' | string;
  height?: number;
  'aria-label'?: string;
  'aria-valuetext'?: string;
  role?: string;
  tabIndex?: number;
}

// Helper function to determine appropriate color based on theme and accessibility
const getProgressColor = (
  color: string = 'primary',
  theme: any,
  isHighContrast: boolean
): string => {
  // High contrast mode overrides
  if (isHighContrast) {
    return color === 'error' 
      ? 'var(--error-color)' 
      : 'var(--primary-color)';
  }

  // Map color to theme tokens
  const colorMap: { [key: string]: string } = {
    primary: 'var(--primary-color)',
    secondary: 'var(--secondary-color)',
    success: 'var(--success-color)',
    error: 'var(--error-color)',
  };

  return colorMap[color] || colorMap.primary;
};

// Generate accessible screen reader text
const getAriaValueText = (value: number | undefined, variant: string): string => {
  if (variant === 'indeterminate') {
    return 'Loading in progress';
  }
  
  if (variant === 'buffer') {
    return `Loading ${value}% with buffer`;
  }
  
  return `${value || 0}% complete`;
};

// Styled component with enhanced accessibility and theme support
const StyledProgressBar = styled(LinearProgress, {
  shouldForwardProp: (prop) => 
    !['height', 'isHighContrast', 'direction'].includes(prop as string),
})<{
  height?: number;
  isHighContrast?: boolean;
  direction?: 'ltr' | 'rtl';
}>(({ theme, height = 4, color = 'primary', isHighContrast, direction }) => ({
  height: Math.max(height, 4), // Ensure minimum height for touch targets
  borderRadius: theme.shape.borderRadius,
  direction: direction || 'inherit',

  // Enhanced focus styles for accessibility
  '&:focus-visible': {
    outline: `var(--focus-ring-width) solid var(--focus-ring-color)`,
    outlineOffset: 'var(--focus-ring-offset)',
  },

  // Base bar styles with theme awareness
  '& .MuiLinearProgress-bar': {
    backgroundColor: getProgressColor(color, theme, isHighContrast),
    transition: 'transform var(--animation-duration-base) var(--animation-easing-standard)',
  },

  // Buffer bar styles
  '& .MuiLinearProgress-dashed': {
    backgroundImage: isHighContrast
      ? 'none'
      : `radial-gradient(${getProgressColor(color, theme, false)} 0%, ${getProgressColor(
          color,
          theme,
          false
        )} 16%, transparent 42%)`,
  },

  // Reduced motion support
  '@media (prefers-reduced-motion: reduce)': {
    '& .MuiLinearProgress-bar': {
      transition: 'none',
    },
  },
}));

/**
 * ProgressBar Component
 * 
 * A highly accessible progress indicator that follows Material Design 3 specifications
 * with support for different variants, themes, and accessibility features.
 *
 * @param {ProgressBarProps} props - Component props
 * @returns {JSX.Element} Themed and accessible progress bar
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  variant = 'determinate',
  color = 'primary',
  height = 4,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
  role = 'progressbar',
  tabIndex = 0,
  ...props
}) => {
  const theme = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersHighContrast = useMediaQuery('(prefers-contrast: more)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const dir = document.dir || 'ltr';

  // Memoize aria-valuetext for performance
  const computedAriaValueText = useMemo(() => 
    ariaValueText || getAriaValueText(value, variant),
    [ariaValueText, value, variant]
  );

  // Callback for handling animation end to improve performance
  const handleAnimationEnd = useCallback(() => {
    if (prefersReducedMotion) {
      const elements = document.querySelectorAll('.MuiLinearProgress-bar');
      elements.forEach(el => (el as HTMLElement).style.transition = 'none');
    }
  }, [prefersReducedMotion]);

  return (
    <StyledProgressBar
      value={value}
      variant={variant}
      color={color}
      height={height}
      isHighContrast={prefersHighContrast}
      direction={dir as 'ltr' | 'rtl'}
      aria-label={ariaLabel || 'Progress indicator'}
      aria-valuetext={computedAriaValueText}
      aria-valuenow={variant === 'determinate' ? value : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      role={role}
      tabIndex={tabIndex}
      onAnimationEnd={handleAnimationEnd}
      {...props}
    />
  );
};

export type { ProgressBarProps };