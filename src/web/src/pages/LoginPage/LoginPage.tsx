import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import { useForm } from 'react-hook-form'; // v7.0.0
import * as yup from 'yup'; // v1.0.0
import { styled } from '@mui/material/styles'; // v5.0.0

import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { LoginCredentials } from '@/types/auth.types';

// Validation schema for login form
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(12, 'Password must be at least 12 characters'),
  mfaCode: yup
    .string()
    .matches(/^\d{6}$/, 'MFA code must be 6 digits')
    .when('requiresMfa', {
      is: true,
      then: yup.string().required('MFA code is required'),
    }),
  rememberMe: yup.boolean(),
});

// Styled components
const LoginContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: 'var(--spacing-lg)',
  backgroundColor: 'var(--background-color)',
}));

const LoginForm = styled('form')(({ theme }) => ({
  width: '100%',
  maxWidth: '400px',
  padding: 'var(--spacing-xl)',
  backgroundColor: 'var(--surface-color)',
  borderRadius: '8px',
  boxShadow: 'var(--elevation-2)',
  '@media (max-width: 600px)': {
    padding: 'var(--spacing-lg)',
  },
}));

const FormTitle = styled('h1')({
  fontSize: 'var(--font-size-xl)',
  color: 'var(--text-primary)',
  marginBottom: 'var(--spacing-lg)',
  textAlign: 'center',
});

const FormField = styled('div')({
  marginBottom: 'var(--spacing-md)',
});

const ErrorMessage = styled('div')({
  color: 'var(--error-color)',
  fontSize: 'var(--font-size-sm)',
  marginTop: 'var(--spacing-xs)',
  minHeight: '20px',
});

// Props interface
interface LoginPageProps {
  redirectUrl?: string;
  onLoginSuccess?: () => void;
}

// LoginPage component
export const LoginPage: React.FC<LoginPageProps> = ({
  redirectUrl = '/dashboard',
  onLoginSuccess,
}) => {
  const navigate = useNavigate();
  const { login, verifyMfa, loading, error } = useAuth();
  const [requiresMfa, setRequiresMfa] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<LoginCredentials>({
    resolver: yup.object().shape(loginSchema),
    mode: 'onBlur',
  });

  // Handle form submission
  const onSubmit = useCallback(async (formData: LoginCredentials) => {
    try {
      clearErrors();
      
      if (requiresMfa) {
        await verifyMfa(formData.mfaCode!);
        onLoginSuccess?.();
        navigate(redirectUrl);
        return;
      }

      const response = await login(formData);
      
      if (response?.requiresMfa) {
        setRequiresMfa(true);
        return;
      }

      onLoginSuccess?.();
      navigate(redirectUrl);
    } catch (err: any) {
      setError('root', {
        type: 'manual',
        message: err.message || 'An error occurred during login',
      });
    }
  }, [login, verifyMfa, navigate, redirectUrl, requiresMfa, onLoginSuccess, setError, clearErrors]);

  return (
    <LoginContainer>
      <LoginForm 
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-labelledby="login-title"
      >
        <FormTitle id="login-title">
          {requiresMfa ? 'Enter MFA Code' : 'Sign In'}
        </FormTitle>

        {!requiresMfa && (
          <>
            <FormField>
              <Input
                id="email"
                type="email"
                label="Email"
                {...register('email')}
                error={errors.email?.message}
                aria-describedby="email-error"
                autoComplete="email"
                required
              />
              <ErrorMessage id="email-error" role="alert">
                {errors.email?.message}
              </ErrorMessage>
            </FormField>

            <FormField>
              <Input
                id="password"
                type="password"
                label="Password"
                {...register('password')}
                error={errors.password?.message}
                aria-describedby="password-error"
                autoComplete="current-password"
                required
              />
              <ErrorMessage id="password-error" role="alert">
                {errors.password?.message}
              </ErrorMessage>
            </FormField>

            <FormField>
              <label>
                <input
                  type="checkbox"
                  {...register('rememberMe')}
                  aria-label="Remember me"
                />
                <span>Remember me</span>
              </label>
            </FormField>
          </>
        )}

        {requiresMfa && (
          <FormField>
            <Input
              id="mfaCode"
              type="text"
              label="MFA Code"
              {...register('mfaCode')}
              error={errors.mfaCode?.message}
              aria-describedby="mfa-error"
              autoComplete="one-time-code"
              required
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
            />
            <ErrorMessage id="mfa-error" role="alert">
              {errors.mfaCode?.message}
            </ErrorMessage>
          </FormField>
        )}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          loading={loading}
          disabled={loading}
          aria-busy={loading}
        >
          {requiresMfa ? 'Verify' : 'Sign In'}
        </Button>

        {error && (
          <ErrorMessage role="alert" style={{ marginTop: 'var(--spacing-md)' }}>
            {error.message}
          </ErrorMessage>
        )}
      </LoginForm>
    </LoginContainer>
  );
};

export default LoginPage;