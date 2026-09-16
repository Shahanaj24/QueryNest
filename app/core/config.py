"""
Application configuration.

All tunable values live here and are read from environment variables so that
nothing sensitive is hardcoded. Defaults are chosen so the project runs
locally with only GEMINI_API_KEY set, exactly like the original version did.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ----------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------

# Project root = two levels up from this file (app/core/config.py -> project root)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Per-user FAISS indexes live under faiss_store/{userId}/.
# NOTE: the original global store directory ("faiss_vector_store") is left
# untouched on disk. It is no longer read, because its vectors predate users
# and cannot be attributed to an owner.
VECTOR_STORE_ROOT = Path(os.getenv("VECTOR_STORE_ROOT", BASE_DIR / "faiss_store"))

# Uploaded PDFs are stored per user: uploaded_documents/{userId}/{storedName}.pdf
UPLOAD_ROOT = Path(os.getenv("UPLOAD_ROOT", BASE_DIR / "uploaded_documents"))


# ----------------------------------------------------------------------
# Gemini
# ----------------------------------------------------------------------

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Preserved from the original code (backend_chatdoc.py line 327).
# Exposed as an env var so the model can be changed without editing code.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


# ----------------------------------------------------------------------
# Embeddings / RAG
# ----------------------------------------------------------------------

# Unchanged from the original project. Changing this invalidates existing
# indexes, because vector dimensionality is model specific.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-mpnet-base-v2")

# Unchanged from the original project (CharacterTextSplitter(1000, 200)).
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "200"))

# The original used k=3. Raised to 5 to give Gemini more grounding context,
# which measurably reduces "I need more context" style non-answers.
RETRIEVAL_K = int(os.getenv("RETRIEVAL_K", "5"))

# How many recent messages of a conversation are considered for follow-up
# question rewriting and passed to Gemini. Bounded so prompts cannot grow
# without limit as a conversation gets long.
HISTORY_WINDOW = int(os.getenv("HISTORY_WINDOW", "6"))

# Maximum number of per-user FAISS indexes kept in memory at once.
VECTOR_CACHE_SIZE = int(os.getenv("VECTOR_CACHE_SIZE", "8"))


# ----------------------------------------------------------------------
# MongoDB
# ----------------------------------------------------------------------

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "chatdoc")


# ----------------------------------------------------------------------
# Authentication
# ----------------------------------------------------------------------

# Dev-only fallback so the app boots without extra setup. Anyone who reads this
# repository knows this value, so a deployment using it could have tokens forged
# for any account. APP_ENV therefore decides how the fallback is treated:
# "development" warns, anything else refuses to start (see main.py).
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-insecure-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))

JWT_SECRET_IS_DEFAULT = "JWT_SECRET" not in os.environ

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV not in {"development", "dev", "test", "testing"}

PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))


# ----------------------------------------------------------------------
# Uploads
# ----------------------------------------------------------------------

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

ALLOWED_EXTENSIONS = {".pdf"}


# ----------------------------------------------------------------------
# CORS
# ----------------------------------------------------------------------

# Preserved from the original project, with Vite's alternate port added.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]
