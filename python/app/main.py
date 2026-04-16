"""
Hey buddy MAIN API
====================

This is the central FastAPI application file for Hey buddy (Your Intelligent
Companion).  It is the **single entry point** for every HTTP
request — both the REST API *and* the static frontend are served from here.

HOW IT FITS IN THE SYSTEM:
  ┌─────────────┐   HTTP    ┌──────────────────────────────────────────┐
  │  Browser /  │ ───────►  │  main.py  (this file)                    │
  │  Frontend   │ ◄───────  │    ├── FastAPI app + middleware          │
  └─────────────┘  SSE/JSON │    ├── Lifespan (startup / shutdown)     │
                            │    ├── REST endpoints (/chat, /tts, …)   │
                            │    └── Inline TTS pipeline               │
                            │         │                                │
                            │         ▼                                │
                            │  app/services/                           │
                            │    ├── vector_store.py (FAISS embeddings)│
                            │    ├── groq_service.py (LLM via Groq)    │
                            │    ├── realtime_service.py (+Tavily web) │
                            │    └── chat_service.py (session manager) │
                            └──────────────────────────────────────────┘

KEY ARCHITECTURAL DECISIONS:
  • **Lifespan pattern** — FastAPI's recommended way to run setup/teardown
    code.  Services are created once at startup and stored as module-level
    globals so every request handler can use them without re-initialising.
  • **Server-Sent Events (SSE)** for streaming — the `/chat/stream` and
    `/chat/realtime/stream` endpoints return a `StreamingResponse` that
    yields `data: {json}\n\n` lines.  The browser reads these with the
    standard `EventSource` API (or a fetch + ReadableStream).
  • **Inline TTS** — instead of making the client call `/tts` separately
    after the full response arrives, the streaming endpoints can *embed*
    base64 MP3 audio chunks inside the same SSE stream.  This lets the
    frontend start speaking the first sentence while later sentences are
    still being generated.
  • **Single-user design** — one person runs one server.  There is no
    authentication, no multi-tenancy, and CORS is open (`allow_origins=*`).

ENDPOINTS:
  GET  /                    - Redirects to /app/ (frontend).
  GET  /app, /app/*         - Serves the frontend (static files) when frontend/ exists.
  GET  /api                 - Returns API name and list of endpoints.
  GET  /health              - Returns status of all services (for monitoring).
  POST /chat                - General chat (non-streaming).
  POST /chat/stream         - General chat (streaming, saves to JSON periodically).
  POST /chat/realtime       - Realtime chat (non-streaming).
  POST /chat/realtime/stream - Realtime chat (streaming, saves to JSON periodically).
  GET  /chat/history/{id}   - Returns all messages for a session.
  POST /tts                 - Text-to-speech: returns streamed MP3 audio (edge-tts).

SESSION:
  Both /chat and /chat/realtime use the same session_id. If you omit session_id,
  the server generates a UUID and returns it; send it back on the next request
  to continue the conversation. Sessions are saved to disk and survive restarts.

STARTUP:
  On startup, the lifespan function builds the vector store from learning_data/*.txt
  and chats_data/*.json, then creates Groq, Realtime, and Chat services. On shutdown,
  it saves all in-memory sessions to disk.
"""

# =============================================================================
# IMPORTS
# =============================================================================
# Each import is explained below so learners understand *why* it is here.

# pathlib.Path — object-oriented filesystem paths.  Used to locate the
# frontend/ directory relative to this file (see _frontend_dir near the end).
from pathlib import Path
import os as _os

# FastAPI — the web framework itself.
# HTTPException — raises an HTTP error (e.g. 400, 429, 503) that FastAPI
#   automatically converts to a JSON response.
from fastapi import FastAPI, HTTPException, Header, Depends
from typing import Optional as _Optional

# CORSMiddleware — handles Cross-Origin Resource Sharing headers so that a
# browser on a different origin (e.g. localhost:3000) can call this API.
from fastapi.middleware.cors import CORSMiddleware

# GZipMiddleware — compresses response bodies to reduce bandwidth. Configured
# with minimum_size=1000 to only compress responses larger than 1KB (smaller
# responses often get larger after compression).
from fastapi.middleware.gzip import GZipMiddleware

# StreamingResponse — returns an iterable/generator to the client chunk by
#   chunk instead of buffering the entire response body in memory first.
#   Used for SSE streaming and TTS audio streaming.
# RedirectResponse — sends an HTTP 302 redirect (GET / → /app/).
from fastapi.responses import StreamingResponse, RedirectResponse

# StaticFiles — mounts a directory so FastAPI serves its contents as static
# files (HTML, CSS, JS).  Used to serve the frontend under /app.
from fastapi.staticfiles import StaticFiles

# BaseHTTPMiddleware — Starlette base class for writing custom middleware.
# TimingMiddleware (below) subclasses this to log request duration.
from starlette.middleware.base import BaseHTTPMiddleware

# Request — the Starlette request object; used inside TimingMiddleware to
# read the HTTP method and URL path.
from starlette.requests import Request

# asynccontextmanager — decorator that turns an async generator into an async
# context manager.  FastAPI's `lifespan` parameter expects one; everything
# before `yield` runs on startup, everything after runs on shutdown.
from contextlib import asynccontextmanager

# uvicorn — the ASGI server that actually listens on a TCP port and forwards
# HTTP requests to our FastAPI app.  Only used at the very bottom in run().
import uvicorn

# logging — Python's standard logging library.  We create one logger named
# "Hey buddy" and use it throughout this file (and it's the logger you
# see in the terminal when the server is running).
import logging

# json — serialise Python dicts to JSON strings for SSE `data:` payloads.
import json

# time — time.perf_counter() gives high-resolution timestamps for measuring
# how long operations take (startup timing, request duration).
import time

# re — regular expressions.  Used by _split_sentences() to break text at
# punctuation boundaries (periods, commas, etc.) for inline TTS.
import re

# base64 — encode raw MP3 bytes as ASCII text so they can be safely embedded
# inside a JSON string in an SSE event.
import base64

# asyncio — needed by _generate_tts_sync() which runs a tiny one-shot async
# event loop inside a synchronous function (because edge_tts is async but
# the ThreadPoolExecutor calls sync functions).
import asyncio

# ThreadPoolExecutor — a pool of OS threads.  TTS generation is CPU- and
# I/O-bound; we submit each sentence to the pool so multiple sentences can
# be synthesised in parallel without blocking the main async event loop.
from concurrent.futures import ThreadPoolExecutor

# edge_tts — Microsoft Edge's free text-to-speech engine.  It streams MP3
# audio for a given text string.  Used in both the /tts endpoint and in the
# inline TTS pipeline inside _stream_generator.
import edge_tts
from gtts import gTTS
import io

# Pydantic models defined in app/models.py.  They declare the shape of
# request bodies and response bodies; FastAPI auto-validates against them.
#   ChatRequest  — { message: str, session_id: str | None, tts: bool }
#   ChatResponse — { response: str, session_id: str }
#   TTSRequest   — { text: str }
from app.models import ChatRequest, ChatResponse, TTSRequest


# =============================================================================
# RATE LIMIT HANDLING
# =============================================================================
# Groq's free tier has a daily token quota.  When it's exceeded the Groq SDK
# raises an exception whose message contains "429", "rate limit", or "tokens
# per day".  We detect that and return a friendly message instead of a
# cryptic traceback.

# User-friendly message when Groq rate limit (daily token quota) is exceeded.
RATE_LIMIT_MESSAGE = (
    "You've reached your daily API limit for this assistant. "
    "Your credits will reset in a few hours, or you can upgrade your plan for more. "
    "Please try again later."
)


