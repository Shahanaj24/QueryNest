"""
RAG pipeline: PDF -> text -> chunks -> embeddings -> FAISS -> retrieval.

The four pipeline components from the original project are preserved exactly:
    PyPDFLoader, CharacterTextSplitter, HuggingFaceEmbeddings, FAISS

What changed is the *architecture around them*: instead of one global index
shared by every user, each user gets their own index at faiss_store/{userId}/.
Isolation is therefore structural -- a retrieval call loads only the caller's
directory, so another user's vectors are not merely filtered out, they are
never in the search space to begin with.
"""

import logging
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any, Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import CharacterTextSplitter

from app.core import config
from app.core.errors import ServiceError, ValidationError
from app.rag.embeddings import get_embeddings

logger = logging.getLogger("chatdoc")


# ----------------------------------------------------------------------
# Per-user vector store cache
# ----------------------------------------------------------------------

# Loading a FAISS index from disk on every question is wasteful, but keeping
# every user's index in memory forever would leak. A small LRU cache bounds it.
# The lock guards both the cache and on-disk writes, because FAISS objects are
# not thread-safe and FastAPI runs sync work in a thread pool.
_store_cache: "OrderedDict[str, FAISS]" = OrderedDict()
_lock = threading.RLock()


def _user_store_path(user_id: str) -> Path:
    return config.VECTOR_STORE_ROOT / user_id


def _cache_put(user_id: str, store: FAISS) -> None:
    _store_cache[user_id] = store
    _store_cache.move_to_end(user_id)
    while len(_store_cache) > config.VECTOR_CACHE_SIZE:
        evicted_id, _ = _store_cache.popitem(last=False)
        logger.debug("Evicted vector store for user %s from cache.", evicted_id)


def load_user_store(user_id: str) -> Optional[FAISS]:
    """
    Return the user's FAISS index, or None if they have no documents yet.

    Uses the same FAISS.load_local(..., allow_dangerous_deserialization=True)
    call as the original code. That flag is required because LangChain stores
    the docstore as a pickle; it is safe here because the file is written by
    this application, never uploaded by a user.
    """
    with _lock:
        cached = _store_cache.get(user_id)
        if cached is not None:
            _store_cache.move_to_end(user_id)
            return cached

        store_path = _user_store_path(user_id)
        if not (store_path / "index.faiss").exists():
            return None

        try:
            store = FAISS.load_local(
                str(store_path),
                get_embeddings(),
                allow_dangerous_deserialization=True,
            )
        except Exception as exc:
            logger.error("Failed to load vector store for user %s: %s", user_id, exc)
            raise ServiceError("Could not open your document index. Please try again.")

        _cache_put(user_id, store)
        return store


def process_document(file_path: str) -> list:
    """
    Load a PDF and split its text into chunks.

    UNCHANGED from the original `process_document`: same PyPDFLoader, same
    CharacterTextSplitter with chunk_size=1000 / chunk_overlap=200 (now read
    from config, with those values as defaults).
    """
    try:
        loader = PyPDFLoader(file_path)
        documents = loader.load()
        logger.info("PDF pages loaded: %d", len(documents))

        text_splitter = CharacterTextSplitter(
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
        )
        texts = text_splitter.split_documents(documents)
        logger.info("Document chunks created: %d", len(texts))

        return texts

    except Exception as exc:
        logger.error("Error processing PDF '%s': %s", file_path, exc)
        raise ValidationError(
            "This PDF could not be read. It may be corrupted, empty, or scanned "
            "without selectable text."
        )


