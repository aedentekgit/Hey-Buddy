"""
GROQ SERVICE MODULE
===================

This module handles general chat: no web search, only the Groq LLM plus context
from the vector store (learning data + past chats). Used by ChatService for
POST /chat.

ARCHITECTURE OVERVIEW:
  GroqService is the core LLM interface for Hey buddy. It does three things:
    1. RETRIEVE: Ask the vector store for relevant context chunks.
    2. BUILD: Assemble the full system prompt (personality + time + context + addendum).
    3. CALL: Send the prompt + history + question to Groq and return the response.

  This class is also the parent of RealtimeGroqService, which adds web search.
  The inheritance design means realtime can reuse _build_prompt_and_messages,
  _invoke_llm, and _stream_llm — it only overrides get_response/stream_response
  to inject search results.

MULTIPLE API KEYS (primary-first with fallback):
  - You can set multiple Groq API keys in .env: GROQ_API_KEY, GROQ_API_KEY_2,
    GROQ_API_KEY_3, ... (no limit).
  - PRIMARY-FIRST: Every request tries the first API key first. If it fails
    (rate limit 429, timeout, network error, etc.), we immediately try the
    second key, then the third, until one succeeds.
  - Each key gets 1 retry for transient failures before falling back to the next.
  - If ALL keys fail, we raise AllGroqApisFailedError with a user-friendly message.
  - All API key usage is logged with masked keys for security and debugging.

  WHY PRIMARY-FIRST (not round-robin):
    Round-robin distributes load evenly, but for a single-user app, we want to
    maximize usage of the primary key (best quota) and only touch backup keys
    when the primary is rate-limited. This keeps billing predictable and avoids
    unnecessary key rotation.

  HOW THE FALLBACK LOOP WORKS (visual):
    Request arrives
      ├─ Try Key #1 (primary) ─── success? → return response
      │                           failure? ↓
      ├─ Try Key #2 (backup)  ─── success? → return response
      │                           failure? ↓
      ├─ Try Key #3 (backup)  ─── success? → return response
      │                           failure? ↓
      └─ All keys exhausted → raise AllGroqApisFailedError

FLOW:
  1. get_response(question, chat_history) is called.
  2. We ask the vector store for the top-k chunks most similar to the question (retrieval).
  3. We build a system message: BUDDY_SYSTEM_PROMPT + current time + retrieved context.
  4. We send to Groq using the first key; on failure, try second, third, etc.
  5. We return the assistant's reply, or raise AllGroqApisFailedError if all fail.

Context is only what we retrieve (not a full dump of learning data), so token usage stays bounded.
"""

from typing import List, Optional, Iterator, Any
# ─── LANGCHAIN IMPORTS ───────────────────────────────────────────────────────
# LangChain is a framework that provides abstractions for working with LLMs.
# Instead of making raw HTTP requests to the Groq API, we use LangChain's
# wrappers which handle serialization, retries, and response parsing.
#
# ChatGroq: LangChain's wrapper around the Groq API. It handles HTTP calls,
#   retries, and response parsing so we don't have to use raw requests.
#   Each ChatGroq instance is bound to one API key.
#
# ChatPromptTemplate: Builds the full prompt from a system message, history
#   placeholder, and the human question. LangChain compiles this into the
#   exact message format the Groq API expects (an array of role-tagged messages).
#   Think of it as a "template" with slots for dynamic content.
#
# MessagesPlaceholder: A slot in the template where we inject the chat history
#   (a list of HumanMessage/AIMessage objects). At render time, LangChain
#   expands this into the correct sequence of role-tagged messages. Without
#   this, we'd have to manually format the history into the message array.
#
# HumanMessage / AIMessage: LangChain's typed message objects. We convert our
#   (user_text, assistant_text) tuples into these for the history placeholder.
#   HumanMessage becomes {"role": "user", "content": "..."} in the API call,
#   and AIMessage becomes {"role": "assistant", "content": "..."}.
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

import logging
import time

from config import GROQ_API_KEYS, GROQ_API_KEY, GROQ_MODEL, BUDDY_SYSTEM_PROMPT, GENERAL_CHAT_ADDENDUM, GEMINI_API_KEY, OPENAI_API_KEY
from app.services.vector_store import VectorStoreService
from app.utils.time_info import get_time_information
from app.utils.retry import with_retry

logger = logging.getLogger("Hey buddy")

# ─── CONSTANTS ───────────────────────────────────────────────────────────────
# Request timeout: if the Groq API doesn't respond within 60 seconds, we
# consider the request failed and move on (either retry or fallback to next key).
# This prevents the server from hanging indefinitely on a stuck connection.
# 60 seconds is generous — Groq typically responds in 1-5 seconds. The high
# timeout accounts for rare cases where the API is under heavy load.
GROQ_REQUEST_TIMEOUT = 60

# User-friendly message when all API keys fail. This is shown to the end user,
# so it avoids technical jargon and suggests trying again later.
# It's defined as a constant so both _invoke_llm and _stream_llm use the same text.
ALL_APIS_FAILED_MESSAGE = (
    "I'm unable to process your request at the moment. All API services are "
    "temporarily unavailable. Please try again in a few minutes."
)


class AllGroqApisFailedError(Exception):
    """
    Raised when every configured Groq API key has been tried and all failed.

    This is a custom exception so the API layer can catch it specifically and
    return a 503 Service Unavailable response (rather than a generic 500).
    The error message (ALL_APIS_FAILED_MESSAGE) is user-friendly and safe to
    display directly.

    USAGE IN THE API LAYER:
      try:
          response = groq_service.get_response(question, history)
      except AllGroqApisFailedError as e:
          return JSONResponse(status_code=503, content={"detail": str(e)})
    """
    pass


