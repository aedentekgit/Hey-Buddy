"""
CHAT SERVICE MODULE
===================

This service owns all chat session and conversation logic. It is used by the
/chat and /chat/realtime endpoints. Designed for single-user use: one server
has one ChatService and one in-memory session store; the user can have many
sessions (each identified by session_id).

ARCHITECTURE OVERVIEW:
  ChatService sits between the API layer (FastAPI routes) and the LLM layer
  (GroqService / RealtimeGroqService). It does NOT call LLMs directly; instead,
  it delegates to self.groq_service or self.realtime_service. Its job is to:
    1. Manage session lifecycle (create, load, validate, persist).
    2. Keep an ordered message list per session (user & assistant turns).
    3. Format that history into (user, assistant) pairs the LLM can consume.
    4. Orchestrate the full message flow: receive → store → call LLM → store reply.

DATA FLOW (non-streaming):
  API route  →  ChatService.process_message(session_id, text)
                   ├─ add_message(session_id, "user", text)
                   ├─ format_history_for_llm(session_id)   →  [(user, assistant), ...]
                   ├─ groq_service.get_response(text, history)  →  reply string
                   ├─ add_message(session_id, "assistant", reply)
                   └─ return reply

DATA FLOW (streaming):
  Same as above, but groq_service.stream_response() yields chunks one at a time.
  We accumulate them into the assistant message in-place and periodically flush
  to disk so that even a partial response survives a crash.

SESSION PERSISTENCE:
  Sessions are stored in-memory in self.sessions (a dict). After each completed
  message (or periodically during streaming), the session is written to
  database/chats_data/chat_<safe_id>.json. On the next request with the same
  session_id, we try to load that file back into memory. This means conversations
  survive server restarts. The JSON files are also consumed by the vector store
  on startup so past conversations become retrievable context.

WHY IN-MEMORY + JSON (not a database):
  For a single-user assistant, a Python dict gives sub-microsecond lookups with
  zero configuration. JSON files are human-readable, easy to debug, and double
  as input for the vector store's document loader. A full database (SQLite,
  Postgres) would add complexity without meaningful benefit at this scale.

RESPONSIBILITIES:
  - get_or_create_session(session_id): Return existing session or create new one.
    If the user sends a session_id that was used before (e.g. before a restart),
    we try to load it from disk so the conversation continues.
  - add_message / get_chat_history: Keep messages in memory per session.
  - format_history_for_llm: Turn the message list into (user, assistant) pairs
    and trim to MAX_CHAT_HISTORY_TURNS so we don't overflow the prompt.
  - process_message / process_realtime_message: Add user message, call Groq (or
    RealtimeGroq), add assistant reply, return reply.
  - save_chat_session: Write session to database/chats_data/*.json so it persists
    and can be loaded on next startup (and used by the vector store for retrieval).
"""

import json
import logging
import time
import requests
import os
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional, Dict, Iterator
import uuid

# MAX_CHAT_HISTORY_TURNS: cap on how many (user, assistant) pairs we send to the LLM
# to keep the prompt within token limits (e.g. 20 turns).
from config import MAX_CHAT_HISTORY_TURNS, NODE_BACKEND_URL, BUDDY_INTERNAL_SECRET
from app.models import ChatMessage, ChatHistory
from app.services.groq_service import GroqService
from app.services.realtime_service import RealtimeGroqService


logger = logging.getLogger("Hey buddy")

# ─── STREAMING SAVE INTERVAL ────────────────────────────────────────────────
# During streaming, we write the session to disk every N chunks rather than
# after every single chunk. This is a trade-off:
#   - Too low (e.g. 1): excessive disk I/O, slows down streaming.
#   - Too high (e.g. 100): if the server crashes mid-stream, we lose more data.
# 5 is a reasonable middle ground — roughly every ~50 tokens get flushed.
#
# WHAT IS A "CHUNK"?
#   When the LLM streams, it sends its response in small pieces (chunks). Each
#   chunk is typically 1-5 tokens (a few words). So 5 chunks ≈ 5-25 words of
#   text flushed to disk at a time.
SAVE_EVERY_N_CHUNKS = 5

# ─── MESSAGE HISTORY SLIDING WINDOW ──────────────────────────────────────────
# Cap the total number of messages stored in memory per session to prevent
# unbounded memory growth. When a session exceeds MAX_SESSION_MESSAGES, we trim
# it to keep only the most recent messages. The system message (if present at
# index 0) is preserved.
# Example: 50 messages = 25 conversation turns (user + assistant pairs).
MAX_SESSION_MESSAGES = 50

# Thread pool for background DB sync operations.
# Max 4 workers prevents unbounded thread creation under high request load.
# Queue size tracking: we manually check pending task count before submitting.
_db_sync_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="db-sync")
_db_sync_queue_limit = 20  # Max tasks in queue; above this we skip to prevent memory bloat


