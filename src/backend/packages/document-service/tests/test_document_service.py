"""
Comprehensive test suite for the Document Service.
Tests document upload, download, verification and management functionality
with enhanced security measures and validation.

Version: 1.0.0
"""

import pytest
import uuid
import os
import json
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from moto import mock_s3  # version: 4.1.11
import mongomock  # version: 4.1.2
import boto3
from cryptography.fernet import Fernet  # version: 41.0.0
import httpx  # version: 0.24.0

from app import app
from models.document import Document, DocumentStatus, VerificationStatus
from services.storage_service import StorageService
from utils.file_validator import validate_file, generate_file_hash

# Test constants
TEST_APPLICATION_ID = uuid.uuid4()
TEST_FILE_CONTENT = b'test file content'
TEST_FILE_NAME = 'test_document.pdf'
TEST_MIME_TYPE = 'application/pdf'
TEST_ENCRYPTION_KEY = os.getenv('TEST_ENCRYPTION_KEY', Fernet.generate_key())
TEST_ACCESS_TOKEN = "test_jwt_token"

@pytest.fixture(scope='module')
def s3_client():
    """Configure mocked S3 client with encryption support."""
    with mock_s3():
        s3 = boto3.client(
            's3',
            region_name='us-east-1',
            aws_access_key_id='test',
            aws_secret_access_key='test'
        )
        # Create test bucket with encryption
        s3.create_bucket(Bucket='test-bucket')
        s3.put_bucket_encryption(
            Bucket='test-bucket',
            ServerSideEncryptionConfiguration={
                'Rules': [
                    {
                        'ApplyServerSideEncryptionByDefault': {
                            'SSEAlgorithm': 'AES256'
                        }
                    }
                ]
            }
        )
        yield s3

@pytest.fixture(scope='module')
def mongo_client():
    """Configure mocked MongoDB client with security context."""
    with mongomock.patch(servers=(('mongodb://localhost', 27017),)):
        yield

@pytest.fixture(scope='module')
def storage_service(s3_client):
    """Initialize storage service with mocked S3."""
    with patch('services.storage_service.boto3.client') as mock_boto3:
        mock_boto3.return_value = s3_client
        service = StorageService()
        service._bucket_name = 'test-bucket'
        yield service

@pytest.fixture
def test_client(mongo_client):
    """Initialize FastAPI test client with security configuration."""
    with TestClient(app) as client:
        client.headers.update({
            "Authorization": f"Bearer {TEST_ACCESS_TOKEN}",
            "X-Request-ID": str(uuid.uuid4())
        })
        yield client

