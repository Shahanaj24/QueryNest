#!/usr/bin/env python3
"""
End-to-end and cross-user isolation verification against a RUNNING server.

This walks the exact flow from requirement 26:

    Register -> Login -> Upload PDF -> Ask question -> Receive answer
    -> See citations -> Start new chat -> Continue old chat -> Logout
    -> Login again -> Verify chat history remains -> Verify documents remain
    -> Verify another user cannot access them.

It then runs an explicit isolation suite proving User B cannot read, answer
from, or delete any of User A's data.

Usage
-----
    # 1. start MongoDB and the API first, e.g.
    uvicorn app.main:app --reload

    # 2. then, in another terminal
    python scripts/verify_e2e.py
    python scripts/verify_e2e.py --base-url http://127.0.0.1:8000
    python scripts/verify_e2e.py --skip-rag     # no Gemini quota / offline

Design notes
------------
* Standard library only. No new dependency is added to the project for this.
* It creates two throwaway accounts with random emails and deletes the data it
  creates at the end, so it is safe to run repeatedly against a dev database.
* It never prints a password or an access token.
* Exit code is 0 only if every check passes, so CI can gate on it.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import ssl
import sys
import urllib.error
import urllib.request
import uuid
from typing import Any, Optional

DEFAULT_BASE_URL = "http://127.0.0.1:8000"

# Two distinctive documents. The isolation test relies on B's corpus never
# containing A's marker string, so the assertions can be exact.
A_MARKER = "ZEPHYR-ALPHA-7741"
B_MARKER = "NIMBUS-BRAVO-2208"

A_TEXT = [
    "Internal Report: Project Zephyr",
    f"The classified project codeword is {A_MARKER}.",
    "Zephyr's annual operating budget is 4.2 million dollars.",
    "The project lead is Dana Whitfield, based in Rotterdam.",
]
B_TEXT = [
    "Internal Report: Project Nimbus",
    f"The classified project codeword is {B_MARKER}.",
    "Nimbus's annual operating budget is 1.7 million dollars.",
    "The project lead is Amara Osei, based in Lisbon.",
]


# ----------------------------------------------------------------------
# Result tracking
# ----------------------------------------------------------------------


class Results:
    """Collects pass/fail outcomes and prints a readable transcript."""

    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.failures: list[str] = []

    def check(self, label: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.passed += 1
            print(f"  [PASS] {label}")
        else:
            self.failed += 1
            self.failures.append(label + (f" -- {detail}" if detail else ""))
            print(f"  [FAIL] {label}")
            if detail:
                print(f"         {detail}")
        return condition

    def skip(self, label: str, why: str) -> None:
        self.skipped += 1
        print(f"  [SKIP] {label} ({why})")

    def stage(self, name: str) -> None:
        print(f"\n=== {name} ===")

    def summary(self) -> int:
        print("\n" + "=" * 62)
        print(f"passed: {self.passed}   failed: {self.failed}   skipped: {self.skipped}")
        if self.failures:
            print("\nFailures:")
            for failure in self.failures:
                print(f"  - {failure}")
        print("=" * 62)
        return 1 if self.failed else 0


# ----------------------------------------------------------------------
# Minimal PDF writer (so no PDF fixture or extra library is needed)
# ----------------------------------------------------------------------


def build_pdf(lines: list[str]) -> bytes:
    """
    Build a single-page PDF containing the given lines of text.

    Written by hand rather than with reportlab so the verification script adds
    no dependency. Offsets in the xref table are computed from the real byte
    positions, which is what makes the file valid enough for pypdf to extract
    text from it.
    """

    def escape(text: str) -> str:
        return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    content_lines = ["BT", "/F1 12 Tf", "72 720 Td", "16 TL"]
    for index, line in enumerate(lines):
        if index:
            content_lines.append("T*")
        content_lines.append(f"({escape(line)}) Tj")
    content_lines.append("ET")
    stream = "\n".join(content_lines).encode("latin-1")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
        ),
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n".encode()
        + b"%%EOF\n"
    )
    return bytes(out)


# ----------------------------------------------------------------------
# HTTP client
# ----------------------------------------------------------------------


class ApiError(Exception):
    def __init__(self, status: int, body: Any, raw: str):
        super().__init__(f"HTTP {status}")
        self.status = status
        self.body = body
        self.raw = raw


class Client:
    """Tiny bearer-token API client over urllib."""

    def __init__(self, base_url: str, label: str = "anon") -> None:
        self.base_url = base_url.rstrip("/")
        self.label = label
        self.token: Optional[str] = None
        self.user: dict[str, Any] = {}
        self.last_status: int = 0
        # Local dev over plain http; this only relaxes verification if someone
        # points the script at a self-signed https dev server.
        self._ctx = ssl.create_default_context()
        self._ctx.check_hostname = False
        self._ctx.verify_mode = ssl.CERT_NONE

    # -- plumbing -------------------------------------------------------

    def _send(
        self,
        method: str,
        path: str,
        *,
        json_body: Optional[dict] = None,
        multipart: Optional[tuple[str, str, bytes]] = None,
        token: Optional[str] = "self",
    ) -> Any:
        url = f"{self.base_url}{path}"
        data: Optional[bytes] = None
        headers: dict[str, str] = {"Accept": "application/json"}

        if json_body is not None:
            data = json.dumps(json_body).encode()
            headers["Content-Type"] = "application/json"
        elif multipart is not None:
            field, filename, payload = multipart
            boundary = f"----verify{uuid.uuid4().hex}"
            guessed = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            body = bytearray()
            body += f"--{boundary}\r\n".encode()
            body += (
                f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            ).encode()
            body += f"Content-Type: {guessed}\r\n\r\n".encode()
            body += payload
            body += f"\r\n--{boundary}--\r\n".encode()
            data = bytes(body)
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"

        effective = self.token if token == "self" else token
        if effective:
            headers["Authorization"] = f"Bearer {effective}"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            # Generous: the first upload of a run loads the sentence-transformers
            # model, which on a cold cache downloads several hundred megabytes
            # inside the request.
            with urllib.request.urlopen(request, timeout=900, context=self._ctx) as response:
                self.last_status = response.status
                raw = response.read().decode("utf-8", "replace")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = None
            raise ApiError(exc.code, parsed, raw) from None
        except urllib.error.URLError as exc:
            raise SystemExit(
                f"\nCould not reach {url}: {exc.reason}\n"
                "Start MongoDB and the API (uvicorn app.main:app) first."
            )

    def get(self, path: str, **kw) -> Any:
        return self._send("GET", path, **kw)

    def post(self, path: str, **kw) -> Any:
        return self._send("POST", path, **kw)

    def put(self, path: str, **kw) -> Any:
        return self._send("PUT", path, **kw)

    def delete(self, path: str, **kw) -> Any:
        return self._send("DELETE", path, **kw)

    # -- auth -----------------------------------------------------------

    def register(self, name: str, email: str, password: str) -> Any:
        payload = self.post(
            "/api/auth/register",
            json_body={
                "name": name,
                "email": email,
                "password": password,
                "confirmPassword": password,
            },
        )
        self.token = payload["accessToken"]
        self.user = payload["user"]
        return payload

    def login(self, email: str, password: str) -> Any:
        payload = self.post("/api/auth/login", json_body={"email": email, "password": password})
        self.token = payload["accessToken"]
        self.user = payload["user"]
        return payload


def status_of(call) -> int:
    """Run a call expected to fail and return its HTTP status (0 if it did not)."""
    try:
        call()
    except ApiError as exc:
        return exc.status
    return 0


# ----------------------------------------------------------------------
# Stages
# ----------------------------------------------------------------------


def run(base_url: str, skip_rag: bool) -> int:
    r = Results()
    run_id = uuid.uuid4().hex[:8]
    a_email = f"alpha_{run_id}@example.test"
    b_email = f"bravo_{run_id}@example.test"
    a_password = f"Alpha-pw-{run_id}!"
    b_password = f"Bravo-pw-{run_id}!"

    alice = Client(base_url, "A")
    bob = Client(base_url, "B")

    # -- Stage 1: register ---------------------------------------------
    r.stage("Stage 1 - Register")
    payload = alice.register("Alice Alpha", a_email, a_password)
    r.check("register returns 201", alice.last_status == 201, f"got {alice.last_status}")
    r.check("register returns an access token", bool(payload.get("accessToken")))
    r.check(
        "register response contains no password field",
        "password" not in json.dumps(payload).lower().replace("confirmpassword", ""),
        "a password-like key appeared in the register response",
    )
    r.check(
        "register response never exposes passwordHash",
        "passwordhash" not in json.dumps(payload).lower(),
    )
    bob.register("Bob Bravo", b_email, b_password)

    r.check(
        "duplicate email is rejected",
        status_of(lambda: Client(base_url).register("Clone", a_email, a_password)) == 400,
    )
    r.check(
        "mismatched confirmPassword is rejected",
        status_of(
            lambda: Client(base_url).post(
                "/api/auth/register",
                json_body={
                    "name": "Bad",
                    "email": f"bad_{run_id}@example.test",
                    "password": "abcdefgh1",
                    "confirmPassword": "different1",
                },
            )
        )
        == 422,
    )
    r.check(
        "short password is rejected",
        status_of(
            lambda: Client(base_url).post(
                "/api/auth/register",
                json_body={
                    "name": "Bad",
                    "email": f"short_{run_id}@example.test",
                    "password": "abc",
                    "confirmPassword": "abc",
                },
            )
        )
        == 422,
    )
    r.check(
        "invalid email is rejected",
        status_of(
            lambda: Client(base_url).post(
                "/api/auth/register",
                json_body={
                    "name": "Bad",
                    "email": "not-an-email",
                    "password": "abcdefgh1",
                    "confirmPassword": "abcdefgh1",
                },
            )
        )
        == 422,
    )

    # -- Stage 2: login -------------------------------------------------
    r.stage("Stage 2 - Login and session")
    alice.login(a_email, a_password)
    r.check("login succeeds with correct credentials", bool(alice.token))

    me = alice.get("/api/auth/me")
    r.check("GET /api/auth/me returns the caller", me.get("email") == a_email)
    r.check("me response omits passwordHash", "passwordHash" not in me)

    wrong = status_of(lambda: Client(base_url).login(a_email, "totally-wrong-pw"))
    r.check("wrong password is rejected with 401", wrong == 401)

    unknown = status_of(
        lambda: Client(base_url).login(f"ghost_{run_id}@example.test", a_password)
    )
    r.check("unknown email is rejected with 401", unknown == 401)

    # The two failures must be indistinguishable, or login becomes an
    # account-enumeration oracle.
    def message_for(email: str, password: str) -> str:
        try:
            Client(base_url).login(email, password)
        except ApiError as exc:
            body = exc.body or {}
            return json.dumps(body.get("detail") or body)
        return ""

    r.check(
        "wrong password and unknown email give an identical message",
        message_for(a_email, "totally-wrong-pw")
        == message_for(f"ghost_{run_id}@example.test", a_password),
    )

    r.check("no token is rejected", status_of(lambda: Client(base_url).get("/api/documents")) == 401)
    r.check(
        "a garbage token is rejected",
        status_of(lambda: Client(base_url).get("/api/documents", token="not.a.jwt")) == 401,
    )
    r.check(
        "a token signed with the wrong key is rejected",
        status_of(
            lambda: Client(base_url).get(
                "/api/documents",
                token=(
                    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
                    ".eyJzdWIiOiI2NTBjMWYwMDAwMDAwMDAwMDAwMDAwMDAiLCJleHAiOjQ4NzY1NDMyMTB9"
                    ".Zm9yZ2VkX3NpZ25hdHVyZV9ub3RfdmFsaWQ"
                ),
            )
        )
        == 401,
    )

    # -- Stage 3: upload ------------------------------------------------
    r.stage("Stage 3 - Upload PDF")
    a_pdf = build_pdf(A_TEXT)
    b_pdf = build_pdf(B_TEXT)

    # Guarded: when indexing fails the router raises rather than returning a
    # record, so an unguarded call would abort the run with a traceback and no
    # summary. Everything downstream needs these two documents, so a failure
    # here reports and stops cleanly instead.
    try:
        upload = alice.post(
            "/api/documents/upload", multipart=("file", "project-zephyr.pdf", a_pdf)
        )
        b_upload = bob.post(
            "/api/documents/upload", multipart=("file", "project-nimbus.pdf", b_pdf)
        )
    except ApiError as exc:
        r.check(
            "upload and index a PDF",
            False,
            f"HTTP {exc.status}: {exc.raw[:300]}\n"
            "         The first upload downloads the embedding model (~420 MB); "
            "if this timed out, run it once more with a warm cache.",
        )
        return r.summary()

    a_document = upload["document"]
    b_document = b_upload["document"]
    r.check("upload returns a document record", bool(a_document.get("id")))
    r.check("uploaded document reaches 'processed'", a_document.get("status") == "processed")
    r.check("document reports a chunk count", bool(a_document.get("chunkCount")))

    # These are raised as ValidationError in the router, which maps to 400.
    # (Pydantic schema failures, by contrast, surface as 422.)
    r.check(
        "a non-PDF extension is rejected",
        status_of(
            lambda: alice.post("/api/documents/upload", multipart=("file", "evil.exe", b"MZ\x00"))
        )
        == 400,
    )
    r.check(
        "a .pdf that is not really a PDF is rejected",
        status_of(
            lambda: alice.post(
                "/api/documents/upload", multipart=("file", "fake.pdf", b"just text, not a pdf")
            )
        )
        == 400,
    )
    r.check(
        "an empty file is rejected",
        status_of(lambda: alice.post("/api/documents/upload", multipart=("file", "empty.pdf", b"")))
        == 400,
    )

    documents = alice.get("/api/documents")
    r.check("document list is a list", isinstance(documents, list))
    r.check(
        "A's list contains A's document",
        any(item["id"] == a_document["id"] for item in documents),
    )
    r.check(
        "A's list does NOT contain B's document",
        all(item["id"] != b_document["id"] for item in documents),
    )

    # -- Stage 4: ask a question ---------------------------------------
    r.stage("Stage 4 - Ask a question, receive an answer with citations")
    conversation = alice.post("/api/conversations", json_body={})
    a_conversation_id = conversation["id"]
    r.check("conversation created", bool(a_conversation_id))

    answer: dict[str, Any] = {}
    if skip_rag:
        r.skip("ask a question", "--skip-rag")
        r.skip("answer cites a source", "--skip-rag")
    else:
        try:
            answer = alice.post(
                f"/api/conversations/{a_conversation_id}/messages",
                json_body={"content": "What is the classified project codeword?"},
            )
        except ApiError as exc:
            r.check(
                "ask a question",
                False,
                f"HTTP {exc.status}: {exc.raw[:300]} "
                "(if this is a Gemini quota/key problem, rerun with --skip-rag)",
            )

    if answer:
        assistant = answer.get("assistantMessage", {})
        content = assistant.get("content", "")
        r.check("assistant replied", bool(content.strip()))
        r.check(
            "answer is grounded in A's own document",
            A_MARKER.lower() in content.lower(),
            f"marker {A_MARKER} not found in: {content[:200]!r}",
        )
        sources = assistant.get("sources") or []
        r.check("answer includes citations", len(sources) > 0)
        r.check(
            "every citation names one of A's own documents",
            all(source.get("documentId") == a_document["id"] for source in sources),
            f"sources were {sources!r}",
        )
        r.check(
            "conversation was auto-titled from the question",
            answer.get("title") and answer["title"] != "New chat",
        )
        r.check("echoed user message is stored", bool(answer.get("userMessage", {}).get("id")))

    r.check(
        "an empty question is rejected",
        status_of(
            lambda: alice.post(
                f"/api/conversations/{a_conversation_id}/messages", json_body={"content": "   "}
            )
        )
        == 422,
    )

    # -- Stage 5: multiple chats ---------------------------------------
    r.stage("Stage 5 - Start a new chat, continue the old one")
    second = alice.post("/api/conversations", json_body={"title": "Second chat"})
    second_id = second["id"]
    r.check("a second conversation is separate from the first", second_id != a_conversation_id)

    first_detail = alice.get(f"/api/conversations/{a_conversation_id}")
    expected_first = 2 if answer else 0
    r.check(
        "the original chat still holds its own messages",
        len(first_detail.get("messages", [])) == expected_first,
        f"expected {expected_first}, saw {len(first_detail.get('messages', []))}",
    )
    second_detail = alice.get(f"/api/conversations/{second_id}")
    r.check("the new chat starts empty", second_detail.get("messages") == [])

    listed = alice.get("/api/conversations")
    r.check("both chats are listed", len({item["id"] for item in listed} & {a_conversation_id, second_id}) == 2)

    # -- Stage 6: logout, log back in, verify persistence --------------
    r.stage("Stage 6 - Logout, login again, verify everything persisted")
    alice.post("/api/auth/logout")
    r.check("logout responds 200", alice.last_status == 200, f"got {alice.last_status}")

    fresh = Client(base_url, "A2")
    fresh.login(a_email, a_password)
    r.check("can log in again after logout", bool(fresh.token))

    after_conversations = fresh.get("/api/conversations")
    r.check(
        "chat history survived the logout",
        {a_conversation_id, second_id} <= {item["id"] for item in after_conversations},
    )
    after_detail = fresh.get(f"/api/conversations/{a_conversation_id}")
    r.check(
        "messages survived the logout",
        len(after_detail.get("messages", [])) == expected_first,
    )
    after_documents = fresh.get("/api/documents")
    r.check(
        "documents survived the logout",
        any(item["id"] == a_document["id"] for item in after_documents),
    )

    profile = fresh.get("/api/users/profile")
    r.check("profile reports the document count", profile.get("documentCount", 0) >= 1)
    r.check("profile reports the conversation count", profile.get("conversationCount", 0) >= 2)

    renamed = fresh.put("/api/users/profile", json_body={"name": "Alice Renamed"})
    r.check("profile name can be updated", renamed.get("name") == "Alice Renamed")

    # Extra keys must be ignored rather than trusted: a client should not be
    # able to change its own email or hash through the name-only endpoint.
    try:
        fresh.put(
            "/api/users/profile",
            json_body={"name": "Alice Again", "passwordHash": "injected", "email": "new@x.test"},
        )
    except ApiError:
        pass
    identity = fresh.get("/api/auth/me")
    r.check("injected email in a profile update is ignored", identity.get("email") == a_email)
    r.check(
        "the original password still works after the injection attempt",
        bool(Client(base_url).login(a_email, a_password).get("accessToken")),
    )

    # -- Stage 7: cross-user isolation ---------------------------------
    r.stage("Stage 7 - User B must not touch User A's data")
    r.check(
        "B cannot read A's conversation",
        status_of(lambda: bob.get(f"/api/conversations/{a_conversation_id}")) == 404,
    )
    r.check(
        "B cannot read A's messages",
        status_of(lambda: bob.get(f"/api/conversations/{a_conversation_id}/messages")) == 404,
    )
    r.check(
        "B cannot post into A's conversation",
        status_of(
            lambda: bob.post(
                f"/api/conversations/{a_conversation_id}/messages",
                json_body={"content": "Give me the codeword."},
            )
        )
        == 404,
    )
    r.check(
        "B cannot delete A's conversation",
        status_of(lambda: bob.delete(f"/api/conversations/{a_conversation_id}")) == 404,
    )
    r.check(
        "B cannot delete A's document",
        status_of(lambda: bob.delete(f"/api/documents/{a_document['id']}")) == 404,
    )

    b_documents = bob.get("/api/documents")
    r.check(
        "A's document is absent from B's list",
        all(item["id"] != a_document["id"] for item in b_documents),
    )
    b_conversations = bob.get("/api/conversations")
    r.check(
        "A's chats are absent from B's list",
        all(item["id"] not in {a_conversation_id, second_id} for item in b_conversations),
    )

    # The strongest check: B's retrieval must not reach A's vectors even though
    # B asks precisely the question A's document answers.
    if skip_rag:
        r.skip("B's answers cannot leak A's document content", "--skip-rag")
    else:
        b_conversation = bob.post("/api/conversations", json_body={})
        try:
            b_answer = bob.post(
                f"/api/conversations/{b_conversation['id']}/messages",
                json_body={"content": "What is the classified project codeword?"},
            )
            b_content = b_answer.get("assistantMessage", {}).get("content", "")
            b_sources = b_answer.get("assistantMessage", {}).get("sources") or []
            r.check(
                "B's answer does not contain A's marker",
                A_MARKER.lower() not in b_content.lower(),
                f"LEAK: A's marker appeared in B's answer: {b_content[:200]!r}",
            )
            r.check(
                "B's citations reference only B's documents",
                all(source.get("documentId") == b_document["id"] for source in b_sources),
                f"LEAK: B cited {b_sources!r}",
            )
            r.check(
                "B's own content is still retrievable",
                B_MARKER.lower() in b_content.lower(),
                f"B could not answer from its own document: {b_content[:200]!r}",
            )
        except ApiError as exc:
            r.check("B's isolated RAG query", False, f"HTTP {exc.status}: {exc.raw[:200]}")
        bob.delete(f"/api/conversations/{b_conversation['id']}")

    # A traversal-shaped name must not escape the upload directory; the stored
    # name is a uuid, and the displayed name must be flattened.
    #
    # This runs deliberately late. The probe adds a second document to A's
    # library, and A's retrieval checks above assert that every citation points
    # at A's *one* expected document. Uploading it earlier would put a second
    # set of vectors in A's index, so any failure to remove them on delete would
    # show up as a confusing citation failure in stage 4 rather than as the
    # deletion bug it actually is. Running it here keeps each failure legible.
    traversal = alice.post(
        "/api/documents/upload",
        multipart=("file", "../../../../etc/passwd.pdf", build_pdf(["traversal probe"])),
    )
    shown = traversal["document"]["filename"]
    r.check(
        "a traversal filename is sanitised",
        "/" not in shown and "\\" not in shown and ".." not in shown,
        f"stored display name was {shown!r}",
    )
    alice.delete(f"/api/documents/{traversal['document']['id']}")
    r.check(
        "the probe document is gone after deletion",
        all(item["id"] != traversal["document"]["id"] for item in alice.get("/api/documents")),
    )

    # -- Stage 8: error hygiene ----------------------------------------
    r.stage("Stage 8 - Error responses leak nothing")
    for label, call in (
        ("malformed id", lambda: alice.get("/api/conversations/not-a-valid-object-id")),
        ("missing id", lambda: alice.get("/api/conversations/650c1f0000000000000000ff")),
        ("unknown route", lambda: alice.get("/api/does-not-exist")),
    ):
        try:
            call()
            raw = ""
        except ApiError as exc:
            raw = exc.raw
        lowered = raw.lower()
        r.check(
            f"{label}: no Python traceback in the response",
            "traceback" not in lowered and "file \"" not in lowered,
            raw[:200],
        )
        r.check(
            f"{label}: no internal paths or module names leaked",
            not any(token in lowered for token in ("app/routers", "app\\routers", "motor.", "pymongo", "site-packages")),
            raw[:200],
        )
        r.check(
            f"{label}: no API key material leaked",
            not any(token in lowered for token in ("gemini_api_key", "jwt_secret", "mongodb_uri", "aizasy")),
            raw[:200],
        )

    # -- Cleanup --------------------------------------------------------
    r.stage("Cleanup")
    for client, conversation_ids, document_id in (
        (fresh, [a_conversation_id, second_id], a_document["id"]),
        (bob, [], b_document["id"]),
    ):
        for conversation_id in conversation_ids:
            try:
                client.delete(f"/api/conversations/{conversation_id}")
            except ApiError:
                pass
        try:
            client.delete(f"/api/documents/{document_id}")
        except ApiError:
            pass
    print("  removed the conversations and documents this run created")
    print("  (the two throwaway accounts remain; drop them from the users collection if you wish)")

    return r.summary()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="API base URL")
    parser.add_argument(
        "--skip-rag",
        action="store_true",
        help="skip the checks that call Gemini (use when offline or out of quota)",
    )
    args = parser.parse_args()

    print(f"Verifying {args.base_url}")
    if args.skip_rag:
        print("RAG answer checks are disabled (--skip-rag)")
    return run(args.base_url, args.skip_rag)


if __name__ == "__main__":
    sys.exit(main())
