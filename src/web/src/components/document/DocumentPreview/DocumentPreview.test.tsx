import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import DocumentPreview from './DocumentPreview';
import { documentApi } from '@/api/document.api';
import { ThemeProvider } from '@mui/material';
import { createCustomTheme } from '@/config/theme.config';
import { ThemeMode } from '@/config/theme.config';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock document API
vi.mock('@/api/document.api', () => ({
  documentApi: {
    getDocument: vi.fn()
  }
}));

// Mock sample document data
const mockDocument = {
  id: 'doc-123',
  fileName: 'test-document.pdf',
  mimeType: 'application/pdf',
  downloadUrl: 'https://example.com/test-document.pdf',
  fileSize: 1024,
  uploadedAt: new Date(),
  status: 'UPLOADED',
  verificationStatus: 'VERIFIED'
};

// Test setup helper
const renderDocumentPreview = (props = {}) => {
  const defaultProps = {
    open: true,
    documentId: 'doc-123',
    onClose: vi.fn(),
    secureMode: true,
    highContrast: false
  };

  return render(
    <ThemeProvider theme={createCustomTheme(ThemeMode.LIGHT)}>
      <DocumentPreview {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

describe('DocumentPreview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful document fetch
    (documentApi.getDocument as jest.Mock).mockResolvedValue(mockDocument);
  });

  describe('Rendering and Basic Functionality', () => {
    it('renders document preview modal when open', async () => {
      renderDocumentPreview();
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(mockDocument.fileName)).toBeInTheDocument();
      });
    });

    it('displays loading state while fetching document', () => {
      renderDocumentPreview();
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('renders toolbar with all control buttons', async () => {
      renderDocumentPreview();
      
      await waitFor(() => {
        expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
        expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
        expect(screen.getByLabelText('Download document')).toBeInTheDocument();
        expect(screen.getByLabelText('Print document')).toBeInTheDocument();
        expect(screen.getByLabelText('Close preview')).toBeInTheDocument();
      });
    });
  });

  describe('Document Type Handling', () => {
    it('renders PDF documents in iframe with security attributes', async () => {
      renderDocumentPreview();
      
      await waitFor(() => {
        const iframe = screen.getByTitle(mockDocument.fileName);
        expect(iframe).toBeInTheDocument();
        expect(iframe).toHaveAttribute('src', `${mockDocument.downloadUrl}#toolbar=0`);
        expect(iframe).toHaveAttribute('aria-label', 'PDF document preview');
      });
    });

    it('renders images with right-click protection', async () => {
      const imageDocument = { ...mockDocument, mimeType: 'image/jpeg' };
      (documentApi.getDocument as jest.Mock).mockResolvedValue(imageDocument);
      
      renderDocumentPreview();
      
      await waitFor(() => {
        const image = screen.getByAltText(imageDocument.fileName);
        expect(image).toBeInTheDocument();
        
        // Test right-click prevention
        const contextMenuEvent = new MouseEvent('contextmenu');
        fireEvent(image, contextMenuEvent);
        expect(contextMenuEvent.defaultPrevented).toBeTruthy();
      });
    });

    it('displays message for unsupported file types', async () => {
      const unsupportedDocument = { ...mockDocument, mimeType: 'application/unknown' };
      (documentApi.getDocument as jest.Mock).mockResolvedValue(unsupportedDocument);
      
      renderDocumentPreview();
      
      await waitFor(() => {
        expect(screen.getByText('This file type cannot be previewed')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderDocumentPreview();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      renderDocumentPreview();
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveFocus();
      });

      // Test tab navigation
      const user = userEvent.setup();
      await user.tab();
      expect(screen.getByLabelText('Zoom out')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText('Zoom in')).toHaveFocus();
    });

    it('handles keyboard shortcuts correctly', async () => {
      const onClose = vi.fn();
      renderDocumentPreview({ onClose });
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        fireEvent.keyDown(dialog, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('provides proper ARIA labels and roles', async () => {
      renderDocumentPreview();
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Document preview dialog');
        expect(screen.getByRole('toolbar')).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    it('enforces secure mode timeout', async () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      renderDocumentPreview({ secureMode: true, onClose });
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Fast-forward 5 minutes (security timeout)
      vi.advanceTimersByTime(300000);
      
      expect(onClose).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Session expired for security reasons');
      
      vi.useRealTimers();
    });

    it('sanitizes download URLs', async () => {
      const maliciousDocument = {
        ...mockDocument,
        downloadUrl: 'javascript:alert("xss")'
      };
      (documentApi.getDocument as jest.Mock).mockResolvedValue(maliciousDocument);
      
      renderDocumentPreview();
      
      await waitFor(() => {
        const downloadButton = screen.getByLabelText('Download document');
        expect(downloadButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message on document fetch failure', async () => {
      (documentApi.getDocument as jest.Mock).mockRejectedValue(new Error('Failed to load document'));
      
      renderDocumentPreview();
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load document. Please try again.');
      });
    });

    it('handles download errors gracefully', async () => {
      renderDocumentPreview();
      
      // Mock fetch failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Download failed'));
      
      await waitFor(() => {
        const downloadButton = screen.getByLabelText('Download document');
        fireEvent.click(downloadButton);
      });
      
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to download document');
    });
  });

  describe('Performance', () => {
    it('implements zoom controls efficiently', async () => {
      renderDocumentPreview();
      
      await waitFor(() => {
        const zoomInButton = screen.getByLabelText('Zoom in');
        const zoomOutButton = screen.getByLabelText('Zoom out');
        
        // Test zoom limits
        for (let i = 0; i < 10; i++) {
          fireEvent.click(zoomInButton);
        }
        expect(zoomInButton).toBeDisabled();
        
        for (let i = 0; i < 20; i++) {
          fireEvent.click(zoomOutButton);
        }
        expect(zoomOutButton).toBeDisabled();
      });
    });
  });
});