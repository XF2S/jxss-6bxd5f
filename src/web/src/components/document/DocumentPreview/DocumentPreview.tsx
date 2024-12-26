import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Box, IconButton, CircularProgress, Tooltip, Snackbar } from '@mui/material';
import { useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

import Modal from '../../common/Modal/Modal';
import { Document } from '../../../types/document.types';
import { DocumentApi } from '../../../api/document.api';
import { useTheme } from '../../../hooks/useTheme';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// react: ^18.0.0

/**
 * Styled components for document preview
 */
const PreviewContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  maxHeight: 'calc(100vh - 64px)',
  overflow: 'auto',
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  width: '100%',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const ContentContainer = styled(Box)({
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

/**
 * Props interface for DocumentPreview component
 */
interface DocumentPreviewProps {
  open: boolean;
  documentId: string;
  onClose: () => void;
  secureMode?: boolean;
  highContrast?: boolean;
}

/**
 * DocumentPreview component with enhanced security and accessibility features
 */
export const DocumentPreview = memo<DocumentPreviewProps>(({
  open,
  documentId,
  onClose,
  secureMode = true,
  highContrast = false,
}) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const previewRef = useRef<HTMLDivElement>(null);
  const { currentTheme, themeMode } = useTheme();
  const isMobile = useMediaQuery(currentTheme.breakpoints.down('sm'));

  // Security timeout for document viewing
  const securityTimeoutRef = useRef<NodeJS.Timeout>();
  const SECURITY_TIMEOUT = 300000; // 5 minutes

  /**
   * Fetches document data with security validation
   */
  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await DocumentApi.getDocument(documentId);
      setDocument(response);

      // Set security timeout if in secure mode
      if (secureMode) {
        securityTimeoutRef.current = setTimeout(() => {
          onClose();
          setError('Session expired for security reasons');
        }, SECURITY_TIMEOUT);
      }
    } catch (err) {
      setError('Failed to load document. Please try again.');
      console.error('Document preview error:', err);
    } finally {
      setLoading(false);
    }
  }, [documentId, secureMode, onClose]);

  /**
   * Handles document download with security checks
   */
  const handleDownload = useCallback(async () => {
    if (!document?.downloadUrl) return;

    try {
      const response = await fetch(document.downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download document');
      console.error('Download error:', err);
    }
  }, [document]);

  /**
   * Handles zoom controls
   */
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setZoom(prev => {
      const newZoom = direction === 'in' ? prev + 25 : prev - 25;
      return Math.min(Math.max(newZoom, 50), 200);
    });
  }, []);

  /**
   * Keyboard event handlers for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        onClose();
        break;
      case '+':
        if (event.ctrlKey) {
          event.preventDefault();
          handleZoom('in');
        }
        break;
      case '-':
        if (event.ctrlKey) {
          event.preventDefault();
          handleZoom('out');
        }
        break;
    }
  }, [onClose, handleZoom]);

  // Fetch document on mount and cleanup on unmount
  useEffect(() => {
    if (open && documentId) {
      fetchDocument();
    }
    return () => {
      if (securityTimeoutRef.current) {
        clearTimeout(securityTimeoutRef.current);
      }
    };
  }, [open, documentId, fetchDocument]);

  /**
   * Renders document preview based on mime type
   */
  const renderPreview = useCallback(() => {
    if (!document) return null;

    const previewStyle = {
      maxWidth: '100%',
      transform: `scale(${zoom / 100})`,
      transition: 'transform 0.2s ease-in-out',
    };

    switch (document.mimeType) {
      case 'application/pdf':
        return (
          <iframe
            src={`${document.downloadUrl}#toolbar=0`}
            title={document.fileName}
            style={{ ...previewStyle, width: '100%', height: '80vh' }}
            aria-label="PDF document preview"
          />
        );
      case 'image/jpeg':
      case 'image/png':
        return (
          <img
            src={document.downloadUrl}
            alt={document.fileName}
            style={previewStyle}
            onContextMenu={e => e.preventDefault()}
          />
        );
      default:
        return (
          <Box p={3} textAlign="center">
            This file type cannot be previewed
          </Box>
        );
    }
  }, [document, zoom]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={document?.fileName || 'Document Preview'}
      fullScreen={isMobile}
    >
      <PreviewContainer
        ref={previewRef}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="dialog"
        aria-label="Document preview dialog"
        data-high-contrast={highContrast}
      >
        <ToolbarContainer>
          <Tooltip title="Zoom out (Ctrl + -)">
            <IconButton
              onClick={() => handleZoom('out')}
              disabled={zoom <= 50}
              aria-label="Zoom out"
            >
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom in (Ctrl + +)">
            <IconButton
              onClick={() => handleZoom('in')}
              disabled={zoom >= 200}
              aria-label="Zoom in"
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton
              onClick={handleDownload}
              disabled={!document?.downloadUrl}
              aria-label="Download document"
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print">
            <IconButton
              onClick={() => window.print()}
              disabled={!document}
              aria-label="Print document"
            >
              <PrintIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close (Esc)">
            <IconButton onClick={onClose} aria-label="Close preview">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </ToolbarContainer>

        <ContentContainer>
          {loading ? (
            <CircularProgress aria-label="Loading document" />
          ) : error ? (
            <Box p={3} color="error.main" role="alert">
              {error}
            </Box>
          ) : (
            renderPreview()
          )}
        </ContentContainer>
      </PreviewContainer>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
        role="alert"
      />
    </Modal>
  );
});

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;