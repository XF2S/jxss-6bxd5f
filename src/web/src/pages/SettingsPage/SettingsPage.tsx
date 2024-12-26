/**
 * @fileoverview Settings page component providing comprehensive user preferences management
 * Implements theme, notification, security, and accessibility settings with persistence
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  Contrast,
  Notifications,
  Security,
  Accessibility,
  Save
} from '@mui/icons-material';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNotification } from '@/hooks/useNotification';
import { ThemeMode } from '@/config/theme.config';
import { NotificationPriority } from '@/types/notification.types';

/**
 * Settings page component providing comprehensive user preferences management
 */
const SettingsPage: React.FC = () => {
  const { user, updateSecuritySettings } = useAuth();
  const { themeMode, setTheme } = useTheme();
  const { notificationPreferences, updatePreferences } = useNotification();

  // Local state for settings
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [securitySettings, setSecuritySettings] = useState({
    mfaEnabled: user?.mfaEnabled || false,
    loginNotifications: true,
    sessionTimeout: 30,
    passwordChangeRequired: false
  });

  // Handle theme changes
  const handleThemeChange = useCallback(async (newThemeMode: ThemeMode) => {
    try {
      await setTheme(newThemeMode);
      setSuccess('Theme settings updated successfully');
    } catch (error) {
      setError('Failed to update theme settings');
    }
  }, [setTheme]);

  // Handle notification preference changes
  const handleNotificationPreferences = useCallback(async (
    category: string,
    enabled: boolean,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ) => {
    try {
      setLoading(true);
      await updatePreferences({
        [category]: {
          enabled,
          priority
        }
      });
      setSuccess('Notification preferences updated successfully');
    } catch (error) {
      setError('Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  }, [updatePreferences]);

  // Handle security settings changes
  const handleSecuritySettings = useCallback(async (setting: keyof typeof securitySettings, value: boolean | number) => {
    try {
      setLoading(true);
      await updateSecuritySettings({
        ...securitySettings,
        [setting]: value
      });
      setSecuritySettings(prev => ({
        ...prev,
        [setting]: value
      }));
      setSuccess('Security settings updated successfully');
    } catch (error) {
      setError('Failed to update security settings');
    } finally {
      setLoading(false);
    }
  }, [securitySettings, updateSecuritySettings]);

  // Clear messages after delay
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>

        {/* Theme Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Brightness4 sx={{ mr: 1 }} />
            Theme Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Theme Mode</InputLabel>
                <Select
                  value={themeMode}
                  onChange={(e) => handleThemeChange(e.target.value as ThemeMode)}
                  label="Theme Mode"
                >
                  <MenuItem value={ThemeMode.LIGHT}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Brightness7 sx={{ mr: 1 }} />
                      Light Mode
                    </Box>
                  </MenuItem>
                  <MenuItem value={ThemeMode.DARK}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Brightness4 sx={{ mr: 1 }} />
                      Dark Mode
                    </Box>
                  </MenuItem>
                  <MenuItem value={ThemeMode.HIGH_CONTRAST}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Contrast sx={{ mr: 1 }} />
                      High Contrast
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Notification Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Notifications sx={{ mr: 1 }} />
            Notification Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationPreferences?.email || false}
                    onChange={(e) => handleNotificationPreferences('email', e.target.checked)}
                  />
                }
                label="Email Notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationPreferences?.inApp || false}
                    onChange={(e) => handleNotificationPreferences('inApp', e.target.checked)}
                  />
                }
                label="In-App Notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Notification Priority</InputLabel>
                <Select
                  value={notificationPreferences?.priority || NotificationPriority.MEDIUM}
                  onChange={(e) => handleNotificationPreferences('priority', true, e.target.value as NotificationPriority)}
                  label="Notification Priority"
                >
                  <MenuItem value={NotificationPriority.HIGH}>High Priority</MenuItem>
                  <MenuItem value={NotificationPriority.MEDIUM}>Medium Priority</MenuItem>
                  <MenuItem value={NotificationPriority.LOW}>Low Priority</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Security Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Security sx={{ mr: 1 }} />
            Security Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={securitySettings.mfaEnabled}
                    onChange={(e) => handleSecuritySettings('mfaEnabled', e.target.checked)}
                  />
                }
                label="Enable Two-Factor Authentication"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={securitySettings.loginNotifications}
                    onChange={(e) => handleSecuritySettings('loginNotifications', e.target.checked)}
                  />
                }
                label="Login Notifications"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Session Timeout (minutes)"
                value={securitySettings.sessionTimeout}
                onChange={(e) => handleSecuritySettings('sessionTimeout', parseInt(e.target.value))}
                InputProps={{ inputProps: { min: 5, max: 120 } }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Accessibility Settings */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Accessibility sx={{ mr: 1 }} />
            Accessibility Settings
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={themeMode === ThemeMode.HIGH_CONTRAST}
                    onChange={(e) => handleThemeChange(e.target.checked ? ThemeMode.HIGH_CONTRAST : ThemeMode.LIGHT)}
                  />
                }
                label="High Contrast Mode"
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Status Messages */}
        <Snackbar
          open={!!success}
          autoHideDuration={5000}
          onClose={() => setSuccess(null)}
        >
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!error}
          autoHideDuration={5000}
          onClose={() => setError(null)}
        >
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Snackbar>

        {/* Loading Indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default SettingsPage;