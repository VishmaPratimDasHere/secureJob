"""Security middleware — rate limiting, request size, security headers, CSRF, input sanitization."""

import time
import secrets
import logging
import re
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("securejob.security")

# ─── Global Rate Limiter (sliding window per IP) ─────────────────────────────

_request_log: dict[str, list[float]] = defaultdict(list)
_blocked_ips: dict[str, float] = {}  # IP -> block expiry timestamp

# Configurable limits
GLOBAL_RATE_LIMIT = 100           # max requests per window
GLOBAL_RATE_WINDOW = 60           # window in seconds
SENSITIVE_RATE_LIMIT = 10         # stricter limit for auth endpoints
SENSITIVE_RATE_WINDOW = 60        # window for auth endpoints
BLOCK_DURATION = 300              # 5-minute ban for exceeding limits
MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024  # 10 MB global max
CLEANUP_INTERVAL = 300            # clean stale entries every 5 min
_last_cleanup: float = 0.0

SENSITIVE_PATHS = {
    "/api/accounts/register",
    "/api/accounts/login/request-otp",
    "/api/accounts/login/verify-otp",
    "/api/accounts/resend-otp",
    "/api/accounts/verify-otp",
}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _cleanup_stale_entries():
    """Periodically purge old entries to prevent memory leaks."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < CLEANUP_INTERVAL:
        return
    _last_cleanup = now

    cutoff = now - GLOBAL_RATE_WINDOW
    stale_ips = [ip for ip, timestamps in _request_log.items() if not timestamps or timestamps[-1] < cutoff]
    for ip in stale_ips:
        del _request_log[ip]

    expired_blocks = [ip for ip, expiry in _blocked_ips.items() if now > expiry]
    for ip in expired_blocks:
        del _blocked_ips[ip]


def _is_rate_limited(ip: str, path: str) -> Optional[str]:
    """Check if IP is rate-limited. Returns error message or None."""
    now = time.time()

    # Check if IP is blocked
    if ip in _blocked_ips:
        if now < _blocked_ips[ip]:
            remaining = int(_blocked_ips[ip] - now)
            return f"Too many requests. Blocked for {remaining}s."
        else:
            del _blocked_ips[ip]

    is_sensitive = path in SENSITIVE_PATHS
    limit = SENSITIVE_RATE_LIMIT if is_sensitive else GLOBAL_RATE_LIMIT
    window = SENSITIVE_RATE_WINDOW if is_sensitive else GLOBAL_RATE_WINDOW

    cutoff = now - window
    _request_log[ip] = [t for t in _request_log[ip] if t > cutoff]
    _request_log[ip].append(now)

    if len(_request_log[ip]) > limit:
        _blocked_ips[ip] = now + BLOCK_DURATION
        logger.warning("Rate limit exceeded for IP %s on %s — blocked for %ds", ip, path, BLOCK_DURATION)
        return "Rate limit exceeded. Please slow down."

    return None


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # XSS protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # Disable caching for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissions policy — disable unnecessary browser features
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Global rate limiting + request size enforcement."""

    async def dispatch(self, request: Request, call_next):
        _cleanup_stale_entries()

        ip = _get_client_ip(request)
        path = request.url.path

        # Skip rate limiting for health checks
        if path in ("/health", "/"):
            return await call_next(request)

        # Rate limit check
        error = _is_rate_limited(ip, path)
        if error:
            return JSONResponse(
                status_code=429,
                content={"detail": error},
                headers={"Retry-After": str(BLOCK_DURATION)},
            )

        # Request body size check (from Content-Length header)
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Request body too large. Maximum is {MAX_REQUEST_BODY_SIZE // (1024 * 1024)}MB."},
            )

        return await call_next(request)


# ─── CSRF Token store (in-memory; use Redis in prod) ─────────────────────────
_csrf_tokens: dict[str, float] = {}   # token -> expiry timestamp
CSRF_TOKEN_TTL = 3600                  # 1 hour

# State-changing methods that require a CSRF token
_CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Paths exempt from CSRF (JWT-only APIs, login endpoints)
_CSRF_EXEMPT_PREFIXES = (
    "/api/accounts/login",
    "/api/accounts/register",
    "/api/accounts/password-reset",
    "/docs",
    "/openapi.json",
    "/health",
)


def issue_csrf_token() -> str:
    """Generate and store a CSRF token."""
    token = secrets.token_urlsafe(32)
    _csrf_tokens[token] = time.time() + CSRF_TOKEN_TTL
    return token


def _cleanup_csrf_tokens():
    now = time.time()
    expired = [t for t, exp in _csrf_tokens.items() if now > exp]
    for t in expired:
        del _csrf_tokens[t]


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Double-submit cookie CSRF protection.
    - GET /api/csrf  →  issues a CSRF token as a cookie + JSON body
    - All state-changing requests must include X-CSRF-Token header
      matching a valid issued token.
    - Pure JWT (Authorization: Bearer) requests are exempt because
      they are not vulnerable to CSRF (browser never auto-attaches Bearer).
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        method = request.method

        # Exempt safe methods and special paths
        if method in _CSRF_SAFE_METHODS:
            return await call_next(request)
        if any(path.startswith(p) for p in _CSRF_EXEMPT_PREFIXES):
            return await call_next(request)

        # If request carries a Bearer token it's a programmatic API call — exempt
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return await call_next(request)

        # Otherwise validate CSRF token
        csrf_header = request.headers.get("X-CSRF-Token", "")
        _cleanup_csrf_tokens()
        now = time.time()
        if not csrf_header or csrf_header not in _csrf_tokens or now > _csrf_tokens.get(csrf_header, 0):
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing or invalid. Fetch a token from GET /api/csrf."},
            )

        return await call_next(request)


# ─── HTML / XSS sanitization helper ─────────────────────────────────────────

# Strip tags and dangerous attributes from free-text input
_TAG_RE = re.compile(r'<[^>]+>')
_JS_RE = re.compile(r'javascript\s*:', re.IGNORECASE)
_EVENT_RE = re.compile(r'\bon\w+\s*=', re.IGNORECASE)


def sanitize_text(value: str) -> str:
    """Strip HTML tags, javascript: URIs, and inline event handlers from text."""
    if not isinstance(value, str):
        return value
    value = _TAG_RE.sub('', value)
    value = _JS_RE.sub('', value)
    value = _EVENT_RE.sub('', value)
    return value
