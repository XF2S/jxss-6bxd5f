/**
 * @fileoverview Main layout component providing core structure for the enrollment system
 * Implements Material Design 3 specifications with comprehensive accessibility features
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal imports
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import Footer from '../Footer/Footer';
import useTheme from '../../../hooks/useTheme';

// Constants for layout configuration
const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;

// Interface definitions
interface MainLayoutProps {
  /** Child components to render in main content area */
  children: React.ReactNode;
  /** Current page title for accessibility */
  pageTitle: string;
}

// Styled components
const MainContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  [theme.breakpoints.up('md')]: {
    marginLeft: SIDEBAR_WIDTH,
    width: `calc(100% - ${SIDEBAR_WIDTH}px)`,
  },
}));

const ContentWrapper = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  width: '100%',
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

/**
 * Main layout component that provides the core structure for the application
 * with responsive behavior and accessibility features
 */
const MainLayout: React.FC<MainLayoutProps> = ({ children, pageTitle }) => {
  const { currentTheme, themeMode, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('md'));

  // Handle mobile menu toggle with proper focus management
  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      if (!isMobile && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, mobileMenuOpen]);

  // Update document title for accessibility
  useEffect(() => {
    document.title = `${pageTitle} | Enrollment System`;
  }, [pageTitle]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      {/* Skip to main content link for keyboard navigation */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          '&:focus': {
            position: 'fixed',
            top: theme => theme.spacing(2),
            left: theme => theme.spacing(2),
            width: 'auto',
            height: 'auto',
            padding: theme => theme.spacing(2),
            backgroundColor: 'background.paper',
            color: 'text.primary',
            zIndex: theme => theme.zIndex.modal + 1,
            outline: theme => `2px solid ${theme.palette.primary.main}`,
          },
        }}
      >
        Skip to main content
      </Box>

      {/* Header with theme toggle and menu controls */}
      <Header
        onMenuClick={handleMobileMenuToggle}
        onThemeToggle={toggleTheme}
      />

      {/* Navigation sidebar with responsive behavior */}
      <Sidebar
        open={isMobile ? mobileMenuOpen : true}
        onClose={() => setMobileMenuOpen(false)}
        variant={isMobile ? 'temporary' : 'permanent'}
      />

      {/* Main content area with proper ARIA landmarks */}
      <MainContainer
        component="main"
        id="main-content"
        role="main"
        aria-label={pageTitle}
        maxWidth={false}
      >
        <ContentWrapper>
          {children}
        </ContentWrapper>

        {/* Footer with consistent styling */}
        <Footer />
      </MainContainer>
    </Box>
  );
};

export default MainLayout;