import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

import { RegisterCredentials } from '@/types/auth.types';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/useAuth';
import Input from '@/components/common/Input';
import { VALIDATION_PATTERNS } from '@/constants/validation.constants';
import { AUTH_CONFIG } from '@/config/auth.config';

// Enhanced validation schema with security requirements
const formSchema = yup.object().shape({
  firstName: yup
    .string()
    .required('First name is required')
    .matches(VALIDATION_PATTERNS.UNICODE_NAME, 'Please enter a valid first name')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters'),
  
  lastName: yup
    .string()
    .required('Last name is required')
    .matches(VALIDATION_PATTERNS.UNICODE_NAME, 'Please enter a valid last name')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters'),
  
  email: yup
    .string()
    .required('Email is required')
    .matches(VALIDATION_PATTERNS.EMAIL, 'Please enter a valid email address')
    .max(255, 'Email must not exceed 255 characters'),
  
  password: yup
    .string()
    .required('Password is required')
    .min(AUTH_CONFIG.PASSWORD_REQUIREMENTS.minLength, 
      `Password must be at least ${AUTH_CONFIG.PASSWORD_REQUIREMENTS.minLength} characters`)
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
    .test('unique-chars', 
      `Password must contain at least ${AUTH_CONFIG.PASSWORD_REQUIREMENTS.minUniqueChars} unique characters`,
      value => new Set(value).size >= AUTH_CONFIG.PASSWORD_REQUIREMENTS.minUniqueChars),
  
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  
  acceptedTerms: yup
    .boolean()
    .oneOf([true], 'You must accept the terms and conditions')
});

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useAuth();
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors
  } = useForm<RegisterCredentials>({
    resolver: yupResolver(formSchema),
    mode: 'onBlur'
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Enhanced form submission handler with security features
  const onSubmit = useCallback(async (formData: RegisterCredentials) => {
    try {
      clearErrors();
      setRegistrationError(null);

      // Generate browser fingerprint for enhanced security
      const fpPromise = import('@fingerprintjs/fingerprintjs').then(FingerprintJS => FingerprintJS.load());
      const fp = await fpPromise;
      const result = await fp.get();

      const response = await authApi.register({
        ...formData,
        deviceFingerprint: result.visitorId
      });

      // Navigate to email verification page on success
      navigate('/verify-email', { 
        state: { email: formData.email }
      });

    } catch (error: any) {
      console.error('Registration failed:', error);
      
      // Handle specific validation errors
      if (error.code === 'VALIDATION_ERROR') {
        Object.entries(error.details).forEach(([field, message]) => {
          setError(field as keyof RegisterCredentials, {
            type: 'manual',
            message: message as string
          });
        });
      } else {
        setRegistrationError(error.message || 'Registration failed. Please try again.');
      }
    }
  }, [clearErrors, navigate, setError]);

  return (
    <div className="register-page" role="main" aria-labelledby="register-title">
      <h1 id="register-title" className="register-title">
        Create Account
      </h1>

      {/* Error Alert */}
      {registrationError && (
        <div 
          role="alert" 
          className="error-alert"
          aria-live="polite"
        >
          {registrationError}
        </div>
      )}

      <form 
        onSubmit={handleSubmit(onSubmit)} 
        className="register-form"
        noValidate
      >
        {/* First Name Field */}
        <Input
          id="firstName"
          type="text"
          label="First Name"
          error={errors.firstName}
          {...register('firstName')}
          autoComplete="given-name"
          required
          aria-required="true"
        />

        {/* Last Name Field */}
        <Input
          id="lastName"
          type="text"
          label="Last Name"
          error={errors.lastName}
          {...register('lastName')}
          autoComplete="family-name"
          required
          aria-required="true"
        />

        {/* Email Field */}
        <Input
          id="email"
          type="email"
          label="Email Address"
          error={errors.email}
          {...register('email')}
          autoComplete="email"
          required
          aria-required="true"
        />

        {/* Password Field */}
        <Input
          id="password"
          type="password"
          label="Password"
          error={errors.password}
          {...register('password')}
          autoComplete="new-password"
          required
          aria-required="true"
        />

        {/* Confirm Password Field */}
        <Input
          id="confirmPassword"
          type="password"
          label="Confirm Password"
          error={errors.confirmPassword}
          {...register('confirmPassword')}
          autoComplete="new-password"
          required
          aria-required="true"
        />

        {/* Terms and Conditions */}
        <div className="terms-container">
          <label className="checkbox-label">
            <input
              type="checkbox"
              {...register('acceptedTerms')}
              aria-describedby="terms-error"
            />
            <span>I accept the Terms and Conditions</span>
          </label>
          {errors.acceptedTerms && (
            <span id="terms-error" className="error-message" role="alert">
              {errors.acceptedTerms.message}
            </span>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      {/* Login Link */}
      <div className="login-link">
        <span>Already have an account? </span>
        <a href="/login" className="link">
          Log in
        </a>
      </div>
    </div>
  );
};

export default RegisterPage;