def index_document(
    *,
    user_id: str,
    document_id: str,
    filename: str,
    file_path: str,
) -> dict[str, Any]:
    """
    Process a PDF and add its chunks to the user's own FAISS index.

    Each chunk is stamped with userId, documentId, filename and page so that
    citations are traceable and a document's vectors can later be deleted.

    Returns page/chunk counts and the FAISS ids of the added vectors, which the
    caller persists in MongoDB to support deletion.
    """
    chunks = process_document(file_path)

    if not chunks:
        raise ValidationError("No readable text could be extracted from this PDF.")

    page_numbers = set()

    for chunk in chunks:
        # PyPDFLoader pages are 0-based; store 1-based for human-readable citations.
        raw_page = chunk.metadata.get("page")
        page = raw_page + 1 if isinstance(raw_page, int) else None
        if page is not None:
            page_numbers.add(page)

        # Preserve the loader's original metadata and add ownership fields.
        chunk.metadata.update(
            {
                "userId": user_id,
                "documentId": document_id,
                "filename": filename,
                "page": page,
            }
        )

    embeddings = get_embeddings()

    with _lock:
        try:
            # Same construction call as the original code.
            new_store = FAISS.from_documents(chunks, embeddings)

            existing = load_user_store(user_id)

            if existing is None:
                store = new_store
            else:
                # Same merge strategy as the original, but scoped to one user.
                existing.merge_from(new_store)
                store = existing

            store_path = _user_store_path(user_id)
            store_path.mkdir(parents=True, exist_ok=True)
            store.save_local(str(store_path))

            _cache_put(user_id, store)

            # Map the chunks just added back to their FAISS ids so the document
            # can be deleted later without rebuilding the whole index.
            chunk_ids = [
                stored_id
                for stored_id, doc in store.docstore._dict.items()
                if doc.metadata.get("documentId") == document_id
            ]

            vector_count = store.index.ntotal

        except ValidationError:
            raise
        except Exception as exc:
            logger.error("FAISS indexing failed for user %s: %s", user_id, exc)
            raise ServiceError("Could not index this document. Please try again.")

    logger.info(
        "Indexed document %s for user %s (%d chunks, index now %d vectors).",
        document_id,
        user_id,
        len(chunks),
        vector_count,
    )

    return {
        "chunkCount": len(chunks),
        "pageCount": len(page_numbers) or None,
        "chunkIds": chunk_ids,
        "vectorCount": vector_count,
    }


def delete_document_vectors(user_id: str, document_id: str, chunk_ids: list[str]) -> None:
    """
    Remove one document's vectors from the user's index.

    FAISS.delete() needs explicit ids, which is why chunk ids are recorded at
    index time. If they are missing (e.g. an older record), fall back to
    matching on documentId metadata.
    """
    with _lock:
        store = load_user_store(user_id)
        if store is None:
            return

        ids = chunk_ids or [
            stored_id
            for stored_id, doc in store.docstore._dict.items()
            if doc.metadata.get("documentId") == document_id
        ]

        if not ids:
            return

        try:
            # Only delete ids the store actually holds, or FAISS raises.
            present = [i for i in ids if i in store.docstore._dict]
            if present:
                store.delete(present)

            store_path = _user_store_path(user_id)
            store_path.mkdir(parents=True, exist_ok=True)
            store.save_local(str(store_path))
            _cache_put(user_id, store)

            logger.info(
                "Deleted %d vectors for document %s (user %s).",
                len(present),
                document_id,
                user_id,
            )
        except Exception as exc:
            # A failed vector cleanup must not block deleting the user's file
            # and database record, so this is logged rather than raised.
            logger.error(
                "Could not delete vectors for document %s (user %s): %s",
                document_id,
                user_id,
                exc,
            )


def retrieve(user_id: str, query: str, k: Optional[int] = None) -> list:
    """
    Return the most relevant chunks from this user's documents only.

    The store is selected by user id before any search happens, which is what
    guarantees one user can never retrieve another's content.
    """
    store = load_user_store(user_id)
    if store is None:
        return []

    try:
        with _lock:
            # Same similarity_search API as the original code; k raised via config.
            return store.similarity_search(query, k=k or config.RETRIEVAL_K)
    except Exception as exc:
        logger.error("FAISS search failed for user %s: %s", user_id, exc)
        raise ServiceError("Could not search your documents right now. Please try again.")


def drop_user_store(user_id: str) -> None:
    """Forget a user's cached index (used after deleting their last document)."""
    with _lock:
        _store_cache.pop(user_id, None)