# =============================================================================
# HELPER: ESCAPE CURLY BRACES FOR LANGCHAIN
# =============================================================================
# LangChain prompt templates use {variable_name} for string interpolation.
# For example, {question} gets replaced with the actual question text.
#
# PROBLEM: If the learning data or chat history contains literal { or } characters
# (very common in code snippets, JSON data, math notation, etc.), LangChain's
# template engine will try to interpret them as variables and throw a KeyError.
#
# EXAMPLE OF THE PROBLEM:
#   Context contains: "def foo() { return 1; }"
#   LangChain sees {, tries to find a variable named " return 1; }", crashes.
#
# SOLUTION: Double every { and } → {{ and }}. In Python's string formatting
# (which LangChain uses internally), {{ renders as a literal { in the output.
# We apply this to ALL user-provided content before injecting it into templates.
#
# This is similar to SQL parameterization — we sanitize user input before
# injecting it into a template to prevent "injection" errors.

def escape_curly_braces(text: str) -> str:
    """
    Double every { and } so LangChain does not treat them as template variables.

    Examples:
      "def foo() { return 1; }"  →  "def foo() {{ return 1; }}"
      "{name}"                    →  "{{name}}"
      "no braces here"            →  "no braces here" (unchanged)

    This is critical for safety: without it, any user message containing
    curly braces could crash the LLM chain with a template formatting error.
    """
    if not text:
        return text
    return text.replace("{", "{{").replace("}", "}}")


def _is_rate_limit_error(exc: BaseException) -> bool:
    """
    Check if an exception indicates a Groq rate limit (HTTP 429 or quota exceeded).

    We use string matching because Groq's SDK may raise different exception types
    for rate limits vs quota limits. Checking the error message is the most
    reliable way to detect all variants.

    COMMON RATE LIMIT INDICATORS IN GROQ ERROR MESSAGES:
      - "429" — HTTP status code for Too Many Requests.
      - "rate limit" — explicit rate limit message.
      - "tokens per day" — daily quota exceeded.

    Used for LOGGING ONLY — the actual fallback logic tries the next key on ANY
    failure, not just rate limits. This means even unexpected errors (network
    timeouts, 500s) trigger a fallback, making the system more resilient.
    """
    msg = str(exc).lower()
    return "429" in str(exc) or "rate limit" in msg or "tokens per day" in msg


def _log_timing(label: str, elapsed: float, extra: str = ""):
    """
    Log timing in consistent format for performance monitoring.

    All timing logs use the [TIMING] prefix so they can be easily filtered
    with grep: `grep "[TIMING]" buddy.log` shows all performance data.
    """
    msg = f"[TIMING] {label}: {elapsed:.3f}s"
    if extra:
        msg += f" ({extra})"
    logger.info(msg)


def _mask_api_key(key: str) -> str:
    """
    Mask an API key for safe logging: show first 8 and last 4 characters only.

    WHY: API keys must never appear in plain text in logs (security risk). But
    we need to distinguish WHICH key was used for debugging multi-key setups.
    Showing the prefix and suffix is enough to identify the key without exposing it.

    Example: "gsk_abc123xyz789def456" → "gsk_abc1...f456"

    EDGE CASE: Keys shorter than 12 characters are fully masked to "***masked***"
    because there isn't enough entropy to safely show partial content.
    """
    if not key or len(key) <= 12:
        return "***masked***"
    return f"{key[:8]}...{key[-4:]}"


# =============================================================================
# GROQ SERVICE CLASS
# =============================================================================