def _is_rate_limit_error(exc: Exception) -> bool:
    """
    Detect whether an exception was caused by hitting Groq's rate limit.

    Groq returns HTTP 429 when you exceed your token-per-day quota.  The
    Python SDK wraps that into a regular Exception, so we inspect the
    stringified message for telltale phrases.

    Returns True if the error looks like a rate-limit error, False otherwise.
    """
    msg = str(exc).lower()
    return "429" in str(exc) or "rate limit" in msg or "tokens per day" in msg


# =============================================================================
# SERVICE IMPORTS
# =============================================================================
# These are the core backend services.  They are imported *after* the rate-
# limit helper because Python executes module-level code top-to-bottom and
# some services have heavy imports (numpy, faiss, etc.).  Grouping them here
# keeps the import section tidy.

# VectorStoreService — builds and queries a FAISS vector index over the user's
#   learning_data/*.txt files and chats_data/*.json chat logs.  This gives the
#   LLM relevant context ("retrieval-augmented generation" / RAG).
from app.services.vector_store import VectorStoreService

# GroqService — wraps the Groq Cloud LLM API.  Sends the user's message plus
#   vector-store context to the model and returns the response.
#   AllGroqApisFailedError — raised when every configured Groq API key has
#   been exhausted or errored out.
from app.services.groq_service import GroqService, AllGroqApisFailedError

# RealtimeGroqService — extends GroqService by adding a Tavily web search
#   step *before* calling the LLM, so responses include up-to-date info.
from app.services.realtime_service import RealtimeGroqService

# ChatService — the session manager.  It holds in-memory chat histories,
#   delegates to GroqService or RealtimeGroqService, and persists sessions
#   to JSON files on disk.
from app.services.chat_service import ChatService
from app.services.system_service import SystemService
from app.services.language_service import LanguageService
from app.services.consensus_service import ConsensusService
from app.models import ChatRequest, ChatResponse, TTSRequest, ActionRequest

# Configuration values loaded from config.py (which reads .env).
# Each one is used during startup or at request time:
#   VECTOR_STORE_DIR       — path to the FAISS index directory
#   GROQ_API_KEYS          — list of Groq API keys (round-robined if one fails)
#   GROQ_MODEL             — which Groq model to use (e.g. "llama-3.3-70b-versatile")
#   TAVILY_API_KEY         — API key for Tavily web search (realtime mode)
#   EMBEDDING_MODEL        — sentence-transformer model for vector embeddings
#   CHUNK_SIZE/OVERLAP      — text chunking params for the vector store
#   MAX_CHAT_HISTORY_TURNS — how many user/assistant turns to keep in context
#   ASSISTANT_NAME         — display name ("Hey buddy")
#   TTS_VOICE              — edge-tts voice ID (e.g. "en-US-ChristopherNeural")
#   TTS_RATE               — speech speed adjustment (e.g. "+0%")
from config import (
    VECTOR_STORE_DIR, GROQ_API_KEYS, GROQ_MODEL, TAVILY_API_KEY,
    EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP, MAX_CHAT_HISTORY_TURNS,
    ASSISTANT_NAME, TTS_VOICE, TTS_RATE,
)


# =============================================================================
# LOGGING SETUP
# =============================================================================
# We configure the root logger with a human-readable format:
#   2025-02-21 14:30:00 | INFO     | Hey buddy            | message…
# Every log call in this file (and child loggers) will follow this format.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("Hey buddy")


# =============================================================================
# GLOBAL SERVICE REFERENCES
# =============================================================================
# These are module-level variables that hold the singleton service instances.
# They start as None and are set during startup (lifespan).  Every async
# endpoint reads from these globals — this works because:
#   1. Python module globals are shared across all coroutines in the same process.
#   2. We only write to them once (at startup), so there's no race condition.
#   3. FastAPI runs in a single-process, single-event-loop model (by default),
#      so all request handlers see the same objects.
vector_store_service: VectorStoreService = None
groq_service: GroqService = None
realtime_service: RealtimeGroqService = None
chat_service: ChatService = None
system_service: SystemService = None
language_service: LanguageService = None
consensus_service: ConsensusService = None


def print_title():
    """
    Print the Hey buddy ASCII art banner to the console when the server
    starts.  This is purely cosmetic — it makes the terminal output look cool
    and confirms to the user that the correct application is running.
    """
    title = """

   ╔══════════════════════════════════════════════════════════╗
   ║                                                          ║
   ║         ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗          ║
   ║         ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝          ║
   ║         ██║███████║██████╔╝██║   ██║██║███████╗          ║
   ║    ██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║          ║
   ║    ╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║          ║
   ║     ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝          ║
   ║                                                          ║
   ║              Your Intelligent Companion               ║
   ║                                                          ║
   ╚══════════════════════════════════════════════════════════╝

    """
    print(title)


