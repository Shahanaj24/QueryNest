"""
Gemini integration and answer generation.

Preserves the original integration: the same `google.genai` client and the same
configured model. What changed is the prompt.

The original prompt told the model:
    "If the answer is not available in the context, respond exactly with
     'I need more context from the uploaded document.'"
combined with "Answer ONLY using the provided context". In practice that makes
the model refuse whenever the question's wording differs from the document's,
which is the failure described in requirement 14 ("What is the deadline?" over
text saying "within 30 days"). The prompt below keeps the grounding rule but
explicitly permits reasoning and inference over the retrieved text.
"""

import logging
from typing import Any, Optional

from google import genai

from app.core import config
from app.core.errors import ServiceError

logger = logging.getLogger("chatdoc")

_client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    """Return the shared Gemini client. The API key never leaves the backend."""
    global _client

    if _client is None:
        if not config.GEMINI_API_KEY:
            raise ServiceError("The AI service is not configured. Please contact the administrator.")
        _client = genai.Client(api_key=config.GEMINI_API_KEY)

    return _client


SYSTEM_RULES = """You are a document question-answering assistant. You answer questions about the user's uploaded documents.

HOW TO ANSWER

1. Ground every factual claim in the provided context. Do not invent facts, figures, names, or page numbers.
2. Reason over the context. If the answer follows from what the document says, state it directly.
   Example: if the document says "Employees must submit the form within 30 days" and the user asks
   "What is the deadline?", answer "The deadline is 30 days." Do not ask for more context.
3. Answer the actual question that was asked, first and directly. Do not restate the question.
4. Only say the documents do not cover something when the context genuinely does not support an answer.
   In that case say so plainly and, if the context is related but insufficient, say what it does cover.
5. Use the conversation history to interpret follow-up questions such as "why is it important?".
6. Be concise but complete. Explain where an explanation genuinely helps.
7. Do not mention "the context", "the chunks", or "the retrieved text". Refer to "the document" naturally.
8. Do not list sources or page numbers yourself. They are attached automatically.

FORMATTING

Reply in Markdown. Use short paragraphs. Use bullet points for lists of items, numbered lists for
sequences or steps, headings only when the answer has several distinct sections, and code blocks for
code or exact excerpts. Never return one dense block of text."""


def _format_context(chunks: list) -> str:
    """
    Render retrieved chunks with their real source labels.

    Labelling each excerpt lets the model attribute information correctly
    when several documents are relevant.
    """
    parts = []

    for index, chunk in enumerate(chunks, start=1):
        filename = chunk.metadata.get("filename") or chunk.metadata.get("source") or "document"
        page = chunk.metadata.get("page")
        label = f"[Excerpt {index}] {filename}"
        if page is not None:
            label += f", page {page}"
        parts.append(f"{label}\n{chunk.page_content}")

    return "\n\n---\n\n".join(parts)


def _format_history(history: list[dict[str, Any]]) -> str:
    if not history:
        return ""

    lines = []
    for message in history:
        role = "User" if message.get("role") == "user" else "Assistant"
        content = (message.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")

    return "\n".join(lines)


def _generate(prompt: str) -> str:
    """Call Gemini and return its text, converting failures into a safe error."""
    try:
        response = get_client().models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
        )
    except Exception as exc:
        logger.error("Gemini request failed: %s", exc)
        raise ServiceError("The AI service is temporarily unavailable. Please try again.")

    text = (getattr(response, "text", "") or "").strip()

    if not text:
        # Empty output usually means a safety block or a truncated response.
        raise ServiceError("The AI service returned an empty response. Please try again.")

    return text


def condense_question(question: str, history: list[dict[str, Any]]) -> str:
    """
    Rewrite a follow-up question into a standalone one for retrieval.

    Requirement 15: "Why is it important?" retrieves nothing useful on its own,
    because the pronoun carries the meaning. Rewriting it to "Why is the main
    objective important?" makes the vector search hit the right chunks.

    Only the question sent to FAISS is rewritten; the user's original wording is
    what gets stored and displayed. If rewriting fails, the original question is
    used, so retrieval degrades rather than breaks.
    """
    if not history:
        return question

    conversation = _format_history(history)

    prompt = f"""Rewrite the follow-up question as a standalone question that can be understood without the conversation.

Rules:
- Resolve pronouns and references ("it", "that", "the above") using the conversation.
- Keep the user's intent and wording as close to the original as possible.
- If the question already stands alone, return it unchanged.
- Return ONLY the rewritten question, with no preamble or quotes.

Conversation:
{conversation}

Follow-up question: {question}

Standalone question:"""

    try:
        rewritten = _generate(prompt)
    except ServiceError:
        return question

    # Guard against a chatty model returning an explanation instead of a question.
    if not rewritten or len(rewritten) > 400:
        return question

    return rewritten.strip().strip('"')


def answer_question(
    *,
    question: str,
    chunks: list,
    history: list[dict[str, Any]],
) -> str:
    """Generate a grounded answer from the retrieved chunks."""
    if not chunks:
        # No retrieval hits: answer without a Gemini call, since there is
        # nothing to ground an answer in.
        return (
            "I could not find anything in your uploaded documents that answers this question.\n\n"
            "You could try rephrasing the question, or uploading a document that covers this topic."
        )

    context = _format_context(chunks)
    conversation = _format_history(history)

    history_block = f"\nRecent conversation:\n{conversation}\n" if conversation else ""

    prompt = f"""{SYSTEM_RULES}
{history_block}
Context from the user's documents:
{context}

User's question: {question}

Answer:"""

    return _generate(prompt)


def generate_title(question: str) -> str:
    """
    Produce a short sidebar title from the first question, ChatGPT-style.

    Falls back to a truncated version of the question if Gemini is unavailable,
    so a title is always available without blocking the conversation.
    """
    fallback = question.strip()
    fallback = fallback[:47].rstrip() + "..." if len(fallback) > 50 else fallback

    prompt = f"""Summarise this question as a short chat title of at most 6 words.
Return ONLY the title: no quotes, no punctuation at the end, no preamble.

Question: {question}

Title:"""

    try:
        title = _generate(prompt)
    except ServiceError:
        return fallback

    title = title.strip().strip('"').strip()

    if not title or len(title) > 80:
        return fallback

    return title
