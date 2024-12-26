"""
Storage Service module for secure document management using AWS S3 and MongoDB.
Implements comprehensive file operations with encryption, access control, and error handling.

Version: 1.0.0
"""

import boto3  # version: 1.26.0
import botocore  # version: 1.29.0
import logging
import uuid
from typing import Tuple, Optional
from botocore.exceptions import ClientError
from tenacity import retry, stop_after_attempt, wait_exponential

from config import storage_config
from models.document import Document, DocumentStatus, VerificationStatus
from utils.file_validator import validate_file, generate_file_hash

# Configure logging
logger = logging.getLogger(__name__)

class StorageService:
    """
    Service class for managing secure document storage operations in S3 and MongoDB.
    Implements comprehensive security measures and error handling.
    """

    def __init__(self):
        """Initialize storage service with AWS credentials and encryption settings."""
        try:
            # Initialize S3 client with credentials
            self._s3_client = boto3.client(
                's3',
                aws_access_key_id=storage_config['aws_access_key_id'],
                aws_secret_access_key=storage_config['aws_secret_access_key'],
                region_name=storage_config['aws_region']
            )
            
            self._bucket_name = storage_config['bucket_name']
            self._encryption_algorithm = storage_config['encryption_algorithm']
            
            # Verify bucket existence and encryption
            self._verify_bucket_configuration()
            
            logger.info("Storage service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize storage service: {str(e)}")
            raise

    def _verify_bucket_configuration(self) -> None:
        """Verify S3 bucket existence and encryption configuration."""
        try:
            self._s3_client.head_bucket(Bucket=self._bucket_name)
            
            # Verify bucket encryption
            encryption = self._s3_client.get_bucket_encryption(Bucket=self._bucket_name)
            if not encryption.get('ServerSideEncryptionConfiguration'):
                raise ValueError("Bucket encryption not configured")
                
        except ClientError as e:
            logger.error(f"Bucket configuration error: {str(e)}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def upload_file(self, file_content: bytes, file_name: str, mime_type: str, 
                   application_id: uuid.UUID) -> Document:
        """
        Upload document to S3 with encryption and comprehensive validation.
        
        Args:
            file_content: Raw file content
            file_name: Original file name
            mime_type: File MIME type
            application_id: Associated application ID
            
        Returns:
            Document: Created document model instance
            
        Raises:
            ValueError: For validation failures
            ClientError: For S3 operation failures
        """
        try:
            # Validate file content
            is_valid, error_msg, metadata = validate_file(file_content, mime_type, file_name)
            if not is_valid:
                raise ValueError(f"File validation failed: {error_msg}")
            
            # Generate secure document ID and storage path
            document_id = uuid.uuid4()
            storage_path = f"documents/{application_id}/{document_id}/{metadata['sanitized_filename']}"
            
            # Upload to S3 with server-side encryption
            self._s3_client.put_object(
                Bucket=self._bucket_name,
                Key=storage_path,
                Body=file_content,
                ContentType=mime_type,
                ServerSideEncryption=self._encryption_algorithm,
                Metadata={
                    'file_hash': metadata['file_hash'],
                    'application_id': str(application_id)
                }
            )
            
            # Create document record
            document = Document(
                id=document_id,
                application_id=application_id,
                file_name=metadata['sanitized_filename'],
                mime_type=mime_type,
                storage_path=storage_path,
                file_size=len(file_content),
                status=DocumentStatus.UPLOADED,
                verification_status=VerificationStatus.UNVERIFIED
            )
            
            # Validate and save document
            Document.validate(document)
            document.save()
            
            logger.info(f"Document uploaded successfully: {storage_path}")
            return document
            
        except Exception as e:
            logger.error(f"Upload failed: {str(e)}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def download_file(self, storage_path: str) -> Tuple[bytes, str]:
        """
        Download document from S3 with access verification.
        
        Args:
            storage_path: S3 storage path
            
        Returns:
            Tuple[bytes, str]: File content and MIME type
            
        Raises:
            ValueError: For invalid paths
            ClientError: For S3 operation failures
        """
        try:
            # Verify storage path
            if not storage_path.startswith("documents/") or ".." in storage_path:
                raise ValueError("Invalid storage path")
            
            # Download from S3
            response = self._s3_client.get_object(
                Bucket=self._bucket_name,
                Key=storage_path
            )
            
            content = response['Body'].read()
            mime_type = response['ContentType']
            
            # Verify file integrity
            stored_hash = response['Metadata'].get('file_hash')
            if stored_hash:
                current_hash = generate_file_hash(content)
                if stored_hash != current_hash:
                    raise ValueError("File integrity check failed")
            
            logger.info(f"Document downloaded successfully: {storage_path}")
            return content, mime_type
            
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    def delete_file(self, storage_path: str) -> bool:
        """
        Delete document from S3 with cascading updates.
        
        Args:
            storage_path: S3 storage path
            
        Returns:
            bool: True if deletion successful
            
        Raises:
            ValueError: For invalid paths
            ClientError: For S3 operation failures
        """
        try:
            # Verify storage path
            if not storage_path.startswith("documents/") or ".." in storage_path:
                raise ValueError("Invalid storage path")
            
            # Delete from S3
            self._s3_client.delete_object(
                Bucket=self._bucket_name,
                Key=storage_path
            )
            
            # Update document status
            document = Document.objects(storage_path=storage_path).first()
            if document:
                document.status = DocumentStatus.DELETED
                document.save()
            
            logger.info(f"Document deleted successfully: {storage_path}")
            return True
            
        except Exception as e:
            logger.error(f"Deletion failed: {str(e)}")
            raise

    def generate_presigned_url(self, storage_path: str, expiry_seconds: int = 3600) -> str:
        """
        Generate secure pre-signed URL for temporary access.
        
        Args:
            storage_path: S3 storage path
            expiry_seconds: URL expiration time in seconds
            
        Returns:
            str: Pre-signed URL
            
        Raises:
            ValueError: For invalid parameters
            ClientError: For S3 operation failures
        """
        try:
            # Validate parameters
            if not storage_path.startswith("documents/") or ".." in storage_path:
                raise ValueError("Invalid storage path")
            
            if not 300 <= expiry_seconds <= 7200:  # 5 minutes to 2 hours
                raise ValueError("Invalid expiry duration")
            
            # Generate URL
            url = self._s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self._bucket_name,
                    'Key': storage_path
                },
                ExpiresIn=expiry_seconds,
                HttpMethod='GET'
            )
            
            logger.info(f"Pre-signed URL generated for: {storage_path}")
            return url
            
        except Exception as e:
            logger.error(f"URL generation failed: {str(e)}")
            raise