class GroqService:
    """
    General chat service: retrieves context from the vector store and calls the Groq LLM.

    MULTI-KEY FALLBACK STRATEGY (PRIMARY-FIRST):
      Unlike round-robin (which cycles through keys evenly), primary-first always
      starts with key #1. This is intentional:
        - Key #1 is the "main" key with the best quota/tier.
        - Keys #2, #3, etc. are backups for when #1 is rate-limited.
        - If key #1 works, we never touch the others (saves their quota).
        - If key #1 fails, we try #2 immediately (no delay between keys).
        - Each key gets 1 retry (via with_retry) for transient errors before
          we give up on it and move to the next.
        - If ALL keys fail, we raise AllGroqApisFailedError.

    INHERITANCE:
      RealtimeGroqService extends this class. It inherits:
        - __init__ (creates LLM clients + stores vector store)
        - _invoke_llm / _stream_llm (multi-key fallback)
        - _build_prompt_and_messages (system prompt assembly)
      And overrides:
        - get_response / stream_response (to add web search results)

    WHY LANGCHAIN (not raw HTTP):
      LangChain provides:
        - Automatic message formatting (system/human/assistant roles).
        - The prompt template system (with variable substitution).
        - The "|" pipe operator for chaining (prompt | llm).
        - Streaming support via .stream() method.
      Without LangChain, we'd need ~100 lines of boilerplate for HTTP calls,
      message formatting, and stream parsing.
    """

    # Map deprecated/experimental/non-available model names to their stable replacements
    _MODEL_ALIASES = {
        'gemini-2.0-flash-exp': 'gemini-1.5-flash',  # Fallback to stable if experimental is tricky
        'gemini-2.0-flash': 'gemini-1.5-flash',      # Redirect unavailable 2.0 to stable 1.5
        'gemini-flash-1.5-8b': 'gemini-1.5-flash-8b',
        'gemini-pro-latest': 'gemini-1.5-pro',
        'gemini-flash': 'gemini-1.5-flash',
    }

    def __init__(self, vector_store_service: VectorStoreService, api_key: str = None, model: str = None, provider: str = None, fallback_groq_key: str = None, api_keys_dict: dict = None):
        self.llms = []

        # If passed dynamically, initialize that provider specifically
        if api_key and provider:
            # Sanitize model name: strip ":free"/":latest" suffixes and map deprecated names
            if model and ":" in model:
                model = model.split(":")[0]
            if model and model in self._MODEL_ALIASES:
                logger.info(f"[GroqService] Mapping deprecated model '{model}' -> '{self._MODEL_ALIASES[model]}'")
                model = self._MODEL_ALIASES[model]
                
            if provider.lower() in ('gemini', 'google'):
                self.llms.append(ChatGoogleGenerativeAI(
                    model=model or "gemini-1.5-flash-latest",
                    google_api_key=api_key,
                    temperature=0.6,
                    timeout=GROQ_REQUEST_TIMEOUT,
                ))
            elif provider.lower() == 'openai':
                self.llms.append(ChatOpenAI(
                    model=model or "gpt-4o-mini",
                    openai_api_key=api_key,
                    temperature=0.6,
                    request_timeout=GROQ_REQUEST_TIMEOUT,
                ))
            elif provider.lower() == 'deepseek':
                self.llms.append(ChatOpenAI(
                    model=model or "deepseek-chat",
                    openai_api_key=api_key,
                    base_url="https://api.deepseek.com/v1",
                    temperature=0.6,
                    request_timeout=GROQ_REQUEST_TIMEOUT,
                ))
            elif provider.lower() == 'anthropic':
                if api_key and api_key.startswith('sk-ant-'):
                    self.llms.append(ChatAnthropic(
                        model=model or "claude-3-5-sonnet-latest",
                        anthropic_api_key=api_key,
                        temperature=0.6,
                        timeout=GROQ_REQUEST_TIMEOUT
                    ))
                else:
                    logger.warning("Anthropic/Claude requested but API key is invalid. Will rely on other configured fallbacks.")
            else:
                 # Default to Groq
                 if api_key and 'gsk_' in str(api_key):
                     self.llms.append(ChatGroq(
                        groq_api_key=api_key,
                        model_name=model or GROQ_MODEL,
                        temperature=0.6,
                        request_timeout=GROQ_REQUEST_TIMEOUT,
                     ))

        # Add fallback Groq key passed from Node.js backend (from DB settings)
        if fallback_groq_key and fallback_groq_key.startswith('gsk_'):
            if not any(getattr(llm, 'groq_api_key', None) == fallback_groq_key for llm in self.llms):
                self.llms.append(ChatGroq(
                    groq_api_key=fallback_groq_key,
                    model_name=GROQ_MODEL,
                    temperature=0.6,
                    request_timeout=GROQ_REQUEST_TIMEOUT,
                ))
                logger.info("[GroqService] Added fallback Groq LLM from Node.js backend config")

        # ── OMNI-FALLBACK: Inject all database keys ──
        if api_keys_dict:
            # 1. Fallback Groq
            if api_keys_dict.get('groq') and 'gsk_' in str(api_keys_dict['groq']):
                if not any(getattr(llm, 'groq_api_key', None) == api_keys_dict['groq'] for llm in self.llms):
                    self.llms.append(ChatGroq(groq_api_key=api_keys_dict['groq'], model_name=GROQ_MODEL, temperature=0.6, request_timeout=GROQ_REQUEST_TIMEOUT))
            # 2. Fallback Claude
            if api_keys_dict.get('claude') and 'sk-ant-' in str(api_keys_dict['claude']):
                if not any(isinstance(llm, ChatAnthropic) and getattr(llm, 'anthropic_api_key', None) == api_keys_dict['claude'] for llm in self.llms):
                    self.llms.append(ChatAnthropic(model="claude-3-5-sonnet-latest", anthropic_api_key=api_keys_dict['claude'], temperature=0.6, timeout=GROQ_REQUEST_TIMEOUT))
            # 3. Fallback OpenAI
            if api_keys_dict.get('openai') and 'sk-' in str(api_keys_dict['openai']) and 'ant-' not in str(api_keys_dict['openai']):
                if not any(isinstance(llm, ChatOpenAI) and getattr(llm, 'openai_api_key', None) == api_keys_dict['openai'] and not hasattr(llm, 'base_url') for llm in self.llms):
                    self.llms.append(ChatOpenAI(model="gpt-4o-mini", openai_api_key=api_keys_dict['openai'], temperature=0.6, request_timeout=GROQ_REQUEST_TIMEOUT))
            # 4. Fallback Gemini
            if api_keys_dict.get('gemini') and 'AIza' in str(api_keys_dict['gemini']):
                if not any(isinstance(llm, ChatGoogleGenerativeAI) and getattr(llm, 'google_api_key', None) == api_keys_dict['gemini'] for llm in self.llms):
                    self.llms.append(ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=api_keys_dict['gemini'], temperature=0.6, timeout=GROQ_REQUEST_TIMEOUT))
            # 5. Fallback DeepSeek
            if api_keys_dict.get('deepseek') and 'sk-' in str(api_keys_dict['deepseek']):
                if not any(isinstance(llm, ChatOpenAI) and getattr(llm, 'openai_api_key', None) == api_keys_dict['deepseek'] and hasattr(llm, 'base_url') for llm in self.llms):
                    self.llms.append(ChatOpenAI(model="deepseek-chat", openai_api_key=api_keys_dict['deepseek'], base_url="https://api.deepseek.com/v1", temperature=0.6, request_timeout=GROQ_REQUEST_TIMEOUT))
            logger.info("[GroqService] Processed Database Omni-Fallback keys")

        # Always add system fallbacks (from .env) as secondary options to ensure reliability
        if GROQ_API_KEYS:
            for key in GROQ_API_KEYS:
                # Avoid duplicates if the dynamic key is the same as one of the system keys
                if any(getattr(llm, 'groq_api_key', None) == key for llm in self.llms):
                    continue
                self.llms.append(ChatGroq(
                    groq_api_key=key,
                    model_name=GROQ_MODEL,
                    temperature=0.6,
                    request_timeout=GROQ_REQUEST_TIMEOUT,
                ))
        
        if GEMINI_API_KEY:
            # Avoid duplicate Gemini entries
            if not any(isinstance(llm, ChatGoogleGenerativeAI) and getattr(llm, 'google_api_key', None) == GEMINI_API_KEY for llm in self.llms):
                self.llms.append(ChatGoogleGenerativeAI(
                    model="gemini-1.5-pro",
                    google_api_key=GEMINI_API_KEY,
                    temperature=0.6,
                    timeout=GROQ_REQUEST_TIMEOUT,
                ))

        if OPENAI_API_KEY:
            # Avoid duplicate OpenAI entries
            if not any(isinstance(llm, ChatOpenAI) and getattr(llm, 'openai_api_key', None) == OPENAI_API_KEY for llm in self.llms):
                self.llms.append(ChatOpenAI(
                    model="gpt-4o-mini",
                    openai_api_key=OPENAI_API_KEY,
                    temperature=0.6,
                    request_timeout=GROQ_REQUEST_TIMEOUT,
                ))

        if not self.llms:
            logger.warning(
                "No AI providers (Groq, Gemini, or OpenAI) configured in .env. "
                "Service will rely on dynamic key injection via request payload."
            )

        self.vector_store_service = vector_store_service
        logger.info(f"Initialized GroqService with {len(self.llms)} total LLM endpoint(s)")

    # ─── LLM INVOCATION WITH MULTI-KEY FALLBACK ─────────────────────────────
    # These two methods (_invoke_llm and _stream_llm) implement the core
    # fallback logic. They are used by get_response/stream_response (and their
    # realtime overrides) to actually call the Groq API.
    #
    # The pattern is the same for both:
    #   for each key (starting from #1):
    #       try to call Groq with this key
    #       if success → return result
    #       if failure → log it, move to next key
    #   all keys failed → raise AllGroqApisFailedError
    #
    # BLOCKING vs STREAMING:
    #   _invoke_llm: Waits for the complete response before returning. Simpler,
    #     and supports with_retry (because the whole call is atomic).
    #   _stream_llm: Returns an iterator that yields chunks as they arrive.
    #     Does NOT use with_retry because you can't retry a partially consumed
    #     stream (some tokens were already sent to the client).

    def _invoke_llm(
        self,
        prompt: ChatPromptTemplate,
        messages: list,
        question: str,
        system_message: str,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Call the LLM (blocking) using PRIMARY-FIRST fallback across all API keys.

        DETAILED FLOW:
          1. Start with i=0 (first/primary API key).
          2. Build a LangChain chain: prompt | self.llms[i]
             This means: render the prompt template, then pass it to the LLM.
          3. Call chain.invoke() wrapped in with_retry(max_retries=2):
             - First attempt: call the API.
             - If it fails with a transient error: wait 0.5s, retry once.
             - If the retry also fails: give up on this key.
          4. If the call succeeds: return response.content (the text).
          5. If the call fails: log the error, increment i, go to step 2.
          6. If all keys exhausted: raise AllGroqApisFailedError.

        WHY max_retries=2:
          "2 attempts total" means 1 initial + 1 retry. This catches brief
          network blips without wasting too much time on a truly dead key.
          The delay (0.5s) is short because we'd rather try the next key quickly.

        THE PIPE OPERATOR (prompt | self.llms[i]):
          LangChain's "|" operator creates a "chain" — a pipeline where the
          output of one step feeds into the next. Here:
            1. `prompt` renders the template with the provided variables.
            2. The rendered messages are passed to `self.llms[i]` (the Groq client).
            3. The Groq client sends them to the API and returns the response.
          This is equivalent to: self.llms[i].invoke(prompt.format_messages(...))

        Args:
            prompt: The compiled LangChain prompt template (system + history + question).
            messages: List of HumanMessage/AIMessage objects for the history placeholder.
            question: The user's current question (fills {question} in the template).

        Returns:
            The LLM's response text (str).

        Raises:
            AllGroqApisFailedError: If every API key fails after retries.
        """
        n = len(self.llms)
        last_exc = None
        # Track which keys we tried (for the diagnostic log if all fail).
        from app.services.action_tools import get_action_tools
        from langchain_core.messages import ToolMessage
        tools = get_action_tools(user_id) if user_id else []
        tools_map = {t.name: t for t in tools}

        keys_tried = []
        for i in range(n):
            keys_tried.append(i)
            llm = self.llms[i]
            provider = type(llm).__name__
            logger.info(f"Trying LLM endpoint #{i + 1}/{n} ({provider})")
            
            llm_with_tools = llm.bind_tools(tools) if tools else llm

            def _call_llm(msgs):
                return llm_with_tools.invoke(msgs)

            try:
                current_msgs = prompt.format_messages(system_message=system_message, history=messages, question=question)
                # Loop to support multi-turn tool use (agent-like behavior).
                # We limit to 4 turns to prevent infinite loops if the model gets stuck.
                last_tool_calls_set = None
                for turn in range(4):
                    response = with_retry(
                        lambda: _call_llm(current_msgs),
                        max_retries=2,
                        initial_delay=0.5,
                    )
                    
                    if hasattr(response, "tool_calls") and response.tool_calls:
                        # Stuck-loop detection: if the model sends the exact same tool calls as last turn,
                        # it means the tool result didn't satisfy it or it's hallucinating. Break to avoid 4x repetition.
                        current_tool_calls_set = set([(tc['name'], str(tc['args'])) for tc in response.tool_calls])
                        if last_tool_calls_set == current_tool_calls_set:
                            logger.warning(f"Loop detected: duplicate tool calls in turn {turn}. Breaking.")
                            return response.content
                        last_tool_calls_set = current_tool_calls_set

                        current_msgs.append(response)
                        for tc in response.tool_calls:
                            logger.info(f"Tool call: {tc['name']}")
                            try:
                                result = tools_map[tc["name"]].invoke(tc["args"])
                            except Exception as e:
                                result = f"Error: {e}"
                            current_msgs.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))
                        
                        # Optimization: if we are going into turn 2+, remind the model not to repeat itself.
                        # This prevents the "Hey there... Hey there..." duplication seen in the UI.
                        current_msgs.append(HumanMessage(content="(System: Do not repeat your previous greeting or intro. Just provide the final answer or next action.)"))
                    else:
                        if i > 0:
                            logger.info(f"Fallback successful: endpoint #{i + 1}/{n} ({provider}) succeeded")
                        return self.get_text_content(response.content)
            except Exception as e:
                last_exc = e
                # Get a clean error message
                err_msg = str(e)
                if hasattr(e, "response") and hasattr(e.response, "text"):
                     try:
                         # Try to get detailed JSON error if available (e.g. from OpenAI/Groq)
                         err_detail = e.response.json()
                         err_msg = f"{err_msg} - {err_detail}"
                     except Exception as json_err:
                         logger.warning(f"Failed to parse JSON error response: {json_err}")
                         err_msg = f"{err_msg} - {e.response.text[:200]}"

                if _is_rate_limit_error(e):
                    logger.warning(f"Endpoint #{i + 1}/{n} ({provider}) rate limited: {err_msg[:200]}")
                else:
                    logger.warning(f"Endpoint #{i + 1}/{n} failed: {provider} - {err_msg[:400]}")

                if i < n - 1:
                    logger.info(f"Falling back to next provider...")
                    continue
                break

        # All keys failed — build a diagnostic log and raise.
        logger.error(f"All {n} AI provider(s) failed.")
        # Chain the original exception (from last_exc) for full traceback context.
        raise AllGroqApisFailedError(ALL_APIS_FAILED_MESSAGE) from last_exc

    def _stream_llm(
        self,
        prompt: ChatPromptTemplate,
        messages: list,
        question: str,
        system_message: str,
        user_id: Optional[str] = None,
    ) -> Iterator[str]:
        """
        Stream the LLM response token-by-token using PRIMARY-FIRST fallback.

        HOW STREAMING DIFFERS FROM BLOCKING:
          - chain.stream() returns an iterator of chunk objects instead of one response.
          - Each chunk may have a .content attribute (str) or be a dict with "content".
          - We extract the text from each chunk and yield it to the caller.
          - We only get ONE attempt per key (no with_retry) because you can't
            "retry" a partially consumed stream — the LLM has already generated
            some tokens. If the stream breaks mid-way, we fall back to the next key
            and start fresh (the caller sees a clean stream from the new key).

        WHY NO with_retry FOR STREAMING:
          In blocking mode, a failed call is atomic — nothing was sent to the client.
          In streaming mode, we may have already yielded some chunks to the caller
          (which forwarded them to the client via SSE). If we retried, the client
          would receive the beginning of the response twice. So instead, we fail
          over to the next key and start a completely fresh stream.

        TIMING INSTRUMENTATION:
          - first_chunk: Time from request start to first token received. This is
            the user-perceived latency (Time To First Token / TTFT). For Groq,
            this is typically 200-500ms.
          - groq_stream_total: Total time from start to last token. Includes all
            token generation time. For a medium response, this is typically 2-8s.

        CHUNK FORMAT:
          LangChain's streaming chunks can come in two formats depending on the
          provider and version:
            1. Object with .content attribute (most common): chunk.content = "Hello"
            2. Dict with "content" key: chunk["content"] = "Hello"
          We handle both formats for robustness.

        Args:
            prompt: The compiled LangChain prompt template.
            messages: Chat history as LangChain message objects.
            question: The user's current question.

        Yields:
            Text chunks (str) as they arrive from the LLM.

        Raises:
            AllGroqApisFailedError: If every API key fails.
        """
        n = len(self.llms)
        from app.services.action_tools import get_action_tools
        from langchain_core.messages import ToolMessage
        tools = get_action_tools(user_id) if user_id else []
        tools_map = {t.name: t for t in tools}

        last_exc = None
        for i in range(n):
            llm = self.llms[i]
            provider = type(llm).__name__
            logger.info(f"Streaming with endpoint #{i + 1}/{n} ({provider})")
            llm_with_tools = llm.bind_tools(tools) if tools else llm

            yielded_in_this_connection = False
            try:
                current_msgs = prompt.format_messages(system_message=system_message, history=messages, question=question)
                chunk_count = 0
                first_chunk_time = None
                stream_start = time.perf_counter()

                # Multi-turn streaming loop (Turn 1: Thinking/Tool, Turn 2: Answer, etc.)
                last_tool_calls_set = None
                for turn in range(4):
                    accumulated_chunk = None
                    # If this is turn 2+, the model might repeat its Turn 1 text in history.
                    # We track the Turn 1 text to avoid yielding it twice to the client.
                    turn_output = "" 
                    
                    for chunk in llm_with_tools.stream(current_msgs):
                        if accumulated_chunk is None:
                            accumulated_chunk = chunk
                        else:
                            accumulated_chunk += chunk

                        content = ""
                        if hasattr(chunk, "content"):
                            content = self.get_text_content(chunk.content)
                        elif isinstance(chunk, dict) and "content" in chunk:
                            content = self.get_text_content(chunk.get("content", ""))

                        if isinstance(content, str) and content:
                            if first_chunk_time is None:
                                first_chunk_time = time.perf_counter() - stream_start
                                _log_timing("first_chunk", first_chunk_time)
                            
                            # Only yield if it doesn't look like a direct repeat of the previous turns
                            # (Heuristic: if the turn output is still short, check if it's already in current_msgs)
                            turn_output += content
                            chunk_count += 1
                            yielded_in_this_connection = True
                            yield content

                    if hasattr(accumulated_chunk, "tool_calls") and accumulated_chunk.tool_calls:
                        # Stuck-loop detection
                        current_tool_calls_set = set([(tc['name'], str(tc['args'])) for tc in accumulated_chunk.tool_calls])
                        if last_tool_calls_set == current_tool_calls_set:
                            logger.warning(f"Stream Loop detected: duplicate tool calls in turn {turn}. Breaking.")
                            return
                        last_tool_calls_set = current_tool_calls_set

                        current_msgs.append(accumulated_chunk)
                        for tc in accumulated_chunk.tool_calls:
                            logger.info(f"Tool call streamed: {tc['name']}")
                            try:
                                result = tools_map[tc["name"]].invoke(tc["args"])
                            except Exception as e:
                                result = f"Error: {e}"
                            current_msgs.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))
                        
                        # Add a system nudge to stop the model from repeating its earlier content
                        current_msgs.append(HumanMessage(content="(System: Provide only the new information. Do not repeat your earlier greeting or intro.)"))
                    else:
                        total_stream = time.perf_counter() - stream_start
                        _log_timing("groq_stream_total", total_stream, f"chunks: {chunk_count}")
                        if i > 0 and chunk_count > 0:
                            logger.info(f"Fallback successful: endpoint #{i + 1}/{n} ({provider}) streamed")
                        return

            except Exception as e:
                last_exc = e
                # Get a clean error message
                err_msg = str(e)
                if hasattr(e, "response") and hasattr(e.response, "text"):
                     try:
                         # Try to get detailed JSON error if available (e.g. from OpenAI/Groq)
                         err_detail = e.response.json()
                         err_msg = f"{err_msg} - {err_detail}"
                     except Exception as json_err:
                         logger.warning(f"Failed to parse JSON error response: {json_err}")
                         err_msg = f"{err_msg} - {e.response.text[:200]}"

                # CRITICAL FIX: If we have already yielded content to the user, we CANNOT fallback
                # to a new key because that key would start the response from the beginning,
                # resulting in duplicated text in the UI.
                if yielded_in_this_connection:
                    logger.error(f"Stream failed mid-way on endpoint #{i + 1} ({provider}). "
                                  f"Yielded {chunk_count} chunks. Aborting fallback. Error: {err_msg[:400]}")
                    raise e

                if _is_rate_limit_error(e):
                    logger.warning(f"Endpoint #{i + 1}/{n} ({provider}) rate limited: {err_msg[:200]}")
                else:
                    logger.warning(f"Endpoint #{i + 1}/{n} failed: {provider} - {err_msg[:400]}")

                if i < n - 1:
                    logger.info("Falling back to next provider for stream...")
                    continue
                break

        logger.error("All AI providers (Primary + Fallbacks) failed to generate a response.")
        if last_exc:
             raise AllGroqApisFailedError(f"{ALL_APIS_FAILED_MESSAGE} (Last Error: {str(last_exc)})") from last_exc
        else:
             raise AllGroqApisFailedError(f"DEBUG - LLMs is ZERO. Dict state was empty.")


    # ─── PROMPT ASSEMBLY ─────────────────────────────────────────────────────
    # This method builds everything the LLM needs: system message, history, and
    # the prompt template. It's used by both get_response and stream_response,
    # and also by the realtime subclass (which passes extra_system_parts for
    # web search results).
    #
    # THE SYSTEM MESSAGE IS BUILT IN 5 LAYERS:
    #   Layer 1: Base personality (BUDDY_SYSTEM_PROMPT)
    #   Layer 2: Current time/date (so the LLM knows "today" and "this week")
    #   Layer 3: RAG context (vector store retrieval results)
    #   Layer 4: Extra parts (web search results, only in realtime mode)
    #   Layer 5: Mode addendum (role-specific instructions)
    #
    # Each layer is optional (except Layer 1) and is only added if content exists.

    def get_text_content(self, content: Any) -> str:
        """Helper to extract plain text from potentially multi-modal content."""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    text_parts.append(part["text"])
                elif isinstance(part, str):
                    text_parts.append(part)
            return " ".join(text_parts)
        return str(content)

    def _build_prompt_and_messages(
        self,
        question: Any,
        chat_history: Optional[List[tuple]] = None,
        extra_system_parts: Optional[List[str]] = None,
        mode_addendum: str = "",
        memory_context: str = "",
        user_id: Optional[str] = None
    ) -> tuple:
        """
        Retrieve context from the vector store and assemble the full LLM prompt.

        THIS IS WHERE THE MAGIC HAPPENS. The system message is built layer by layer:

        LAYER 1 — BASE PERSONALITY (BUDDY_SYSTEM_PROMPT):
          The core personality and instructions for Hey buddy. Defines tone, behavior,
          and capabilities. Loaded from config.py. This is the "soul" of Hey buddy —
          it tells the LLM who it is, how it should behave, and what it can/can't do.

        LAYER 2 — CURRENT TIME:
          "Current time and date: Saturday, February 21, 2026, 3:45 PM IST"
          This lets the LLM give time-aware answers ("today", "this week", etc.).
          Without this, the LLM has no idea what "today" means — it only knows
          its training data cutoff date.

        LAYER 3 — VECTOR STORE CONTEXT (RAG — Retrieval-Augmented Generation):
          We query the vector store for the k=10 most similar chunks to the user's
          question. These chunks come from:
            - Learning data files (PDFs, text files the user uploaded)
            - Past chat sessions (saved JSON files)
          The chunks are concatenated and injected into the system message as
          "Relevant context from your learning data and past conversations: ..."
          This is what makes Hey buddy personalized — it answers based on YOUR data.

          WHAT IS RAG?
            RAG stands for "Retrieval-Augmented Generation". Instead of relying
            solely on the LLM's training data, we RETRIEVE relevant documents
            first, then AUGMENT the prompt with them, so the LLM can GENERATE
            answers grounded in your actual data. This dramatically reduces
            hallucination and makes the LLM "know" things it was never trained on.

          WHY k=10: More chunks = more context for the LLM, but also more tokens
          (and cost). 10 is a good balance: enough to find relevant info, not so
          many that we flood the prompt with irrelevant content or hit token limits.

        LAYER 4 — EXTRA SYSTEM PARTS (optional):
          Used by RealtimeGroqService to inject Tavily web search results. The
          general chat path passes None here. This is the extension point that
          makes the inheritance design work — the subclass doesn't need to
          duplicate prompt assembly, it just passes extra content.

        LAYER 5 — MODE ADDENDUM:
          A role-specific instruction block. For general chat, it might say
          "Answer based on your knowledge and the provided context." For realtime
          chat, it says "Incorporate the web search results into your answer."
          This steers the LLM's behavior based on which mode is active.

        PROMPT TEMPLATE STRUCTURE:
          The final prompt template looks like:
            [system]  <everything above, concatenated>
            [history]  <MessagesPlaceholder — expands to HumanMessage/AIMessage pairs>
            [human]   {question}  <the current user question>

          This three-part structure (system → history → question) is the standard
          pattern for chat LLMs. The system message sets the rules, the history
          provides conversation context, and the human message is the current query.

        CHAT HISTORY CONVERSION:
          The chat_history comes in as [(user_text, ai_text), ...] tuples from
          ChatService.format_history_for_llm(). We convert each tuple into a
          HumanMessage + AIMessage pair for LangChain's MessagesPlaceholder.
          This conversion is necessary because LangChain expects its own message
          types, not plain tuples.

        Args:
            question: The user's current question.
            chat_history: List of (user_text, assistant_text) tuples.
            extra_system_parts: Optional strings to append (e.g. search results).
            mode_addendum: Role-specific instructions (general vs realtime).
            memory_context: High-priority memories from the main DB.
            user_id: The ID of the current user (for privacy-filtered RAG).

        Returns:
            (prompt, messages, system_message)
        """
        # ── Step 1: Retrieve context from the vector store (RAG) ──
        # This is the "R" in RAG. We search for document chunks that are
        # semantically similar to the user's question, FILTERED by user_id.
        context = ""
        context_sources = []
        t0 = time.perf_counter()
        try:
            # Pass user_id to ensure we only get chunks this user is allowed to see.
            retriever = self.vector_store_service.get_retriever(k=5, user_id=user_id)
            search_query = self.get_text_content(question)
            context_docs = retriever.invoke(search_query)
            if context_docs:
                # Concatenate all chunk texts. Each doc.page_content is a text chunk
                # from a learning file or past chat session. We join with newlines
                # so the LLM sees them as separate paragraphs.
                context = "\n".join([doc.page_content for doc in context_docs])
                # Track sources for logging (helps debug "where did that answer come from?").
                context_sources = [doc.metadata.get("source", "unknown") for doc in context_docs]
                logger.info("[CONTEXT] Retrieved %d chunks from sources: %s", len(context_docs), context_sources)
            else:
                logger.info("[CONTEXT] No relevant chunks found for query")
        except Exception as retrieval_err:
            # If the vector store is broken, we proceed with empty context.
            # The LLM can still answer from its training data — just without
            # personalized context. This is a graceful degradation pattern:
            # partial functionality is better than a complete failure.
            logger.warning("Vector store retrieval failed, using empty context: %s", retrieval_err)
        finally:
            _log_timing("vector_db", time.perf_counter() - t0)

        # ── Step 2: Build the system message layer by layer ──
        # Each layer is concatenated to form one large system message string.
        time_info = get_time_information()
        system_message = BUDDY_SYSTEM_PROMPT  # Layer 1: base personality

        system_message += f"\n\nCurrent time and date: {time_info}"  # Layer 2: time awareness

        if memory_context:
            logger.info("[MEMORY] Passing context to LLM: %d chars", len(memory_context))
            # Layer 2.5: High-priority explicit memories retrieved from the main database.
            # We put these above RAG context because they are exact facts the user told us.
            system_message += f"\n\n=== USER MEMORIES (AUTHORITATIVE) ===\n{escape_curly_braces(memory_context)}"

        if context:
            # Layer 3: RAG context (vector store retrieval results).
            system_message += f"\n\nUser Notes, Facts & Past History:\n{escape_curly_braces(context)}"

        if extra_system_parts:
            # Layer 4: additional content (e.g. web search results from realtime mode).
            # extra_system_parts is a list of strings; we escape each one.
            safe_parts = [escape_curly_braces(p) for p in extra_system_parts]
            system_message += "\n\n" + "\n\n".join(safe_parts)

        if mode_addendum:
            # Layer 5: mode-specific instructions (e.g. "use the search results").
            system_message += f"\n\n{mode_addendum}"

        # ── Step 2.5: Guest Access Restriction ──
        # If the user is unauthenticated (guest), they should not be able to 
        # inquire about personal data. We force the AI to ask for a login.
        # Handle various representations of "guest" or "null" from frontends.
        is_guest = (
            not user_id or 
            str(user_id).lower() in ["null", "none", "undefined", "unknown"] or 
            str(user_id).startswith("guest_")
        )

        logger.info(f"[AUTH] User ID: {user_id} | Is Guest: {is_guest}")

        if is_guest:
            system_message += (
                "\n\n=== GUEST SECURITY POLICY ===\n"
                "The current user is NOT logged in. They are a guest.\n"
                "1. If they ask for ANY EXISTING personal details, reminders, memories, "
                "addresses, phone numbers, or past private conversation history, "
                "you MUST refuse and reply exactly: 'Please login to check the details.'\n"
                "2. However, you ARE allowed to help them set NEW reminders, timers, or save NEW ephemeral memories for the current session. "
                "You can confirm the details of what you just created, but do not fetch older data.\n"
                "Do not try to find or provide older info even if you think you have it."
            )

        # ── Step 3: Build the LangChain prompt template ──
        # ChatPromptTemplate.from_messages() creates a template with three slots:
        #   1. ("system", ...) — the system message (rendered as-is, no variables inside
        #      because we already escaped curly braces in the context).
        #   2. MessagesPlaceholder("history") — expands to the chat history messages.
        #      At invoke time, LangChain replaces this with the actual messages list.
        #   3. ("human", "{question}") — the current user question. The {question}
        #      placeholder is filled by chain.invoke({"question": "..."}).
        prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_message}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ])

        # ── Step 4: Convert chat history tuples to LangChain message objects ──
        # ChatService gives us tuples: [("Hello", "Hi!"), ("How are you?", "I'm good")]
        # LangChain needs: [HumanMessage("Hello"), AIMessage("Hi!"), HumanMessage("How are you?"), AIMessage("I'm good")]
        messages = []
        if chat_history:
            for human_msg, ai_msg in chat_history:
                messages.append(HumanMessage(content=human_msg))
                messages.append(AIMessage(content=ai_msg))

        logger.info("[PROMPT] System message length: %d chars | History pairs: %d | User ID: %s | Is Guest: %s",
                     len(system_message), len(chat_history) if chat_history else 0, user_id, is_guest)
        # Now it expects system_message, history, question
        return prompt, messages, system_message

    # ─── PUBLIC API ──────────────────────────────────────────────────────────
    # These are the methods that ChatService calls. They orchestrate the full
    # flow: build prompt → call LLM → return result.
    #
    # RealtimeGroqService overrides these to add web search results before
    # calling the LLM. The base implementations here do NOT include web search.
    #
    # ERROR HANDLING STRATEGY:
    #   - AllGroqApisFailedError: re-raised as-is (the API layer handles it).
    #   - Any other exception: wrapped with context for easier debugging.
    #   This two-tier approach means the API layer can distinguish between
    #   "all keys failed" (503) and "something unexpected broke" (500).

    def get_response(
        self,
        question: str,
        chat_history: Optional[List[tuple]] = None,
        user_id: Optional[str] = None,
        memory_context: str = ""
    ) -> str:
        """
        Return the assistant's reply for a general chat question (no web search).

        FLOW:
          1. _build_prompt_and_messages: retrieve context + build system prompt.
          2. _invoke_llm: call Groq with primary-first key fallback.
          3. Return the response text.

        The GENERAL_CHAT_ADDENDUM is passed as mode_addendum — it contains
        instructions specific to general chat mode (e.g. "rely on your knowledge
        and the provided context, do not make up URLs").

        Error handling:
          - AllGroqApisFailedError: re-raised as-is (all keys exhausted).
          - Any other exception: wrapped with a descriptive message so the caller
            knows the error originated from the Groq service.
        """
        try:
            prompt, messages, system_message = self._build_prompt_and_messages(
                question, chat_history, 
                mode_addendum=GENERAL_CHAT_ADDENDUM,
                user_id=user_id,
                memory_context=memory_context
            )
            t0 = time.perf_counter()
            result = self._invoke_llm(prompt, messages, question, system_message, user_id=user_id)
            _log_timing("groq_api", time.perf_counter() - t0)
            logger.info("[RESPONSE] General chat | Length: %d chars | Preview: %.120s", len(result), result)
            return result
        except AllGroqApisFailedError:
            raise
        except Exception as e:
            raise Exception(f"Error getting response from Groq: {str(e)}") from e

    def stream_response(
        self,
        question: str,
        chat_history: Optional[List[tuple]] = None,
        user_id: Optional[str] = None,
        memory_context: str = ""
    ) -> Iterator[str]:
        """
        Stream the assistant's reply token-by-token for general chat (no web search).

        Same as get_response but uses _stream_llm instead of _invoke_llm.
        Returns a generator that yields text chunks as the LLM produces them.

        This is used by ChatService.process_message_stream to implement
        Server-Sent Events (SSE) for real-time typing effect in the UI.

        GENERATOR DELEGATION (yield from):
          `yield from self._stream_llm(...)` delegates the entire generator to
          _stream_llm. Every chunk that _stream_llm yields is automatically
          yielded by this method. This is cleaner than a manual for loop:
            for chunk in self._stream_llm(...):
                yield chunk
          Both are equivalent, but `yield from` is the Pythonic way.
        """
        try:
            prompt, messages, system_message = self._build_prompt_and_messages(
                question, chat_history, mode_addendum=GENERAL_CHAT_ADDENDUM,
                memory_context=memory_context,
                user_id=user_id
            )
            yield from self._stream_llm(prompt, messages, question, system_message, user_id=user_id)
        except AllGroqApisFailedError:
            raise
        except Exception as e:
            raise Exception(f"Error streaming response from Groq: {str(e)}") from e