# =============================================================================
# LIFESPAN (STARTUP / SHUTDOWN)
# =============================================================================
# FastAPI's "lifespan" replaces the older @app.on_event("startup") /
# @app.on_event("shutdown") pattern.  It's an async context manager:
#   • Code BEFORE `yield` runs once when the server starts.
#   • Code AFTER  `yield` runs once when the server shuts down.
# This guarantees that teardown logic always executes, even if the server
# is killed with Ctrl-C.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager — handles startup and shutdown.
    
    This function manages the application's lifecycle:
    - STARTUP: Initializes all services in the correct order
      1. VectorStoreService: Creates FAISS index from learning data and chat history
      2. GroqService: Sets up general chat AI service
      3. RealtimeGroqService: Sets up realtime chat with Tavily search
      4. ChatService: Manages chat sessions and conversations
    - RUNTIME: Application runs normally
    - SHUTDOWN: Saves all active chat sessions to disk
    
    The services are initialized in this specific order because:
    - VectorStoreService must be created first (used by GroqService)
    - GroqService must be created before RealtimeGroqService (it inherits from it)
    - ChatService needs both GroqService and RealtimeGroqService

    WHY GLOBALS?
    We write into module-level globals so that every endpoint handler can
    access the same service instances.  The `global` keyword tells Python
    "when I assign to these names, update the module-level variable, don't
    create a local one".
    
    All services are stored as global variables so they can be accessed by API endpoints.
    """
    global vector_store_service, groq_service, realtime_service, chat_service, system_service, language_service, consensus_service
    
    print_title()
    logger.info("=" * 60)
    logger.info("Hey buddy - Starting Up...")
    logger.info("=" * 60)
    logger.info("[CONFIG] Assistant name: %s", ASSISTANT_NAME)
    logger.info("[CONFIG] Groq model: %s", GROQ_MODEL)
    logger.info("[CONFIG] Groq API keys loaded: %d", len(GROQ_API_KEYS))
    logger.info("[CONFIG] Tavily API key: %s", "configured" if TAVILY_API_KEY else "NOT SET")
    logger.info("[CONFIG] Embedding model: %s", EMBEDDING_MODEL)
    logger.info("[CONFIG] Chunk size: %d | Overlap: %d | Max history turns: %d",
                CHUNK_SIZE, CHUNK_OVERLAP, MAX_CHAT_HISTORY_TURNS)
    
    try:
        # --- Step 1: Vector Store (FAISS) ---
        # Must be initialised FIRST because GroqService and RealtimeGroqService
        # both receive it as a constructor argument and query it at inference time
        # to supply the LLM with relevant context documents (RAG pattern).
        logger.info("Initializing vector store service...")
        t0 = time.perf_counter()
        vector_store_service = VectorStoreService()
        await vector_store_service.create_vector_store()  # reads files, chunks, embeds, builds FAISS index
        logger.info("[TIMING] startup_vector_store: %.3fs", time.perf_counter() - t0)
        
        # --- Step 2: Groq Service (general chat) ---
        # Wraps the Groq LLM API.  Uses vector_store_service for RAG context.
        # Does NOT search the web — purely LLM + local knowledge.
        logger.info("Initializing Groq service (general queries)...")
        groq_service = GroqService(vector_store_service)
        logger.info("Groq service initialized successfully")
        
        # --- Step 3: Realtime Groq Service (chat + Tavily web search) ---
        # Inherits from / wraps GroqService and adds a Tavily web-search step
        # before calling the LLM, so responses include up-to-the-minute info.
        logger.info("Initializing Realtime Groq service (with Tavily search)...")
        realtime_service = RealtimeGroqService(vector_store_service)
        logger.info("Realtime Groq service initialized successfully")
        
        # --- Step 4: Chat Service (session manager) ---
        # Orchestrates conversations: creates/loads sessions, delegates messages
        # to the correct backend (groq_service or realtime_service), manages
        # chat history, and saves sessions to disk as JSON files.
        logger.info("Initializing chat service...")
        chat_service = ChatService(groq_service, realtime_service, vector_store_service)
        logger.info("Chat service initialized successfully")
        
        # --- Step 5: System Service (actions) ---
        logger.info("Initializing system service...")
        system_service = SystemService()
        logger.info("System service initialized successfully")

        logger.info("Initializing language service...")
        language_service = LanguageService()
        logger.info("Language service initialized successfully")

        # --- Step 7: Consensus Service ---
        logger.info("Initializing consensus service...")
        consensus_service = ConsensusService(groq_service)
        logger.info("Consensus service initialized successfully")
        
        # --- Startup complete — print a summary ---
        logger.info("=" * 60)
        logger.info("Service Status:")
        logger.info("  - Vector Store: Ready")
        logger.info("  - Groq AI (General): Ready")
        logger.info("  - Groq AI (Realtime): Ready")
        logger.info("  - Chat Service: Ready")
        logger.info("  - Consensus Mode: Ready")
        logger.info("=" * 60)
        logger.info("Hey buddy is online and ready!")
        logger.info("API: http://localhost:8000")
        logger.info("Frontend: http://localhost:8000/app/ (open in browser)")
        # Security reminder — warn loudly if no API key is configured
        if not _os.getenv("BUDDY_API_KEY", ""):
            logger.warning("[SECURITY] BUDDY_API_KEY is not set — all /chat endpoints are unprotected!")
            logger.warning("[SECURITY] Set BUDDY_API_KEY=<random-secret> in your .env for production.")
        logger.info("=" * 60)
        
        # --- Hand control to FastAPI (the app runs between yield and the code below) ---
        yield
        
        # --- SHUTDOWN: runs when the server stops (Ctrl-C, SIGTERM, etc.) ---
        # Walk every in-memory session and flush it to a JSON file on disk so
        # that conversations survive server restarts.
        logger.info("\nShutting down Hey buddy...")
        if chat_service:
            for session_id in list(chat_service.sessions.keys()):
                chat_service.save_chat_session(session_id)
        logger.info("All sessions saved. Goodbye!")
        
    except Exception as e:
        logger.error(f"Fatal error during startup: {e}", exc_info=True)
        raise


# =============================================================================
# FASTAPI APP INSTANCE AND CORS MIDDLEWARE
# =============================================================================

# Create the FastAPI application.
# `lifespan` runs once at startup (build services) and once at shutdown (save sessions).
# `docs_url`, `redoc_url`, `openapi_url` are all None to disable the auto-
# generated documentation endpoints (/docs, /redoc, /openapi.json).  This is a
# personal assistant, not a public API — docs live in the README instead.
app = FastAPI(
    title="Hey buddy API",
    description="Your Intelligent Companion",
    lifespan=lifespan,
    docs_url=None,   # No /docs page; documentation is in README only
    redoc_url=None,  # No /redoc page
    openapi_url=None # No /openapi.json (disables docs entirely)
)

# --- GZip Compression Middleware ---
# Automatically compress response bodies (non-streaming) for faster delivery.
# minimum_size=1000: only compress responses larger than 1KB (smaller ones
# often get larger after gzip overhead). Note: streaming SSE responses are
# excluded by default since they use StreamingResponse.
app.add_middleware(GZipMiddleware, minimum_size=1000)

# --- CORS (Cross-Origin Resource Sharing) Middleware ---
# SECURITY: allow_origins=["*"] with allow_credentials=True is invalid per the
# CORS spec and creates CSRF risks. We now read the allowed origin list from the
# ALLOWED_ORIGINS env var (comma-separated). Falls back to localhost only.
#
# Example .env entry:
#   ALLOWED_ORIGINS=https://ayuskart.com,https://www.ayuskart.com
#
_raw_origins = _os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:8000,http://10.0.2.2:5173,http://10.0.2.2:8000")
_ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

# =============================================================================
# API KEY AUTHENTICATION
# =============================================================================
# A simple shared-secret guard for all /chat and /tts endpoints.
# Set BUDDY_API_KEY in your .env.  Requests must include the header:
#   X-API-Key: <your key>
# If BUDDY_API_KEY is not set the check is skipped (dev/local mode), but a
# warning is logged at startup so you don't accidentally ship without it.
#
_BUDDY_API_KEY = _os.getenv("BUDDY_API_KEY", "")

async def _require_api_key(x_api_key: _Optional[str] = Header(default=None)):
    """Dependency: reject requests that don't carry the correct API key."""
    if not _BUDDY_API_KEY:
        # Dev mode — key not configured, allow all (warning already logged at startup).
        return
    if x_api_key != _BUDDY_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


# =============================================================================
# TIMING MIDDLEWARE
# =============================================================================

