"""
Centralised error handling.

Goal: users always receive a short, friendly message, while full details
(including stack traces) stay in the server logs. No Python exception text is
ever forwarded to the client.
"""

import logging
import traceback

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("chatdoc")


class AppError(HTTPException):
    """
    An error that is safe to show to the user.

    Raise this (or a subclass) anywhere in the application when the message is
    intended for a human reading the UI.
    """

    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)


class NotFoundError(AppError):
    def __init__(self, detail: str = "The requested item was not found."):
        super().__init__(status.HTTP_404_NOT_FOUND, detail)


class ValidationError(AppError):
    def __init__(self, detail: str = "The submitted data is not valid."):
        super().__init__(status.HTTP_400_BAD_REQUEST, detail)


class AuthError(AppError):
    def __init__(self, detail: str = "Authentication is required."):
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail)


class PermissionError_(AppError):
    """Named with a trailing underscore to avoid shadowing the builtin."""

    def __init__(self, detail: str = "You do not have access to this item."):
        super().__init__(status.HTTP_403_FORBIDDEN, detail)


class ServiceError(AppError):
    """An upstream dependency (Gemini, MongoDB, FAISS) failed."""

    def __init__(self, detail: str = "A required service is currently unavailable."):
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, detail)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach handlers that guarantee a consistent, safe error shape."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException):
        # HTTPException details are author-written and safe to return as-is.
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError):
        # Convert Pydantic's nested output into one readable sentence,
        # e.g. "email: value is not a valid email address".
        messages = []
        for error in exc.errors():
            location = [str(part) for part in error.get("loc", []) if part != "body"]
            field = ".".join(location) if location else "request"
            messages.append(f"{field}: {error.get('msg', 'is invalid')}")

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "; ".join(messages) or "The submitted data is not valid."},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        # Log everything server-side...
        logger.error(
            "Unhandled error on %s %s: %s\n%s",
            request.method,
            request.url.path,
            exc,
            traceback.format_exc(),
        )
        # ...but tell the user nothing about the internals.
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Something went wrong on our side. Please try again."},
        )
