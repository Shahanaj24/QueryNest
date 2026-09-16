"""
Conversation and message endpoints.

POST   /api/conversations
GET    /api/conversations
GET    /api/conversations/{id}
DELETE /api/conversations/{id}
GET    /api/conversations/{id}/messages
POST   /api/conversations/{id}/messages   <- replaces the original POST /query/
"""

import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, status
from fastapi.concurrency import run_in_threadpool
from pymongo.errors import PyMongoError

from app.core import config
from app.core.deps import get_current_user, to_object_id
from app.core.errors import NotFoundError
from app.db.mongo import get_database, mongo_guard
from app.models.schemas import (
    ConversationDetailResponse,
    ConversationResponse,
    CreateConversationRequest,
    MessageResponse,
    SendMessageRequest,
    SendMessageResponse,
    serialise_conversation,
    serialise_message,
)
from app.services import chat, gemini

logger = logging.getLogger("chatdoc")

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

DEFAULT_TITLE = "New chat"


async def _get_owned_conversation(conversation_id: str, user: dict) -> dict[str, Any]:
    """
    Fetch a conversation, enforcing ownership.

    Filtering on userId in the query itself (rather than fetching then
    comparing) means a conversation belonging to someone else is simply not
    found, and returns the same 404 as a non-existent id.
    """
    database = get_database()
    object_id = to_object_id(conversation_id, "This conversation was not found.")

    try:
        conversation = await database.conversations.find_one(
            {"_id": object_id, "userId": user["_id"]}
        )
    except PyMongoError as exc:
        raise mongo_guard(exc, "load this conversation")

    if conversation is None:
        raise NotFoundError("This conversation was not found.")

    return conversation


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: CreateConversationRequest,
    user: dict = Depends(get_current_user),
) -> Any:
    """
    Start a new conversation.

    Creates a new record only; existing conversations are untouched
    (requirement 11).
    """
    database = get_database()
    now = datetime.now(timezone.utc)

    conversation = {
        "userId": user["_id"],
        "title": (payload.title or DEFAULT_TITLE).strip() or DEFAULT_TITLE,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        result = await database.conversations.insert_one(conversation)
    except PyMongoError as exc:
        raise mongo_guard(exc, "start a new chat")

    conversation["_id"] = result.inserted_id

    return serialise_conversation(conversation, message_count=0)


@router.get("", response_model=list[ConversationResponse])
async def list_conversations(user: dict = Depends(get_current_user)) -> Any:
    """List the authenticated user's conversations, most recently active first."""
    database = get_database()

    try:
        cursor = database.conversations.find({"userId": user["_id"]}).sort("updatedAt", -1)
        conversations = await cursor.to_list(length=200)

        # One grouped count for all conversations, rather than a query per row.
        counts: dict[ObjectId, int] = {}
        if conversations:
            pipeline_stages = [
                {"$match": {"conversationId": {"$in": [c["_id"] for c in conversations]}}},
                {"$group": {"_id": "$conversationId", "count": {"$sum": 1}}},
            ]
            async for row in database.messages.aggregate(pipeline_stages):
                counts[row["_id"]] = row["count"]

    except PyMongoError as exc:
        raise mongo_guard(exc, "load your chats")

    return [
        serialise_conversation(conversation, counts.get(conversation["_id"], 0))
        for conversation in conversations
    ]


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
) -> Any:
    """Return one conversation with its full message history."""
    conversation = await _get_owned_conversation(conversation_id, user)
    database = get_database()

    try:
        cursor = database.messages.find({"conversationId": conversation["_id"]}).sort(
            "createdAt", 1
        )
        messages = await cursor.to_list(length=1000)
    except PyMongoError as exc:
        raise mongo_guard(exc, "load this conversation")

    detail = serialise_conversation(conversation, message_count=len(messages))
    detail["messages"] = [serialise_message(message) for message in messages]

    return detail


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: str,
    user: dict = Depends(get_current_user),
) -> Any:
    """Return just the messages of a conversation, oldest first."""
    conversation = await _get_owned_conversation(conversation_id, user)
    database = get_database()

    try:
        cursor = database.messages.find({"conversationId": conversation["_id"]}).sort(
            "createdAt", 1
        )
        messages = await cursor.to_list(length=1000)
    except PyMongoError as exc:
        raise mongo_guard(exc, "load these messages")

    return [serialise_message(message) for message in messages]