class TimingMiddleware(BaseHTTPMiddleware):
    """
    A custom middleware that logs every HTTP request with its duration.

    Middleware sits between the web server and your route handlers.  Every
    incoming request passes through all middleware (in order) before it reaches
    the endpoint, and the response passes back through them on the way out.

    This middleware:
      1. Records the current time (t0).
      2. Calls `call_next(request)` to pass the request down to the next
         middleware / route handler.
      3. When the response comes back, computes the elapsed time.
      4. Logs one line:  [REQUEST] GET /health -> 200 (0.002s)

    This is invaluable for debugging slow endpoints and monitoring performance.
    """

    async def dispatch(self, request: Request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - t0
        path = request.url.path
        
        # Skip logging for common heartbeat or browser-internal requests to keep logs clean
        if path == "/favicon.ico":
            return response
            
        logger.info("[REQUEST] %s %s -> %s (%.3fs)", request.method, path, response.status_code, elapsed)
        return response


# Register the TimingMiddleware.  Middleware is applied in reverse
# registration order, so this runs *inside* the CORS middleware (which is
# fine — we want to time the actual handler, not the CORS header injection).
app.add_middleware(TimingMiddleware)


# ============================================================================
# API ENDPOINTS
# ============================================================================
# Each endpoint is an `async def` decorated with @app.get or @app.post.
# FastAPI automatically:
#   • Parses query params, path params, and JSON request bodies.
#   • Validates them against Pydantic models (ChatRequest, ChatResponse, …).
#   • Serialises the return value to JSON.
#   • Converts HTTPException into the correct HTTP status code + JSON body.


@app.get("/api")
async def api_info():
    """
    Discovery endpoint — returns the API name and a short description of
    every available endpoint.  Useful for health-check scripts or for a
    developer who curls the server and wants to know what's available.
    """
    return {
        "message": "Hey buddy API",
        "endpoints": {
            "/chat": "General chat (non-streaming)",
            "/chat/stream": "General chat (streaming chunks)",
            "/chat/realtime": "Realtime chat (non-streaming)",
            "/chat/realtime/stream": "Realtime chat (streaming chunks)",
            "/chat/history/{session_id}": "Get chat history",
            "/health": "System health check",
            "/tts": "Text-to-speech (POST text, returns streamed MP3)",
            "/chat/consensus": "Premium consensus mode (multi-LLM verification)"
        }
    }


@app.get("/health")
async def health():
    """
    Health-check endpoint.

    Returns HTTP 200 with a JSON object showing whether each service has
    been successfully initialised.  A monitoring tool (or the frontend) can
    poll this to know when the server is ready to accept chat requests.

    Example response:
      { "status": "healthy", "vector_store": true, "groq_service": true, … }
    """
    return {
        "status": "healthy",
        "vector_store": vector_store_service is not None,
        "groq_service": groq_service is not None,
        "realtime_service": realtime_service is not None,
        "chat_service": chat_service is not None
    }


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """
    Handle browser's automatic favicon request to avoid 404 logs.
    Returns a 204 No Content status.
    """
    from fastapi import Response
    return Response(status_code=204)


@app.post("/chat", response_model=ChatResponse, dependencies=[Depends(_require_api_key)])
async def chat(request: ChatRequest):
    """
    General chat endpoint - send a message to Hey buddy.
    
    This endpoint uses the general chatbot mode which does NOT perform web searches.
    It's perfect for:
    - Conversational questions
    - Historical information
    - General knowledge queries
    - Questions that don't require current/realtime information
    
    HOW IT WORKS:
    1. Receives user message and optional session_id
    2. Gets or creates a chat session
    3. Processes message through GroqService (pure LLM, no web search)
    4. Retrieves context from user data files and past conversations
    5. Generates response using Groq AI
    6. Saves session to disk
    7. Returns response and session_id
    
    SESSION MANAGEMENT:
    - If session_id is NOT provided: Server generates a new UUID (server-managed)
    - If session_id IS provided: Server uses it (loads from disk if exists, creates new if not)
    - Use the SAME session_id with /chat/realtime to seamlessly switch between modes
    - Sessions persist across server restarts (loaded from disk)
    
    REQUEST BODY:
    {
        "message": "What is Python?",
        "session_id": "optional-session-id"
    }
    
    RESPONSE:
    {
        "response": "Python is a high-level programming language...",
        "session_id": "session-id-here"
    }

    ERROR HANDLING:
    - 400 — invalid session_id format
    - 429 — Groq daily rate limit exceeded
    - 503 — chat_service not ready OR all Groq API keys exhausted
    - 500 — unexpected server error
    """
    # Guard: if lifespan hasn't finished yet (or failed), the service is None.
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not initialized")

    # --- Message length guard ---
    # Prevent token overflow and potential abuse by rejecting messages that are
    # too long or empty. ~32 000 chars ≈ ~8 000 tokens — well within model limits.
    _MAX_MSG_LEN = 32_000
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(request.message) > _MAX_MSG_LEN:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long ({len(request.message)} chars). Maximum is {_MAX_MSG_LEN}."
        )

    logger.info("[API /chat] Incoming | session_id=%s | message_len=%d | message=%.100s",
                request.session_id or "new", len(request.message), request.message)
    try:
        # Retrieve an existing session or create a new one (returns session_id string).
        session_id = await chat_service.get_or_create_session(request.session_id)

        # Send the message through the non-streaming pipeline:
        #   chat_service → groq_service → vector_store (RAG) → Groq LLM → response text
        response_text = chat_service.process_message(session_id, request.message, api_key=getattr(request, 'api_key', None), provider=getattr(request, 'provider', None), model=getattr(request, 'model', None), user_id=request.userId, memory_context=request.memory_context or "", fallback_groq_key=getattr(request, 'fallback_groq_key', None), api_keys_dict=getattr(request, 'api_keys', None))

        # Persist the updated session (including the new user + assistant messages)
        # to a JSON file on disk so it survives server restarts.
        chat_service.save_chat_session(session_id)

        logger.info("[API /chat] Done | session_id=%s | response_len=%d", session_id[:12], len(response_text))
        return ChatResponse(response=response_text, session_id=session_id)

    # --- Structured error handling ---
    # ValueError: invalid session_id (e.g. not a valid UUID)
    except ValueError as e:
        logger.warning("[API /chat] Invalid session_id: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    # AllGroqApisFailedError: every API key returned an error (not just rate-limit)
    except AllGroqApisFailedError as e:
        logger.error("[API /chat] All Groq APIs failed: %s", e)
        raise HTTPException(status_code=503, detail=str(e))
    # Catch-all: check for rate limit first, then re-raise as 500
    except Exception as e:
        if _is_rate_limit_error(e):
            logger.warning("[API /chat] Rate limit hit: %s", e)
            raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)
        logger.error("[API /chat] Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")


@app.post("/chat/consensus", response_model=ChatResponse, dependencies=[Depends(_require_api_key)])
async def chat_consensus(request: ChatRequest):
    """
    PREMIUM: Consensus Mode endpoint.
    
    Calls multiple LLMs (Groq, Gemini, OpenAI) in parallel, then uses a 
    'Verifying LLM' to synthesize a final, highly reliable consensus answer.
    
    Perfect for factual questions where you want to minimize hallucinations.
    """
    if not consensus_service:
        raise HTTPException(status_code=503, detail="Consensus service not initialized")

    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    logger.info("[API /chat/consensus] Incoming | message=%.100s", request.message)
    try:
        # Get history from chat_service (if session exists)
        history = []
        if request.session_id:
            session = chat_service.sessions.get(request.session_id)
            if session:
                history = session.get("history", [])

        # Call the consensus service (async)
        response_text = await consensus_service.get_consensus_response(
            question=request.message,
            chat_history=history,
            user_id=request.userId
        )

        # Build session_id if missing
        session_id = request.session_id or await chat_service.get_or_create_session(None)
        
        # Save response to history (optional, here we do it to keep session context)
        if session_id in chat_service.sessions:
            chat_service.sessions[session_id]["history"].append(("user", request.message))
            chat_service.sessions[session_id]["history"].append(("assistant", response_text))
            chat_service.save_chat_session(session_id)

        return ChatResponse(response=response_text, session_id=session_id)

    except Exception as e:
        logger.error("[API /chat/consensus] Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Consensus error: {str(e)}")


# =============================================================================
# INLINE TTS — sentence splitting + audio generation inside SSE stream
# =============================================================================
# The "inline TTS" system is the most complex part of this file.  Here's the
# big picture:
#
# PROBLEM:
#   The LLM streams text token-by-token.  We want the user to HEAR the
#   response (text-to-speech) as soon as possible — ideally the first sentence
#   starts playing while later sentences are still being generated.
#
# SOLUTION:
#   As LLM tokens arrive, we accumulate them into a buffer.  When we detect a
#   complete sentence (ends with `.`, `!`, `?`, etc.), we immediately submit it
#   to a thread-pool worker that calls edge_tts to synthesise MP3 audio.
#   Meanwhile, the text tokens continue streaming to the client without delay.
#   When a TTS worker finishes, we inject a `{"audio": "<base64>", "sentence":
#   "…"}` event into the SSE stream.
#
# KEY DESIGN GOALS:
#   1. Text never waits for audio — tokens are yielded the instant they arrive.
#   2. Audio is generated in parallel (ThreadPoolExecutor with 4 workers).
#   3. Audio events are yielded IN ORDER — even if sentence #3 finishes before
#      sentence #2, sentence #2's audio is yielded first.
#
# The pipeline has five helpers:
#   _split_sentences — splits accumulated text at punctuation boundaries
#   _merge_short     — merges tiny fragments ("OK.") into neighbouring sentences
#   _generate_tts_sync — synchronous wrapper around async edge_tts (runs in thread)
#   _tts_pool        — the ThreadPoolExecutor (4 workers)
#   _stream_generator — the main SSE generator that ties everything together
#
# Adapted from reference project: split on punctuation, merge short fragments,
# generate edge-tts audio, send base64 MP3 alongside text chunks.
# =============================================================================

