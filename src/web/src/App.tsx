/**
 * @fileoverview Root application component for the Enrollment System
 * Implements core application structure, routing, theme management, and authentication
 * @version 1.0.0
 */

import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import MainLayout from '@/components/layout/MainLayout/MainLayout';
import LoginPage from '@/pages/LoginPage/LoginPage';
import { store, persistor } from '@/store';
import useAuth from '@/hooks/useAuth';
import useTheme from '@/hooks/useTheme';
import { ROUTES } from '@/constants/routes.constants';

// Lazy-loaded components for code splitting
const Dashboard = React.lazy(() => import('@/pages/Dashboard/Dashboard'));
const Applications = React.lazy(() => import('@/pages/Applications/Applications'));
const Documents = React.lazy(() => import('@/pages/Documents/Documents'));
const Profile = React.lazy(() => import('@/pages/Profile/Profile'));
const Settings = React.lazy(() => import('@/pages/Settings/Settings'));

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
  </div>
);

/**
 * Loading fallback component for Suspense
 */
const LoadingFallback: React.FC = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    Loading...
  </div>
);

/**
 * Protected Route component that handles authentication and authorization
 */
const PrivateRoute: React.FC<{
  children: React.ReactNode;
  roles?: string[];
}> = ({ children, roles = [] }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN.path} replace />;
  }

  if (roles.length > 0 && !roles.some(role => user?.roles.includes(role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

/**
 * Root application component that provides core application structure
 */
const App: React.FC = () => {
  const { currentTheme } = useTheme();
  const { refreshToken } = useAuth();

  // Setup token refresh on mount
  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Provider store={store}>
        <PersistGate loading={<LoadingFallback />} persistor={persistor}>
          <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Public routes */}
                  <Route path={ROUTES.AUTH.LOGIN.path} element={<LoginPage />} />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <PrivateRoute>
                        <MainLayout pageTitle="Dashboard">
                          <Dashboard />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />

                  <Route
                    path={ROUTES.APPLICATION.LIST.path}
                    element={
                      <PrivateRoute roles={ROUTES.APPLICATION.LIST.roles}>
                        <MainLayout pageTitle="Applications">
                          <Applications />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />

                  <Route
                    path={ROUTES.DOCUMENT.LIST.path}
                    element={
                      <PrivateRoute roles={ROUTES.DOCUMENT.LIST.roles}>
                        <MainLayout pageTitle="Documents">
                          <Documents />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />

                  <Route
                    path={ROUTES.PROFILE.VIEW.path}
                    element={
                      <PrivateRoute roles={ROUTES.PROFILE.VIEW.roles}>
                        <MainLayout pageTitle="Profile">
                          <Profile />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />

                  <Route
                    path={ROUTES.SETTINGS.GENERAL.path}
                    element={
                      <PrivateRoute roles={ROUTES.SETTINGS.GENERAL.roles}>
                        <MainLayout pageTitle="Settings">
                          <Settings />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />

                  {/* Fallback route */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;