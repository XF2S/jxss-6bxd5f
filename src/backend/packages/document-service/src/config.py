"""
Configuration module for the Document Service.
Provides comprehensive settings for document storage, validation, security, and service operations.

Version: 1.0.0
"""

import os
from functools import wraps
from typing import Dict, Any
from dotenv import load_dotenv  # version: ^1.0.0

# Load environment variables from .env file
load_dotenv()

# Global environment settings
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

def validate_config(func):
    """Decorator to validate configuration settings."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        config = func(*args, **kwargs)
        
        # Validate required environment variables
        required_vars = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_REGION',
            'S3_BUCKET_NAME',
            'MONGODB_URI'
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        return config
    return wrapper

@validate_config
def load_config() -> Dict[str, Any]:
    """
    Loads and validates environment-specific configuration with security checks.
    
    Returns:
        dict: Complete configuration dictionary with all settings
    """
    # Storage configuration for AWS S3
    storage_config = {
        'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID'),
        'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY'),
        'aws_region': os.getenv('AWS_REGION'),
        'bucket_name': os.getenv('S3_BUCKET_NAME'),
        'encryption_algorithm': 'AES256',  # AWS S3 server-side encryption
        'max_file_size_mb': int(os.getenv('MAX_FILE_SIZE_MB', '100')),
        'storage_class': os.getenv('S3_STORAGE_CLASS', 'STANDARD'),
        'versioning_enabled': True
    }

    # MongoDB configuration
    mongodb_config = {
        'uri': os.getenv('MONGODB_URI'),
        'database': os.getenv('MONGODB_DATABASE', 'enrollment_system'),
        'collection': os.getenv('MONGODB_COLLECTION', 'documents'),
        'shard_key': 'application_id',  # Sharding by application ID
        'connection_pool_size': int(os.getenv('MONGODB_POOL_SIZE', '100')),
        'retry_writes': True
    }

    # Service configuration
    service_config = {
        'allowed_mime_types': [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        'max_upload_retries': int(os.getenv('MAX_UPLOAD_RETRIES', '3')),
        'presigned_url_expiry': int(os.getenv('PRESIGNED_URL_EXPIRY', '3600')),  # 1 hour
        'upload_chunk_size': int(os.getenv('UPLOAD_CHUNK_SIZE', '5242880')),  # 5MB
        'virus_scan_enabled': os.getenv('VIRUS_SCAN_ENABLED', 'True').lower() == 'true',
        'content_validation_rules': {
            'max_pages': int(os.getenv('MAX_DOCUMENT_PAGES', '50')),
            'min_dpi': int(os.getenv('MIN_DOCUMENT_DPI', '300')),
            'max_image_dimension': int(os.getenv('MAX_IMAGE_DIMENSION', '4096'))
        }
    }

    # Logging configuration
    logging_config = {
        'level': os.getenv('LOG_LEVEL', 'INFO'),
        'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        'rotation_size_mb': int(os.getenv('LOG_ROTATION_SIZE_MB', '100')),
        'retention_days': int(os.getenv('LOG_RETENTION_DAYS', '30')),
        'log_handlers': ['console', 'file']
    }

    # Environment-specific overrides
    if ENVIRONMENT == 'production':
        storage_config.update({
            'storage_class': 'STANDARD_IA',  # Infrequent Access for cost optimization
            'versioning_enabled': True
        })
        service_config.update({
            'virus_scan_enabled': True,
            'presigned_url_expiry': 1800  # 30 minutes in production
        })
        logging_config.update({
            'level': 'WARNING',
            'log_handlers': ['console', 'file', 'cloudwatch']
        })
    elif ENVIRONMENT == 'staging':
        storage_config.update({
            'storage_class': 'STANDARD',
            'versioning_enabled': True
        })
        logging_config.update({
            'level': 'INFO'
        })
    else:  # development
        storage_config.update({
            'storage_class': 'STANDARD',
            'versioning_enabled': False
        })
        logging_config.update({
            'level': 'DEBUG' if DEBUG else 'INFO'
        })

    return {
        'storage_config': storage_config,
        'mongodb_config': mongodb_config,
        'service_config': service_config,
        'logging_config': logging_config
    }

# Export configurations
config = load_config()
storage_config = config['storage_config']
mongodb_config = config['mongodb_config']
service_config = config['service_config']
logging_config = config['logging_config']