# Regex that matches a split point: one of  . ! ? , ; :  followed by whitespace.
# re.split() with this pattern breaks text into sentences at these boundaries.
# The (?<=…) is a *lookbehind* — it asserts the punctuation is BEFORE the split
# point, so the punctuation stays attached to the preceding sentence.
_SPLIT_RE = re.compile(r"(?<=[.!?,;:])")

# Minimum word counts to avoid generating TTS for trivially short fragments.
# _MIN_WORDS_FIRST: the very first sentence must have at least this many words.
# _MIN_WORDS: subsequent sentences must have at least this many.
# _MERGE_IF_WORDS: if a sentence has ≤ this many words, merge it into the next.
_MIN_WORDS_FIRST = 1
_MIN_WORDS = 1
_MERGE_IF_WORDS = 1


def _split_sentences(buf: str):
    """
    Split a text buffer into complete sentences at punctuation boundaries.

    Takes the accumulated text buffer and attempts to split it into complete
    sentences.  Only text followed by whitespace after punctuation is
    considered a complete sentence — the last fragment (which may still be
    receiving more tokens) is returned as `remaining`.

    Args:
        buf: The accumulated text buffer (may contain multiple sentences).

    Returns:
        (sentences, remaining) — a list of complete sentences and the
        leftover text that hasn't ended with punctuation + space yet.

    Example:
        _split_sentences("Hello world. How are you? I am")
        → (["Hello world.", "How are you?"], "I am")

    The function also enforces minimum word counts: if a sentence is too
    short (fewer than _MIN_WORDS_FIRST for the first, _MIN_WORDS for the
    rest), it's held in `pending` and prepended to the next sentence.
    """
    parts = _SPLIT_RE.split(buf)
    # If there's only one part, no complete sentence boundary was found yet.
    if len(parts) <= 1:
        return [], buf
    # Everything except the last part is a complete sentence;
    # the last part is still accumulating tokens.
    raw = [p.strip() for p in parts[:-1] if p.strip()]
    sentences, pending = [], ""
    for s in raw:
        # If a previous fragment was too short, prepend it to this one.
        if pending:
            s = (pending + " " + s).strip()
            pending = ""
        # Enforce minimum word count — too-short fragments get held back.
        min_req = _MIN_WORDS_FIRST if not sentences else _MIN_WORDS
        if len(s.split()) < min_req:
            pending = s
            continue
        sentences.append(s)
    # Combine any leftover pending text with the last (incomplete) part.
    remaining = (pending + " " + parts[-1].strip()).strip() if pending else parts[-1].strip()
    return sentences, remaining


def _merge_short(sentences):
    """
    Merge tiny trailing fragments into the previous sentence.

    After splitting, we may end up with very short sentences like "OK." or
    "Sure."  These produce awkward TTS audio on their own.  This function
    scans forward: if the next sentence has ≤ _MERGE_IF_WORDS words, it's
    concatenated onto the current sentence.

    Example:
        _merge_short(["I think so.", "Yes.", "Let me explain."])
        → ["I think so. Yes.", "Let me explain."]

    This produces more natural-sounding speech with fewer, longer TTS calls.
    """
    if not sentences:
        return []
    merged, i = [], 0
    while i < len(sentences):
        cur = sentences[i]
        j = i + 1
        # Absorb following short sentences into `cur`.
        while j < len(sentences) and len(sentences[j].split()) <= _MERGE_IF_WORDS:
            cur = (cur + " " + sentences[j]).strip()
            j += 1
        merged.append(cur)
        i = j
    return merged


def _generate_tts_sync(text: str, voice: str, rate: str) -> bytes:
    """
    Generate MP3 audio bytes from text using edge_tts — synchronous wrapper.
    Falls back to gTTS if edge_tts fails (e.g. 403 Forbidden).
    """
    async def _inner():
        try:
            communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
            parts = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    parts.append(chunk["data"])
            
            audio_data = b"".join(parts)
            if not audio_data:
                raise ValueError("Edge TTS returned empty audio")
            return audio_data
            
        except Exception as e:
            logger.warning(f"[TTS-FALLBACK] Edge TTS failed ({e}), falling back to gTTS for: {text[:30]}...")
            try:
                # gTTS fallback (always works on VPS unless Google blocks IP)
                # Mapping edge-tts lang prefix to gtts lang
                lang = "en"
                if "-" in voice:
                    lang = voice.split("-")[0]
                
                tts = gTTS(text=text, lang=lang)
                fp = io.BytesIO()
                tts.write_to_fp(fp)
                return fp.getvalue()
            except Exception as ge:
                logger.error(f"[TTS-FATAL] Both Edge and gTTS failed: {ge}")
                return b""

    return asyncio.run(_inner())


# Thread pool for parallel TTS generation.  4 workers means up to 4 sentences
# can be synthesised simultaneously.  This is a module-level singleton —
# created once when the module is imported, shared across all requests.
_tts_pool = ThreadPoolExecutor(max_workers=12)


