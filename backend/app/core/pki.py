"""PKI utilities — RSA key generation, signing, and verification."""

import base64
import hashlib
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet

from app.core.config import settings


def _get_key_encryption_key() -> bytes:
    """Derive a Fernet key from SECRET_KEY to encrypt stored private keys."""
    import base64
    derived = hashlib.sha256(f"pki-{settings.SECRET_KEY}".encode()).digest()
    return base64.urlsafe_b64encode(derived)


def generate_user_keypair() -> tuple[str, str]:
    """
    Generate an RSA-2048 key pair for a user.
    Returns (pem_public_key, encrypted_pem_private_key).
    Private key is encrypted with Fernet before storage.
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend(),
    )
    public_key = private_key.public_key()

    pub_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    priv_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # Encrypt private key at rest
    fernet = Fernet(_get_key_encryption_key())
    encrypted_priv = fernet.encrypt(priv_pem).decode("utf-8")

    return pub_pem, encrypted_priv


def _load_private_key(encrypted_pem: str):
    """Decrypt and load a user's RSA private key."""
    fernet = Fernet(_get_key_encryption_key())
    pem = fernet.decrypt(encrypted_pem.encode("utf-8"))
    return serialization.load_pem_private_key(pem, password=None, backend=default_backend())


def _load_public_key(pem: str):
    """Load an RSA public key from PEM string."""
    return serialization.load_pem_public_key(pem.encode("utf-8"), backend=default_backend())


def sign_data(data: bytes, encrypted_private_key_pem: str) -> str:
    """Sign data with user's RSA private key. Returns base64-encoded signature."""
    private_key = _load_private_key(encrypted_private_key_pem)
    signature = private_key.sign(
        data,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode("utf-8")


def verify_signature(data: bytes, signature_b64: str, public_key_pem: str) -> bool:
    """Verify a base64-encoded RSA signature against data using a public key PEM."""
    try:
        public_key = _load_public_key(public_key_pem)
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            data,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH,
            ),
            hashes.SHA256(),
        )
        return True
    except Exception:
        return False


# ─── Server-level signing key (for resume integrity) ─────────────────────────

_server_private_key = None
_server_public_key_pem = None


def get_server_keys() -> tuple:
    """Return (private_key_object, public_key_pem). Generated once per process."""
    global _server_private_key, _server_public_key_pem
    if _server_private_key is None:
        # Try to load from disk; generate if not found
        import os
        key_path = "certs/server_signing.key"
        pub_path = "certs/server_signing.pub"
        if os.path.exists(key_path) and os.path.exists(pub_path):
            with open(key_path, "rb") as f:
                _server_private_key = serialization.load_pem_private_key(
                    f.read(), password=None, backend=default_backend()
                )
            with open(pub_path, "r") as f:
                _server_public_key_pem = f.read()
        else:
            priv = rsa.generate_private_key(
                public_exponent=65537, key_size=2048, backend=default_backend()
            )
            os.makedirs("certs", exist_ok=True)
            with open(key_path, "wb") as f:
                f.write(priv.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption(),
                ))
            pub_pem = priv.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode("utf-8")
            with open(pub_path, "w") as f:
                f.write(pub_pem)
            _server_private_key = priv
            _server_public_key_pem = pub_pem
    return _server_private_key, _server_public_key_pem


def server_sign(data: bytes) -> str:
    """Sign data with the server's RSA private key."""
    private_key, _ = get_server_keys()
    sig = private_key.sign(
        data,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
        hashes.SHA256(),
    )
    return base64.b64encode(sig).decode("utf-8")


def server_verify(data: bytes, signature_b64: str) -> bool:
    """Verify data against server signature."""
    try:
        _, pub_pem = get_server_keys()
        pub = _load_public_key(pub_pem)
        sig = base64.b64decode(signature_b64)
        pub.verify(
            sig, data,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256(),
        )
        return True
    except Exception:
        return False
