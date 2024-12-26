import React, { memo, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Box,
  useMediaQuery,
  useTheme,
  Divider,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as ApplicationIcon,
  Upload as DocumentIcon,
  Person as ProfileIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  ChevronLeft
} from '@mui/icons-material';

import { ROUTES } from '@/constants/routes.constants';
import { useAuth } from '@/hooks/useAuth';

// Constants for component configuration
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const TRANSITION_DURATION = 225;

// Styled components
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: TRANSITION_DURATION,
    }),
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// Interface definitions
interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant?: 'permanent' | 'temporary' | 'persistent';
}

interface NavItemProps {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  children?: NavItemProps[];
}

// Navigation items configuration
const NAVIGATION_ITEMS: NavItemProps[] = [
  {
    label: 'Dashboard',
    path: ROUTES.DASHBOARD.HOME.path,
    icon: <DashboardIcon />,
    roles: ['*'],
  },
  {
    label: 'Applications',
    path: ROUTES.APPLICATION.LIST.path,
    icon: <ApplicationIcon />,
    roles: ['*'],
    children: [
      {
        label: 'New Application',
        path: ROUTES.APPLICATION.NEW.path,
        icon: <ApplicationIcon />,
        roles: ['applicant'],
      },
      {
        label: 'Review Applications',
        path: ROUTES.APPLICATION.REVIEW.path,
        icon: <ApplicationIcon />,
        roles: ['staff', 'admin', 'reviewer'],
      },
    ],
  },
  {
    label: 'Documents',
    path: ROUTES.DOCUMENT.LIST.path,
    icon: <DocumentIcon />,
    roles: ['*'],
  },
  {
    label: 'Profile',
    path: ROUTES.PROFILE.VIEW.path,
    icon: <ProfileIcon />,
    roles: ['*'],
  },
  {
    label: 'Settings',
    path: ROUTES.SETTINGS.GENERAL.path,
    icon: <SettingsIcon />,
    roles: ['admin', 'staff'],
  },
];

// NavItem component for rendering individual navigation items
const NavItem = memo(({ item, level = 0 }: { item: NavItemProps; level?: number }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const theme = useTheme();

  const hasChildren = item.children && item.children.length > 0;
  const isSelected = location.pathname === item.path;
  const canAccess = item.roles.includes('*') || item.roles.some(role => hasPermission(role));

  const handleClick = useCallback(() => {
    if (hasChildren) {
      setOpen(!open);
    } else {
      navigate(item.path);
    }
  }, [hasChildren, navigate, item.path, open]);

  if (!canAccess) return null;

  return (
    <>
      <ListItem
        disablePadding
        sx={{ display: 'block' }}
      >
        <Tooltip title={item.label} placement="right" arrow>
          <ListItemButton
            selected={isSelected}
            onClick={handleClick}
            sx={{
              minHeight: 48,
              justifyContent: 'initial',
              pl: theme.spacing(level + 2),
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: 3,
                justifyContent: 'center',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label}
              primaryTypographyProps={{
                noWrap: true,
                variant: 'body2',
              }}
            />
            {hasChildren && (open ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </Tooltip>
      </ListItem>
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children.map((child, index) => (
              <NavItem key={`${child.path}-${index}`} item={child} level={level + 1} />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
});

// Main Sidebar component
export const Sidebar = memo(({ open, onClose, variant = 'permanent' }: SidebarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);
  const { isAuthenticated } = useAuth();

  // Handle responsive behavior
  useEffect(() => {
    if (!isMobile && variant === 'temporary') {
      onClose();
    }
  }, [isMobile, variant, onClose]);

  if (!isAuthenticated) return null;

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : variant}
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      sx={{
        '& .MuiDrawer-paper': {
          overflowX: 'hidden',
        },
      }}
    >
      <DrawerHeader>
        {isMobile && (
          <Box onClick={onClose} sx={{ cursor: 'pointer', p: 1 }}>
            <ChevronLeft />
          </Box>
        )}
      </DrawerHeader>
      <Divider />
      <List
        component="nav"
        aria-label="main navigation"
        sx={{ width: '100%' }}
      >
        {NAVIGATION_ITEMS.map((item, index) => (
          <React.Fragment key={`${item.path}-${index}`}>
            <NavItem item={item} />
            {index < NAVIGATION_ITEMS.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </StyledDrawer>
  );
});

Sidebar.displayName = 'Sidebar';
NavItem.displayName = 'NavItem';

export default Sidebar;