def _stream_generator(session_id: str, chunk_iter, is_realtime: bool, tts_enabled: bool = False, initial_language: str = "en", gender: str = "male", tone: str = "normal", voice_id: str = None):
    """
    The core SSE (Server-Sent Events) generator for streaming chat responses.

    This generator is the heart of the streaming + inline TTS pipeline.
    It is passed to FastAPI's StreamingResponse and yields SSE-formatted
    strings that the browser reads as a stream of events.

    OVERVIEW OF WHAT HAPPENS:
    ─────────────────────────
    1. Yields an initial event with the session_id (so the client knows it).
    2. Iterates over `chunk_iter` (the LLM's token-by-token output).
    3. For each chunk:
       a. Yields the text chunk IMMEDIATELY (never blocked by TTS).
       b. If TTS is enabled, accumulates text in a buffer, splits into
          sentences, and submits complete sentences to the TTS thread pool.
       c. Checks if any previously-submitted TTS jobs have finished and
          yields their audio events (in order).
    4. After the LLM finishes, flushes any remaining text as a final TTS job.
    5. Waits for all pending TTS futures to complete and yields their audio.
    6. Yields a final `done: True` event to signal the end of the stream.

    SSE FORMAT:
    ───────────
    Each event is a line like:  data: {"chunk": "Hello", "done": false}\n\n
    The browser's EventSource API parses these automatically.
    Audio events look like:     data: {"audio": "<base64-mp3>", "sentence": "Hello."}\n\n

    KEY VARIABLES:
    ──────────────
    • buffer    — accumulates raw text chunks until a full sentence is detected.
    • held      — the most-recent complete sentence that we *haven't submitted
                  yet*.  We hold it back because the next chunk might extend it
                  (e.g. "Dr." looks like a sentence end, but "Dr. Smith" doesn't).
                  Only when the NEXT sentence starts do we submit `held` to TTS.
    • is_first  — tracks whether we've submitted the first sentence yet (the
                  first sentence has a stricter minimum word count to avoid
                  generating audio for a greeting fragment like "Hi.").
    • audio_queue — an ordered list of (Future, sentence_text) tuples.  Each
                    Future represents a TTS job running in the thread pool.
                    The queue preserves sentence order so audio plays back in
                    the correct sequence, even if later sentences finish first.

    Args:
        session_id:   The chat session identifier (echoed back to the client).
        chunk_iter:   An iterable/generator yielding text chunks from the LLM.
        is_realtime:  True if this is a realtime (web-search) response.
        tts_enabled:  If True, generate and stream inline TTS audio alongside text.
    
    Yields:
        SSE-formatted strings ("data: {json}\n\n").
    """
    # First event: tells the client which session_id to use for future requests.
    # Include the detected language for the current turn.
    yield f"data: {json.dumps({'session_id': session_id, 'chunk': '', 'done': False, 'lang': initial_language})}\n\n"

    buffer = ""       # Accumulated text not yet split into sentences
    held = None       # Last complete sentence, held back in case the next chunk extends it
    is_first = True   # Whether we've submitted the first TTS sentence yet
    audio_queue = []  # Ordered list of (Future, sentence_text) — preserves playback order

    def _submit(text):
        """Submit a sentence to the TTS thread pool and add the Future to audio_queue."""
        # Detect language and pick a matching voice. Use initial_language as hint for efficiency.
        voice = voice_id if voice_id else language_service.get_voice_for_text(text, gender=gender, default_voice=TTS_VOICE)
        
        # Map tone to rate
        rate = TTS_RATE
        if tone == "energetic":
            rate = "+15%"
        elif tone == "soft":
            rate = "-10%"
            
        audio_queue.append((_tts_pool.submit(_generate_tts_sync, text, voice, rate), text))

    def _drain_ready():
        """
        Check completed audio futures WITHOUT blocking and yield their events.

        Only pops from the FRONT of the queue — this is critical for preserving
        sentence order.  If sentence #1 is still processing but sentence #2 is
        done, we do NOT yield #2 yet; we wait until #1 finishes first.

        The .done() check is non-blocking: it returns True if the Future has
        completed (success or failure), False if it's still running.

        Returns a list of SSE event strings ready to be yielded.
        """
        events = []
        while audio_queue and audio_queue[0][0].done():
            fut, sent = audio_queue.pop(0)
            try:
                audio = fut.result()
                b64 = base64.b64encode(audio).decode("ascii")
                events.append(f"data: {json.dumps({'audio': b64, 'sentence': sent})}\n\n")
            except Exception as exc:
                logger.warning("[TTS-INLINE] Failed for '%s': %s", sent[:40], exc)
        return events

    try:
        # ── Main loop: iterate over LLM text chunks (or search_results in realtime) ──
        for chunk in chunk_iter:
            # Realtime mode may yield a dict first: send search_results to the client widget.
            if isinstance(chunk, dict) and "_search_results" in chunk:
                yield f"data: {json.dumps({'search_results': chunk['_search_results']})}\n\n"
                continue
            if not chunk:
                continue

            # --- Text goes out instantly — TTS never blocks text delivery ---
            yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"

            if not tts_enabled:
                continue

            # Between chunks, check if any TTS jobs finished and yield their audio.
            for ev in _drain_ready():
                yield ev

            # Accumulate this chunk into the buffer and try to split sentences.
            buffer += chunk
            sentences, buffer = _split_sentences(buffer)
            sentences = _merge_short(sentences)

            # If we're holding a previous sentence and the new first sentence
            # is very short, merge them (avoids tiny standalone TTS clips).
            if held and sentences and len(sentences[0].split()) <= _MERGE_IF_WORDS:
                held = (held + " " + sentences[0]).strip()
                sentences = sentences[1:]

            for i, sent in enumerate(sentences):
                # Enforce minimum word count before submitting to TTS.
                min_w = _MIN_WORDS_FIRST if is_first else _MIN_WORDS
                if len(sent.split()) < min_w:
                    continue
                
                # --- OPTIMIZATION: IMMEDIATE FIRST RESPONSE ---
                # If this is the very first sentence of the response, submit it instantly.
                # Don't hold it back for extension checks, as the first 1-2 tokens are 
                # almost always the full greeting or start of the logic.
                if is_first:
                    _submit(sent)
                    is_first = False
                    continue

                is_last = (i == len(sentences) - 1)
                # If we were holding a sentence, submit it now (a new sentence
                # confirms the held one is truly complete).
                if held:
                    _submit(held)
                    held = None
                
                if is_last:
                    # Hold subsequent sentences briefly to ensure they are complete
                    held = sent
                else:
                    _submit(sent)

    except Exception as e:
        # If anything goes wrong mid-stream, cancel pending TTS jobs and send
        # an error event so the client knows the stream terminated abnormally.
        for fut, _ in audio_queue:
            fut.cancel()
        yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': str(e)})}\n\n"
        return

    # --- Flush remaining TTS after the LLM finishes ---
    if tts_enabled:
        remaining = buffer.strip()  # Any text left in the buffer after the last chunk
        if held:
            # If there's leftover text that's very short, merge it with the held sentence.
            if remaining and len(remaining.split()) <= _MERGE_IF_WORDS:
                _submit((held + " " + remaining).strip())
            else:
                _submit(held)
                if remaining:
                    _submit(remaining)
        elif remaining:
            _submit(remaining)

        # Wait for EVERY pending TTS future to complete (in order) and yield
        # their audio.  timeout=15 prevents hanging forever if edge_tts stalls.
        for fut, sent in audio_queue:
            try:
                audio = fut.result(timeout=15)
                b64 = base64.b64encode(audio).decode("ascii")
                yield f"data: {json.dumps({'audio': b64, 'sentence': sent})}\n\n"
            except Exception as exc:
                logger.warning("[TTS-INLINE] Failed for '%s': %s", sent[:40], exc)

    # Final event: signals the client that the stream is complete.
    yield f"data: {json.dumps({'chunk': '', 'done': True, 'session_id': session_id})}\n\n"


# =============================================================================
# STREAMING CHAT ENDPOINTS
# =============================================================================

