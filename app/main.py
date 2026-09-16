"""
FastAPI application factory.

Assembles configuration, middleware, error handlers and routers. The entrypoint
(backend_chatdoc.py) imports `app` from here, so `python backend_chatdoc.py`
still starts the server exactly as before.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import config
from app.core.errors import register_exception_handlers
from app.db.mongo import close_mongo_connection, connect_to_mongo
from app.routers import auth, conversations, documents, users

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(name)s  %(message)s",
)

logger = logging.getLogger("chatdoc")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Open resources on startup and release them on shutdown."""
    if config.JWT_SECRET_IS_DEFAULT:
        # The fallback secret is published in this repository, so running with
        # it outside development would let anyone mint a token for any account
        # and read that user's documents. Fail closed rather than warn.
        if config.IS_PRODUCTION:
            raise RuntimeError(
                "JWT_SECRET is not set. Set it to a long random value before "
                "running with APP_ENV=" + config.APP_ENV + "."
            )
        logger.warning(
            "JWT_SECRET is not set; using an insecure development default. "
            "Set JWT_SECRET in .env before deploying."
        )

    if not config.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY is not set. Answer generation will fail until it is.")

    config.UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    config.VECTOR_STORE_ROOT.mkdir(parents=True, exist_ok=True)

    await connect_to_mongo()

    yield

    await close_mongo_connection()


def create_app() -> FastAPI:
    application = FastAPI(
        title="Chat With Your Documents",
        description="Authenticated RAG-based Document Question Answering API",
        version="2.0.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(application)

    application.include_router(auth.router)
    application.include_router(users.router)
    application.include_router(documents.router)
    application.include_router(conversations.router)

    @application.get("/", tags=["health"])
    async def root():
        return {"message": "Chat With Your Documents API is running."}

    @application.get("/health", tags=["health"])
    async def health():
        return {"status": "OK"}

    return application


app = create_app()