# =============================================================================
# CHAT SERVICE CLASS
# =============================================================================

class ChatService:
    """
    Manages chat sessions: in-memory message lists, load/save to disk, and
    calling Groq (or Realtime) to get replies.

    DESIGN DECISIONS:
      - All state for active sessions is in self.sessions (a plain dict).
        This is intentionally simple — no database ORM, no Redis. For a
        single-user assistant, an in-memory dict is fast and sufficient.
      - Sessions are synchronized to MongoDB via background threads after 
        each interaction so conversations survive restarts.
      - The class accepts GroqService and RealtimeGroqService via constructor
        injection (dependency injection pattern), making it easy to test or
        swap implementations.

    DEPENDENCY INJECTION:
      Instead of creating GroqService/RealtimeGroqService inside this class,
      we receive them as constructor parameters. This is a well-known design
      pattern called "dependency injection". Benefits:
        - Testability: In unit tests, you can pass mock services.
        - Flexibility: You can swap the LLM backend without touching ChatService.
        - Clarity: The class's dependencies are explicit in the constructor signature.
    """

    def __init__(self, groq_service: GroqService = None, realtime_service: RealtimeGroqService = None, vector_store_service=None):
        """
        Initialize the ChatService with its LLM backends.

        Args:
            groq_service: The general-chat LLM service (optional now). Handles
                          questions using only the vector store context (no web search).
            realtime_service: The realtime-chat LLM service (optional). Adds Tavily
                              web search on top of the general flow. If None, any
                              call to process_realtime_message will raise ValueError.
            vector_store_service: Used to dynamically construct GroqService if needed.

        Internal state:
            self.sessions: A dict mapping session_id (str) → list of ChatMessage.
                           This is the single source of truth for all active
                           conversations.
            self.session_user_map: A dict mapping session_id (str) → userId (str).
                                   Links a temporary session to a permanent MongoDB user.
            self._http_session: Shared aiohttp session with connection pooling.
        """
        self.groq_service = groq_service
        self.realtime_service = realtime_service
        self.vector_store_service = vector_store_service
        # Map: session_id -> list of ChatMessage (user and assistant messages in order).
        # This dict lives entirely in RAM. It's fast (O(1) lookup) but ephemeral —
        # if the process dies, we lose it. That's why we also save to disk (JSON files).
        self.sessions: Dict[str, List[ChatMessage]] = {}
        self.session_user_map: Dict[str, str] = {}

        # Shared aiohttp session with connection pooling for HTTP requests.
        # Reusing a session across requests multiplexes connections and reduces
        # overhead compared to creating new sessions per request.
        self._http_session: Optional[aiohttp.ClientSession] = None

    # -------------------------------------------------------------------------
    # SESSION LOAD / VALIDATE / GET-OR-CREATE
    # -------------------------------------------------------------------------
    # These three methods handle the session lifecycle:
    #   1. validate_session_id — security gate (reject bad IDs before touching disk).
    #   2. load_session_from_disk — deserialize a previously saved session.
    #   3. get_or_create_session — the public entry point that ties it all together.
    #
    # The lookup order in get_or_create_session is:
    #   memory (fast) → disk (slower) → create new (instant)
    #
    # WHY THIS ORDER MATTERS:
    #   Memory lookup is a dict key check (nanoseconds). Disk lookup requires
    #   opening and parsing a JSON file (milliseconds). Creating a new session
    #   is just initializing an empty list (nanoseconds). By checking memory
    #   first, the common case (ongoing conversation) is extremely fast.
    # -------------------------------------------------------------------------

    async def _get_http_session(self) -> aiohttp.ClientSession:
        """
        Lazy-create and reuse a shared HTTP session with connection pooling.
        This avoids creating a new session (and new connections) for each request.
        """
        if self._http_session is None or self._http_session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,  # Max concurrent connections
                limit_per_host=10,  # Max per domain
                ttl_dns_cache=300  # Cache DNS lookups for 5 minutes
            )
            self._http_session = aiohttp.ClientSession(connector=connector)
        return self._http_session

    async def _fetch_session_async(self, backend_url: str, session_id: str) -> Optional[dict]:
        """
        Helper: async HTTP GET to fetch session from backend.
        Uses a shared session with connection pooling for efficiency.
        Returns parsed JSON or None if request fails.
        """
        try:
            session = await self._get_http_session()
            headers = {"Authorization": f"Bearer {BUDDY_INTERNAL_SECRET}"}
            async with session.get(
                f"{backend_url}/api/conversations/internal/{session_id}",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    logger.debug(f"No history found for session {session_id} in MongoDB (Status: {resp.status})")
                    return None
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching session {session_id} from backend")
            return None
        except Exception as ex:
            logger.warning(f"Failed to fetch session {session_id} from backend: {ex}")
            return None

    def load_session_from_backend(self, session_id: str) -> bool:
        """
        Attempt to load a previously saved session from the MongoDB database
        via the Node.js backend proxy using async HTTP (non-blocking).

        HOW IT WORKS:
          1. Send an async GET request to the Node.js internal conversation endpoint.
          2. If found, deserialize the messages and store them in memory.

        WHY ASYNC:
          Uses aiohttp instead of requests to prevent blocking the event loop.
          This is critical for FastAPI's async request handling.
        """
        try:
            backend_url = os.getenv("NODE_BACKEND_URL", "http://localhost:5001")
            logger.info(f"Session {session_id} not in memory, restoring from MongoDB...")

            # Run async fetch using event loop
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            data = loop.run_until_complete(
                self._fetch_session_async(backend_url, session_id)
            )

            if data and data.get("success") and data.get("data"):
                conv = data["data"]
                messages = [
                    ChatMessage(role=msg.get("role"), content=msg.get("content"))
                    for msg in conv.get("messages", [])
                ]
                self.sessions[session_id] = messages
                logger.info(f"Successfully restored history for session {session_id} from MongoDB")
                return True
        except Exception as ex:
            logger.warning(f"Failed to load session {session_id} from backend: {ex}")

        return False

    def validate_session_id(self, session_id: str) -> bool:
        """
        Security check: ensure the session_id is safe to use in file paths.

        WHY THIS IS CRITICAL:
          The session_id becomes part of a filename (e.g. chat_<id>.json).
          If we blindly trust user-provided IDs, a malicious client could send
          "../../etc/passwd" and cause us to read/write arbitrary files on the
          filesystem. This is known as a "path traversal" attack.

        THREATS WE GUARD AGAINST:
          - Path traversal: "../../etc/passwd" could read arbitrary files.
          - Empty or whitespace-only IDs: would create files with no meaningful name.
          - Extremely long IDs: could exceed filesystem limits (most OSes cap
            filenames at 255 characters).

        RULES:
          1. Must be non-empty and not all whitespace.
          2. Must not contain ".." (path traversal).
          3. Must not contain "/" or "\\" (path separators).
          4. Length must be <= 255 characters.

        Returns:
            True if the session_id passes all checks.
        """
        if not session_id or not session_id.strip():
            return False
        # Block path traversal and path separators.
        if ".." in session_id or "/" in session_id or "\\" in session_id:
            return False
        if len(session_id) > 255:
            return False
        return True

    def get_or_create_session(self, session_id: Optional[str] = None) -> str:
        """
        The main entry point for session management. Ensures a session exists
        in memory and returns its ID.

        LOGIC FLOW:
          ┌─ session_id is None?
          │   YES → generate a new UUID, create empty session, return it.
          │   NO  ↓
          ├─ validate_session_id(session_id) fails?
          │   YES → raise ValueError (reject malicious/invalid IDs).
          │   NO  ↓
          ├─ session_id already in self.sessions? (memory hit)
          │   YES → return it immediately (fastest path).
          │   NO  ↓
          ├─ load_session_from_disk(session_id) succeeds? (disk hit)
          │   YES → session is now in memory, return it.
          │   NO  ↓
          └─ Create a new empty session with this ID, return it.
              (Client sent an ID we've never seen — that's fine, just start fresh.)

        TIMING LABELS IN LOGS:
          The [TIMING] logs help identify which path was taken:
            - "(new)": No ID was provided, generated a UUID.
            - "(memory)": Session was already in the in-memory dict (fastest).
            - "(disk)": Session was loaded from a JSON file (a few ms for parsing).
            - "(new_id)": Client sent an unknown ID, created fresh session.
          This is invaluable for performance debugging in production.

        Args:
            session_id: Optional client-provided ID. If None, a UUID is generated.

        Returns:
            The session_id (either the provided one or a newly generated UUID).

        Raises:
            ValueError: If the provided session_id is invalid (empty, contains
                        path traversal characters, or exceeds 255 chars).
        """
        t0 = time.perf_counter()
        if not session_id:
            # No ID provided — generate a fresh UUID (e.g. "a1b2c3d4-e5f6-...")
            # uuid4() generates a random UUID, which is effectively guaranteed unique.
            new_session_id = str(uuid.uuid4())
            self.sessions[new_session_id] = []
            logger.info("[TIMING] session_get_or_create: %.3fs (new)", time.perf_counter() - t0)
            return new_session_id

        # Validate before doing anything else — reject malicious IDs early.
        if not self.validate_session_id(session_id):
            raise ValueError(
                f"Invalid session_id format: {session_id}. Session ID must be non-empty, "
                "not contain path traversal characters, and be under 255 characters."
            )

        # Fast path: session already in memory from a previous request this run.
        if session_id in self.sessions:
            logger.info("[TIMING] session_get_or_create: %.3fs (memory)", time.perf_counter() - t0)
            return session_id

        # Medium path: session was saved to the database in a previous server run.
        # load_session_from_backend() fetches from Node.js and populates self.sessions.
        if self.load_session_from_backend(session_id):
            logger.info("[TIMING] session_get_or_create: %.3fs (mongodb)", time.perf_counter() - t0)
            return session_id

        # New session with this ID (e.g. client sent an ID that was never saved).
        self.sessions[session_id] = []
        logger.info("[TIMING] session_get_or_create: %.3fs (new_id)", time.perf_counter() - t0)
        return session_id

    # -------------------------------------------------------------------------
    # MESSAGES AND HISTORY FORMATTING
    # -------------------------------------------------------------------------
    # These methods manage the message list for a session and convert it into
    # the format the LLM expects.
    #
    # MESSAGE STORAGE MODEL:
    #   Each session is a flat list of ChatMessage objects in chronological order:
    #     [user, assistant, user, assistant, user, assistant, ...]
    #   We always append; we never delete or edit existing messages.
    #   This is an "append-only" data model — simple and reliable.
    #
    # LLM HISTORY FORMAT:
    #   LangChain expects chat history as a list of (human_text, ai_text) tuples.
    #   format_history_for_llm() converts the flat list into these pairs, skipping
    #   any orphaned messages (e.g. a user message with no reply yet).
    #
    # WHY TUPLES, NOT MESSAGES?
    #   The GroqService._build_prompt_and_messages() method expects tuples because
    #   it converts them into LangChain HumanMessage/AIMessage objects itself.
    #   Keeping the interface as simple tuples means ChatService doesn't need to
    #   know about LangChain internals — clean separation of concerns.
    # -------------------------------------------------------------------------

    def add_message(self, session_id: str, role: str, content: str):
        """
        Append a single message to the session's chronological message list.

        This is the only way messages are added to a session. Both user messages
        and assistant replies go through here. If the session doesn't exist yet
        (edge case), we create it on the fly.

        USAGE PATTERN:
          - User sends a message → add_message(sid, "user", "Hello")
          - LLM replies → add_message(sid, "assistant", "Hi there!")
          - For streaming, we first add_message(sid, "assistant", "") as a
            placeholder, then build up .content chunk-by-chunk.

        SLIDING WINDOW:
          After appending the message, if the session exceeds MAX_SESSION_MESSAGES,
          we trim it to keep only the most recent messages. This prevents unbounded
          memory growth for long-running conversations.

        Args:
            session_id: Which session to append to.
            role: "user" or "assistant".
            content: The message text. For streaming, the assistant message starts
                     as "" and is built up chunk-by-chunk in process_message_stream.
        """
        if session_id not in self.sessions:
            self.sessions[session_id] = []
        self.sessions[session_id].append(ChatMessage(role=role, content=content))

        # Trim session history if it exceeds the maximum message count.
        # Keep the first message (often a system prompt) plus the last MAX_SESSION_MESSAGES-1 messages.
        if len(self.sessions[session_id]) > MAX_SESSION_MESSAGES:
            messages = self.sessions[session_id]
            # Preserve the first message (likely system context) and keep the most recent ones
            self.sessions[session_id] = messages[:1] + messages[-(MAX_SESSION_MESSAGES - 1):]
            logger.info(
                "[HISTORY TRIM] Session %s trimmed to %d messages (was %d)",
                session_id[:8], len(self.sessions[session_id]), len(messages)
            )

    def get_chat_history(self, session_id: str) -> List[ChatMessage]:
        """
        Return the full, chronological list of messages for a session.

        Returns an empty list (not None) if the session is unknown — this makes
        it safe to iterate without null checks. This is a defensive coding pattern:
        the caller never has to write `if history is not None: for msg in history`.
        """
        return self.sessions.get(session_id, [])

    def format_history_for_llm(self, session_id: str, exclude_last: bool = False) -> List[tuple]:
        """
        Convert the flat message list into (user_text, assistant_text) pairs
        suitable for the LLM prompt, trimmed to MAX_CHAT_HISTORY_TURNS.

        HOW PAIRING WORKS:
          We walk through the message list two at a time. If messages[i] is "user"
          and messages[i+1] is "assistant", we have a complete pair → include it.
          If the roles don't match (e.g. two user messages in a row due to a bug),
          we skip ahead by one and try again. This makes the pairing robust.

          Example:
            Messages: [user, assistant, user, assistant, user]
            Pairs:    [(user1, assistant1), (user2, assistant2)]
            The last "user" has no assistant reply yet, so it's not paired.

        WHY exclude_last:
          When we're about to reply to a new user message, that message is already
          in the list (we called add_message before this). But we don't want to
          include it in the *history* — it's the *current* question, not history.
          So exclude_last=True drops the last message before pairing.

          Timeline:
            1. User sends "What is Python?"
            2. add_message(sid, "user", "What is Python?")  ← now in the list
            3. format_history_for_llm(sid, exclude_last=True)  ← exclude it
            4. The current question is passed separately to the LLM as {question}

        WHY WE TRIM:
          LLMs have a finite context window (e.g. 8K, 32K, 128K tokens). If we
          sent 500 turns of history, we'd exceed the token limit and the API would
          reject the request. MAX_CHAT_HISTORY_TURNS (e.g. 20) keeps us safe.
          We keep the *most recent* turns because they're most relevant to the
          current conversation. Older turns are still saved on disk and indexed
          in the vector store, so they can still influence answers via RAG retrieval.

        Args:
            session_id: The session to format.
            exclude_last: If True, drop the last message before pairing (see above).

        Returns:
            A list of (user_text, assistant_text) tuples, at most
            MAX_CHAT_HISTORY_TURNS long.
        """
        messages = self.get_chat_history(session_id)
        history = []
        # If exclude_last, we skip the last message (the current user message we are about to reply to).
        messages_to_process = messages[:-1] if exclude_last and messages else messages

        # Walk through messages two at a time, looking for (user, assistant) pairs.
        i = 0
        while i < len(messages_to_process) - 1:
            user_msg = messages_to_process[i]
            ai_msg = messages_to_process[i + 1]
            if user_msg.role == "user" and ai_msg.role == "assistant":
                # Found a complete pair — add it.
                history.append((user_msg.content, ai_msg.content))
                i += 2  # Skip past both messages.
            else:
                # Roles don't match — skip one message and try again.
                # This handles edge cases like consecutive user messages
                # (which can happen if the LLM call failed mid-conversation).
                i += 1

        # Keep only the most recent turns so the prompt does not exceed token limits.
        # Example: if history has 30 pairs and MAX is 20, we take the last 20.
        # Using negative slice: history[-20:] takes the last 20 elements.
        if len(history) > MAX_CHAT_HISTORY_TURNS:
            history = history[-MAX_CHAT_HISTORY_TURNS:]
        return history

    # -------------------------------------------------------------------------
    # PROCESS MESSAGE (GENERAL AND REALTIME)
    # -------------------------------------------------------------------------
    # These four methods are the main "do work" functions of ChatService. They
    # implement two modes (general / realtime) × two flavors (blocking / streaming).
    #
    # NON-STREAMING (process_message / process_realtime_message):
    #   1. Log the request for debugging.
    #   2. add_message(session_id, "user", text) — store the user's message.
    #   3. format_history_for_llm — build (user, assistant) pairs, excluding
    #      the message we just added (it's the current question, not history).
    #   4. Call groq_service.get_response (or realtime_service.get_response).
    #   5. add_message(session_id, "assistant", reply) — store the LLM's reply.
    #   6. Return the reply string.
    #
    # STREAMING (process_message_stream / process_realtime_message_stream):
    #   Same steps, but instead of one blocking call, we:
    #   - Add an empty assistant message upfront (placeholder).
    #   - Iterate over groq_service.stream_response(), which yields text chunks.
    #   - For each chunk: append it to the assistant message, yield it to the
    #     caller (who forwards it to the client via SSE), and periodically save
    #     the session to disk.
    #   - The `finally` block guarantees a final save even if the stream errors.
    #
    # WHY TWO MODES (general vs realtime)?
    #   General chat uses only the vector store context (fast, no external API).
    #   Realtime chat adds a Tavily web search (slower, but provides current info).
    #   Both use the SAME session and history — you can switch modes mid-conversation.
    #
    # WHY TWO FLAVORS (blocking vs streaming)?
    #   Blocking is simpler and used for programmatic API calls.
    #   Streaming gives users a "typing" effect via Server-Sent Events (SSE),
    #   which feels much faster even though total response time is similar.
    # -------------------------------------------------------------------------

    def process_message(self, session_id: str, user_message: str, api_key: str = None, provider: str = None, model: str = None, user_id: Optional[str] = None, memory_context: str = "") -> str:
        """
        Handle one general-chat message (no web search).

        FLOW: add user msg → format history → call GroqService → add reply → return.

        This is the simplest path: one API call, one response. The GroqService
        handles vector store retrieval and multi-key fallback internally.
        """
        logger.info("[GENERAL] Session: %s | User: %.200s", session_id[:12], user_message)
        if user_id:
            self.session_user_map[session_id] = user_id
            
        # Step 1: Add user message to memory.
        self.add_message(session_id, "user", user_message)
        # Step 2: Build history pairs, excluding the message we just added
        # (it will be passed separately as the "question" parameter).
        chat_history = self.format_history_for_llm(session_id, exclude_last=True)
        logger.info("[GENERAL] History pairs sent to LLM: %d", len(chat_history))
        # Step 3: Call the LLM. GroqService handles retrieval + prompt building + API call.
        if api_key and provider:
             dynamic_groq = GroqService(vector_store_service=self.vector_store_service, api_key=api_key, provider=provider, model=model)
             response = dynamic_groq.get_response(question=user_message, chat_history=chat_history, user_id=user_id, memory_context=memory_context)
        else:
            response = self.groq_service.get_response(question=user_message, chat_history=chat_history, user_id=user_id, memory_context=memory_context)
        # Step 4: Store the assistant's reply so it becomes part of future history.
        self.add_message(session_id, "assistant", response)
        logger.info("[GENERAL] Response length: %d chars | Preview: %.120s", len(response), response)
        return response

    def process_realtime_message(self, session_id: str, user_message: str, api_key: str = None, provider: str = None, model: str = None, user_id: Optional[str] = None, memory_context: str = "") -> str:
        """
        Handle one realtime message (with web search via Tavily + Groq).

        FLOW: same as process_message, but uses self.realtime_service which runs
        a Tavily web search first and injects the results into the system prompt.

        IMPORTANT: Uses the same session as process_message, so history is shared
        between general and realtime modes. A user can switch modes mid-conversation
        without losing context. For example:
          1. User asks "What is Python?" in general mode → gets answer from vector store.
          2. User asks "What's the latest Python release?" in realtime mode → gets
             answer with web search results + the conversation history from step 1.

        Raises:
            ValueError: If realtime_service was not provided during construction
                        (e.g., TAVILY_API_KEY is missing from .env).
        """
        if not self.realtime_service and not (api_key and provider):
            raise ValueError("Realtime service is not initialized. Cannot process realtime queries.")
        if user_id:
            self.session_user_map[session_id] = user_id
            
        logger.info("[REALTIME] Session: %s | User: %.200s", session_id[:12], user_message)
        self.add_message(session_id, "user", user_message)
        chat_history = self.format_history_for_llm(session_id, exclude_last=True)
        logger.info("[REALTIME] History pairs sent to LLM: %d", len(chat_history))
        # The realtime_service.get_response() internally:
        #   1. Extracts a clean search query from the user's message.
        #   2. Calls Tavily API with advanced depth for web search results.
        #   3. Injects those results into the system prompt.
        #   4. Calls Groq with the enriched prompt.
        if api_key and provider:
            dynamic_realtime = RealtimeGroqService(vector_store_service=self.vector_store_service, api_key=api_key, provider=provider, model=model)
            response = dynamic_realtime.get_response(question=user_message, chat_history=chat_history, user_id=user_id, memory_context=memory_context)
        else:
             response = self.realtime_service.get_response(question=user_message, chat_history=chat_history, user_id=user_id, memory_context=memory_context)
        self.add_message(session_id, "assistant", response)
        logger.info("[REALTIME] Response length: %d chars | Preview: %.120s", len(response), response)
        return response

    def process_message_stream(
        self, session_id: str, user_message: str, api_key: str = None, provider: str = None, model: str = None, user_id: Optional[str] = None, memory_context: str = ""
    ) -> Iterator[str]:
        """
        Stream general-chat response chunk-by-chunk (Server-Sent Events pattern).

        HOW STREAMING WORKS:
          1. We add the user message and an EMPTY assistant message to the session.
             The empty assistant message acts as a placeholder that we'll fill in
             as chunks arrive.
          2. We call groq_service.stream_response() which is a generator — it
             yields small text chunks (typically a few tokens each) as the LLM
             produces them.
          3. For each chunk:
             a. Append it to the assistant message's content (building it up).
             b. Increment chunk_count.
             c. Every SAVE_EVERY_N_CHUNKS chunks, save to disk (periodic flush).
             d. Yield the chunk to our caller (the API route), which sends it to
                the client as an SSE event.
          4. The `finally` block runs whether the stream completes normally OR
             raises an exception. It logs the final stats and does one last save,
             ensuring no data is lost.

        THE PLACEHOLDER PATTERN:
          We add an empty assistant message BEFORE streaming starts. As chunks arrive,
          we append to this message's .content attribute in place:
            sessions[sid][-1].content += chunk
          This means at any point during streaming, the last message in the session
          contains the response generated so far. If we save to disk mid-stream,
          the partial response is preserved.

        WHY PERIODIC SAVES:
          If we only saved at the end and the server crashed mid-stream, we'd
          lose the entire response. By saving every 5 chunks, we lose at most
          ~5 chunks worth of text (~50 tokens). The trade-off is a small amount
          of disk I/O during streaming.

        WHY `finally`:
          Python's `finally` block runs no matter what — even if the generator is
          interrupted by a client disconnect, a network error, or an LLM API failure.
          This guarantees we always save whatever we've accumulated.

        Yields:
            Text chunks (str) as they arrive from the LLM.
        """
        if user_id:
            self.session_user_map[session_id] = user_id
            
        logger.info("[GENERAL-STREAM] Session: %s | User: %.200s", session_id[:12], user_message)
        self.add_message(session_id, "user", user_message)
        # Add empty assistant message as a placeholder — we'll build it up chunk by chunk.
        self.add_message(session_id, "assistant", "")
        chat_history = self.format_history_for_llm(session_id, exclude_last=True)
        logger.info("[GENERAL-STREAM] History pairs sent to LLM: %d", len(chat_history))
        chunk_count = 0
        try:
            active_groq_service = self.groq_service
            if api_key and provider:
                active_groq_service = GroqService(vector_store_service=self.vector_store_service, api_key=api_key, provider=provider, model=model)
                
            for chunk in active_groq_service.stream_response(
                question=user_message, chat_history=chat_history, user_id=user_id, memory_context=memory_context
            ):
                # Append this chunk to the last message (the assistant placeholder).
                # sessions[session_id][-1] is always the assistant message we just added.
                # We're mutating the ChatMessage object in-place — no need to replace it.
                self.sessions[session_id][-1].content += chunk
                chunk_count += 1
                # Removed mid-stream DB sync to prevent excessive background threads which cause delays.
                # The session will be synced once at the end of the stream in the `finally` block.
                # if chunk_count % SAVE_EVERY_N_CHUNKS == 0:
                #     self.save_chat_session(session_id, log_timing=False)
                # Yield to the caller — this is what makes this function a generator.
                # The API route receives this chunk and sends it to the client via SSE.
                yield chunk
        finally:
            # Always runs — even if the stream raises an exception mid-way.
            # This guarantees we save whatever partial response we've accumulated.
            final_response = self.sessions[session_id][-1].content
            logger.info("[GENERAL-STREAM] Completed | Chunks: %d | Response length: %d chars", chunk_count, len(final_response))
            # Final save to ensure the complete response is persisted.
            self.save_chat_session(session_id)

    def process_realtime_message_stream(
        self, session_id: str, user_message: str, api_key: str = None, provider: str = None, model: str = None, user_id: Optional[str] = None, memory_context: str = ""
    ) -> Iterator[str]:
        """
        Stream realtime-chat response chunk-by-chunk (Tavily search + Groq).

        Identical structure to process_message_stream, but uses the
        RealtimeGroqService which adds web search results to the system prompt
        before calling the LLM.

        LATENCY NOTE:
          The search happens synchronously BEFORE streaming begins (inside
          realtime_service.stream_response). The flow is:
            1. Extract search query (~0.5-1s, fast LLM call)
            2. Call Tavily API (~1-3s, web search)
            3. Build prompt with search results (~instant)
            4. Start streaming from Groq (first token in ~0.3-1s)
          So the user may wait 2-5 seconds before seeing the first token,
          compared to ~0.3-1s for general chat. This is expected — the web
          search adds latency but provides current, real-world information.
        """
        if not self.realtime_service and not (api_key and provider):
            raise ValueError("Realtime service is not initialized.")
        if user_id:
            self.session_user_map[session_id] = user_id
            
        logger.info("[REALTIME-STREAM] Session: %s | User: %.200s", session_id[:12], user_message)
        self.add_message(session_id, "user", user_message)
        # Same placeholder pattern as process_message_stream.
        self.add_message(session_id, "assistant", "")
        chat_history = self.format_history_for_llm(session_id, exclude_last=True)
        logger.info("[REALTIME-STREAM] History pairs sent to LLM: %d", len(chat_history))
        chunk_count = 0
        try:
            active_realtime_service = self.realtime_service
            if api_key and provider:
                active_realtime_service = RealtimeGroqService(vector_store_service=self.vector_store_service, api_key=api_key, provider=provider, model=model)
                
            for chunk in active_realtime_service.stream_response(
                question=user_message, chat_history=chat_history, user_id=user_id, memory_context=memory_context
            ):
                # Realtime may yield a dict first (search_results for the widget); only accumulate text.
                if isinstance(chunk, dict):
                    yield chunk
                    continue
                self.sessions[session_id][-1].content += chunk
                chunk_count += 1
                # Removed mid-stream DB sync to prevent excessive background threads.
                # if chunk_count % SAVE_EVERY_N_CHUNKS == 0:
                #     self.save_chat_session(session_id, log_timing=False)
                yield chunk
        finally:
            final_response = self.sessions[session_id][-1].content
            logger.info("[REALTIME-STREAM] Completed | Chunks: %d | Response length: %d chars", chunk_count, len(final_response))
            self.save_chat_session(session_id)

    # -------------------------------------------------------------------------
    # PERSIST SESSION TO DISK
    # -------------------------------------------------------------------------
    # Sessions are persisted as JSON files in database/chats_data/. Each session
    # gets its own file named chat_<safe_id>.json. The format is:
    #   {
    #     "session_id": "original-uuid-here",
    #     "messages": [
    #       {"role": "user", "content": "Hello!"},
    #       {"role": "assistant", "content": "Hi there!"},
    #       ...
    #     ]
    #   }
    #
    # WHY JSON (not SQLite, not pickle):
    #   - Human-readable: you can open the file and see the conversation.
    #   - Easy to debug: if something goes wrong, you can inspect the file.
    #   - Used by the vector store: on startup, the vector store reads these
    #     files to index past conversations for retrieval.
    #   - Simple: no schema migrations, no ORM, no dependencies.
    #   - Portable: JSON works on every OS and every programming language.
    #
    # WHY ONE FILE PER SESSION (not one big file):
    #   - Avoids read-modify-write conflicts: each save only touches one file.
    #   - Makes it easy to delete or inspect individual conversations.
    #   - The vector store can load them independently.
    # -------------------------------------------------------------------------

    def save_chat_session(self, session_id: str, log_timing: bool = True):
        """
        Synchronize this session's messages to MongoDB via the Node.js backend.

        WHEN THIS IS CALLED:
          - After each completed message (blocking mode).
          - Once at the end of streaming (in the `finally` block).

        QUEUE SIZE LIMITING:
          If too many tasks are already queued (> 20), this skips submission and logs
          a warning. This prevents unbounded queue growth under high request load.

        Args:
            session_id: The session to persist.
            log_timing: If False, skip the timing log.
        """
        # Guard: don't create empty files for non-existent or empty sessions.
        if session_id not in self.sessions or not self.sessions[session_id]:
            return

        # Check queue size: if too many tasks are queued, skip to prevent bloat
        # _db_sync_pool._work_queue.qsize() is not officially supported, so we use
        # a rough estimate via the thread pool's internal state. Alternatively,
        # we can track submitted tasks ourselves. For safety, check the estimate:
        if hasattr(_db_sync_pool, '_work_queue'):
            queue_size = _db_sync_pool._work_queue.qsize()
            if queue_size > _db_sync_queue_limit:
                logger.warning(f"[PERFORMANCE] DB sync queue full ({queue_size} > {_db_sync_queue_limit}); "
                              f"skipping sync for session {session_id} to prevent bloat")
                return

        messages = self.sessions[session_id]
        # Build the sync structure: session_id + flat list of {role, content} dicts.
        sync_payload = {
            "session_id": session_id,
            "messages": [{"role": msg.role, "content": msg.content} for msg in messages]
        }

        # Background sync to MongoDB via Node.js backend with proper error handling
        def _sync_to_db():
            t0 = time.time()
            try:
                # Use environment variable for backend URL, default to 5001 if not set
                backend_url = os.getenv("NODE_BACKEND_URL", "http://localhost:5001")
                # Use the provided userId for sync if available, fallback to session_id
                sync_user_id = self.session_user_map.get(session_id, session_id)

                # Filter out messages with empty content to avoid validation errors.
                # Only sync non-empty strings.
                messages_to_sync = [
                    {"role": m["role"], "content": m["content"]}
                    for m in sync_payload["messages"]
                    if m.get("content") and m["content"].strip()
                ]

                payload = {
                    "userId": sync_user_id,
                    "messages": messages_to_sync
                }

                headers = {"Authorization": f"Bearer {BUDDY_INTERNAL_SECRET}"}
                resp = requests.post(f"{backend_url}/api/conversations/sync", json=payload, headers=headers, timeout=5)
                elapsed = time.time() - t0
                if resp.status_code == 200:
                    logger.info(f"[DB-SYNC] Conversation synced for user {sync_user_id} "
                              f"({len(messages_to_sync)} messages, {elapsed:.2f}s)")
                else:
                    logger.warning(f"[DB-SYNC] Failed to sync (status={resp.status_code}): {resp.text[:200]}")
            except requests.Timeout:
                logger.warning(f"[DB-SYNC] Timeout syncing session {session_id} (5s exceeded)")
            except Exception as ex:
                logger.warning(f"[DB-SYNC] Error syncing session {session_id}: {type(ex).__name__}: {ex}")

        # Submit to the bounded thread pool instead of spawning unlimited threads.
        # This caps concurrent DB sync operations to 4, preventing resource exhaustion.
        try:
            _db_sync_pool.submit(_sync_to_db)
        except Exception as e:
            logger.warning(f"[DB-SYNC] Failed to submit task to pool: {e}")