@app.post("/chat/stream", dependencies=[Depends(_require_api_key)])
async def chat_stream(request: ChatRequest):
    """
    General chat with streaming — returns LLM tokens as Server-Sent Events.

    This is the streaming counterpart of POST /chat.  Instead of waiting for
    the entire response to be generated, it yields each token as it arrives
    from the Groq API.  The frontend can display text incrementally, giving
    the user a much more responsive experience.

    The response is a StreamingResponse with media_type="text/event-stream".
    Each SSE event is a JSON object:
      • { "session_id": "…", "chunk": "", "done": false }  — first event
      • { "chunk": "Hello", "done": false }                — text token
      • { "audio": "<base64>", "sentence": "Hello." }      — TTS audio (if tts=true)
      • { "chunk": "", "done": true, "session_id": "…" }   — final event

    The `request.tts` flag (from ChatRequest) enables inline TTS: when true,
    _stream_generator will split text into sentences, generate MP3 audio in
    background threads, and interleave audio events into the SSE stream.

    Headers:
      Cache-Control: no-cache     — prevents proxies from buffering the stream
      X-Accel-Buffering: no       — tells nginx (if present) not to buffer

    Saves to JSON every 5 chunks for fast persistence. Same session as /chat.
    """
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not initialized")
    _MAX_MSG_LEN = 32_000
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(request.message) > _MAX_MSG_LEN:
        raise HTTPException(status_code=400, detail=f"Message too long ({len(request.message)} chars). Maximum is {_MAX_MSG_LEN}.")
    logger.info("[API /chat/stream] Incoming | session_id=%s | message_len=%d | message=%.100s",
                request.session_id or "new", len(request.message), request.message)
    try:
        session_id = await chat_service.get_or_create_session(request.session_id)
        # process_message_stream returns a generator that yields text chunks.
        chunk_iter = chat_service.process_message_stream(session_id, request.message, api_key=getattr(request, 'api_key', None), provider=getattr(request, 'provider', None), model=getattr(request, 'model', None), user_id=request.userId, memory_context=request.memory_context or "", fallback_groq_key=getattr(request, 'fallback_groq_key', None), api_keys_dict=getattr(request, 'api_keys', None))
        # Detect language of user message to set the context
        user_lang = language_service.detect_language(request.message)

        return StreamingResponse(
            _stream_generator(session_id, chunk_iter, is_realtime=False, tts_enabled=request.tts, initial_language=user_lang, gender=request.gender, tone=request.tone, voice_id=request.voice_id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AllGroqApisFailedError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)
        logger.error("[API /chat/stream] Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/realtime", response_model=ChatResponse, dependencies=[Depends(_require_api_key)])
async def chat_realtime(request: ChatRequest):
    """
    Realtime chat endpoint - send a message to Hey buddy with Tavily web search.
    
    This endpoint uses the realtime chatbot mode which performs web searches via Tavily
    before generating a response. It's perfect for:
    - Current events and news
    - Recent information
    - Questions requiring up-to-date data
    - Anything that needs internet access
    
    HOW IT WORKS:
    1. Receives user message and optional session_id
    2. Gets or creates a chat session (SAME as /chat endpoint)
    3. Searches Tavily for real-time information (fast, AI-optimized, English-only)
    4. Retrieves context from user data files and past conversations
    5. Combines search results with context
    6. Generates response using Groq AI with all available information
    7. Saves session to disk
    8. Returns response and session_id
    
    IMPORTANT: This uses the SAME chat session as /chat endpoint.
    - You can use the same session_id for both endpoints
    - This allows seamless switching between general and realtime modes
    - Conversation history is shared between both modes
    - Example: Ask a general question, then ask a realtime question, then another general question
      - All in the same conversation context
    
    SESSION MANAGEMENT:
    - Same as /chat endpoint - sessions are shared
    - If session_id is NOT provided: Server generates a new UUID
    - If session_id IS provided: Server uses it (loads from disk if exists)
    
    REQUEST BODY:
    {
        "message": "What's the latest AI news?",
    Realtime chat without streaming — POST text, returns JSON response.
    
    This endpoint uses the realtime mode (with Tavily web search) but
    returns the entire response as a single JSON object.
    
    If 'tts' is True in the request, it will also generate high-quality
    Ryan audio (Base64 MP3) using edge-tts before returning.
    """
    if not chat_service or not realtime_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    _MAX_MSG_LEN = 32_000
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(request.message) > _MAX_MSG_LEN:
        raise HTTPException(status_code=400, detail=f"Message too long ({len(request.message)} chars). Maximum is {_MAX_MSG_LEN}.")

    logger.info("[API /chat/realtime] Incoming | session_id=%s | message_len=%d | message=%.100s",
                request.session_id or "new", len(request.message), request.message)
    try:
        session_id = await chat_service.get_or_create_session(request.session_id)
        # process_realtime_message: Tavily search -> RAG context -> Groq LLM -> text
        response_text = chat_service.process_realtime_message(session_id, request.message, api_key=getattr(request, 'api_key', None), provider=getattr(request, 'provider', None), model=getattr(request, 'model', None), user_id=request.userId, memory_context=request.memory_context or "", fallback_groq_key=getattr(request, 'fallback_groq_key', None), api_keys_dict=getattr(request, 'api_keys', None))
        chat_service.save_chat_session(session_id)

        # GENERATE RYAN AUDIO IF REQUESTED
        audio_b64 = None
        if request.tts:
            try:
                # Use Ryan (en-GB-RyanNeural) specifically
                # Use personality-based voice selection unless a specific voice_id is passed
                voice = request.voice_id if request.voice_id else language_service.get_voice_for_text(response_text, gender=request.gender, default_voice=TTS_VOICE)
                
                # Map tone to rate
                rate = TTS_RATE
                if request.tone == "energetic":
                    rate = "+15%"
                elif request.tone == "soft":
                    rate = "-10%"
                    
                audio_bytes = await asyncio.to_thread(_generate_tts_sync, response_text, voice, rate)
                audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
            except Exception as e:
                logger.error(f"[API /chat/realtime] TTS generation error: {e}")

        logger.info("[API /chat/realtime] Done | session_id=%s | response_len=%d", session_id[:12], len(response_text))
        return ChatResponse(response=response_text, session_id=session_id, audio=audio_b64)
    except ValueError as e:
        logger.warning("[API /chat/realtime] Invalid session_id: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except AllGroqApisFailedError as e:
        logger.error("[API /chat/realtime] All Groq APIs failed: %s", e)
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        if _is_rate_limit_error(e):
            logger.warning("[API /chat/realtime] Rate limit hit: %s", e)
            raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)
        logger.error("[API /chat/realtime] Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing chat: {str(e)}")


@app.post("/chat/realtime/stream", dependencies=[Depends(_require_api_key)])
async def chat_realtime_stream(request: ChatRequest):
    """
    Realtime chat with streaming — SSE stream with optional inline TTS.

    Combines realtime (Tavily web search) with streaming output.  This is
    the most feature-rich endpoint: the user gets real-time web data,
    token-by-token text streaming, AND optional inline TTS audio — all in
    a single SSE connection.

    Same session as /chat and /chat/realtime.
    Returns chunks as SSE. Saves to JSON every 5 chunks.
    """
    if not chat_service or not realtime_service:
        raise HTTPException(status_code=503, detail="Service not initialized")
    _MAX_MSG_LEN = 32_000
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(request.message) > _MAX_MSG_LEN:
        raise HTTPException(status_code=400, detail=f"Message too long ({len(request.message)} chars). Maximum is {_MAX_MSG_LEN}.")
    logger.info("[API /chat/realtime/stream] Incoming | session_id=%s | message_len=%d | message=%.100s",
                request.session_id or "new", len(request.message), request.message)
    try:
        session_id = await chat_service.get_or_create_session(request.session_id)
        chunk_iter = chat_service.process_realtime_message_stream(session_id, request.message, api_key=getattr(request, 'api_key', None), provider=getattr(request, 'provider', None), model=getattr(request, 'model', None), user_id=request.userId, memory_context=request.memory_context or "", fallback_groq_key=getattr(request, 'fallback_groq_key', None), api_keys_dict=getattr(request, 'api_keys', None))
        # Detect language of user message to set the context
        user_lang = language_service.detect_language(request.message)

        return StreamingResponse(
            _stream_generator(session_id, chunk_iter, is_realtime=True, tts_enabled=request.tts, initial_language=user_lang, gender=request.gender, tone=request.tone, voice_id=request.voice_id),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AllGroqApisFailedError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail=RATE_LIMIT_MESSAGE)
        logger.error("[API /chat/realtime/stream] Error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/action", dependencies=[Depends(_require_api_key)])
async def perform_action(request: Request, action_req: ActionRequest):
    """
    Perform a system action (open URL, open app, etc.)
    """
    if not system_service:
        raise HTTPException(status_code=503, detail="System service not initialized")
    
    success = False
    if action_req.type == "OPEN_URL":
        success = system_service.open_url(action_req.value)
    elif action_req.type == "OPEN_APP":
        success = system_service.open_app(action_req.value)
    elif action_req.type == "SEARCH":
        success = system_service.search_system(action_req.value)
    elif action_req.type in ("CREATE_REMINDER", "SAVE_MEMORY"):
        import requests
        auth_header = request.headers.get("authorization")
        headers = {"Content-Type": "application/json"}
        if auth_header:
            headers["Authorization"] = auth_header
        
        try:
            # Forward action to Node.js backend
            resp = requests.post("http://localhost:5001/api/ai/action", json={"type": action_req.type, "value": action_req.value}, headers=headers, timeout=5)
            success = resp.status_code == 200
        except Exception as e:
            logger.error(f"[SYSTEM] Error forwarding action to Node.js: {e}")
            success = False
    
    return {"success": success}


# =============================================================================
# STANDALONE TOOL ENDPOINTS (FOR THIRD-PARTY / NODE.JS GATEWAY)
# =============================================================================

@app.get("/tools/search", dependencies=[Depends(_require_api_key)])
async def standalone_search(query: str):
    """
    Standalone search endpoint for external services (e.g. Node.js backend).
    Returns formatted search results from Tavily.
    """
    if not realtime_service:
        raise HTTPException(status_code=503, detail="Realtime service not initialized")
    
    try:
        formatted, payload = realtime_service.search_tavily(query)
        return {"formatted": formatted, "payload": payload}
    except Exception as e:
        logger.error(f"[TOOLS] Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tools/memory", dependencies=[Depends(_require_api_key)])
async def standalone_memory_search(query: str, k: int = 5):
    """
    Standalone memory search endpoint for external services.
    Returns the k most relevant chunks from the FAISS vector store.
    """
    if not vector_store_service:
        raise HTTPException(status_code=503, detail="Vector store service not initialized")
    
    try:
        retriever = vector_store_service.get_retriever(k=k)
        docs = retriever.invoke(query)
        # Combine chunks into a single list of strings
        results = [doc.page_content for doc in docs]
        return {"results": results}
    except Exception as e:
        logger.error(f"[TOOLS] Memory search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/system/reload", dependencies=[Depends(_require_api_key)])
async def reload_system():
    """
    Reload the vector store and rebuild the index.
    Call this after new .txt files are added to the learning_data directory.
    """
    if not vector_store_service:
        raise HTTPException(status_code=503, detail="Vector store service not initialized")
    
    try:
        logger.info("[SYSTEM] Manual reload triggered - rebuilding vector store...")
        await vector_store_service.create_vector_store()
        return {"success": True, "message": "Vector store rebuilt successfully"}
    except Exception as e:
        logger.error(f"[SYSTEM] Reload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CHAT HISTORY ENDPOINT
# =============================================================================

@app.get("/chat/history/{session_id}", dependencies=[Depends(_require_api_key)])
async def get_chat_history(session_id: str):
    """
    Get chat history for a specific session.
    
    This endpoint retrieves all messages from a chat session, including both
    general and realtime messages since they share the same session.
    
    HOW IT WORKS:
    1. Receives session_id as URL parameter
    2. Retrieves all messages from that session
    3. Returns messages in chronological order
    
    RESPONSE:
    {
        "session_id": "session-id",
        "messages": [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Good day. How may I assist you?"},
            ...
        ]
    }
    
    NOTE: If session doesn't exist, returns empty messages array.
    """
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not initialized")
    
    try:
        # Step 1: Ensure session is loaded (from memory or disk).
        # This handles loading historical conversations that weren't in memory.
        await chat_service.get_or_create_session(session_id)
        
        # Link session to itself as the userId for sync if not already known
        if session_id not in chat_service.session_user_map:
            chat_service.session_user_map[session_id] = session_id
            
        # Returns in-memory messages for this session (now populated if it existed on disk).
        messages = chat_service.get_chat_history(session_id)
        return {
            "session_id": session_id,
            # Convert internal Message objects to plain dicts for JSON serialisation.
            "messages": [{"role": msg.role, "content": msg.content} for msg in messages]
        }
    except Exception as e:
        logger.error(f"Error retrieving history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")


@app.delete("/chat/history/{session_id}", dependencies=[Depends(_require_api_key)])
async def delete_chat_session(session_id: str):
    """
    Clear a specific chat session from memory.
    """
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not initialized")
    
    found = chat_service.clear_session(session_id)
    return {"success": found, "message": f"Session {session_id} cleared" if found else "Session not found"}

@app.delete("/chat/user/{user_id}/history", dependencies=[Depends(_require_api_key)])
async def delete_all_user_history(user_id: str):
    """
    Clear all chat sessions for a specific user from memory.
    """
    if not chat_service:
        raise HTTPException(status_code=503, detail="Chat service not initialized")
    
    count = chat_service.clear_user_sessions(user_id)
    return {"success": True, "count": count, "message": f"Cleared {count} sessions for user {user_id}"}


# ============================================================================
# TEXT-TO-SPEECH (STANDALONE ENDPOINT)
# ============================================================================
# This is the standalone TTS endpoint — separate from the inline TTS above.
# The inline TTS is embedded in the SSE stream; this endpoint takes arbitrary
# text and returns a pure MP3 audio stream.  Useful if the frontend wants to
# re-speak a previous message or speak text that didn't come from the LLM.

@app.post("/tts", dependencies=[Depends(_require_api_key)])
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using edge-tts and stream back MP3 audio.

    The response is a StreamingResponse with media_type="audio/mpeg".
    The browser (or any HTTP client) receives a continuous MP3 byte stream
    that can be played as it downloads — no need to wait for the full file.

    edge_tts.Communicate streams audio in small chunks; we yield each chunk
    as it arrives, so the client starts hearing audio almost immediately.

    Request body:  { "text": "Hello, how are you?" }
    Response:      raw MP3 audio bytes (Content-Type: audio/mpeg)
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    async def generate():
        """Async generator that yields MP3 audio chunks from edge_tts."""
        try:
            # Detect language and pick a matching voice if specific ID not provided
            voice = request.voice_id if request.voice_id else language_service.get_voice_for_text(text, gender=request.gender, default_voice=TTS_VOICE)
            
            # Map tone to rate
            rate = TTS_RATE
            if request.tone == "energetic":
                rate = "+15%"
            elif request.tone == "soft":
                rate = "-10%"
                
            communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except Exception as e:
            logger.error("[TTS] Error generating speech: %s", e)

    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache"},
    )


# =============================================================================
# FRONTEND STATIC FILE SERVING
# =============================================================================
# The frontend (HTML/CSS/JS) lives in the `frontend/` directory at the project
# root (one level up from app/).  We mount it under the /app URL prefix so
# that API routes (/, /health, /chat, …) don't collide with frontend routes.
#
# Architecture:
#   http://localhost:8000/           → 302 redirect to /app/
#   http://localhost:8000/app/       → serves frontend/index.html
#   http://localhost:8000/app/style.css → serves frontend/style.css
#   http://localhost:8000/chat       → API endpoint (JSON)
#
# This lets us run BOTH the API and the frontend on a single port (8000),
# which simplifies deployment — no separate web server needed.
#
# The `html=True` flag tells StaticFiles to serve index.html for directory
# requests (e.g. /app/ serves frontend/index.html).

_frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/app", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")


@app.get("/")
async def root_redirect():
    """
    Redirect the bare root URL to the frontend app.

    When a user opens http://localhost:8000/ in their browser, they probably
    want the UI — not a JSON API response.  This 302 redirect sends them
    to /app/ where the frontend is served.
    """
    return RedirectResponse(url="/app/", status_code=302)


# =============================================================================
# STANDALONE RUN (python -m app.main)
# =============================================================================
# This section allows running the server directly with `python -m app.main`
# instead of the usual `python run.py`.  It calls uvicorn programmatically
# with the same settings.

def run():
    """
    Start the uvicorn ASGI server.

    This is equivalent to running:
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level info

    - host="0.0.0.0" — listen on all network interfaces (not just localhost),
      so other devices on your LAN can access the server.
    - port=8000 — the HTTP port.
    - reload=True — auto-restart when Python files change (dev convenience).
    - log_level="info" — show request logs in the terminal.
    """
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )


# Python convention: this block runs only when the file is executed directly
# (python app/main.py), not when it's imported as a module.
if __name__ == "__main__":
    run()
