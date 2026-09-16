QueryNest is an authenticated, multi-user AI document Q&A platform that lets users upload PDF documents, ask questions in natural language, and receive answers grounded in their own documents with page-level citations.

Each user's documents, vector indexes, and conversations are isolated from every other user.

What is QueryNest?

QueryNest started as a single-user Retrieval-Augmented Generation (RAG) demo with one global vector store and no authentication.

It has been upgraded into a multi-user document intelligence platform with:

User registration and login

Secure JWT-based authentication

Per-user document libraries

User-isolated FAISS vector indexes

Persistent multi-conversation chat history

PDF upload and processing

Context-grounded AI answers

Page-level document citations

Secure document ownership checks

Protection against cross-user data access

The original RAG pipeline remains the foundation of the system:

PDF → PyPDFLoader → CharacterTextSplitter → HuggingFaceEmbeddings → FAISS → Similarity Search → Gemini → Grounded Answer + Citations

How User Isolation Works

One of the most important design decisions in QueryNest is how user data is isolated.

Instead of maintaining one shared FAISS index and relying on metadata filtering during retrieval, QueryNest creates a separate FAISS index for each user:

faiss_store/

├── user_1/

├── user_2/

└── user_3/

The authenticated user's ID comes from the verified JWT, rather than from a request body or URL parameter.

MongoDB ownership

MongoDB queries also enforce ownership directly using both the resource ID and authenticated user ID.

Security Model

Password Security

Passwords are hashed using bcrypt.

Plain-text passwords are never stored.

Passwords are never returned through API responses.

Login errors do not reveal whether an email address exists.

JWT Authentication

Authenticated API requests require:

Authorization: Bearer <token>

Gemini API Protection

The Gemini API key remains on the backend. The frontend never receives the Gemini API key.

Error Handling

Client-facing errors contain short, human-readable messages. Internal details such as stack traces, database driver information, server file paths, and sensitive configuration are not returned to the frontend.

Secure File Uploads

Uploaded PDFs are validated using:

File extension validation

File-size validation while streaming

PDF magic-byte validation

JWT Secret

In production environments, QueryNest requires a properly configured JWT_SECRET. The server refuses to start when a secure signing secret is missing.

RAG Pipeline

QueryNest uses Retrieval-Augmented Generation to answer questions using information from uploaded documents.

PDF Document

↓

PyPDFLoader

↓

CharacterTextSplitter

├── Chunk Size: 1000

└── Chunk Overlap: 200

↓

HuggingFace Embeddings

└── all-mpnet-base-v2

↓

FAISS Vector Store

↓

Similarity Search

↓

Relevant Document Chunks

↓

Gemini

↓

Grounded Answer

↓

Source / Page Citations

Conversation Support

QueryNest supports persistent conversations rather than treating every question as an isolated request.

Users can:

Start multiple conversations

Continue previous conversations

Ask follow-up questions

Retrieve conversation history

Log out and return later

Continue working with their uploaded documents

Prerequisites

Node.js

npm

Python 3.10+

MongoDB

Gemini API key from Google AI Studio

Getting Started

1. Clone the repository

git clone https://github.com/YOUR_USERNAME/QueryNest.git

cd QueryNest

2. Create the environment file

GEMINI_API_KEY=your_gemini_api_key_here

MONGODB_URI=mongodb://localhost:27017

MONGODB_DB_NAME=chatdoc

JWT_SECRET=your_long_random_secret

APP_ENV=development

Generate a secure JWT secret with:

python -c "import secrets; print(secrets.token_urlsafe(48))"

Never commit .env to GitHub.

Running the Backend

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt

python backend_chatdoc.py

The backend runs at:

http://localhost:8000

FastAPI documentation:

http://localhost:8000/docs

Running the Frontend

cd front-chatdoc

npm install

npm run dev

The frontend normally runs at:

http://localhost:5173

Verifying the Application

python scripts/verify_e2e.py

If Gemini is unavailable:

python scripts/verify_e2e.py --skip-rag

The verification script checks registration, login, PDF upload, retrieval, question answering, citations, conversations, logout, session restoration, and multi-user isolation.

Project Structure

QueryNest/

├── app/

│   ├── core/

│   ├── db/

│   ├── models/

│   ├── rag/

│   ├── services/

│   └── routers/

├── faiss_store/

├── scripts/

├── front-chatdoc/

├── backend_chatdoc.py

├── requirements.txt

├── .env.example

└── README.md

API Endpoints

POST   /api/auth/register — Create a new account

POST   /api/auth/login — Authenticate a user

POST   /api/auth/logout — Sign out

GET    /api/auth/me — Restore the current session

GET    /api/users/profile — Get the current profile

PUT    /api/users/profile — Update the profile

POST   /api/documents/upload — Upload and index a PDF

GET    /api/documents — List the user's documents

DELETE /api/documents/{id} — Delete a document

POST   /api/conversations — Start a conversation

GET    /api/conversations — List conversations

GET    /api/conversations/{id} — Get conversation history

GET    /api/conversations/{id}/messages — Get messages

POST   /api/conversations/{id}/messages — Ask a document question

DELETE /api/conversations/{id} — Delete a conversation

Technology Stack

Frontend

React 19

Vite

React Router

Styled Components

Axios

React Dropzone

React Markdown

Backend

Python

FastAPI

Motor

MongoDB

bcrypt

PyJWT

AI / RAG

Google Gemini API

LangChain

FAISS

Hugging Face Embeddings

Sentence Transformers

PyPDFLoader

CharacterTextSplitter

Key Features

🔐 Authentication

Secure registration, login, logout, and JWT-based session management.

📄 Personal Document Library

Each user can upload and manage their own PDF documents.

🧠 AI-Powered Q&A

Ask natural-language questions about uploaded documents.

🔎 Semantic Retrieval

Relevant document chunks are retrieved using embeddings and FAISS similarity search.

💬 Persistent Conversations

Users can create multiple chats and continue previous conversations.

📑 Page Citations

Answers can reference the document and page from which supporting information was retrieved.

👥 Multi-User Isolation

Documents, vectors, and conversations are isolated between users.

🛡️ Secure File Handling

PDF uploads are validated for type and size before processing.

Migration from the Original Single-User Version

The original application used a global vector store:

faiss_vector_store/

Those vectors were created before user ownership was introduced and therefore do not contain user ownership information.

QueryNest does not search those legacy vectors.

To make the documents available in QueryNest:

1. Upload the PDFs again.

2. QueryNest creates vectors under the authenticated user's index.

3. The documents can then be searched normally.

Security Architecture

React Client

     │

     │ JWT Request

     ▼

FastAPI Backend

     │

     │ Verify authenticated user

     │

     ├───────────────┐

     ▼               ▼

  MongoDB       User FAISS Index

                    │

                    ▼

              Relevant Chunks

                    │

                    ▼

                  Gemini

                    │

                    ▼

              Grounded Answer

                    │

                    ▼

              React Interface

Future Improvements

Streaming AI responses

Support for additional document formats

Cloud object storage

Hosted vector databases

Background document processing

Advanced retrieval and reranking

Document-level permissions

Conversation search

Production deployment

Monitoring and observability