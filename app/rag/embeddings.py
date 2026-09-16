"""
Embedding model loader.

The model is loaded once and shared, exactly as in the original
backend_chatdoc.py. It is separated from the pipeline so that importing schemas
or routers does not pull a ~420 MB model into memory.
"""

import logging
from typing import Optional

from langchain_huggingface import HuggingFaceEmbeddings

from app.core import config

logger = logging.getLogger("chatdoc")

_embeddings: Optional[HuggingFaceEmbeddings] = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Return the shared embedding model, loading it on first use.

    UNCHANGED from the original project: same class, same model name
    ("sentence-transformers/all-mpnet-base-v2"). Only the load timing moved
    from import-time to first-use.
    """
    global _embeddings

    if _embeddings is None:
        logger.info("Loading embedding model '%s'...", config.EMBEDDING_MODEL)
        _embeddings = HuggingFaceEmbeddings(model_name=config.EMBEDDING_MODEL)
        logger.info("Embedding model loaded.")

    return _embeddings
