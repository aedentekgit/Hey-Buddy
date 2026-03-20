"""
CONFIGURATION MODULE
====================
PURPOSE:
  Central place for all Hey buddy settings: API keys, paths, model names,
  and the Hey buddy system prompt. Designed for single-user use: each person runs
  their own copy of this backend with their own .env and database/ folder.
WHAT THIS FILE DOES:
  - Loads environment variables from .env (so API keys stay out of code).
  - Defines paths to database/learning_data, database/chats_data, database/vector_store.
  - Creates those directories if they don't exist (so the app can run immediately).
  - Exposes GROQ_API_KEY, GROQ_MODEL, TAVILY_API_KEY for the LLM and search.
  - Defines chunk size/overlap for the vector store, max chat history turns, and max message length.
  - Holds the full system prompt that defines Hey buddy's personality and formatting rules.
USAGE:
  Import what you need: `from config import GROQ_API_KEY, CHATS_DATA_DIR, BUDDY_SYSTEM_PROMPT`
  All services import from here so behaviour is consistent.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# LOGGING
# -----------------------------------------------------------------------------
# Used when we need to log warnings (e.g. failed to load a learning data file)
logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# ENVIRONMENT
# -----------------------------------------------------------------------------
# Load environment variables from .env file (if it exists).
# This keeps API keys and secrets out of the code and version control.
load_dotenv()


# -----------------------------------------------------------------------------
# BASE PATH
# -----------------------------------------------------------------------------
# Points to the folder containing this file (the project root).
# All other paths (database, learning_data, etc.) are built from this.
BASE_DIR = Path(__file__).parent

# ============================================================================
# DATABASE PATHS
# ============================================================================
# These directories store different types of data:
# - learning_data: Text files with information about the user (personal data, preferences, etc.)
# - vector_store: FAISS index files for fast similarity search

LEARNING_DATA_DIR = BASE_DIR / "database" / "learning_data"
VECTOR_STORE_DIR = BASE_DIR / "database" / "vector_store"

# Create directories if they don't exist so the app can run without manual setup.
LEARNING_DATA_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================================
# GROQ API CONFIGURATION
# ============================================================================
# Groq is the LLM provider we use for generating responses.
# You can set one key (GROQ_API_KEY) or multiple keys for fallback:
#   GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, ... (no upper limit).
# PRIMARY-FIRST: Every request tries the first key first. If it fails (rate limit,
# timeout, etc.), the server tries the second, then third, until one succeeds.
# If all keys fail, the user receives a clear error message.
# Model determines which AI model to use (llama-3.3-70b-versatile is latest).

def _load_groq_api_keys() -> list:
    """
    Load all GROQ API keys from the environment.
    Reads GROQ_API_KEY first, then GROQ_API_KEY_2, GROQ_API_KEY_3, ... until
    a number has no value. There is no upper limit on how many keys you can set.
    Returns a list of non-empty key strings (may be empty if GROQ_API_KEY is not set).
    """
    keys = []
    # First key: GROQ_API_KEY (required in practice; validated when building services).
    first = os.getenv("GROQ_API_KEY", "").strip()
    if first:
        keys.append(first)
    # Additional keys: GROQ_API_KEY_2, GROQ_API_KEY_3, GROQ_API_KEY_4, ...
    i = 2
    while True:
        k = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
        if not k:
            # No key for this number; stop (no more keys).
            break
        keys.append(k)
        i += 1
    return keys


GROQ_API_KEYS = _load_groq_api_keys()
# Backward compatibility: single key name still used in docs; code uses GROQ_API_KEYS.
GROQ_API_KEY = GROQ_API_KEYS[0] if GROQ_API_KEYS else "" # The primary Groq model to use if no dynamic preference is provided
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ============================================================================
# TAVILY API CONFIGURATION
# ============================================================================
# Tavily is a fast, AI-optimized search API designed for LLM applications
# Get API key from: https://tavily.com (free tier available)
# Tavily returns English-only results by default and is faster than DuckDuckGo

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

# ============================================================================
# TTS (TEXT-TO-SPEECH) CONFIGURATION
# ============================================================================
# edge-tts uses Microsoft Edge's free cloud TTS. No API key needed.
# Voice list: run `edge-tts --list-voices` to see all available voices.
# Default: en-GB-RyanNeural (male British voice, fitting for Hey buddy).
# Override via TTS_VOICE in .env (e.g. TTS_VOICE=en-US-ChristopherNeural).

TTS_VOICE = os.getenv("TTS_VOICE", "en-GB-RyanNeural")
TTS_RATE = os.getenv("TTS_RATE", "+22%")

# ============================================================================
# EMBEDDING CONFIGURATION
# ============================================================================
# Embeddings convert text into numerical vectors that capture meaning
# We use HuggingFace's sentence-transformers model (runs locally, no API needed)
# CHUNK_SIZE: How many characters to split documents into
# CHUNK_OVERLAP: How many characters overlap between chunks (helps maintain context)

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CHUNK_SIZE = 1000  # Characters per chunk
CHUNK_OVERLAP = 200  # Overlap between chunks

# Maximum conversation turns (user+assistant pairs) sent to the LLM per request.
# Older turns are kept on disk but not sent to avoid context/token limits.
MAX_CHAT_HISTORY_TURNS = 20

# Maximum length (characters) for a single user message. Prevents token limit errors
# and abuse. ~32K chars ≈ ~8K tokens; keeps total prompt well under model limits.
# ============================================================================
# API KEYS (MULTI-PROVIDER)
# ============================================================================
# We use Groq as primary, but Gemini and OpenAI as fallbacks if Groq is not set.

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


# ============================================================================
# NODE.js BACKEND INTEGRATION
# ============================================================================
# The URL of the Node.js backend for actions and tool execution.
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5001")

# ============================================================================
# SECURITY CONFIGURATION
# ============================================================================
# BUDDY_API_KEY: Shared secret that clients must send as X-API-Key header.
#   Generate with: python -c "import secrets; print(secrets.token_hex(32))"
#   If not set, all /chat endpoints are publicly accessible (dev mode only).
BUDDY_API_KEY = os.getenv("BUDDY_API_KEY", "")

# BUDDY_INTERNAL_SECRET: Bearer token used by action_tools.py when calling the
#   Node.js backend. Must match the value expected by the Node server.
#   Generate with: python -c "import secrets; print(secrets.token_hex(32))"
BUDDY_INTERNAL_SECRET = os.getenv("BUDDY_INTERNAL_SECRET", "")

# ALLOWED_ORIGINS: Comma-separated list of origins allowed by CORS.
#   Example: https://ayuskart.com,https://www.ayuskart.com
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000")


# ============================================================================
# Hey buddy PERSONALITY CONFIGURATION
# ============================================================================
# System prompt that defines the assistant as a complete AI assistant.
# Designed for speed (short replies) and reliability.

ASSISTANT_NAME = (os.getenv("ASSISTANT_NAME", "").strip() or "Hey buddy")

_BUDDY_SYSTEM_PROMPT_BASE = """You are {assistant_name}, a sharp and warm AI assistant. You help with information, tasks, and actions (Open apps/urls, save memories, manage reminders).

