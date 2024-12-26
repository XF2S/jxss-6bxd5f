import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '@axe-core/react';
import { vi } from 'vitest';
import DocumentPage from './DocumentPage';
import { DocumentApi } from '@/api/document.api';
import { Document, DocumentStatus, VerificationStatus } from '@/types/document.types';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ applicationId: 'test-app-123' }),
  useNavigate: () => vi.fn()
}));

// Mock document data
const documentListMock: Document[] = [
  {
    id: 'doc-1',
    applicationId: 'test-app-123',
    fileName: 'test-document.pdf',
    mimeType: 'application/pdf',
    storagePath: '/documents/test-document.pdf',
    fileSize: 1024 * 1024, // 1MB
    uploadedAt: new Date(),
    status: DocumentStatus.UPLOADED,
    verificationStatus: VerificationStatus.VERIFIED,
    downloadUrl: 'https://example.com/test-document.pdf',
    lastModifiedAt: new Date(),
    verifiedAt: new Date(),
    verifiedBy: 'admin',
    rejectionReason: null
  },
  {
    id: 'doc-2',
    applicationId: 'test-app-123',
    fileName: 'test-image.jpg',
    mimeType: 'image/jpeg',
    storagePath: '/documents/test-image.jpg',
    fileSize: 512 * 1024, // 512KB
    uploadedAt: new Date(),
    status: DocumentStatus.PROCESSING,
    verificationStatus: VerificationStatus.IN_REVIEW,
    downloadUrl: 'https://example.com/test-image.jpg',
    lastModifiedAt: new Date(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionReason: null
  }
];

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
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

// Mock API calls
const mockDocumentApi = () => {
  vi.spyOn(DocumentApi, 'listApplicationDocuments').mockResolvedValue({
    documents: documentListMock,
    total: documentListMock.length,
    page: 1,
    pageSize: 10,
    hasMore: false
  });

  vi.spyOn(DocumentApi, 'uploadDocument').mockImplementation(async (request) => {
    return {
      ...documentListMock[0],
      id: 'new-doc',
      fileName: request.file.name
    };
  });

  vi.spyOn(DocumentApi, 'deleteDocument').mockResolvedValue(undefined);
  vi.spyOn(DocumentApi, 'getDocument').mockResolvedValue(documentListMock[0]);
};

describe('DocumentPage Component', () => {
  beforeEach(() => {
    mockDocumentApi();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Accessibility Tests', () => {
    it('should be accessible according to WCAG 2.1 Level AA', async () => {
      const { container } = renderWithProviders(<DocumentPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle keyboard navigation correctly', async () => {
      renderWithProviders(<DocumentPage />);
      
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      uploadButton.focus();
      expect(document.activeElement).toBe(uploadButton);

      // Tab through interactive elements
      userEvent.tab();
      expect(document.activeElement).toHaveAttribute('role', 'button');
    });

    it('should provide proper ARIA labels and roles', () => {
      renderWithProviders(<DocumentPage />);
      
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /document management/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /document upload/i })).toBeInTheDocument();
    });
  });

  describe('Document List Functionality', () => {
    it('should display the list of documents', async () => {
      renderWithProviders(<DocumentPage />);

      await waitFor(() => {
        documentListMock.forEach(doc => {
          expect(screen.getByText(doc.fileName)).toBeInTheDocument();
        });
      });
    });

    it('should handle document selection and preview', async () => {
      renderWithProviders(<DocumentPage />);

      await waitFor(() => {
        const firstDocument = screen.getByText(documentListMock[0].fileName);
        fireEvent.click(firstDocument);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle document deletion', async () => {
      renderWithProviders(<DocumentPage />);

      await waitFor(() => {
        const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
        fireEvent.click(deleteButton);
      });

      expect(DocumentApi.deleteDocument).toHaveBeenCalledWith(documentListMock[0].id);
    });
  });

  describe('Document Upload Functionality', () => {
    it('should handle file upload successfully', async () => {
      renderWithProviders(<DocumentPage />);

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const uploadInput = screen.getByLabelText(/upload/i);

      await act(async () => {
        userEvent.upload(uploadInput, file);
      });

      expect(DocumentApi.uploadDocument).toHaveBeenCalled();
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    });

    it('should validate file types and size', async () => {
      renderWithProviders(<DocumentPage />);

      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      const uploadInput = screen.getByLabelText(/upload/i);

      await act(async () => {
        userEvent.upload(uploadInput, invalidFile);
      });

      expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages for failed operations', async () => {
      vi.spyOn(DocumentApi, 'listApplicationDocuments').mockRejectedValue(
        new Error('Failed to load documents')
      );

      renderWithProviders(<DocumentPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load documents/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      vi.spyOn(DocumentApi, 'uploadDocument').mockRejectedValue(
        new Error('Network error')
      );

      renderWithProviders(<DocumentPage />);

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const uploadInput = screen.getByLabelText(/upload/i);

      await act(async () => {
        userEvent.upload(uploadInput, file);
      });

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<DocumentPage />);

      const container = screen.getByRole('main');
      expect(container).toHaveStyle({
        gridTemplateColumns: '1fr'
      });
    });

    it('should maintain functionality on different screen sizes', async () => {
      // Mock tablet viewport
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));

      renderWithProviders(<DocumentPage />);

      await waitFor(() => {
        documentListMock.forEach(doc => {
          expect(screen.getByText(doc.fileName)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should render efficiently without unnecessary updates', async () => {
      const renderCount = vi.fn();
      const TestComponent = () => {
        renderCount();
        return <DocumentPage />;
      };

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(renderCount).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle large document lists without performance degradation', async () => {
      const largeDocumentList = Array.from({ length: 100 }, (_, i) => ({
        ...documentListMock[0],
        id: `doc-${i}`,
        fileName: `document-${i}.pdf`
      }));

      vi.spyOn(DocumentApi, 'listApplicationDocuments').mockResolvedValue({
        documents: largeDocumentList,
        total: largeDocumentList.length,
        page: 1,
        pageSize: 10,
        hasMore: true
      });

      const startTime = performance.now();
      renderWithProviders(<DocumentPage />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
    });
  });
});