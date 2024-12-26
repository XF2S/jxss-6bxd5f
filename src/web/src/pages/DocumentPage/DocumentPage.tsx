import React, { useState, useCallback, useEffect, memo } from 'react';
import { Box, Typography, Alert, CircularProgress, Snackbar } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

// Internal components
import DocumentList from '../../components/document/DocumentList/DocumentList';
import DocumentUpload from '../../components/document/DocumentUpload/DocumentUpload';
import DocumentPreview from '../../components/document/DocumentPreview/DocumentPreview';

// Types and utilities
import { Document } from '../../types/document.types';
import { useNotification } from '../../hooks/useNotification';
import { NotificationTemplate, NotificationPriority } from '../../types/notification.types';

/**
 * DocumentPage component providing comprehensive document management functionality
 * Implements Material Design 3 specifications and WCAG 2.1 Level AA compliance
 */
const DocumentPage = memo(() => {
  // Router hooks
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();

  // State management
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Notification hook
  const { send: sendNotification } = useNotification();

  // Validate required parameter
  useEffect(() => {
    if (!applicationId) {
      navigate('/applications');
      setError('Application ID is required');
    }
  }, [applicationId, navigate]);

  /**
   * Handles document selection for preview with security validation
   */
  const handleDocumentSelect = useCallback(async (document: Document) => {
    try {
      setSelectedDocument(document);
      setPreviewOpen(true);

      // Send notification for analytics
      sendNotification(
        'SYSTEM',
        NotificationTemplate.DOCUMENT_UPLOADED,
        { fileName: document.fileName },
        NotificationPriority.LOW
      );
    } catch (err) {
      setError('Failed to load document preview');
      console.error('Document preview error:', err);
    }
  }, [sendNotification]);

  /**
   * Handles successful document upload with notifications
   */
  const handleUploadComplete = useCallback((document: Document) => {
    sendNotification(
      'SYSTEM',
      NotificationTemplate.DOCUMENT_UPLOADED,
      { fileName: document.fileName },
      NotificationPriority.LOW
    );
  }, [sendNotification]);

  /**
   * Handles document upload errors with user feedback
   */
  const handleUploadError = useCallback((error: Error) => {
    setError(error.message);
    sendNotification(
      'SYSTEM',
      NotificationTemplate.DOCUMENT_REJECTED,
      { error: error.message },
      NotificationPriority.HIGH
    );
  }, [sendNotification]);

  /**
   * Handles preview modal close
   */
  const handlePreviewClose = useCallback(() => {
    setPreviewOpen(false);
    setSelectedDocument(null);
  }, []);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
        role="status"
        aria-label="Loading documents"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      component="main"
      role="main"
      aria-label="Document Management"
      sx={{
        padding: theme => theme.spacing(3),
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <Typography
        variant="h1"
        component="h1"
        sx={{
          fontSize: '2rem',
          fontWeight: 500,
          marginBottom: theme => theme.spacing(3),
        }}
      >
        Document Management
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ marginBottom: theme => theme.spacing(3) }}
        >
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: theme => theme.spacing(3),
          gridTemplateColumns: {
            xs: '1fr',
            md: '1fr 1fr',
          },
        }}
      >
        <Box>
          <Typography
            variant="h2"
            component="h2"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 500,
              marginBottom: theme => theme.spacing(2),
            }}
          >
            Upload Documents
          </Typography>
          
          <DocumentUpload
            applicationId={applicationId!}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            maxFiles={5}
          />
        </Box>

        <Box>
          <Typography
            variant="h2"
            component="h2"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 500,
              marginBottom: theme => theme.spacing(2),
            }}
          >
            Document List
          </Typography>

          <DocumentList
            applicationId={applicationId!}
            onDocumentSelect={handleDocumentSelect}
            onError={error => setError(error.message)}
          />
        </Box>
      </Box>

      {selectedDocument && (
        <DocumentPreview
          open={previewOpen}
          documentId={selectedDocument.id}
          onClose={handlePreviewClose}
          secureMode={true}
        />
      )}

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </Box>
  );
});

DocumentPage.displayName = 'DocumentPage';

export default DocumentPage;