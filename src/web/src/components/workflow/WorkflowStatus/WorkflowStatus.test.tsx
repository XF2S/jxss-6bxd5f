import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { WorkflowStatus } from './WorkflowStatus';
import { WorkflowState, Workflow, WorkflowStateHistory } from '@/types/workflow.types';
import { workflowApi } from '@/api/workflow.api';

// Mock API calls
vi.mock('@/api/workflow.api', () => ({
  workflowApi: {
    getWorkflow: vi.fn(),
    updateWorkflowState: vi.fn(),
    getWorkflowHistory: vi.fn(),
    validateStateTransition: vi.fn()
  }
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      const translations: { [key: string]: string } = {
        'workflow.loading': 'Loading workflow status...',
        'workflow.error': 'Error: ${error}',
        'workflow.status.title': 'Application Status',
        'workflow.progress.label': 'Progress',
        'workflow.progress.value': '${progress}% complete',
        'workflow.history.title': 'Status History',
        'workflow.state.created': 'Created',
        'workflow.state.document_verification': 'Document Verification',
        'workflow.state.academic_review': 'Academic Review',
        'workflow.state.final_review': 'Final Review',
        'workflow.state.approved': 'Approved',
        'workflow.state.rejected': 'Rejected',
        'workflow.state.completed': 'Completed'
      };
      return params ? translations[key].replace('${error}', params.error) : translations[key];
    }
  })
}));

// Helper function to create mock workflow data
const createMockWorkflow = (state: WorkflowState, options: Partial<Workflow> = {}): Workflow => ({
  id: 'test-workflow-id',
  applicationId: 'test-application-id',
  currentState: state,
  history: [],
  pendingActions: [],
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...options
});

// Helper function to create mock history entries
const createMockHistory = (states: WorkflowState[]): WorkflowStateHistory[] => {
  return states.map((state, index) => ({
    id: `history-${index}`,
    state,
    comment: `Transitioned to ${state}`,
    updatedBy: 'test-user',
    timestamp: new Date(Date.now() - (states.length - index) * 3600000),
    duration: 3600000,
    metadata: {}
  }));
};

describe('WorkflowStatus Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering and Display', () => {
    it('should render loading state initially', () => {
      render(<WorkflowStatus workflowId="test-id" />);
      expect(screen.getByLabelText('Loading workflow status...')).toBeInTheDocument();
    });

    it('should render workflow status with correct state', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.DOCUMENT_VERIFICATION);
      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });

      render(<WorkflowStatus workflowId="test-id" />);

      await waitFor(() => {
        expect(screen.getByText('Document Verification')).toBeInTheDocument();
      });
    });

    it('should render progress bar with correct percentage', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.ACADEMIC_REVIEW);
      const mockHistory = createMockHistory([WorkflowState.CREATED, WorkflowState.DOCUMENT_VERIFICATION]);
      
      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });
      vi.mocked(workflowApi.getWorkflowHistory).mockResolvedValue(mockHistory);

      render(<WorkflowStatus workflowId="test-id" showHistory={true} />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '40');
      });
    });

    it('should apply correct theme styles', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.APPROVED);
      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });

      render(<WorkflowStatus workflowId="test-id" theme="high-contrast" />);

      await waitFor(() => {
        const statusChip = screen.getByText('Approved');
        expect(statusChip).toHaveStyle({ backgroundColor: 'var(--success-color)' });
      });
    });
  });

  describe('State Transitions', () => {
    it('should handle state changes correctly', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.DOCUMENT_VERIFICATION);
      const onStateChange = vi.fn();

      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });

      render(<WorkflowStatus workflowId="test-id" onStateChange={onStateChange} />);

      await waitFor(() => {
        expect(onStateChange).toHaveBeenCalledWith(WorkflowState.DOCUMENT_VERIFICATION);
      });
    });

    it('should refresh data at specified interval', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.ACADEMIC_REVIEW);
      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });

      vi.useFakeTimers();
      render(<WorkflowStatus workflowId="test-id" refreshInterval={5000} />);

      await waitFor(() => {
        expect(workflowApi.getWorkflow).toHaveBeenCalledTimes(1);
      });

      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(workflowApi.getWorkflow).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on API failure', async () => {
      vi.mocked(workflowApi.getWorkflow).mockRejectedValue(new Error('API Error'));

      render(<WorkflowStatus workflowId="test-id" errorBoundary={true} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Error: API Error');
      });
    });

    it('should retry failed requests with exponential backoff', async () => {
      vi.mocked(workflowApi.getWorkflow).mockRejectedValueOnce(new Error('Temporary Error'));
      const mockWorkflow = createMockWorkflow(WorkflowState.CREATED);
      vi.mocked(workflowApi.getWorkflow).mockResolvedValueOnce({ data: mockWorkflow, success: true, message: '' });

      vi.useFakeTimers();
      render(<WorkflowStatus workflowId="test-id" />);

      await waitFor(() => {
        expect(workflowApi.getWorkflow).toHaveBeenCalledTimes(1);
      });

      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(workflowApi.getWorkflow).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.FINAL_REVIEW);
      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });

      render(<WorkflowStatus workflowId="test-id" />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        expect(progressBar).toHaveAttribute('aria-valuetext');
      });
    });

    it('should support keyboard navigation', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.COMPLETED);
      const mockHistory = createMockHistory([
        WorkflowState.CREATED,
        WorkflowState.DOCUMENT_VERIFICATION,
        WorkflowState.COMPLETED
      ]);

      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });
      vi.mocked(workflowApi.getWorkflowHistory).mockResolvedValue(mockHistory);

      render(<WorkflowStatus workflowId="test-id" showHistory={true} />);

      await waitFor(() => {
        const historyItems = screen.getAllByRole('listitem');
        expect(historyItems[0]).toHaveAttribute('tabIndex', '0');
      });
    });

    it('should handle reduced motion preferences', async () => {
      const mockWorkflow = createMockWorkflow(WorkflowState.APPROVED);
      vi.mocked(workflowApi.getWorkflow).mockResolvedValue({ data: mockWorkflow, success: true, message: '' });

      // Mock reduced motion media query
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }));

      render(<WorkflowStatus workflowId="test-id" />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveStyle({ transition: 'none' });
      });
    });
  });
});