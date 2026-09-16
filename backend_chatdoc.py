"""
Application entrypoint.

Kept at the project root with its original name so the documented workflow
still works unchanged:

    python backend_chatdoc.py

The implementation that used to live in this file now lives in the `app`
package, split by responsibility:

    app/core/      configuration, security, error handling, dependencies
    app/db/        MongoDB connection and indexes
    app/models/    request/response schemas
    app/rag/       PDF -> chunks -> embeddings -> FAISS  (the original pipeline)
    app/services/  Gemini integration and conversational RAG
    app/routers/   auth, users, documents, conversations

Nothing about the RAG pipeline's behaviour changed in the move: the same
PyPDFLoader, CharacterTextSplitter, HuggingFaceEmbeddings and FAISS calls are
used, now scoped per user.
"""

from app.main import app  # re-exported so `uvicorn backend_chatdoc:app` also works

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
