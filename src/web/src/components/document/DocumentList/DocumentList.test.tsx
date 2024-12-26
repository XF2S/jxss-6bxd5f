import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import DocumentList from './DocumentList';
import { Document, DocumentStatus, VerificationStatus } from '@/types/document.types';
import { documentApi } from '@/api/document.api';
import { useTheme } from '@/hooks/useTheme';
import { ThemeMode } from '@/config/theme.config';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
vi.mock('@/api/document.api');
vi.mock('@/hooks/useTheme');

// Test data
const mockDocuments: Document[] = [
  {
    id: '1',
    applicationId: 'app-1',
    fileName: 'transcript.pdf',
    mimeType: 'application/pdf',
    storagePath: '/documents/transcript.pdf',
    fileSize: 1024 * 1024, // 1MB
    uploadedAt: new Date('2023-01-01'),
    status: DocumentStatus.UPLOADED,
    verificationStatus: VerificationStatus.VERIFIED,
    downloadUrl: 'https://example.com/documents/transcript.pdf',
    lastModifiedAt: new Date('2023-01-01'),
    verifiedAt: new Date('2023-01-02'),
    verifiedBy: 'admin@example.com',
    rejectionReason: null
  },
  {
    id: '2',
    applicationId: 'app-1',
    fileName: 'passport.jpg',
    mimeType: 'image/jpeg',
    storagePath: '/documents/passport.jpg',
    fileSize: 512 * 1024, // 512KB
    uploadedAt: new Date('2023-01-02'),
    status: DocumentStatus.UPLOADED,
    verificationStatus: VerificationStatus.PENDING,
    downloadUrl: 'https://example.com/documents/passport.jpg',
    lastModifiedAt: new Date('2023-01-02'),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null
  }
];

// Setup function
const setup = () => {
  // Mock API responses
  vi.mocked(documentApi.listDocuments).mockResolvedValue({
    documents: mockDocuments,
    total: mockDocuments.length,
    page: 1,
    pageSize: 10,
    hasMore: false
  });

  // Mock theme hook
  vi.mocked(useTheme).mockReturnValue({
    currentTheme: {} as any,
    themeMode: ThemeMode.LIGHT,
    toggleTheme: vi.fn(),
    setTheme: vi.fn()
  });

  const user = userEvent.setup();
  const onDocumentSelect = vi.fn();
  const onDocumentDelete = vi.fn();
  const onError = vi.fn();

  return {
    user,
    onDocumentSelect,
    onDocumentDelete,
    onError,
    renderComponent: (props = {}) => render(
      <DocumentList
        applicationId="app-1"
        onDocumentSelect={onDocumentSelect}
        onDocumentDelete={onDocumentDelete}
        onError={onError}
        {...props}
      />
    )
  };
};

