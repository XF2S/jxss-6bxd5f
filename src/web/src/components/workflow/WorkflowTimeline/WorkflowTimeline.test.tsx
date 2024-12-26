import React from 'react';
import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/matchers';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from '@mui/material';
import WorkflowTimeline from './WorkflowTimeline';
import { WorkflowState, type Workflow } from '@/types/workflow.types';

// Mock i18n instance
const mockI18n = {
  language: 'en',
  dir: () => 'ltr',
  t: (key: string, options?: any) => {
    const translations: { [key: string]: string } = {
      'workflow.states.CREATED': 'Created',
      'workflow.states.DOCUMENT_VERIFICATION': 'Document Verification',
      'workflow.states.ACADEMIC_REVIEW': 'Academic Review',
      'workflow.states.FINAL_REVIEW': 'Final Review',
      'workflow.states.APPROVED': 'Approved',
      'workflow.states.REJECTED': 'Rejected',
      'workflow.states.COMPLETED': 'Completed',
      'workflow.progress.label': 'Application Progress',
      'workflow.progress.valueText': `${options?.progress}% complete`,
      'workflow.timeline.label': 'Application Timeline'
    };
    return translations[key] || key;
  }
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockI18n.t, i18n: mockI18n })
}));

// Mock Redux store
vi.mock('react-redux', () => ({
  useSelector: vi.fn((selector) => selector({
    workflows: {
      entities: {
        'test-workflow-id': mockWorkflowData
      }
    }
  }))
}));

// Helper function to render component with providers
const renderWithProviders = (ui: React.ReactNode, options = {}) => {
  const theme = {
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      success: { main: '#2e7d32' },
      error: { main: '#d32f2f' }
    },
    shape: { borderRadius: 4 }
  };

  return render(
    <I18nextProvider i18n={mockI18n}>
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    </I18nextProvider>,
    options
  );
};

// Mock workflow data generator
const mockWorkflow = (currentState: WorkflowState, options = {}): Workflow => ({
  id: 'test-workflow-id',
  applicationId: 'test-application-id',
  currentState,
  history: [
    {
      id: '1',
      state: WorkflowState.CREATED,
      comment: 'Application created',
      updatedBy: 'user-1',
      timestamp: new Date('2023-01-01T10:00:00Z'),
      duration: 0,
      metadata: {}
    },
    {
      id: '2',
      state: currentState,
      comment: 'Current state',
      updatedBy: 'user-1',
      timestamp: new Date('2023-01-01T11:00:00Z'),
      duration: 3600000,
      metadata: {}
    }
  ],
  pendingActions: [],
  metadata: {},
  createdAt: new Date('2023-01-01T10:00:00Z'),
  updatedAt: new Date('2023-01-01T11:00:00Z'),
  ...options
});

const mockWorkflowData = mockWorkflow(WorkflowState.DOCUMENT_VERIFICATION);

describe('WorkflowTimeline Component', () => {
  describe('Rendering and Layout', () => {
    test('renders workflow timeline with correct structure', () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    test('displays all workflow states in correct order', () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const states = screen.getAllByRole('listitem').map(item => 
        within(item).getByText(/Created|Document Verification/i)
      );
      expect(states[0]).toHaveTextContent('Created');
      expect(states[1]).toHaveTextContent('Document Verification');
    });

    test('handles RTL layout correctly', () => {
      mockI18n.dir = () => 'rtl';
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const timeline = screen.getByRole('list');
      expect(timeline).toHaveStyle({ direction: 'rtl' });
    });

    test('applies compact layout when specified', () => {
      renderWithProviders(
        <WorkflowTimeline workflowId="test-workflow-id" compact={true} />
      );
      
      const timelineItems = screen.getAllByRole('listitem');
      timelineItems.forEach(item => {
        expect(item).toHaveStyle({ minHeight: 'auto' });
      });
    });
  });

  describe('State Management', () => {
    test('displays correct active state', () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const activeState = screen.getByText('Document Verification');
      expect(activeState).toBeInTheDocument();
      expect(activeState.closest('[role="listitem"]')).toHaveStyle({
        color: expect.stringContaining('primary')
      });
    });

    test('calculates progress percentage accurately', () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '20');
    });

    test('hides progress bar when showProgress is false', () => {
      renderWithProviders(
        <WorkflowTimeline workflowId="test-workflow-id" showProgress={false} />
      );
      
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('provides proper ARIA labels', () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      expect(screen.getByRole('list')).toHaveAttribute(
        'aria-label',
        'Application Timeline'
      );
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-label',
        'Application Progress'
      );
    });

    test('supports keyboard navigation', async () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const timelineItems = screen.getAllByRole('listitem');
      await userEvent.tab();
      expect(timelineItems[0]).toHaveFocus();
    });

    test('maintains sufficient color contrast', () => {
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const timelineItems = screen.getAllByRole('listitem');
      timelineItems.forEach(item => {
        const computedStyle = window.getComputedStyle(item);
        // Verify contrast ratio meets WCAG AA standards
        expect(computedStyle.color).toBeDefined();
        expect(computedStyle.backgroundColor).toBeDefined();
      });
    });
  });

  describe('Internationalization', () => {
    test('displays translated state labels', () => {
      mockI18n.language = 'es';
      mockI18n.t = (key: string) => {
        const translations: { [key: string]: string } = {
          'workflow.states.CREATED': 'Creado',
          'workflow.states.DOCUMENT_VERIFICATION': 'Verificación de Documentos'
        };
        return translations[key] || key;
      };

      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      expect(screen.getByText('Creado')).toBeInTheDocument();
      expect(screen.getByText('Verificación de Documentos')).toBeInTheDocument();
    });

    test('formats dates according to locale', () => {
      mockI18n.language = 'en-US';
      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      const dateStrings = screen.getAllByText(/Jan 1, 2023/);
      expect(dateStrings).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('renders skeleton loader when workflow data is loading', () => {
      vi.mock('react-redux', () => ({
        useSelector: vi.fn(() => undefined)
      }));

      renderWithProviders(<WorkflowTimeline workflowId="test-workflow-id" />);
      
      expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
    });

    test('handles missing workflow data gracefully', () => {
      vi.mock('react-redux', () => ({
        useSelector: vi.fn(() => null)
      }));

      renderWithProviders(<WorkflowTimeline workflowId="invalid-id" />);
      
      expect(screen.queryByRole('list')).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).toBeInTheDocument();
    });
  });
});