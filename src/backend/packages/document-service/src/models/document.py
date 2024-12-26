"""
Document model for secure document management in the enrollment system.
Provides comprehensive document metadata structure, validation rules, and status management.

Version: 1.0.0
Author: Enrollment System Team
"""

from datetime import datetime, timezone
from enum import Enum
import uuid
import re
from typing import Dict, Any, Optional
import mongoengine  # version 0.27.0

# Security-vetted list of allowed MIME types
ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]

# Maximum file size in MB (50MB limit for security)
MAX_FILE_SIZE_MB = 50

class DocumentStatus(Enum):
    """
    Enumeration of possible document statuses for lifecycle tracking.
    """
    PENDING = "pending"
    UPLOADED = "uploaded"
    FAILED = "failed"
    DELETED = "deleted"

class VerificationStatus(Enum):
    """
    Enumeration of document verification statuses for validation tracking.
    """
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    REJECTED = "rejected"

@mongoengine.Document
class Document(mongoengine.Document):
    """
    Enhanced MongoDB document model for secure document metadata storage.
    Implements comprehensive validation and security measures.
    """
    
    # Primary document identification fields
    id = mongoengine.UUIDField(primary_key=True, required=True, binary=False)
    application_id = mongoengine.UUIDField(required=True, binary=False)
    
    # Document metadata fields
    file_name = mongoengine.StringField(required=True, max_length=255)
    mime_type = mongoengine.StringField(required=True, choices=ALLOWED_MIME_TYPES)
    storage_path = mongoengine.StringField(required=True, max_length=512)
    file_size = mongoengine.IntField(required=True, min_value=0, max_value=MAX_FILE_SIZE_MB * 1024 * 1024)
    
    # Tracking and status fields
    uploaded_at = mongoengine.DateTimeField(required=True)
    status = mongoengine.EnumField(DocumentStatus, required=True)
    verification_status = mongoengine.EnumField(VerificationStatus, required=True)
    
    # MongoDB metadata configuration
    meta = {
        'collection': 'documents',
        'indexes': [
            'application_id',
            'status',
            'verification_status',
            ('application_id', 'status'),
            {'fields': ['uploaded_at'], 'expireAfterSeconds': 365 * 24 * 60 * 60}  # 1 year TTL
        ],
        'ordering': ['-uploaded_at']
    }

    def __init__(self, **kwargs):
        """
        Initialize a new Document instance with secure defaults.
        
        Args:
            **kwargs: Document field values
        """
        # Set secure defaults for required fields
        kwargs['id'] = kwargs.get('id', uuid.uuid4())
        kwargs['status'] = kwargs.get('status', DocumentStatus.PENDING)
        kwargs['verification_status'] = kwargs.get('verification_status', VerificationStatus.UNVERIFIED)
        kwargs['uploaded_at'] = kwargs.get('uploaded_at', datetime.now(timezone.utc))
        
        # Generate secure storage path if not provided
        if 'storage_path' not in kwargs:
            safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', kwargs.get('file_name', ''))
            kwargs['storage_path'] = f"documents/{kwargs['id']}/{safe_filename}"
        
        super().__init__(**kwargs)

    @classmethod
    def validate(cls, document: 'Document') -> bool:
        """
        Comprehensive validation of document metadata with enhanced security checks.
        
        Args:
            document: Document instance to validate
            
        Returns:
            bool: Validation result
            
        Raises:
            ValidationError: If validation fails with detailed error context
        """
        try:
            # Validate file name security
            if not document.file_name or '..' in document.file_name or '/' in document.file_name:
                raise mongoengine.ValidationError("Invalid file name")
            
            # Validate MIME type
            if document.mime_type not in ALLOWED_MIME_TYPES:
                raise mongoengine.ValidationError(f"Unsupported MIME type: {document.mime_type}")
            
            # Validate file size
            if not 0 <= document.file_size <= MAX_FILE_SIZE_MB * 1024 * 1024:
                raise mongoengine.ValidationError(f"File size exceeds {MAX_FILE_SIZE_MB}MB limit")
            
            # Validate storage path security
            if not document.storage_path.startswith("documents/") or '..' in document.storage_path:
                raise mongoengine.ValidationError("Invalid storage path")
            
            # Validate UUIDs
            try:
                uuid.UUID(str(document.id))
                uuid.UUID(str(document.application_id))
            except ValueError:
                raise mongoengine.ValidationError("Invalid UUID format")
            
            # Validate status fields
            if not isinstance(document.status, DocumentStatus):
                raise mongoengine.ValidationError("Invalid document status")
            if not isinstance(document.verification_status, VerificationStatus):
                raise mongoengine.ValidationError("Invalid verification status")
            
            # Validate timestamp
            if not document.uploaded_at or document.uploaded_at.tzinfo != timezone.utc:
                raise mongoengine.ValidationError("Invalid upload timestamp")
            
            return True
            
        except Exception as e:
            raise mongoengine.ValidationError(f"Document validation failed: {str(e)}")

    def to_dict(self) -> Dict[str, Any]:
        """
        Converts document model to secure dictionary representation.
        
        Returns:
            Dict[str, Any]: Sanitized document data dictionary
        """
        return {
            'id': str(self.id),
            'application_id': str(self.application_id),
            'file_name': self.file_name,
            'mime_type': self.mime_type,
            'storage_path': self.storage_path,
            'file_size': self.file_size,
            'uploaded_at': self.uploaded_at.isoformat(),
            'status': self.status.value,
            'verification_status': self.verification_status.value,
            'metadata': {
                'created_at': self.uploaded_at.isoformat(),
                'last_modified': datetime.now(timezone.utc).isoformat()
            }
        }