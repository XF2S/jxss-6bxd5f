import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'; // v14.0.0
import { vi } from 'vitest'; // v0.34.0
import { QueryClient, QueryClientProvider } from 'react-query'; // v4.0.0
import { MemoryRouter, Routes, Route } from 'react-router-dom'; // v6.0.0
import { axe } from '@testing-library/jest-dom'; // v5.16.0

import { ApplicationPage } from './ApplicationPage';
import { applicationApi } from '@/api/application.api';
import { useAuth } from '@/hooks/useAuth';
import { ApplicationStatus } from '@/types/application.types';

// Mock API and hooks
vi.mock('@/api/application.api');
vi.mock('@/hooks/useAuth');

// Mock user data
const mockUser = {
  id: '123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  roles: ['APPLICANT'],
  status: 'ACTIVE',
  mfaEnabled: false,
  lastLoginAt: new Date(),
  createdAt: new Date()
};

// Test data
const mockApplication = {
  id: '456',
  userId: mockUser.id,
  status: ApplicationStatus.DRAFT,
  formData: {
    personalInfo: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '1234567890',
      dateOfBirth: new Date('1990-01-01'),
      address: {
        street1: '123 Test St',
        street2: null,
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'Test Country'
      }
    },
    academicInfo: {
      previousInstitution: 'Test University',
      gpa: 3.5,
      graduationDate: new Date('2022-05-01'),
      major: 'Computer Science',
      transcripts: []
    },
    programInfo: {
      programType: 'UNDERGRADUATE',
      intendedMajor: 'Computer Science',
      startTerm: 'Fall 2024',
      fullTime: true,
      specializations: []
    },
    documents: [],
    additionalInfo: {}
  },
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  reviewedBy: null,
  reviewedAt: null,
  comments: []
};

// Helper function to render component with providers
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  // Setup mock auth state
  (useAuth as vi.Mock).mockReturnValue({
    user: mockUser,
    isAuthenticated: true,
    hasPermission: (permission: string) => true,
    loading: false,
    error: null
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ApplicationPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    test('should render loading state initially', () => {
      renderWithProviders(<ApplicationPage />);
      expect(screen.getByLabelText(/loading application data/i)).toBeInTheDocument();
    });

    test('should pass accessibility audit', async () => {
      const { container } = renderWithProviders(<ApplicationPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('should render stepper with correct steps', async () => {
      renderWithProviders(<ApplicationPage />);
      const steps = ['Personal Information', 'Academic Background', 'Program Selection', 'Document Upload', 'Review'];
      
      await waitFor(() => {
        steps.forEach(step => {
          expect(screen.getByText(step)).toBeInTheDocument();
        });
      });
    });

    test('should handle offline state correctly', async () => {
      // Mock offline status
      const mockOnline = vi.spyOn(navigator, 'onLine', 'get');
      mockOnline.mockReturnValue(false);

      renderWithProviders(<ApplicationPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/you are currently offline/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    test('should show validation errors for required fields', async () => {
      renderWithProviders(<ApplicationPage />);
      
      // Try to proceed without filling required fields
      const continueButton = await screen.findByLabelText('Next step');
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/required field/i)).toBeInTheDocument();
      });
    });

    test('should validate email format', async () => {
      renderWithProviders(<ApplicationPage />);
      
      const emailInput = await screen.findByLabelText(/email/i);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      });
    });

    test('should handle cross-field validation', async () => {
      renderWithProviders(<ApplicationPage />);
      
      // Mock form data with future graduation date
      const graduationDateInput = await screen.findByLabelText(/graduation date/i);
      fireEvent.change(graduationDateInput, { target: { value: '2030-01-01' } });
      fireEvent.blur(graduationDateInput);

      await waitFor(() => {
        expect(screen.getByText(/date cannot be in the future/i)).toBeInTheDocument();
      });
    });
  });

  describe('Document Upload', () => {
    test('should handle file upload correctly', async () => {
      renderWithProviders(<ApplicationPage />);
      
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const uploadInput = await screen.findByLabelText(/upload/i);
      
      fireEvent.change(uploadInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(applicationApi.uploadDocument).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ name: 'test.pdf' })
        );
      });
    });

    test('should validate file size restrictions', async () => {
      renderWithProviders(<ApplicationPage />);
      
      const largeFile = new File(['x'.repeat(5 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      const uploadInput = await screen.findByLabelText(/upload/i);
      
      fireEvent.change(uploadInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file size exceeds limit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Application Submission', () => {
    test('should handle successful submission', async () => {
      (applicationApi.submitApplication as vi.Mock).mockResolvedValueOnce({
        ...mockApplication,
        status: ApplicationStatus.SUBMITTED,
        submittedAt: new Date()
      });

      renderWithProviders(<ApplicationPage />);
      
      const submitButton = await screen.findByLabelText('Submit application');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/application submitted successfully/i)).toBeInTheDocument();
      });
    });

    test('should handle submission errors', async () => {
      (applicationApi.submitApplication as vi.Mock).mockRejectedValueOnce(new Error('Submission failed'));

      renderWithProviders(<ApplicationPage />);
      
      const submitButton = await screen.findByLabelText('Submit application');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to submit application/i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Tracking', () => {
    test('should display current application status', async () => {
      renderWithProviders(<ApplicationPage />);
      
      await waitFor(() => {
        expect(screen.getByText(new RegExp(mockApplication.status, 'i'))).toBeInTheDocument();
      });
    });

    test('should update status in real-time', async () => {
      const { rerender } = renderWithProviders(<ApplicationPage />);
      
      // Simulate status update
      const updatedApplication = {
        ...mockApplication,
        status: ApplicationStatus.UNDER_REVIEW
      };

      rerender(<ApplicationPage />);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(updatedApplication.status, 'i'))).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Mock network error
      (applicationApi.createApplication as vi.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<ApplicationPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to save changes/i)).toBeInTheDocument();
      });
    });

    test('should handle session expiration', async () => {
      // Mock auth error
      (useAuth as vi.Mock).mockReturnValueOnce({
        ...mockUser,
        isAuthenticated: false,
        error: { message: 'Session expired' }
      });

      renderWithProviders(<ApplicationPage />);

      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
      });
    });
  });
});