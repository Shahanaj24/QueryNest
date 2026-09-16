"""
Document management endpoints.

POST   /api/documents/upload
GET    /api/documents
DELETE /api/documents/{document_id}

Replaces the original unauthenticated POST /upload/. The PDF processing and
indexing logic is unchanged; it now runs against the caller's own store and is
recorded in MongoDB.
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pymongo.errors import PyMongoError

from app.core import config
from app.core.deps import get_current_user, to_object_id
from app.core.errors import NotFoundError, ValidationError
from app.db.mongo import get_database, mongo_guard
from app.models.schemas import DocumentResponse, UploadResponse, serialise_document
from app.rag import pipeline

logger = logging.getLogger("chatdoc")

router = APIRouter(prefix="/api/documents", tags=["documents"])

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")
# A PDF must begin with this signature; checked so a renamed .exe is rejected.
_PDF_MAGIC = b"%PDF-"


def _safe_filename(raw: str) -> str:
    """
    Reduce an uploaded filename to something safe to display and store.

    Path components are stripped first (defeating ../ traversal), then any
    character outside a conservative allowlist is replaced.
    """
    base = Path(raw).name
    cleaned = _SAFE_NAME.sub("_", base).strip("._") or "document.pdf"
    return cleaned[:120]


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> Any:
    """
    Upload and index a PDF for the authenticated user.

    Validation order is deliberate: cheap checks (name, extension) run before
    the file is read, and the size limit is enforced while streaming so an
    oversized upload cannot exhaust memory or disk.
    """
    database = get_database()
    user_id = str(user["_id"])

    if not file.filename:
        raise ValidationError("No file was selected.")

    if Path(file.filename).suffix.lower() not in config.ALLOWED_EXTENSIONS:
        raise ValidationError("Only PDF files are supported.")

    display_name = _safe_filename(file.filename)

    # Read with a hard cap rather than trusting any client-supplied size.
    contents = await file.read(config.MAX_UPLOAD_BYTES + 1)
    await file.close()

    if len(contents) > config.MAX_UPLOAD_BYTES:
        raise ValidationError(f"This file is larger than the {config.MAX_UPLOAD_MB} MB limit.")

    if not contents:
        raise ValidationError("This file is empty.")

    if not contents.startswith(_PDF_MAGIC):
        raise ValidationError("This file does not appear to be a valid PDF.")

    # Store under the user's own directory with a unique name, so two users
    # uploading "resume.pdf" can never overwrite each other.
    user_upload_dir = config.UPLOAD_ROOT / user_id
    user_upload_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}.pdf"
    stored_path = user_upload_dir / stored_name

    try:
        stored_path.write_bytes(contents)
    except OSError as exc:
        logger.error("Could not save upload for user %s: %s", user_id, exc)
        raise ValidationError("The file could not be saved. Please try again.")

    now = datetime.now(timezone.utc)
    document_record = {
        "userId": user["_id"],
        "filename": display_name,
        "storedName": stored_name,
        "filePath": str(stored_path),
        "fileSize": len(contents),
        "uploadedAt": now,
        "status": "processing",
    }

    try:
        result = await database.documents.insert_one(document_record)
    except PyMongoError as exc:
        stored_path.unlink(missing_ok=True)
        raise mongo_guard(exc, "save your document")

    document_id = str(result.inserted_id)

    try:
        # Embedding is CPU-bound and blocking: run it off the event loop so the
        # server stays responsive during a large upload.
        index_result = await run_in_threadpool(
            pipeline.index_document,
            user_id=user_id,
            document_id=document_id,
            filename=display_name,
            file_path=str(stored_path),
        )
    except Exception as exc:
        # Processing failed: mark the record and clean up the orphaned file so
        # a failed upload never leaves an unusable document listed as ready.
        detail = getattr(exc, "detail", "This document could not be processed.")
        await database.documents.update_one(
            {"_id": result.inserted_id},
            {"$set": {"status": "failed", "error": str(detail)}},
        )
        stored_path.unlink(missing_ok=True)
        raise

    try:
        await database.documents.update_one(
            {"_id": result.inserted_id},
            {
                "$set": {
                    "status": "processed",
                    "chunkCount": index_result["chunkCount"],
                    "pageCount": index_result["pageCount"],
                    "chunkIds": index_result["chunkIds"],
                    "processedAt": datetime.now(timezone.utc),
                }
            },
        )
    except PyMongoError as exc:
        raise mongo_guard(exc, "finish saving your document")

    stored = await database.documents.find_one({"_id": result.inserted_id})

    return {
        "document": serialise_document(stored),
        "message": "Document uploaded and ready.",
    }


@router.get("", response_model=list[DocumentResponse])
async def list_documents(user: dict = Depends(get_current_user)) -> Any:
    """List the authenticated user's documents, newest first."""
    database = get_database()

    try:
        cursor = database.documents.find({"userId": user["_id"]}).sort("uploadedAt", -1)
        documents = await cursor.to_list(length=200)
    except PyMongoError as exc:
        raise mongo_guard(exc, "load your documents")

    return [serialise_document(doc) for doc in documents]


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    user: dict = Depends(get_current_user),
) -> Any:
    """
    Delete one of the authenticated user's documents.

    The query filters on both _id and userId, so requesting another user's
    document id returns 404 -- it is indistinguishable from a document that
    does not exist, which avoids confirming that the id belongs to someone.
    """
    database = get_database()
    object_id = to_object_id(document_id, "This document was not found.")

    try:
        document = await database.documents.find_one(
            {"_id": object_id, "userId": user["_id"]}
        )
    except PyMongoError as exc:
        raise mongo_guard(exc, "delete your document")

    if document is None:
        raise NotFoundError("This document was not found.")

    user_id = str(user["_id"])

    # Remove vectors first so the document stops appearing in answers even if
    # a later step fails.
    await run_in_threadpool(
        pipeline.delete_document_vectors,
        user_id,
        document_id,
        document.get("chunkIds", []) or [],
    )

    file_path = document.get("filePath")
    if file_path:
        Path(file_path).unlink(missing_ok=True)

    try:
        await database.documents.delete_one({"_id": object_id, "userId": user["_id"]})
        remaining = await database.documents.count_documents({"userId": user["_id"]})
    except PyMongoError as exc:
        raise mongo_guard(exc, "delete your document")

    if remaining == 0:
        pipeline.drop_user_store(user_id)

    return {"message": "Document deleted."}
