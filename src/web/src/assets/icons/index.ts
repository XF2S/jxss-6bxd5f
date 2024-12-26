// @mui/icons-material v5.0.0
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  NotificationsOutlined,
  Close as CloseIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import { ReactNode } from 'react';

/**
 * Standardized icon sizes following Material Design 3 guidelines and accessibility requirements
 */
export const ICON_SIZES = {
  small: '1rem',      // 16px - For dense UIs
  medium: '1.5rem',   // 24px - Default size
  large: '2rem',      // 32px - For emphasis
  touch: '44px'       // Minimum touch target size for accessibility
} as const;

/**
 * Icon color tokens mapped to design system variables
 */
export const ICON_COLORS = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  error: 'var(--error)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  success: 'var(--success)',
  disabled: 'var(--disabled)'
} as const;

/**
 * Standard interface for icon props ensuring consistent styling and accessibility
 */
export interface IconProps {
  size?: keyof typeof ICON_SIZES;
  color?: keyof typeof ICON_COLORS;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
  testId?: string;
}

/**
 * Navigation-related icons for consistent wayfinding
 */
export const NavigationIcons = {
  MenuIcon,
  ArrowForwardIcon,
  ArrowBackIcon,
} as const;

/**
 * Action-related icons for interactive elements
 */
export const ActionIcons = {
  SearchIcon,
  UploadIcon,
  DeleteIcon,
  EditIcon,
  SettingsIcon,
} as const;

/**
 * Status and feedback icons for system messaging
 */
export const StatusIcons = {
  InfoIcon,
  WarningIcon,
  ErrorIcon,
  CheckCircleIcon,
} as const;

/**
 * Theme-related icons for appearance control
 */
export const ThemeIcons = {
  Brightness4,
  Brightness7,
} as const;

/**
 * User-related icons for profile and notifications
 */
export const UserIcons = {
  AccountCircleIcon,
  LogoutIcon,
  NotificationsOutlined,
} as const;

// Consolidated icon map for getIconByName function
const IconMap = {
  ...NavigationIcons,
  ...ActionIcons,
  ...StatusIcons,
  ...ThemeIcons,
  ...UserIcons,
} as const;

type IconName = keyof typeof IconMap;

/**
 * Retrieves icon component by name with standardized props for consistent styling and accessibility
 * @param iconName - Name of the icon to retrieve
 * @param props - Standard icon properties for styling and behavior
 * @returns Configured icon component or null if icon not found
 */
export const getIconByName = (
  iconName: IconName,
  props: IconProps
): ReactNode => {
  const IconComponent = IconMap[iconName];
  
  if (!IconComponent) {
    console.warn(`Icon ${iconName} not found`);
    return null;
  }

  const {
    size = 'medium',
    color = 'primary',
    className,
    ariaLabel,
    onClick,
    testId,
  } = props;

  return (
    <IconComponent
      sx={{
        width: ICON_SIZES[size],
        height: ICON_SIZES[size],
        color: ICON_COLORS[color],
      }}
      className={className}
      aria-label={ariaLabel}
      onClick={onClick}
      data-testid={testId}
    />
  );
};

// Type exports for consuming components
export type { IconName };