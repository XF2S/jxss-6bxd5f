/**
 * @fileoverview Enhanced Header component implementing Material Design 3 specifications
 * with comprehensive accessibility support, responsive design, and theme management.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
  Badge,
  Box,
  Tooltip,
} from '@mui/material';
import { styled, useTheme as useMuiTheme } from '@mui/material/styles';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  NotificationsOutlined,
  ContrastOutlined,
} from '@mui/icons-material';

// Internal imports
import Avatar from '@/components/common/Avatar/Avatar';
import Button from '@/components/common/Button/Button';
import useAuth from '@/hooks/useAuth';
import useTheme from '@/hooks/useTheme';
import { ThemeMode } from '@/config/theme.config';

// Constants for accessibility
const ARIA_LABELS = {
  menuButton: 'Toggle navigation menu',
  themeToggle: 'Toggle theme mode',
  notifications: 'View notifications',
  profile: 'View profile menu',
  logout: 'Log out of application',
} as const;

// Interface definitions
interface HeaderProps {
  /** Handler for mobile menu toggle */
  onMenuClick: () => void;
  /** Optional CSS class for styling customization */
  className?: string;
  /** Data test ID for testing purposes */
  testId?: string;
}

// Styled components with responsive behavior
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  position: 'fixed',
  zIndex: theme.zIndex.appBar,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  borderBottom: `1px solid ${theme.palette.divider}`,
  boxShadow: 'none',
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  height: 64,
  [theme.breakpoints.up('sm')]: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
  },
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/**
 * Enhanced Header component with accessibility and responsive features
 */
const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  className,
  testId = 'header',
}) => {
  const muiTheme = useMuiTheme();
  const { themeMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [notificationCount, setNotificationCount] = useState(0);

  // Memoized handlers
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      // Announce logout to screen readers
      const message = 'Successfully logged out';
      const announcement = new CustomEvent('announcement', { 
        detail: { message, politeness: 'polite' } 
      });
      document.dispatchEvent(announcement);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  const handleThemeToggle = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  // Effect for notification updates
  useEffect(() => {
    // Add notification listener here
    const handleNotifications = (count: number) => {
      setNotificationCount(count);
      // Announce new notifications to screen readers if count increases
      if (count > notificationCount) {
        const message = `You have ${count} new notifications`;
        const announcement = new CustomEvent('announcement', {
          detail: { message, politeness: 'polite' }
        });
        document.dispatchEvent(announcement);
      }
    };

    // Cleanup notification listener
    return () => {
      // Cleanup logic here
    };
  }, [notificationCount]);

  // Theme toggle icon based on current mode
  const ThemeIcon = React.useMemo(() => {
    switch (themeMode) {
      case ThemeMode.DARK:
        return Brightness7;
      case ThemeMode.HIGH_CONTRAST:
        return ContrastOutlined;
      default:
        return Brightness4;
    }
  }, [themeMode]);

  return (
    <StyledAppBar 
      className={className}
      data-testid={testId}
      position="fixed"
    >
      <StyledToolbar>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label={ARIA_LABELS.menuButton}
            onClick={onMenuClick}
            size="large"
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            component="h1"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            Enrollment System
          </Typography>
        </Box>

        <ActionButtons>
          <Tooltip title={ARIA_LABELS.themeToggle}>
            <IconButton
              color="inherit"
              onClick={handleThemeToggle}
              aria-label={ARIA_LABELS.themeToggle}
              size="large"
            >
              <ThemeIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={ARIA_LABELS.notifications}>
            <IconButton
              color="inherit"
              aria-label={`${ARIA_LABELS.notifications} (${notificationCount} new)`}
              size="large"
            >
              <Badge badgeContent={notificationCount} color="error">
                <NotificationsOutlined />
              </Badge>
            </IconButton>
          </Tooltip>

          {user && (
            <>
              <Avatar
                user={user}
                size="small"
                alt={`${user.firstName} ${user.lastName}`}
                onClick={() => {}} // Profile menu handler
                tabIndex={0}
              />

              {!isMobile && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleLogout}
                  aria-label={ARIA_LABELS.logout}
                >
                  Logout
                </Button>
              )}
            </>
          )}
        </ActionButtons>
      </StyledToolbar>
    </StyledAppBar>
  );
};

export default Header;