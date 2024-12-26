/**
 * @fileoverview Enhanced Avatar component with accessibility features and theme integration
 * Implements Material Design 3 standards with size variants and high contrast support
 * @version 1.0.0
 */

// External imports - v18.x
import React from 'react';
// Material-UI v5.x
import { Avatar as MuiAvatar } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

// Internal imports
import { User } from '@/types/auth.types';
import { ThemeMode } from '@/config/theme.config';

/**
 * Size configurations for avatar variants
 */
const AVATAR_SIZES = {
  small: {
    size: '32px',
    fontSize: '14px',
    borderWidth: '1px'
  },
  medium: {
    size: '40px',
    fontSize: '16px',
    borderWidth: '2px'
  },
  large: {
    size: '48px',
    fontSize: '20px',
    borderWidth: '2px'
  }
} as const;

/**
 * Props interface for the Avatar component
 */
interface AvatarProps {
  /** User object containing profile information */
  user?: User;
  /** Size variant of the avatar */
  size?: keyof typeof AVATAR_SIZES;
  /** Direct image source URL */
  src?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Click handler for interactive avatars */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Custom CSS class */
  className?: string;
  /** Tab index for keyboard navigation */
  tabIndex?: number;
}

/**
 * Styled Avatar component with theme integration and size variants
 */
const StyledAvatar = styled(MuiAvatar, {
  shouldForwardProp: (prop) => prop !== 'size'
})<{ size: keyof typeof AVATAR_SIZES }>(({ size, theme }) => {
  const sizeConfig = AVATAR_SIZES[size];
  const isHighContrast = theme.palette.mode === ThemeMode.HIGH_CONTRAST;

  return {
    width: sizeConfig.size,
    height: sizeConfig.size,
    fontSize: sizeConfig.fontSize,
    border: `${sizeConfig.borderWidth} solid ${
      isHighContrast ? theme.palette.common.white : theme.palette.primary.main
    }`,
    backgroundColor: isHighContrast
      ? theme.palette.common.black
      : theme.palette.primary.main,
    color: isHighContrast
      ? theme.palette.common.white
      : theme.palette.primary.contrastText,
    cursor: 'pointer',
    transition: theme.transitions.create(['border-color', 'box-shadow']),
    
    '&:hover': {
      borderColor: theme.palette.primary.dark,
      boxShadow: `0 0 0 1px ${theme.palette.primary.dark}`,
    },
    
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
    },
    
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    }
  };
});

/**
 * Extracts initials from user's name
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @returns Two-letter initials or fallback
 */
const getInitials = (firstName?: string, lastName?: string): string => {
  const first = firstName?.charAt(0) || '';
  const last = lastName?.charAt(0) || '';
  return first || last ? `${first}${last}`.toUpperCase() : '?';
};

/**
 * Enhanced Avatar component with size variants and accessibility features
 */
const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'medium',
  src,
  alt,
  onClick,
  className,
  tabIndex = 0,
}) => {
  const theme = useTheme();
  const imageUrl = src || user?.profileImage;
  const altText = alt || (user ? `${user.firstName} ${user.lastName}` : 'User avatar');
  const initials = user ? getInitials(user.firstName, user.lastName) : '?';

  return (
    <StyledAvatar
      size={size}
      src={imageUrl}
      alt={altText}
      onClick={onClick}
      className={className}
      tabIndex={onClick ? tabIndex : -1}
      role={onClick ? 'button' : 'img'}
      aria-label={onClick ? `${altText} profile` : undefined}
    >
      {!imageUrl && initials}
    </StyledAvatar>
  );
};

export default Avatar;