class TestDocumentService:
    """
    Comprehensive test suite for Document Service functionality.
    Tests security, validation, and error handling.
    """

    @pytest.fixture(autouse=True)
    def setup_method(self, mongo_client, storage_service):
        """Set up test environment before each test."""
        # Clear test data
        Document.objects.delete()
        
        # Initialize test document
        self.test_doc = Document(
            id=uuid.uuid4(),
            application_id=TEST_APPLICATION_ID,
            file_name=TEST_FILE_NAME,
            mime_type=TEST_MIME_TYPE,
            storage_path=f"documents/{TEST_APPLICATION_ID}/test_document.pdf",
            file_size=len(TEST_FILE_CONTENT),
            status=DocumentStatus.PENDING,
            verification_status=VerificationStatus.UNVERIFIED
        )
        
        # Configure mocked services
        self.storage_service = storage_service

    @pytest.mark.asyncio
    async def test_upload_document(self, test_client, storage_service):
        """Test secure document upload with encryption and validation."""
        # Prepare test file
        files = {
            'file': (TEST_FILE_NAME, TEST_FILE_CONTENT, TEST_MIME_TYPE)
        }
        data = {
            'application_id': str(TEST_APPLICATION_ID),
            'file_name': TEST_FILE_NAME,
            'mime_type': TEST_MIME_TYPE,
            'file_size': len(TEST_FILE_CONTENT),
            'checksum': generate_file_hash(TEST_FILE_CONTENT)
        }

        # Test upload endpoint
        response = test_client.post(
            "/api/v1/documents/",
            files=files,
            data=data
        )

        assert response.status_code == 200
        result = response.json()

        # Verify response structure
        assert 'id' in result
        assert result['application_id'] == str(TEST_APPLICATION_ID)
        assert result['file_name'] == TEST_FILE_NAME
        assert result['mime_type'] == TEST_MIME_TYPE
        assert result['status'] == DocumentStatus.UPLOADED.value
        assert result['encryption_status'] == "AES-256-GCM"

        # Verify document in MongoDB
        doc = Document.objects(id=uuid.UUID(result['id'])).first()
        assert doc is not None
        assert doc.verification_status == VerificationStatus.UNVERIFIED

        # Verify file in S3
        stored_file = storage_service.download_file(doc.storage_path)
        assert stored_file[0] == TEST_FILE_CONTENT
        assert stored_file[1] == TEST_MIME_TYPE

    @pytest.mark.asyncio
    async def test_get_document(self, test_client):
        """Test secure document retrieval with access control."""
        # Create test document
        self.test_doc.save()

        # Test retrieval endpoint
        response = test_client.get(f"/api/v1/documents/{self.test_doc.id}")

        assert response.status_code == 200
        result = response.json()

        # Verify response data
        assert result['id'] == str(self.test_doc.id)
        assert result['application_id'] == str(TEST_APPLICATION_ID)
        assert result['file_name'] == TEST_FILE_NAME
        assert result['mime_type'] == TEST_MIME_TYPE
        assert 'encryption_status' in result

    @pytest.mark.asyncio
    async def test_download_document(self, test_client, storage_service):
        """Test secure document download with encryption verification."""
        # Upload test file to S3
        storage_service.upload_file(
            TEST_FILE_CONTENT,
            TEST_FILE_NAME,
            TEST_MIME_TYPE,
            TEST_APPLICATION_ID
        )
        self.test_doc.save()

        # Test download endpoint
        response = test_client.get(f"/api/v1/documents/{self.test_doc.id}/download")

        assert response.status_code == 200
        result = response.json()

        # Verify download URL and metadata
        assert 'download_url' in result
        assert result['file_name'] == TEST_FILE_NAME
        assert result['mime_type'] == TEST_MIME_TYPE
        assert 'expires_in' in result

    @pytest.mark.asyncio
    async def test_delete_document(self, test_client, storage_service):
        """Test secure document deletion with cascading updates."""
        # Create test document
        self.test_doc.save()

        # Test deletion endpoint
        response = test_client.delete(f"/api/v1/documents/{self.test_doc.id}")

        assert response.status_code == 200
        result = response.json()

        # Verify document deletion
        assert result['message'] == "Document deleted successfully"
        doc = Document.objects(id=self.test_doc.id).first()
        assert doc.status == DocumentStatus.DELETED

    @pytest.mark.asyncio
    async def test_verify_document(self, test_client):
        """Test document verification status updates."""
        # Create test document
        self.test_doc.save()

        # Test verification endpoint
        response = test_client.put(f"/api/v1/documents/{self.test_doc.id}/verify")

        assert response.status_code == 200
        result = response.json()

        # Verify status update
        assert result['verification_status'] == VerificationStatus.VERIFIED.value
        doc = Document.objects(id=self.test_doc.id).first()
        assert doc.verification_status == VerificationStatus.VERIFIED

    @pytest.mark.asyncio
    async def test_invalid_mime_type(self, test_client):
        """Test rejection of invalid MIME types."""
        files = {
            'file': ('test.exe', b'malicious content', 'application/x-msdownload')
        }
        data = {
            'application_id': str(TEST_APPLICATION_ID),
            'file_name': 'test.exe',
            'mime_type': 'application/x-msdownload',
            'file_size': 100,
            'checksum': 'test_hash'
        }

        response = test_client.post(
            "/api/v1/documents/",
            files=files,
            data=data
        )

        assert response.status_code == 400
        assert "MIME type not allowed" in response.json()['detail']

    @pytest.mark.asyncio
    async def test_file_size_limit(self, test_client):
        """Test enforcement of file size limits."""
        large_content = b'x' * (101 * 1024 * 1024)  # 101MB
        files = {
            'file': (TEST_FILE_NAME, large_content, TEST_MIME_TYPE)
        }
        data = {
            'application_id': str(TEST_APPLICATION_ID),
            'file_name': TEST_FILE_NAME,
            'mime_type': TEST_MIME_TYPE,
            'file_size': len(large_content),
            'checksum': generate_file_hash(large_content)
        }

        response = test_client.post(
            "/api/v1/documents/",
            files=files,
            data=data
        )

        assert response.status_code == 400
        assert "exceeds maximum allowed size" in response.json()['detail']

    def test_document_validation(self):
        """Test document model validation rules."""
        # Test invalid file name
        with pytest.raises(Exception):
            Document(
                id=uuid.uuid4(),
                application_id=TEST_APPLICATION_ID,
                file_name="../malicious.pdf",
                mime_type=TEST_MIME_TYPE,
                storage_path="documents/test.pdf",
                file_size=100,
                status=DocumentStatus.PENDING,
                verification_status=VerificationStatus.UNVERIFIED
            ).validate()

        # Test invalid storage path
        with pytest.raises(Exception):
            Document(
                id=uuid.uuid4(),
                application_id=TEST_APPLICATION_ID,
                file_name="test.pdf",
                mime_type=TEST_MIME_TYPE,
                storage_path="../../malicious/path.pdf",
                file_size=100,
                status=DocumentStatus.PENDING,
                verification_status=VerificationStatus.UNVERIFIED
            ).validate()