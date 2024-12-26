import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ApplicationList } from './ApplicationList';
import { Application, ApplicationStatus, ProgramType } from '../../../types/application.types';
import { applicationApi } from '../../../api/application.api';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock API calls
vi.mock('../../../api/application.api');

// Constants for testing
const BREAKPOINTS = {
  mobile: 320,
  tablet: 768,
  desktop: 1024,
  large: 1440
};

const TEST_IDS = {
  applicationList: 'application-list',
  pagination: 'pagination-controls',
  statusFilter: 'status-filter',
  loadingSpinner: 'loading-spinner',
  errorMessage: 'error-message'
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

  // Set window size if provided
  if (options.windowWidth) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: options.windowWidth
    });
    window.dispatchEvent(new Event('resize'));
  }

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    ),
    queryClient
  };
};

// Helper function to generate mock applications
const generateMockApplications = (count: number, statusDistribution = {}): Application[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `app-${index}`,
    userId: `user-${index}`,
    status: statusDistribution[index] || ApplicationStatus.SUBMITTED,
    formData: {
      personalInfo: {
        firstName: `John${index}`,
        lastName: `Doe${index}`,
        email: `john${index}@example.com`,
        phone: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        address: {
          street1: '123 Main St',
          street2: null,
          city: 'Anytown',
          state: 'ST',
          zipCode: '12345',
          country: 'USA'
        }
      },
      academicInfo: {
        previousInstitution: 'Previous University',
        gpa: 3.5,
        graduationDate: new Date('2022-05-15'),
        major: 'Computer Science',
        transcripts: []
      },
      programInfo: {
        programType: ProgramType.UNDERGRADUATE,
        intendedMajor: 'Computer Science',
        startTerm: 'Fall 2024',
        fullTime: true,
        specializations: []
      },
      documents: [],
      additionalInfo: {}
    },
    submittedAt: new Date('2023-01-01'),
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    reviewedBy: null,
    reviewedAt: null,
    comments: []
  }));
};

describe('ApplicationList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders without crashing and meets accessibility standards', async () => {
    const mockApplications = generateMockApplications(5);
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: mockApplications,
      total: mockApplications.length
    });

    const { container } = renderWithProviders(<ApplicationList />);
    
    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('displays loading state with skeleton loader while fetching', () => {
    vi.mocked(applicationApi.getUserApplications).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderWithProviders(<ApplicationList />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders application list with correct data and formatting', async () => {
    const mockApplications = generateMockApplications(3);
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: mockApplications,
      total: mockApplications.length
    });

    renderWithProviders(<ApplicationList />);

    await waitFor(() => {
      mockApplications.forEach(app => {
        expect(screen.getByText(app.id.slice(0, 8))).toBeInTheDocument();
        expect(screen.getByText(app.formData.programInfo.intendedMajor)).toBeInTheDocument();
      });
    });
  });

  it('handles pagination with correct page size and navigation', async () => {
    const mockApplications = generateMockApplications(15);
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: mockApplications.slice(0, 10),
      total: mockApplications.length
    });

    renderWithProviders(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    // Test pagination navigation
    const nextButton = screen.getByRole('button', { name: /next/i });
    await userEvent.click(nextButton);

    expect(applicationApi.getUserApplications).toHaveBeenCalledWith(2, 10, expect.any(Object));
  });

  it('maintains responsive layout at all specified breakpoints', async () => {
    const mockApplications = generateMockApplications(5);
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: mockApplications,
      total: mockApplications.length
    });

    // Test mobile layout
    const { rerender } = renderWithProviders(<ApplicationList />, {
      windowWidth: BREAKPOINTS.mobile
    });
    await waitFor(() => {
      expect(screen.getByRole('table')).toHaveStyle({ width: '100%' });
    });

    // Test desktop layout
    rerender(<ApplicationList />);
    Object.defineProperty(window, 'innerWidth', {
      value: BREAKPOINTS.desktop
    });
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  it('handles real-time status updates correctly', async () => {
    const mockApplications = generateMockApplications(1);
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: mockApplications,
      total: mockApplications.length
    });

    const { queryClient } = renderWithProviders(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByText(mockApplications[0].status)).toBeInTheDocument();
    });

    // Simulate status update
    const updatedApplication = {
      ...mockApplications[0],
      status: ApplicationStatus.APPROVED
    };

    queryClient.setQueryData(['applications'], {
      data: [updatedApplication],
      total: 1
    });

    await waitFor(() => {
      expect(screen.getByText(ApplicationStatus.APPROVED)).toBeInTheDocument();
    });
  });

  it('displays appropriate error states with retry option', async () => {
    const errorMessage = 'Failed to fetch applications';
    vi.mocked(applicationApi.getUserApplications).mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByText(/error loading applications/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('handles empty states with appropriate messaging', async () => {
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: [],
      total: 0
    });

    renderWithProviders(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText(/no applications found/i)).toBeInTheDocument();
    });
  });

  it('performs within performance benchmarks', async () => {
    const startTime = performance.now();
    const mockApplications = generateMockApplications(100);
    vi.mocked(applicationApi.getUserApplications).mockResolvedValue({
      data: mockApplications,
      total: mockApplications.length
    });

    renderWithProviders(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render within 200ms
    expect(renderTime).toBeLessThan(200);
  });
});