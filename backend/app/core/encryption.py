"""Encryption utilities for secure file storage."""

from cryptography.fernet import Fernet
import base64
import os
import hashlib
from app.core.config import settings

def get_cipher() -> Fernet:
    """Generate a Fernet cipher from the application SECRET_KEY."""
    # We must ensure the key is exactly 32 url-safe base64-encoded bytes.
    # We derive it by hashing the SECRET_KEY to 32 bytes and encoding it.
    secret = settings.SECRET_KEY.encode()
    if not secret:
        # Fallback for dev if SECRET_KEY is empty
        secret = b"default_insecure_secret_key_for_dev_only"
        
    derived_key = hashlib.sha256(secret).digest()
    fernet_key = base64.urlsafe_b64encode(derived_key)
    return Fernet(fernet_key)

def encrypt_file(file_data: bytes) -> bytes:
    """Encrypt binary data."""
    cipher = get_cipher()
    return cipher.encrypt(file_data)

def decrypt_file(encrypted_data: bytes) -> bytes:
    """Decrypt binary data."""
    cipher = get_cipher()
    return cipher.decrypt(encrypted_data)
