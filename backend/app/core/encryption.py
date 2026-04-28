"""Encryption utilities for secure file storage."""

from cryptography.fernet import Fernet
import base64
import os
import hashlib
from app.core.config import settings

def get_cipher() -> Fernet:
    """Generate a Fernet cipher from the application SECRET_KEY."""
    secret = settings.SECRET_KEY.encode()
    if not secret:
        raise RuntimeError(
            "SECRET_KEY is empty. Cannot perform encryption. "
            "Set a strong SECRET_KEY in your .env file."
        )
    # Derive a 32-byte key via SHA-256 and base64-encode for Fernet
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
