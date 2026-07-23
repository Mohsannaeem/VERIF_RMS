"""
auth.py — password hashing, JWT mint/verify, and FastAPI auth dependencies.

Hashing uses the `bcrypt` library directly rather than passlib: passlib 1.7.4
(unmaintained since 2020) raises on bcrypt >= 4.1, so building on it would fail
at runtime. `passlib[bcrypt]` stays in requirements only to pull bcrypt in.

Environment:
  JWT_SECRET_KEY — token signing secret. Auto-generated per process if unset,
                   which means tokens do not survive a restart; set it
                   explicitly in production.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Config ────────────────────────────────────────────────────────────────────
JWT_SECRET: str    = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(48))
JWT_ALGORITHM: str = "HS256"
SESSION_DAYS: int  = 1     # default session length
REMEMBER_DAYS: int = 30    # "stay signed in"

_BCRYPT_MAX = 72           # bcrypt hashes only the first 72 bytes

bearer_scheme = HTTPBearer(auto_error=False)


# ── Passwords ─────────────────────────────────────────────────────────────────

def _pw_bytes(plain: str) -> bytes:
    """UTF-8 bytes truncated to bcrypt's 72-byte limit (bcrypt 5 raises past it)."""
    return plain.encode("utf-8")[:_BCRYPT_MAX]


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of a plain-text password."""
    return bcrypt.hashpw(_pw_bytes(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain-text password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(_pw_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ── JWT (HS256) ───────────────────────────────────────────────────────────────
# Signed with the standard library rather than python-jose: this environment's
# `cryptography` build is broken, and HS256 is only HMAC-SHA256, which stdlib does
# natively. Keeping auth off a fragile C-extension is the safer call regardless.

class JWTError(Exception):
    """Raised when a token is malformed, mis-signed, or expired."""


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(seg: str) -> bytes:
    return base64.urlsafe_b64decode(seg + "=" * (-len(seg) % 4))


def _sign(signing_input: bytes) -> str:
    return _b64url(hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest())


def create_access_token(data: dict, remember: bool = False) -> str:
    """Mint a signed JWT. Valid 30 days when `remember`, otherwise 1 day."""
    days    = REMEMBER_DAYS if remember else SESSION_DAYS
    payload = {**data, "exp": int(time.time() + timedelta(days=days).total_seconds())}
    header  = _b64url(json.dumps({"alg": JWT_ALGORITHM, "typ": "JWT"}, separators=(",", ":")).encode())
    body    = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}".encode()
    return f"{header}.{body}.{_sign(signing_input)}"


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises JWTError on invalid, tampered, or expired tokens."""
    try:
        header, body, sig = token.split(".")
    except ValueError:
        raise JWTError("Malformed token.")
    # Constant-time signature comparison.
    if not hmac.compare_digest(sig, _sign(f"{header}.{body}".encode())):
        raise JWTError("Bad signature.")
    try:
        claims = json.loads(_b64url_decode(body))
    except (ValueError, json.JSONDecodeError):
        raise JWTError("Undecodable payload.")
    if "exp" in claims and time.time() >= claims["exp"]:
        raise JWTError("Token expired.")
    return claims


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def get_current_user_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """Decoded JWT payload for the request, or HTTP 401 if absent/expired."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Not authenticated. Please sign in.")
    try:
        return decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Session expired or invalid. Please sign in again.")


def get_optional_user_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    """Like get_current_user_payload but returns None instead of raising, for
    endpoints that are public yet behave differently when a user is present
    (e.g. /api/keys scoping listings to the caller)."""
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except JWTError:
        return None
