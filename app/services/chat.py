"""
Conversational RAG orchestration.

Ties together the pieces for one question:
    history -> condensed query -> per-user FAISS retrieval -> Gemini -> answer + citations

This is the module that replaces the original `query_document` function. The
retrieval and generation steps are the same in spirit; what is added is user
scoping, conversation awareness, and citations built from real chunk metadata.
"""

import logging
from typing import Any

from app.core import config
from app.rag import pipeline
from app.services import gemini

logger = logging.getLogger("chatdoc")


def _build_sources(chunks: list) -> list[dict[str, Any]]:
    """
    Build citations from the chunks that were actually retrieved.

    Page numbers come from PDF metadata recorded at index time, never from the
    model, so a citation cannot be hallucinated. Duplicates are collapsed
    because several chunks often come from the same page.
    """
    seen: set[tuple[str, Any]] = set()
    sources: list[dict[str, Any]] = []

    for chunk in chunks:
        filename = chunk.metadata.get("filename") or chunk.metadata.get("source") or "document"
        page = chunk.metadata.get("page")
        document_id = chunk.metadata.get("documentId")

        key = (filename, page)
        if key in seen:
            continue
        seen.add(key)

        sources.append({"document": filename, "documentId": document_id, "page": page})

    return sources


def answer_for_user(
    *,
    user_id: str,
    question: str,
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Answer one question for one user.

    `history` is the recent message window, already bounded by the caller so
    the prompt cannot grow indefinitely as a conversation continues.
    """
    recent = history[-config.HISTORY_WINDOW :] if history else []

    # Resolve pronouns so follow-up questions retrieve the right chunks.
    search_query = gemini.condense_question(question, recent) if recent else question

    if search_query != question:
        logger.info("Condensed follow-up for retrieval: %r -> %r", question, search_query)

    chunks = pipeline.retrieve(user_id, search_query)

    answer = gemini.answer_question(question=question, chunks=chunks, history=recent)

    return {
        "answer": answer,
        # No chunks means nothing was grounded, so no citations are attached.
        "sources": _build_sources(chunks) if chunks else [],
    }