describe('DocumentList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Document Management', () => {
    it('renders document list with correct data and metadata', async () => {
      const { renderComponent } = setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('transcript.pdf')).toBeInTheDocument();
        expect(screen.getByText('passport.jpg')).toBeInTheDocument();
      });

      // Verify file sizes are formatted correctly
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('512.0 KB')).toBeInTheDocument();

      // Verify status badges
      const verifiedBadge = screen.getByText('VERIFIED');
      expect(verifiedBadge).toHaveClass('status-badge', 'status-verified');

      const pendingBadge = screen.getByText('PENDING');
      expect(pendingBadge).toHaveClass('status-badge', 'status-pending');
    });

    it('handles document selection', async () => {
      const { renderComponent, onDocumentSelect, user } = setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('transcript.pdf')).toBeInTheDocument();
      });

      await user.click(screen.getByText('transcript.pdf'));
      expect(onDocumentSelect).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('handles document deletion with confirmation', async () => {
      const { renderComponent, onDocumentDelete, user } = setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /delete/i })[0]).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await user.click(deleteButton);

      expect(onDocumentDelete).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('handles API errors gracefully', async () => {
      const error = new Error('API Error');
      vi.mocked(documentApi.listDocuments).mockRejectedValue(error);

      const { renderComponent, onError } = setup();
      renderComponent();

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('User Interface', () => {
    it('renders correctly across all breakpoints', async () => {
      const { renderComponent } = setup();
      const { container } = renderComponent();

      // Test mobile viewport
      window.innerWidth = 320;
      fireEvent(window, new Event('resize'));
      expect(container).toMatchSnapshot('mobile');

      // Test tablet viewport
      window.innerWidth = 768;
      fireEvent(window, new Event('resize'));
      expect(container).toMatchSnapshot('tablet');

      // Test desktop viewport
      window.innerWidth = 1024;
      fireEvent(window, new Event('resize'));
      expect(container).toMatchSnapshot('desktop');
    });

    it('supports light and dark themes', async () => {
      const { renderComponent } = setup();
      const { rerender } = renderComponent();

      // Test light theme
      vi.mocked(useTheme).mockReturnValue({
        currentTheme: {} as any,
        themeMode: ThemeMode.LIGHT,
        toggleTheme: vi.fn(),
        setTheme: vi.fn()
      });
      rerender(
        <DocumentList
          applicationId="app-1"
          onDocumentSelect={vi.fn()}
          onDocumentDelete={vi.fn()}
        />
      );
      expect(screen.getByRole('region')).toHaveStyle({
        backgroundColor: 'var(--surface-color)'
      });

      // Test dark theme
      vi.mocked(useTheme).mockReturnValue({
        currentTheme: {} as any,
        themeMode: ThemeMode.DARK,
        toggleTheme: vi.fn(),
        setTheme: vi.fn()
      });
      rerender(
        <DocumentList
          applicationId="app-1"
          onDocumentSelect={vi.fn()}
          onDocumentDelete={vi.fn()}
        />
      );
      expect(screen.getByRole('region')).toHaveStyle({
        backgroundColor: 'var(--surface-color)'
      });
    });

    it('handles high contrast mode properly', async () => {
      vi.mocked(useTheme).mockReturnValue({
        currentTheme: {} as any,
        themeMode: ThemeMode.HIGH_CONTRAST,
        toggleTheme: vi.fn(),
        setTheme: vi.fn()
      });

      const { renderComponent } = setup();
      renderComponent();

      await waitFor(() => {
        const statusBadges = screen.getAllByRole('status');
        statusBadges.forEach(badge => {
          expect(badge).toHaveStyle({
            border: '3px solid currentColor'
          });
        });
      });
    });

    it('supports RTL layout', async () => {
      const { renderComponent } = setup();
      const { container } = renderComponent();

      document.dir = 'rtl';
      expect(container).toMatchSnapshot('rtl');
      document.dir = 'ltr';
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA standards', async () => {
      const { renderComponent } = setup();
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('transcript.pdf')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { renderComponent, onDocumentSelect, user } = setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('transcript.pdf')).toBeInTheDocument();
      });

      // Tab to first document
      await user.tab();
      expect(screen.getByText('transcript.pdf')).toHaveFocus();

      // Press Enter to select
      await user.keyboard('{Enter}');
      expect(onDocumentSelect).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('provides proper ARIA attributes', async () => {
      const { renderComponent } = setup();
      renderComponent();

      await waitFor(() => {
        const table = screen.getByRole('region', { name: /document list/i });
        expect(table).toHaveAttribute('aria-label', 'Document List');

        const statusBadges = screen.getAllByRole('status');
        statusBadges.forEach(badge => {
          expect(badge).toHaveAttribute('aria-label');
        });
      });
    });

    it('works with screen readers', async () => {
      const { renderComponent } = setup();
      renderComponent();

      await waitFor(() => {
        const documentNames = screen.getAllByRole('button', { name: /view document/i });
        documentNames.forEach(name => {
          expect(name).toHaveAttribute('aria-label');
        });

        const actions = screen.getAllByRole('button', { name: /(view|delete)/i });
        actions.forEach(action => {
          expect(action).toHaveAttribute('aria-label');
        });
      });
    });
  });
});