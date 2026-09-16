"""
Pydantic request/response schemas.

These double as the input-validation layer: anything that fails here is
rejected before it reaches a router, and is reported to the user as a readable
message by the RequestValidationError handler.
"""

from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core import config


# ----------------------------------------------------------------------
# Auth
# ----------------------------------------------------------------------


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=config.PASSWORD_MIN_LENGTH, max_length=72)
    confirmPassword: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required.")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        # Stored lowercase so "A@x.com" and "a@x.com" cannot both register.
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def password_must_fit_bcrypt(cls, value: str) -> str:
        # max_length above counts characters, but bcrypt's 72-byte limit counts
        # bytes. Without this check a 72-character password of multi-byte
        # characters would be silently truncated, making two different
        # passwords sharing a 72-byte prefix interchangeable at login.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long. Please choose a shorter one.")
        return value

    @model_validator(mode="after")
    def passwords_must_match(self):
        if self.password != self.confirmPassword:
            raise ValueError("Passwords do not match.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalise_email(cls, value: str) -> str:
        return value.strip().lower()


class UserResponse(BaseModel):
    """The public shape of a user. Deliberately excludes passwordHash."""

    id: str
    name: str
    email: str
    createdAt: datetime
    updatedAt: Optional[datetime] = None


class AuthResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    user: UserResponse


# ----------------------------------------------------------------------
# Profile
# ----------------------------------------------------------------------


class ProfileResponse(UserResponse):
    documentCount: int = 0
    conversationCount: int = 0


class UpdateProfileRequest(BaseModel):
    """
    Only the name is editable.

    Email and password changes are intentionally not accepted here: email is
    the account identity and would need a re-verification flow, and password
    changes need the current password. Extra fields are ignored rather than
    trusted, so a client cannot smuggle in `role` or `passwordHash`.
    """

    name: str = Field(..., min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name cannot be empty.")
        return cleaned


# ----------------------------------------------------------------------
# Documents
# ----------------------------------------------------------------------


class DocumentResponse(BaseModel):
    id: str
    filename: str
    fileSize: int
    uploadedAt: datetime
    status: str
    pageCount: Optional[int] = None
    chunkCount: Optional[int] = None
    error: Optional[str] = None


class UploadResponse(BaseModel):
    document: DocumentResponse
    message: str


# ----------------------------------------------------------------------
# Conversations and messages
# ----------------------------------------------------------------------


class Source(BaseModel):
    """A citation pointing at a real retrieved chunk."""

    document: str
    documentId: Optional[str] = None
    page: Optional[int] = None


class MessageResponse(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    sources: List[Source] = Field(default_factory=list)
    createdAt: datetime


class ConversationResponse(BaseModel):
    id: str
    title: str
    createdAt: datetime
    updatedAt: datetime
    messageCount: int = 0


class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = Field(default_factory=list)


class CreateConversationRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Question cannot be empty.")
        return cleaned


class SendMessageResponse(BaseModel):
    conversationId: str
    title: str
    userMessage: MessageResponse
    assistantMessage: MessageResponse


# ----------------------------------------------------------------------
# Serialisation helpers
# ----------------------------------------------------------------------


def serialise_user(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "name": document.get("name", ""),
        "email": document.get("email", ""),
        "createdAt": document.get("createdAt"),
        "updatedAt": document.get("updatedAt"),
    }


def serialise_document(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "filename": document.get("filename", ""),
        "fileSize": document.get("fileSize", 0),
        "uploadedAt": document.get("uploadedAt"),
        "status": document.get("status", "unknown"),
        "pageCount": document.get("pageCount"),
        "chunkCount": document.get("chunkCount"),
        "error": document.get("error"),
    }


def serialise_message(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "role": document.get("role", "assistant"),
        "content": document.get("content", ""),
        "sources": document.get("sources", []) or [],
        "createdAt": document.get("createdAt"),
    }


def serialise_conversation(document: dict[str, Any], message_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "title": document.get("title", "New chat"),
        "createdAt": document.get("createdAt"),
        "updatedAt": document.get("updatedAt"),
        "messageCount": message_count,
    }