@router.post("/{conversation_id}/messages", response_model=SendMessageResponse)
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    user: dict = Depends(get_current_user),
) -> Any:
    """
    Ask a question inside a conversation.

    This is the authenticated successor to the original POST /query/. The RAG
    flow is the same (retrieve -> Gemini -> answer + sources) but scoped to the
    caller's documents and persisted as conversation messages.
    """
    conversation = await _get_owned_conversation(conversation_id, user)
    database = get_database()
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc)

    # Load the recent window for follow-up resolution. Bounded by HISTORY_WINDOW
    # so prompt size stays constant no matter how long the conversation gets.
    try:
        history_cursor = (
            database.messages.find({"conversationId": conversation["_id"]})
            .sort("createdAt", -1)
            .limit(config.HISTORY_WINDOW)
        )
        recent = await history_cursor.to_list(length=config.HISTORY_WINDOW)
        recent.reverse()
    except PyMongoError as exc:
        raise mongo_guard(exc, "load this conversation")

    history = [{"role": m.get("role"), "content": m.get("content", "")} for m in recent]

    user_message = {
        "conversationId": conversation["_id"],
        "userId": user["_id"],
        "role": "user",
        "content": payload.content,
        "sources": [],
        "createdAt": now,
    }

    try:
        user_result = await database.messages.insert_one(user_message)
        user_message["_id"] = user_result.inserted_id
    except PyMongoError as exc:
        raise mongo_guard(exc, "send your message")

    # Blocking work (embedding + Gemini) off the event loop.
    try:
        answer = await run_in_threadpool(
            chat.answer_for_user,
            user_id=user_id,
            question=payload.content,
            history=history,
        )
    except Exception:
        # The question is already saved; remove it so a failed turn does not
        # leave a dangling user message with no reply.
        await database.messages.delete_one({"_id": user_result.inserted_id})
        raise

    assistant_message = {
        "conversationId": conversation["_id"],
        "userId": user["_id"],
        "role": "assistant",
        "content": answer["answer"],
        "sources": answer["sources"],
        "createdAt": datetime.now(timezone.utc),
    }

    try:
        assistant_result = await database.messages.insert_one(assistant_message)
        assistant_message["_id"] = assistant_result.inserted_id
    except PyMongoError as exc:
        raise mongo_guard(exc, "save the answer")

    # Title the conversation from its first question, like ChatGPT.
    title = conversation.get("title", DEFAULT_TITLE)
    if not history and title == DEFAULT_TITLE:
        title = await run_in_threadpool(gemini.generate_title, payload.content)

    try:
        await database.conversations.update_one(
            {"_id": conversation["_id"], "userId": user["_id"]},
            {"$set": {"title": title, "updatedAt": datetime.now(timezone.utc)}},
        )
    except PyMongoError as exc:
        raise mongo_guard(exc, "update this conversation")

    return {
        "conversationId": str(conversation["_id"]),
        "title": title,
        "userMessage": serialise_message(user_message),
        "assistantMessage": serialise_message(assistant_message),
    }


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
) -> Any:
    """Delete one conversation and its messages. Documents are unaffected."""
    conversation = await _get_owned_conversation(conversation_id, user)
    database = get_database()

    try:
        await database.messages.delete_many({"conversationId": conversation["_id"]})
        await database.conversations.delete_one(
            {"_id": conversation["_id"], "userId": user["_id"]}
        )
    except PyMongoError as exc:
        raise mongo_guard(exc, "delete this chat")

    return {"message": "Chat deleted."}
