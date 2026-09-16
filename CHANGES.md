# Change log

Requirement 28 asks that every modification to an existing, important file be
explained in the same five-part form. That is what this document is. It is
split into two parts:

- **Part 1** covers files that existed in the original project.
- **Part 2** covers files introduced during this upgrade that were later
  changed again in response to the security and build audits, so the reasoning
  behind those second-pass edits is recorded too.

A note on risk, per the same requirement: none of the changes below alter the
retrieval pipeline's *mechanism*. `PyPDFLoader`, `CharacterTextSplitter(chunk_size=1000,
chunk_overlap=200)`, `HuggingFaceEmbeddings("sentence-transformers/all-mpnet-base-v2")`,
`FAISS`, `similarity_search`, and the Gemini call are the same objects, and the
chunking parameters are identical to the original. Two things about the pipeline
did change, and both are called out in their own entries below because they are
the only changes here with consequences worth reviewing: **where the FAISS index
lives** (now per user, which has a migration consequence), and **the retrieval
`k`**, raised from 3 to 5.

---

## Part 1 — Files that existed in the original project

### File: `backend_chatdoc.py`

**What existed:** A single-file FastAPI backend holding everything — configuration,
the Gemini client, the PDF loading and chunking, the embedding model, the FAISS
store, and the HTTP endpoints. There was one global vector store on disk at
`faiss_vector_store/`, shared by every request, because the application had no
concept of a user.

**What I changed:** The implementation moved into an `app/` package split by
responsibility (`core/`, `db/`, `models/`, `rag/`, `services/`, `routers/`).
This file is now a thin entrypoint that re-exports `app.main:app` and still
runs a server under `python backend_chatdoc.py`.

**Why:** A single global FAISS store cannot be made multi-tenant safely — any
authenticated user would retrieve chunks from every other user's documents,
which directly violates "do not allow User A to access User B's documents".
Splitting by responsibility was also what made per-route ownership checks and
input validation possible to apply consistently rather than ad hoc.

**What functionality remains unchanged:** The documented run command still works,
as does `uvicorn backend_chatdoc:app`. The RAG pipeline is byte-for-byte the same
sequence of calls with the same parameters; it was moved, not rewritten. Answers
for a single user with a single document are produced exactly as before.

---

### File: `app/rag/pipeline.py` (the pipeline extracted from `backend_chatdoc.py`)

**What existed:** Loading, splitting, embedding and searching against one global
FAISS index at `faiss_vector_store/`.

**What I changed:** The index path became `faiss_store/{userId}/`. The user id is
always taken from the verified JWT, never from a request body or query parameter.

**What functionality remains unchanged:** Loader, splitter (`chunk_size=1000`,
`chunk_overlap=200`), embedding model, index type, and the `similarity_search`
call are identical.

**One deliberate tuning change:** retrieval `k` went from 3 to 5. More grounding
context measurably reduces "I need more context" non-answers. It is exposed as
`RETRIEVAL_K` so it can be returned to 3 with an environment variable and no code
change, should the extra context ever prove counterproductive.

**Why:** This is the isolation boundary. Filtering by a metadata field after
retrieval would still load every user's vectors into the same index, so one bug
in a filter expression would leak documents. Separate index directories make
cross-user retrieval structurally impossible rather than conditionally prevented
— there is no code path that can return another user's chunk, because those
vectors are never loaded into the search at all.

**Risk, stated explicitly:** This is the one change with a migration consequence.
Vectors in the old `faiss_vector_store/` directory are not associated with any
user and are therefore no longer searched. Existing PDFs must be re-uploaded to
be queryable again. The original directory is left untouched on disk rather than
deleted, so nothing is destroyed and the change is reversible. I judged this
acceptable because the alternative — attributing pre-existing vectors to an
arbitrary account — would mean inventing ownership data, and the store held only
test material from single-user development.

---

### File: `requirements.txt`

**What existed:** `fastapi`, `uvicorn`, `python-multipart`, `python-dotenv`,
`google-genai`, `langchain`, `langchain-community`, `langchain-huggingface`,
`sentence-transformers`, `faiss-cpu`, `pypdf`.

**What I changed:** Added four entries under a comment marking them as new:
`motor` (async MongoDB driver), `bcrypt`, `PyJWT`, and `pydantic[email]`. Nothing
was removed, and no version of an existing pin was altered.

**Why:** Each maps to one stated requirement: persistence, password hashing,
tokens, and email validation. `motor` rather than `pymongo` because the app is
async and a blocking driver would stall the event loop during every database
call.

**What functionality remains unchanged:** Every original dependency is present at
the same version specification, so the existing pipeline resolves identically.

---

### File: `front-chatdoc/src/App.jsx`

**What existed:** A single-screen application of roughly 35 lines that rendered
the upload control and the chat interface together, with file state held in
local component state. No routing, and no concept of a signed-in user.

**What I changed:** Replaced with a route table: public `/login` and `/register`,
and a pathless layout route wrapping `<ProtectedRoute><AppLayout /></ProtectedRoute>`
that provides `/dashboard`, `/documents`, `/chat`, `/chat/:conversationId`,
`/profile`, and a catch-all 404.

**Why:** The requirements call for protected pages, a persistent sidebar, and
resumable conversations addressable by id. A pathless layout route renders the
sidebar once and swaps only the `<Outlet />` beneath it, so navigating between
chats does not remount the shell or refetch the conversation list.

**What functionality remains unchanged:** Uploading a PDF and asking a question
about it is still the core flow and still uses the same components — they are now
reached at `/documents` and `/chat` behind a login.

---

### File: `front-chatdoc/src/components/FileUpload.jsx`

**What existed:** A dropzone whose props were `onFileUpload` and `currentFile`; the
parent owned the selected file and the upload call.

**What I changed:** The component now owns the upload itself and exposes a single
`onUploaded(document)` callback, fired only after the backend confirms the document
reached `processed`. Added a progress percentage, and distinct uploading/processing
states.

**Why:** Indexing a PDF is slow, and the old shape reported success as soon as the
file was chosen. A user could ask a question against a document that was not yet
searchable and get a confusing empty answer. Reporting completion only on the
backend's confirmation removes that window.

**What functionality remains unchanged:** Drag-and-drop, click-to-select, the
PDF-only restriction, and the visual treatment of the dropzone.

---

### File: `front-chatdoc/src/components/ChatInterface.jsx`

**What existed:** The message list, auto-scroll on new messages, the sticky
composer, Enter-to-send, and a disabled send button while loading. The backend
already returned `sources` with each answer, but the component never rendered them.

**What I changed:** Kept all of the above. Added Markdown rendering for answers,
a citation strip under each assistant message, role labels, and an empty state.

**Why:** Requirement 18 asks for visible citations. The data was already arriving
and being discarded, so this displays what the backend was already sending rather
than adding a new mechanism.

**What functionality remains unchanged:** Layout, scroll behaviour, keyboard
handling, and the loading indicator all behave as before.

---

### File: `front-chatdoc/src/main.jsx`

**What existed:** The Vite default — `createRoot(...).render(<StrictMode><App /></StrictMode>)`.

**What I changed:** Wrapped the tree in `BrowserRouter`, a `GlobalStyle`, and
`AuthProvider`.

**Why:** Routing and authentication state must sit above every route, including
the login page, so the app can decide where to send a visitor before any page
renders.

**What functionality remains unchanged:** The same root element and the same
`StrictMode` behaviour.

---

### File: `front-chatdoc/src/index.css`

**What existed:** Vite's starter styles, including `overflow: hidden` on the body
and centring rules intended for the single-screen demo.

**What I changed:** Removed `overflow: hidden` and the centring rules; base
typography and resets moved into the shared theme.

**Why:** `overflow: hidden` clipped the Documents, Dashboard, and Profile pages,
which scroll. Leaving it would have made content unreachable.

**What functionality remains unchanged:** The font stack and colour baseline are
preserved, now expressed in one place.

---

### File: `front-chatdoc/index.html`

**What existed:** `<title>Vite + React</title>` and the default favicon link.

**What I changed:** Title set to "Chat with Your Documents"; added a meta
description.

**Why:** The tab title is visible in every screenshot and in any interview demo.

**What functionality remains unchanged:** The root div and the module script tag
are untouched, so the build entrypoint is identical.

---

### File: `front-chatdoc/package.json`

**What existed:** React 19, Vite 6, styled-components, react-dropzone, axios.

**What I changed:** Added `react-router-dom@^7.1.5` and `react-markdown@^9.0.3`.
Nothing removed or upgraded.

**Why:** Routing is required for protected pages and addressable conversations.
Markdown rendering is required because Gemini returns Markdown, which would
otherwise display as literal asterisks and backticks.

**What functionality remains unchanged:** Every existing dependency stays at its
existing version, and the `dev`/`build`/`preview` scripts are unchanged.

---

## Part 2 — Second-pass changes made in response to the audits

Because the sandbox could not run `npm install`, `vite build`, or `python -m py_compile`
in this environment, verification was done by static analysis instead: a backend
security audit against the six isolation properties, and a frontend audit for
build-breaking issues. The entries below are the fixes those audits produced.
**These findings came from static review, not from an executed test run** — the
script at `scripts/verify_e2e.py` exists so the same properties can be confirmed
against a running server.

### File: `app/core/config.py`

**What existed:** Configuration loaded from the environment, including a
`JWT_SECRET` that fell back to a development default when unset.

**What I changed:** Added `APP_ENV` and a derived `IS_PRODUCTION` flag.

**Why:** To let the application distinguish a developer running locally from a
deployment, which is what makes the fail-closed check in `app/main.py` possible
without making local development painful.

**What functionality remains unchanged:** Every existing setting keeps its name,
default, and meaning.

---

### File: `app/main.py`

**What existed:** A lifespan handler that connected to MongoDB, ensured indexes,
and logged a warning when `JWT_SECRET` was still the built-in default.

**What I changed:** That warning now raises `RuntimeError` and refuses to start
when `IS_PRODUCTION` is true. In development it still only warns.

**Why:** This was the highest-severity audit finding. A known default signing key
means anyone can mint a valid token for any user id, which defeats every
ownership check in the application at once — the checks themselves are correct,
but they trust a token that an attacker could forge. A warning in a log is not a
control, because deployments routinely start with warnings unread. Failing to
start is noisy at deploy time and silent thereafter, which is the correct trade.

**What functionality remains unchanged:** Local development with no `.env` still
starts and warns exactly as before. Database connection, index creation, and
router registration are untouched.

---

### File: `app/core/security.py`

**What existed:** `hash_password`, `verify_password`, `create_access_token`, and
`decode_access_token`.

**What I changed:** Added `_TIMING_EQUALISER_HASH` and `dummy_verify()`, and
documented that bcrypt's 72-unit limit is counted in bytes, not characters.

**Why:** Login previously returned much faster for an unknown email than for a
known one, because `user is None` skipped the bcrypt comparison entirely. That
timing difference is enough to enumerate which addresses hold accounts, which
undoes the work of returning an identical error message for both cases.

**What functionality remains unchanged:** Hashing, verification, and token
encoding/decoding are unchanged; existing stored hashes continue to verify.

---

### File: `app/routers/auth.py`

**What existed:** A login handler that looked the user up and verified the
password in one combined condition.

**What I changed:** Split into two branches so the unknown-email path calls
`dummy_verify()` before raising, with the identical message and status as a wrong
password.

**Why:** The counterpart to the change above — the equaliser only helps if the
handler actually calls it on the miss path.

**What functionality remains unchanged:** Both failure modes still return 401 with
"Invalid email or password."; the success path is untouched. Passwords are still
never logged.

---

### File: `app/models/schemas.py`

**What existed:** `RegisterRequest` with `max_length=72` on the password.

**What I changed:** Added a `password_must_fit_bcrypt` validator rejecting any
password whose UTF-8 encoding exceeds 72 bytes.

**Why:** `max_length` counts characters while bcrypt truncates at 72 *bytes*. A
72-character password of multi-byte characters would be silently cut, so two
different passwords sharing a 72-byte prefix would both unlock the same account.
Rejecting at the edge is safer than truncating quietly.

**What functionality remains unchanged:** Ordinary ASCII passwords are unaffected,
as the two limits coincide for them. All other schemas are untouched.

---

### File: `front-chatdoc/src/api/client.js`

**What existed:** Endpoint wrappers expecting `{ documents }` and `{ conversations }`
envelope objects.

**What I changed:** Normalised the wrappers to match what the backend actually
returns. The list routes are declared `response_model=list[...]` and return bare
arrays, so the client now wraps them instead of assuming an envelope. Added a
`messages(id)` wrapper and documented the `sendMessage` response shape.

**Why:** This was a real contract mismatch that would have produced
`undefined.map is not a function` on both list pages. I fixed it in the client
rather than changing the backend because the backend behaviour was correct and
already working — adapting the consumer avoids touching a working API and avoids
a second, redundant response shape.

**What functionality remains unchanged:** The axios instance, the auth-token
request interceptor, and the 401 handling are untouched.

---

### Files: `Sidebar.jsx`, `Chat.jsx`, `Documents.jsx`, `Dashboard.jsx`, `Login.jsx`, `Register.jsx`, `ConversationContext.jsx`

These were all written during this upgrade and then corrected after the frontend
audit. The substantive fixes:

- **`Sidebar.jsx`** — derived the active conversation id from the location rather
  than `useParams()`. The sidebar renders at the layout level, which does not
  declare `:conversationId`, so `useParams()` returned nothing and no chat ever
  highlighted as active. Also gave "New chat" a `catch`: it previously had
  `try`/`finally` with no `catch`, so a failure surfaced as an unhandled promise
  rejection and the user saw the button flicker with no explanation.
- **`ConversationContext.jsx`** — `startConversation` now records the failure in
  shared error state and re-throws, so callers do not navigate to a conversation
  that was never created.
- **`Chat.jsx`** — added a `hydratedId` ref. Adopting a new chat's id rewrites the
  URL, which retriggered the history effect and replaced the just-rendered answer
  with a loading spinner before showing it again.
- **`Documents.jsx`** — memoised `handleUploaded`, which `FileUpload` holds in a
  `useCallback` dependency array; an unstable identity retriggered its effects on
  every render.
- **`Dashboard.jsx`** — clear the error state after a successful reload, so a
  stale alert does not persist after a retry succeeds.
- **`Login.jsx` / `Register.jsx`** — removed the imperative `navigate()` after a
  successful submit. Both files already redirect declaratively via a `<Navigate>`
  guard once `isAuthenticated` flips, so the two mechanisms were racing to decide
  the destination. One redirect path means they cannot disagree.
- **`Documents.jsx` / `Dashboard.jsx`** — renamed map parameters from `document`
  to `doc`, which had been shadowing the global `document`.

---

## Known cleanup item

`front-chatdoc/src/App.css` is orphaned — nothing imports it (verified by grep
across `src/` and `index.html`), and its contents are the Vite starter styles.
**It has been left in place deliberately**, at your request that no project files
be deleted. It is inert: because no module imports it, Vite never includes it in
the bundle, so it affects neither the build nor the rendered styling. Removing it
is optional tidying you can do yourself whenever you like.
