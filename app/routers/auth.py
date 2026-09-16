"""
Authentication endpoints.

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
"""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.core.deps import get_current_user
from app.core.errors import AuthError, ValidationError
from app.core.security import (
    create_access_token,
    dummy_verify,
    hash_password,
    verify_password,
)
from app.db.mongo import get_database, mongo_guard
from app.models.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
    serialise_user,
)

logger = logging.getLogger("chatdoc")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> Any:
    """
    Create a new account.

    Field-level validation (required fields, valid email, password length,
    matching confirmation) happens in RegisterRequest. Duplicate emails are
    caught by the unique index, which is race-free.
    """
    database = get_database()
    now = datetime.now(timezone.utc)

    user_document = {
        "name": payload.name,
        "email": payload.email,
        # Only the hash is ever stored. The plain password is never logged.
        "passwordHash": hash_password(payload.password),
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        result = await database.users.insert_one(user_document)
    except DuplicateKeyError:
        raise ValidationError("An account with this email already exists.")
    except PyMongoError as exc:
        raise mongo_guard(exc, "create your account")

    user_document["_id"] = result.inserted_id
    token = create_access_token(str(result.inserted_id))

    logger.info("New account registered: %s", payload.email)

    return {
        "accessToken": token,
        "tokenType": "bearer",
        "user": serialise_user(user_document),
    }


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> Any:
    """
    Exchange email + password for an access token.

    A missing user and a wrong password return the identical message, so the
    endpoint cannot be used to discover which emails are registered.
    """
    database = get_database()

    try:
        user = await database.users.find_one({"email": payload.email})
    except PyMongoError as exc:
        raise mongo_guard(exc, "sign you in")

    if user is None:
        # Spend the same time hashing as a real check would, so the response
        # time does not reveal whether this email is registered.
        dummy_verify()
        raise AuthError("Invalid email or password.")

    if not verify_password(payload.password, user.get("passwordHash", "")):
        raise AuthError("Invalid email or password.")

    token = create_access_token(str(user["_id"]))

    return {
        "accessToken": token,
        "tokenType": "bearer",
        "user": serialise_user(user),
    }


@router.post("/logout")
async def logout(_: dict = Depends(get_current_user)) -> Any:
    """
    Log out the current user.

    With stateless JWTs the authoritative action is the client discarding its
    token, which the frontend does. This endpoint exists so logout is an
    explicit, audited API call and so a future token denylist has a home.
    """
    return {"message": "Signed out successfully."}


@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)) -> Any:
    """Return the currently authenticated user. Used by the app to restore a session."""
    return serialise_user(user)
