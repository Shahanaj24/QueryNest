"""
User profile endpoints.

GET /api/users/profile
PUT /api/users/profile
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pymongo.errors import PyMongoError

from app.core.deps import get_current_user
from app.db.mongo import get_database, mongo_guard
from app.models.schemas import (
    ProfileResponse,
    UpdateProfileRequest,
    UserResponse,
    serialise_user,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(user: dict = Depends(get_current_user)) -> Any:
    """Return the profile plus the user's document and conversation counts."""
    database = get_database()
    user_id = user["_id"]

    try:
        document_count = await database.documents.count_documents({"userId": user_id})
        conversation_count = await database.conversations.count_documents({"userId": user_id})
    except PyMongoError as exc:
        raise mongo_guard(exc, "load your profile")

    profile = serialise_user(user)
    profile["documentCount"] = document_count
    profile["conversationCount"] = conversation_count

    return profile


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    user: dict = Depends(get_current_user),
) -> Any:
    """
    Update the editable parts of the profile.

    Only `name` is written. The update is scoped to the authenticated user's own
    _id, so a request can never modify another account, and protected fields
    (email, passwordHash, createdAt) are never included in the $set.
    """
    database = get_database()
    now = datetime.now(timezone.utc)

    try:
        updated = await database.users.find_one_and_update(
            {"_id": user["_id"]},
            {"$set": {"name": payload.name, "updatedAt": now}},
            return_document=True,
        )
    except PyMongoError as exc:
        raise mongo_guard(exc, "update your profile")

    return serialise_user(updated or user)
