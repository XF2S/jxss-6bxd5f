/**
 * @fileoverview Test suite for FileUpload component
 * Implements comprehensive testing for file upload functionality, accessibility,
 * security validations, and user interactions.
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import FileUpload from './FileUpload';
import { validateFile } from '../../../utils/file.utils';
import type { Document } from '../../../types/document.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock file validation utility
vi.mock('../../../utils/file.utils', () => ({
  validateFile: vi.fn(),
  formatFileSize: vi.fn((size) => `${size} bytes`)
}));

// Mock notification hook
vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({
    send: vi.fn()
  })
}));

describe('FileUpload Component', () => {
  // Mock props and handlers
  const mockProps = {
    onFilesSelected: vi.fn(),
    onFileRemoved: vi.fn(),
    onUploadProgress: vi.fn(),
    onUploadError: vi.fn(),
    maxFiles: 5,
    maxConcurrentUploads: 3,
    disabled: false
  };

  // Test file data
  const validFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
  const oversizedFile = new File(['x'.repeat(52428800)], 'large.pdf', { type: 'application/pdf' });
  const maliciousFile = new File(['malicious content'], 'malware.exe', { type: 'application/x-msdownload' });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset validation mock to default valid response
    (validateFile as jest.Mock).mockResolvedValue({
      isValid: true,
      details: {
        mimeType: 'application/pdf',
        fileSize: 1024,
        filename: 'test.pdf',
        extension: 'pdf'
      }
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<FileUpload {...mockProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(<FileUpload {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /file upload dropzone/i })).toBeInTheDocument();
      expect(screen.getByText(/drag & drop files/i)).toBeInTheDocument();
    });

    it('should handle keyboard navigation', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });
      
      // Test keyboard focus
      dropzone.focus();
      expect(dropzone).toHaveFocus();
      
      // Test keyboard activation
      fireEvent.keyDown(dropzone, { key: 'Enter' });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /file upload dropzone/i })).toBeInTheDocument();
      });
    });
  });

  describe('File Validation', () => {
    it('should validate file type and size', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      // Upload valid file
      await userEvent.upload(dropzone, validFile);
      
      expect(validateFile).toHaveBeenCalledWith(validFile, {
        strictMimeCheck: true,
        allowedTypes: expect.any(Array),
        maxSizeMB: expect.any(Number),
        validateContent: true
      });
    });

    it('should reject oversized files', async () => {
      (validateFile as jest.Mock).mockResolvedValue({
        isValid: false,
        error: 'File size exceeds 50MB limit'
      });

      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, oversizedFile);
      
      expect(mockProps.onUploadError).toHaveBeenCalledWith({
        fileId: 'VALIDATION_ERROR',
        error: expect.stringContaining('File size exceeds'),
        retryCount: 0
      });
    });

    it('should reject malicious files', async () => {
      (validateFile as jest.Mock).mockResolvedValue({
        isValid: false,
        error: 'Invalid file type'
      });

      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, maliciousFile);
      
      expect(mockProps.onUploadError).toHaveBeenCalledWith({
        fileId: 'VALIDATION_ERROR',
        error: expect.stringContaining('Invalid file type'),
        retryCount: 0
      });
    });
  });

  describe('Upload Functionality', () => {
    it('should handle successful file upload', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, validFile);

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(mockProps.onFilesSelected).toHaveBeenCalled();
      });
    });

    it('should track upload progress', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, validFile);

      // Simulate progress updates
      await waitFor(() => {
        expect(mockProps.onUploadProgress).toHaveBeenCalledWith(
          expect.objectContaining({
            fileId: expect.any(String),
            progress: expect.any(Number)
          })
        );
      });
    });

    it('should handle concurrent uploads correctly', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
        new File(['content3'], 'file3.pdf', { type: 'application/pdf' })
      ];

      await userEvent.upload(dropzone, files);

      await waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(3);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display upload errors', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      // Simulate upload error
      (validateFile as jest.Mock).mockRejectedValue(new Error('Upload failed'));
      
      await userEvent.upload(dropzone, validFile);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(mockProps.onUploadError).toHaveBeenCalled();
      });
    });

    it('should handle retry attempts', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, validFile);

      // Simulate failed upload with retry
      await waitFor(() => {
        expect(mockProps.onUploadError).toHaveBeenCalledWith(
          expect.objectContaining({
            retryCount: expect.any(Number)
          })
        );
      });
    });
  });

  describe('User Interactions', () => {
    it('should allow file removal', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, validFile);
      
      const removeButton = await screen.findByRole('button', { name: /remove test.pdf/i });
      await userEvent.click(removeButton);

      expect(mockProps.onFileRemoved).toHaveBeenCalled();
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    });

    it('should handle drag and drop interactions', async () => {
      render(<FileUpload {...mockProps} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      fireEvent.dragEnter(dropzone, {
        dataTransfer: {
          files: [validFile]
        }
      });

      expect(dropzone).toHaveClass('active');

      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [validFile]
        }
      });

      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('should prevent uploads when disabled', async () => {
      render(<FileUpload {...mockProps} disabled={true} />);
      const dropzone = screen.getByRole('button', { name: /file upload dropzone/i });

      await userEvent.upload(dropzone, validFile);

      expect(mockProps.onFilesSelected).not.toHaveBeenCalled();
      expect(dropzone).toHaveClass('disabled');
    });
  });
});