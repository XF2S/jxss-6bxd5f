"""
File validation utility module for the Document Service.
Provides comprehensive security-focused validation for uploaded documents.

Version: 1.0.0
"""

import magic  # version: 0.4.27
import hashlib
import logging
import os
from typing import Tuple, Dict, Optional
import clamd  # version: 1.0.2
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.0.1
import time

from config import service_config

# Configure logging
logger = logging.getLogger(__name__)

# Configure retry settings
RETRY_CONFIG = {
    "max_attempts": 3,
    "wait_exponential_multiplier": 1000
}

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1))
def validate_mime_type(file_content: bytes, claimed_mime_type: str) -> Tuple[bool, str]:
    """
    Validates file MIME type against claimed type and allowed types list.
    
    Args:
        file_content: Raw file content in bytes
        claimed_mime_type: MIME type claimed by the upload request
    
    Returns:
        Tuple of (validation_result, error_message)
    """
    try:
        # Initialize magic MIME type detector
        mime = magic.Magic(mime=True)
        detected_mime_type = mime.from_buffer(file_content)
        
        # Validate detected MIME type against claimed type
        if detected_mime_type.lower() != claimed_mime_type.lower():
            error_msg = f"MIME type mismatch: claimed {claimed_mime_type}, detected {detected_mime_type}"
            logger.warning(error_msg)
            return False, error_msg
            
        # Check if MIME type is allowed
        if detected_mime_type.lower() not in [m.lower() for m in service_config['allowed_mime_types']]:
            error_msg = f"MIME type {detected_mime_type} not allowed"
            logger.warning(error_msg)
            return False, error_msg
            
        logger.info(f"MIME type validation successful: {detected_mime_type}")
        return True, ""
        
    except Exception as e:
        error_msg = f"MIME type validation error: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def validate_file_size(file_size_bytes: int) -> Tuple[bool, str]:
    """
    Validates file size against configured maximum limit.
    
    Args:
        file_size_bytes: Size of file in bytes
    
    Returns:
        Tuple of (validation_result, error_message)
    """
    # Convert bytes to MB for comparison
    file_size_mb = file_size_bytes / (1024 * 1024)
    max_size_mb = service_config['max_file_size_mb']
    
    if file_size_mb > max_size_mb:
        error_msg = f"File size {file_size_mb:.2f}MB exceeds maximum allowed size of {max_size_mb}MB"
        logger.warning(error_msg)
        return False, error_msg
        
    logger.info(f"File size validation successful: {file_size_mb:.2f}MB")
    return True, ""

def generate_file_hash(file_content: bytes) -> str:
    """
    Generates SHA-256 hash of file content for integrity verification.
    
    Args:
        file_content: Raw file content in bytes
    
    Returns:
        Hexadecimal hash string
    """
    hasher = hashlib.sha256()
    hasher.update(file_content)
    file_hash = hasher.hexdigest()
    logger.debug(f"Generated file hash: {file_hash}")
    return file_hash

def scan_for_viruses(file_content: bytes) -> Tuple[bool, str]:
    """
    Scans file content for viruses using ClamAV.
    
    Args:
        file_content: Raw file content in bytes
    
    Returns:
        Tuple of (scan_result, error_message)
    """
    try:
        # Initialize ClamAV client
        cd = clamd.ClamdUnixSocket()
        
        # Scan file content
        scan_result = cd.instream(file_content)
        scan_status = list(scan_result.values())[0]
        
        if scan_status[0] == 'OK':
            logger.info("Virus scan passed")
            return True, ""
        else:
            error_msg = f"Virus detected: {scan_status[1]}"
            logger.warning(error_msg)
            return False, error_msg
            
    except Exception as e:
        error_msg = f"Virus scan error: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def sanitize_filename(filename: str) -> str:
    """
    Sanitizes filename to prevent path traversal and other security issues.
    
    Args:
        filename: Original filename
    
    Returns:
        Sanitized filename
    """
    # Remove path components and keep only filename
    filename = os.path.basename(filename)
    
    # Remove potentially dangerous characters
    forbidden_chars = ['/', '\\', '..', ';', '&', '|', '*', '?', '<', '>', '^', '$']
    for char in forbidden_chars:
        filename = filename.replace(char, '')
        
    return filename

def validate_file(file_content: bytes, mime_type: str, file_name: str) -> Tuple[bool, str, Dict]:
    """
    Performs comprehensive file validation including security checks.
    
    Args:
        file_content: Raw file content in bytes
        mime_type: Claimed MIME type of the file
        file_name: Original filename
    
    Returns:
        Tuple of (validation_result, error_message, metadata)
    """
    start_time = time.time()
    metadata = {
        'original_filename': file_name,
        'sanitized_filename': '',
        'file_size_bytes': len(file_content),
        'mime_type': mime_type,
        'file_hash': '',
        'validation_time_ms': 0
    }
    
    try:
        # Check for empty file
        if not file_content:
            return False, "Empty file content", metadata
            
        # Sanitize filename
        metadata['sanitized_filename'] = sanitize_filename(file_name)
        
        # Validate MIME type
        mime_valid, mime_error = validate_mime_type(file_content, mime_type)
        if not mime_valid:
            return False, mime_error, metadata
            
        # Validate file size
        size_valid, size_error = validate_file_size(len(file_content))
        if not size_valid:
            return False, size_error, metadata
            
        # Generate file hash
        metadata['file_hash'] = generate_file_hash(file_content)
        
        # Perform virus scan if enabled
        if service_config.get('virus_scan_enabled', True):
            virus_free, virus_error = scan_for_viruses(file_content)
            if not virus_free:
                return False, virus_error, metadata
                
        # Apply content validation rules
        rules = service_config['content_validation_rules']
        # Additional content validation could be implemented here based on rules
        
        # Calculate validation time
        metadata['validation_time_ms'] = int((time.time() - start_time) * 1000)
        
        logger.info(f"File validation successful: {metadata['sanitized_filename']}")
        return True, "", metadata
        
    except Exception as e:
        error_msg = f"File validation error: {str(e)}"
        logger.error(error_msg)
        metadata['validation_time_ms'] = int((time.time() - start_time) * 1000)
        return False, error_msg, metadata

# Export public functions
__all__ = ['validate_file', 'generate_file_hash']