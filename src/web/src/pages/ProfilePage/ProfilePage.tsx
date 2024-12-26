import React, { memo, useCallback, useState } from 'react';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import {
  Grid,
  Typography,
  Switch,
  CircularProgress,
  Alert,
  TextField,
  Button,
  Divider,
  Box,
  FormControlLabel,
  Select,
  MenuItem,
} from '@mui/material';

import Card from '@/components/common/Card/Card';
import { useAuth } from '@/hooks/useAuth';
import { User } from '@/types/auth.types';

// Version 5.0.0 @mui/material
// Version 18.0.0 react
// Version 12.0.0 react-i18next
// Version 4.0.0 react-error-boundary

// Interfaces for profile management
interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  email: string;
  preferences: UserPreferences;
  notifications: NotificationSettings;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system' | 'high-contrast';
  language: string;
  timezone: string;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

// Styled components
const ProfileContainer = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  maxWidth: '1200px',
  margin: '0 auto',
  minHeight: '100vh',
  '@media (max-width: 600px)': {
    padding: theme.spacing(2),
  },
}));

const ProfileSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  transition: theme.transitions.create(['box-shadow', 'transform']),
}));

const ErrorFallback = styled('div')(({ theme }) => ({
  padding: theme.spacing(3),
  color: theme.palette.error.main,
  textAlign: 'center',
}));

/**
 * ProfilePage component implementing Material Design 3 specifications
 * for user profile management with comprehensive accessibility support
 */
const ProfilePage: React.FC = memo(() => {
  const { t } = useTranslation();
  const { user, loading, updateProfile, toggleMfa } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileUpdateData | null>(null);

  // Initialize form data when user data is available
  React.useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        preferences: {
          theme: 'system',
          language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        notifications: {
          email: true,
          push: true,
          frequency: 'daily',
        },
      });
    }
  }, [user]);

  const handleProfileUpdate = useCallback(async (data: ProfileUpdateData) => {
    try {
      await updateProfile(data);
      setIsEditing(false);
      // Show success message
    } catch (error) {
      console.error('Profile update failed:', error);
      // Show error message
    }
  }, [updateProfile]);

  const handleMfaToggle = useCallback(async (enabled: boolean) => {
    try {
      await toggleMfa(enabled);
      // Show success message
    } catch (error) {
      console.error('MFA toggle failed:', error);
      // Show error message
    }
  }, [toggleMfa]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (!user || !formData) {
    return (
      <Alert severity="error" aria-live="polite">
        {t('profile.error.userNotFound')}
      </Alert>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={({ error }) => (
      <ErrorFallback role="alert">
        <Typography variant="h6">{t('common.error')}</Typography>
        <Typography>{error.message}</Typography>
      </ErrorFallback>
    )}>
      <ProfileContainer>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('profile.title')}
        </Typography>

        <Grid container spacing={3}>
          {/* Personal Information Section */}
          <Grid item xs={12} md={6}>
            <ProfileSection>
              <Card elevation={2}>
                <Typography variant="h6" gutterBottom>
                  {t('profile.sections.personal')}
                </Typography>
                <Box component="form" noValidate autoComplete="off">
                  <TextField
                    fullWidth
                    label={t('profile.fields.firstName')}
                    value={formData.firstName}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({
                      ...formData,
                      firstName: e.target.value
                    })}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label={t('profile.fields.lastName')}
                    value={formData.lastName}
                    disabled={!isEditing}
                    onChange={(e) => setFormData({
                      ...formData,
                      lastName: e.target.value
                    })}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label={t('profile.fields.email')}
                    value={formData.email}
                    disabled={!isEditing}
                    type="email"
                    onChange={(e) => setFormData({
                      ...formData,
                      email: e.target.value
                    })}
                    margin="normal"
                  />
                </Box>
              </Card>
            </ProfileSection>
          </Grid>

          {/* Security Settings Section */}
          <Grid item xs={12} md={6}>
            <ProfileSection>
              <Card elevation={2}>
                <Typography variant="h6" gutterBottom>
                  {t('profile.sections.security')}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={user.mfaEnabled}
                      onChange={(e) => handleMfaToggle(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={t('profile.security.mfa')}
                />
                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => {/* Handle password change */}}
                >
                  {t('profile.security.changePassword')}
                </Button>
              </Card>
            </ProfileSection>
          </Grid>

          {/* Preferences Section */}
          <Grid item xs={12}>
            <ProfileSection>
              <Card elevation={2}>
                <Typography variant="h6" gutterBottom>
                  {t('profile.sections.preferences')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Select
                      fullWidth
                      value={formData.preferences.theme}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          theme: e.target.value as UserPreferences['theme']
                        }
                      })}
                      disabled={!isEditing}
                      label={t('profile.preferences.theme')}
                    >
                      <MenuItem value="light">{t('profile.preferences.themes.light')}</MenuItem>
                      <MenuItem value="dark">{t('profile.preferences.themes.dark')}</MenuItem>
                      <MenuItem value="system">{t('profile.preferences.themes.system')}</MenuItem>
                      <MenuItem value="high-contrast">{t('profile.preferences.themes.highContrast')}</MenuItem>
                    </Select>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Select
                      fullWidth
                      value={formData.preferences.language}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          language: e.target.value as string
                        }
                      })}
                      disabled={!isEditing}
                      label={t('profile.preferences.language')}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="es">Español</MenuItem>
                      <MenuItem value="fr">Français</MenuItem>
                    </Select>
                  </Grid>
                </Grid>
              </Card>
            </ProfileSection>
          </Grid>
        </Grid>

        <Box display="flex" justifyContent="flex-end" gap={2} mt={3}>
          {isEditing ? (
            <>
              <Button
                variant="outlined"
                onClick={() => setIsEditing(false)}
                aria-label={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleProfileUpdate(formData)}
                aria-label={t('common.save')}
              >
                {t('common.save')}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={() => setIsEditing(true)}
              aria-label={t('profile.actions.edit')}
            >
              {t('profile.actions.edit')}
            </Button>
          )}
        </Box>
      </ProfileContainer>
    </ErrorBoundary>
  );
});

ProfilePage.displayName = 'ProfilePage';

export default ProfilePage;