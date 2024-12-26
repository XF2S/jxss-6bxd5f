import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ApplicationStatus } from './ApplicationStatus';
import { Application, ApplicationStatus as AppStatus } from '@/types/application.types';
import { Workflow, WorkflowState, WorkflowStateHistory } from '@/types/workflow.types';
import { workflowApi } from '@/api/workflow.api';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock workflow API
vi.mock('@/api/workflow.api', () => ({
  workflowApi: {
    getWorkflow: vi.fn(),
    getWorkflowHistory: vi.fn()
  }
}));

// Mock console.error to prevent noise in test output
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Helper function to render component with React Query provider
const renderWithQueryClient = (ui: React.ReactElement, options = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

// Mock data generators
const mockApplication = (overrides?: Partial<Application>): Application => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  status: AppStatus.SUBMITTED,
  formData: {
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
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
      graduationDate: new Date('2020-05-15'),
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
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  reviewedBy: null,
  reviewedAt: null,
  comments: [],
  ...overrides
});

const mockWorkflow = (overrides?: Partial<Workflow>): Workflow => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  applicationId: '123e4567-e89b-12d3-a456-426614174000',
  currentState: WorkflowState.DOCUMENT_VERIFICATION,
  history: [
    {
      id: '1',
      state: WorkflowState.CREATED,
      comment: 'Application created',
      updatedBy: 'system',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      duration: 0,
      metadata: {}
    },
    {
      id: '2',
      state: WorkflowState.DOCUMENT_VERIFICATION,
      comment: 'Documents under review',
      updatedBy: 'reviewer-1',
      timestamp: new Date('2024-01-02T10:00:00Z'),
      duration: 86400000,
      metadata: {}
    }
  ],
  pendingActions: [],
  metadata: {},
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-02T10:00:00Z'),
  ...overrides
});

describe('ApplicationStatus Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowApi.getWorkflow.mockResolvedValue({ data: mockWorkflow() });
    workflowApi.getWorkflowHistory.mockResolvedValue(mockWorkflow().history);
  });

  it('renders application status correctly', async () => {
    const application = mockApplication();
    renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
      />
    );

    // Verify application ID is displayed
    expect(screen.getByText(`Application #${application.id}`)).toBeInTheDocument();

    // Verify status is displayed correctly
    expect(screen.getByText(`Status: ${application.status.replace('_', ' ')}`)).toBeInTheDocument();

    // Verify progress bar is present
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuetext', expect.stringContaining('%'));
  });

  it('displays workflow timeline correctly', async () => {
    const application = mockApplication();
    const workflow = mockWorkflow();
    workflowApi.getWorkflow.mockResolvedValue({ data: workflow });

    renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
      />
    );

    // Wait for timeline items to be rendered
    await waitFor(() => {
      workflow.history.forEach(item => {
        expect(screen.getByText(item.comment)).toBeInTheDocument();
      });
    });

    // Verify timeline order
    const timelineItems = screen.getAllByRole('listitem');
    expect(timelineItems).toHaveLength(workflow.history.length);
  });

  it('handles loading state correctly', () => {
    const application = mockApplication();
    renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
        isLoading={true}
      />
    );

    // Verify loading skeletons are displayed
    expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
  });

  it('handles error state correctly', async () => {
    const error = new Error('Failed to load workflow');
    workflowApi.getWorkflow.mockRejectedValue(error);

    const application = mockApplication();
    renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
      />
    );

    // Verify error message is displayed
    await waitFor(() => {
      expect(screen.getByText(/error loading workflow/i)).toBeInTheDocument();
    });
  });

  it('triggers status change callback', async () => {
    const onStatusChange = vi.fn();
    const application = mockApplication();

    renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
        onStatusChange={onStatusChange}
      />
    );

    // Simulate status change
    const statusButton = screen.getByRole('button', { name: /change status/i });
    fireEvent.click(statusButton);

    expect(onStatusChange).toHaveBeenCalledWith(expect.any(String));
  });

  it('meets accessibility requirements', async () => {
    const application = mockApplication();
    const { container } = renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
      />
    );

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA attributes
    const statusRegion = screen.getByRole('region');
    expect(statusRegion).toHaveAttribute('aria-label', expect.stringContaining('Application status'));

    // Verify keyboard navigation
    const timelineList = await screen.findByRole('list');
    expect(timelineList).toHaveAttribute('aria-label');
    
    // Verify screen reader text
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuetext');
  });

  it('handles responsive layout correctly', async () => {
    const application = mockApplication();
    
    // Mock window resize
    global.innerWidth = 375; // Mobile viewport
    global.dispatchEvent(new Event('resize'));

    renderWithQueryClient(
      <ApplicationStatus 
        application={application}
        showTimeline={true}
      />
    );

    // Verify compact layout is applied
    const timelineItems = await screen.findAllByRole('listitem');
    timelineItems.forEach(item => {
      expect(item).toHaveStyle({ minHeight: 'auto' });
    });
  });
});