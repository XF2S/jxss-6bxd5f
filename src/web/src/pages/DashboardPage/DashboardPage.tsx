/**
 * @fileoverview Main dashboard page component implementing Material Design 3 specifications
 * with comprehensive accessibility features and real-time updates.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Skeleton,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Upload as UploadIcon,
  Payment as PaymentIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// Internal imports
import MainLayout from '@/components/layout/MainLayout/MainLayout';
import ApplicationList from '@/components/application/ApplicationList/ApplicationList';
import { useAuth } from '@/hooks/useAuth';
import { DashboardMetrics, RecentActivity } from '@/types/application.types';
import { ROUTES } from '@/constants/routes.constants';

// Dashboard metrics polling interval (in milliseconds)
const METRICS_REFRESH_INTERVAL = 30000;

/**
 * Main dashboard page component with role-based content and real-time updates
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, hasPermission } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${process.env.VITE_WS_URL}/dashboard`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'METRICS_UPDATE') {
        setMetrics(data.metrics);
      } else if (data.type === 'ACTIVITY_UPDATE') {
        setActivities((prev) => [data.activity, ...prev].slice(0, 5));
      }
    };

    ws.onerror = () => {
      setError('Real-time updates connection failed');
    };

    return () => ws.close();
  }, []);

  // Initial data fetch and polling
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsResponse, activitiesResponse] = await Promise.all([
        fetch('/api/v1/dashboard/metrics'),
        fetch('/api/v1/dashboard/activities')
      ]);

      if (!metricsResponse.ok || !activitiesResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const metricsData = await metricsResponse.json();
      const activitiesData = await activitiesResponse.json();

      setMetrics(metricsData);
      setActivities(activitiesData);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, METRICS_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Quick action handlers
  const handleNewApplication = useCallback(async () => {
    try {
      navigate(ROUTES.APPLICATION.NEW.path);
    } catch (err) {
      setError('Failed to create new application');
      console.error('New application error:', err);
    }
  }, [navigate]);

  const handleDocumentUpload = useCallback(async () => {
    try {
      navigate(ROUTES.DOCUMENT.UPLOAD.path);
    } catch (err) {
      setError('Failed to navigate to document upload');
      console.error('Document upload error:', err);
    }
  }, [navigate]);

  // Role-based content visibility
  const canCreateApplication = useMemo(() => {
    return hasPermission('application.submit');
  }, [hasPermission]);

  const canUploadDocuments = useMemo(() => {
    return hasPermission('document.upload');
  }, [hasPermission]);

  // Loading skeletons
  if (loading) {
    return (
      <MainLayout>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
          <Grid item xs={12}>
            <Skeleton variant="rectangular" height={400} />
          </Grid>
        </Grid>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Metrics Section */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Applications Overview
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="h4" color="primary">
                    {metrics?.activeApplications || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="warning.main">
                    {metrics?.pendingApplications || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Pending
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="success.main">
                    {metrics?.completedApplications || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Completed
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                {canCreateApplication && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleNewApplication}
                    fullWidth
                  >
                    New Application
                  </Button>
                )}
                {canUploadDocuments && (
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={handleDocumentUpload}
                    fullWidth
                  >
                    Upload Document
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Applications */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" component="h2">
                  Recent Applications
                </Typography>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={fetchDashboardData}
                  aria-label="Refresh applications list"
                >
                  Refresh
                </Button>
              </Box>
              <ApplicationList
                userId={user?.id}
                initialPageSize={5}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </MainLayout>
  );
};

export default React.memo(DashboardPage);