=== KNOWLEDGE & SOURCE OF TRUTH ===
- "Current User Date" is your ONLY source for today. 
- When explicitly asked about reminders or a schedule WITHOUT a specific date, ONLY reply with reminders for "today". (If none exist, say "You have no reminders for today.")
- CRITICAL: Do NOT proactively announce reminders, events, or memories if the user simply greets you (e.g. "hi"). Only mention them if the user specifically asks.
- Do NOT list other dates unless explicitly asked.

=== ABILITIES ===
- Use standard [[ACTION:TYPE:VALUE]] tags for system commands.
- Use `schedule_reminder` for time-based reminders.
- Use `schedule_location_reminder` for reminders tied to a place (e.g. "at Chennai", "when I visit home"). You do NOT need a specific date/time for these; you can leave them blank if not provided.
- Use `save_memory` ONLY for facts, preferences, or bio info. NEVER use `save_memory` for things the user needs to DO or be reminded of.
- Answer accurately and concisely. No vague filler or robotic disclaimers.

=== CONSTRAINTS ===
- REPLIES MUST BE SHORT (1-2 sentences) by default. Only elaborate if the user asks for more or it's a complex task.
- Use numbered lists (1. 2. 3.) or plain text. No Markdown (*, #, emojis). No special symbols.

=== LANGUAGES ===
- Reply in the SAME language the user used. Switch if they switch.
"""

# Build final system prompt: assistant name and optional user title from ENV (no hardcoded names).
_BUDDY_SYSTEM_PROMPT_BASE_FMT = _BUDDY_SYSTEM_PROMPT_BASE.format(assistant_name=ASSISTANT_NAME)
BUDDY_SYSTEM_PROMPT = _BUDDY_SYSTEM_PROMPT_BASE_FMT




GENERAL_CHAT_ADDENDUM = """
You are a highly intelligent, general-purpose AI assistant. 
Your primary directive is to immediately answer any question using YOUR OWN VAST GENERAL KNOWLEDGE.
Some user notes or history may be provided above, but YOU MUST NEVER restrict yourself to only that context.
If the notes/context do not contain the answer, IGNORE THE CONTEXT COMPLETELY and seamlessly answer the user's question from your own knowledge. 
NEVER say "it is not in the context", "I cannot find it in the provided text", or anything similar. 
Answer confidently, accurately, and strictly keep your replies to 1-2 sentences unless specifically asked for details.
"""

REALTIME_CHAT_ADDENDUM = """
You are in REALTIME mode. Live web search results have been provided above in your context.

USE THE SEARCH RESULTS:
- The results above are fresh data from the internet. Use them as your primary source. Extract specific facts, names, numbers, URLs, dates. Be specific, not vague.
- If an AI-SYNTHESIZED ANSWER is included, use it and add details from individual sources.
- Never mention that you searched or that you are in realtime mode. Answer as if you know the information.
- If results do not have the exact answer, say what you found and what was missing. Do not refuse.

LENGTH: Keep replies short by default. 1-2 sentences for simple questions. Only give longer answers when the user asks for detail or the question clearly demands it (e.g. "explain in detail", "compare X and Y"). Do not pad with intros or wrap-ups.
"""


def load_user_context() -> str:
    """
    Load and concatenate the contents of all .txt files in learning_data.
    Reads every .txt file in database/learning_data/, joins their contents with
    double newlines, and returns one string. Used by code that needs the raw
    learning text (e.g. optional utilities). The main chat flow does NOT send
    this full text to the LLM; it uses the vector store to retrieve only
    relevant chunks, so token usage stays bounded.
    Returns:
        str: Combined content from all .txt files, or "" if none exist or all fail to read.
    """
    context_parts = []

    # Sorted by path so the order is always the same across runs.
    text_files = sorted(LEARNING_DATA_DIR.glob("*.txt"))

    for file_path in text_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    context_parts.append(content)
        except Exception as e:
            logger.warning("Could not load learning data file %s: %s", file_path, e)

    # Join all file contents with double newline; empty string if no files or all failed.
    return "\n\n".join(context_parts) if context_parts else ""