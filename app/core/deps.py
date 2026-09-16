"""
Authentication dependency.

`get_current_user` is the backend half of route protection (requirement 4):
every protected endpoint depends on it, so a request without a valid token is
rejected server-side regardless of what the frontend does.
"""

from typing import Any, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import AuthError
from app.core.security import decode_access_token
from app.db.mongo import get_database

# auto_error=False so a missing header produces our own worded 401
# rather than FastAPI's default "Not authenticated".
_bearer_scheme = HTTPBearer(auto_error=False)


def to_object_id(value: str, message: str = "The requested item was not found.") -> ObjectId:
    """
    Convert a string to an ObjectId, treating malformed ids as 'not found'.

    This matters for security: a bad id and someone else's id should be
    indistinguishable to the caller.
    """
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        from app.core.errors import NotFoundError

        raise NotFoundError(message)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict[str, Any]:
    """
    Resolve the authenticated user from the Authorization: Bearer header.

    Raises 401 when the header is absent, the token is invalid or expired, or
    the user it refers to no longer exists (e.g. a deleted account holding an
    otherwise still-valid token).
    """
    if credentials is None or not credentials.credentials:
        raise AuthError("You need to sign in to continue.")

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise AuthError("Your session has expired. Please sign in again.")

    try:
        object_id = ObjectId(user_id)
    except (InvalidId, TypeError):
        raise AuthError("Your session is not valid. Please sign in again.")

    database = get_database()
    user = await database.users.find_one({"_id": object_id})

    if user is None:
        raise AuthError("Your session is no longer valid. Please sign in again.")

    return user
