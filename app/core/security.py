"""
Password hashing and JWT creation/verification.

Passwords are hashed with bcrypt and are never stored or logged in plain text.
Tokens are signed JWTs carrying only the user id and an expiry.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
import jwt

from app.core import config

# bcrypt only considers the first 72 bytes of a password. Rather than silently
# truncating (which would make two different long passwords equivalent), the
# API validates length up front and this module enforces the same bound.
# Note the bound is in BYTES, not characters: the schema validates the encoded
# length so a short string of multi-byte characters cannot slip past it.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """Return a bcrypt hash of the given plain-text password."""
    password_bytes = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plain-text password against a stored bcrypt hash."""
    try:
        password_bytes = password.encode("utf-8")[:BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed hash in the database: treat as a failed login rather than
        # raising, so the caller returns a generic "invalid credentials".
        return False


# A real bcrypt hash of a throwaway value, used to spend the same ~100ms on a
# login for an unknown email as for a known one. Without it, `user is None`
# short-circuits the hash comparison and the response time alone reveals which
# emails are registered, undoing the identical error messages in the router.
_TIMING_EQUALISER_HASH = bcrypt.hashpw(b"timing-equaliser", bcrypt.gensalt()).decode("utf-8")


def dummy_verify() -> None:
    """Burn the same work as a real password check, then discard the result."""
    verify_password("timing-equaliser", _TIMING_EQUALISER_HASH)


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    """
    Create a signed JWT for the given user id.

    The token deliberately carries no personal data: only the subject (user id),
    issued-at and expiry claims.
    """
    minutes = expires_minutes or config.ACCESS_TOKEN_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)

    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }

    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """
    Verify a JWT and return the user id it refers to.

    Returns None when the token is missing, expired, tampered with, or
    otherwise invalid. Callers translate that into a 401.
    """
    try:
        payload = jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM],
        )
    except jwt.PyJWTError:
        return None

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        return None

    return subject
