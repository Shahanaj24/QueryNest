"""
MongoDB connection management.

A single Motor client is shared across the application. Indexes are created
once at startup, which is also where a unique index on users.email enforces
"no duplicate registrations" at the database level rather than relying only on
an application-side check (which would be racy).
"""

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError

from app.core import config
from app.core.errors import ServiceError

logger = logging.getLogger("chatdoc")

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    """Open the connection pool and verify the server is actually reachable."""
    global _client, _database

    _client = AsyncIOMotorClient(
        config.MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        uuidRepresentation="standard",
    )
    _database = _client[config.MONGODB_DB_NAME]

    # Fail fast and loudly at startup rather than on the first user request.
    await _client.admin.command("ping")
    logger.info("Connected to MongoDB database '%s'.", config.MONGODB_DB_NAME)

    await _create_indexes(_database)


async def close_mongo_connection() -> None:
    global _client, _database

    if _client is not None:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed.")


async def _create_indexes(database: AsyncIOMotorDatabase) -> None:
    """
    Create the indexes the application relies on.

    Every query in this app is scoped by userId, so each collection is indexed
    on userId first. Sorting keys are included to keep list endpoints covered.
    """
    await database.users.create_index([("email", ASCENDING)], unique=True)

    await database.documents.create_index([("userId", ASCENDING), ("uploadedAt", DESCENDING)])

    await database.conversations.create_index([("userId", ASCENDING), ("updatedAt", DESCENDING)])

    await database.messages.create_index([("conversationId", ASCENDING), ("createdAt", ASCENDING)])
    await database.messages.create_index([("userId", ASCENDING)])

    logger.info("MongoDB indexes verified.")


def get_database() -> AsyncIOMotorDatabase:
    """
    Return the active database handle.

    Raises a user-safe ServiceError if called before startup completed, so a
    missing database surfaces as "service unavailable" rather than a crash.
    """
    if _database is None:
        raise ServiceError("The database is not available right now.")
    return _database


def mongo_guard(exc: PyMongoError, action: str) -> ServiceError:
    """
    Convert a raw PyMongo error into a safe, logged ServiceError.

    Usage:
        try:
            ...
        except PyMongoError as exc:
            raise mongo_guard(exc, "save the document")
    """
    logger.error("MongoDB error while trying to %s: %s", action, exc)
    return ServiceError(f"Could not {action} right now. Please try again.")
