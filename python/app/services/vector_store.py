"""
VECTOR STORE SERVICE MODULE
===========================

This service builds and queries the FAISS vector index used for context retrieval.
Learning data (database/learning_data/*.txt) and past chats (restored from MongoDB)
are loaded at startup, split into chunks, embedded with HuggingFace, and stored in FAISS.
When the user asks a question we embed it and retrieve the k most similar chunks; only
those chunks are sent to the LLM, so token usage is bounded.

LIFECYCLE:
  - create_vector_store(): Load all .txt (from disk) and chat history (from DB), chunk, embed, build FAISS, save index to disk.
    Called once at startup. Restart the server after adding new .txt files or many new conversations.
    - get_retriever(k): Return a retriever that fetches k nearest chunks for a query string.
  - save_vector_store(): Write the current FAISS index to database/vector_store/ (called after create).

Embeddings run locally (sentence-transformers); no extra API key. Groq and Realtime services
call get_retriever() for every request to get context.

─────────────────────────────────────────────────────────────────────────────
WHAT IS A VECTOR STORE AND WHY DO WE NEED ONE?
─────────────────────────────────────────────────────────────────────────────
Large Language Models (LLMs) like Groq-hosted Llama have a limited context window
(the maximum number of tokens they can read at once). We can't paste our entire
knowledge base into every prompt — it would exceed the limit and waste money/time.

A **vector store** solves this with *semantic search*:
  1. Offline: convert every chunk of text into a numeric vector (embedding) that
     captures its *meaning*, then store all vectors in an index.
  2. At query time: convert the user's question into a vector, then find the
     chunks whose vectors are closest (most similar in meaning) to the question.
  3. Send only those top-k chunks to the LLM as context. This is called
     **Retrieval-Augmented Generation (RAG)**.

Result: the LLM gets relevant context without seeing the entire database.

─────────────────────────────────────────────────────────────────────────────
HOW FAISS WORKS (HIGH LEVEL)
─────────────────────────────────────────────────────────────────────────────
FAISS (Facebook AI Similarity Search) is a library optimized for finding the
nearest neighbors of a vector in a large collection:
  - It stores all chunk embeddings in an efficient in-memory index.
  - When given a query vector, it computes distances (e.g. L2 or cosine) to
    every stored vector and returns the top-k closest matches.
  - For small-to-medium datasets (<100k vectors) a flat (brute-force) index is
    used; for larger datasets FAISS supports approximate methods (IVF, HNSW).
  - The index can be saved to disk and loaded back, so we only rebuild when data changes.

─────────────────────────────────────────────────────────────────────────────
HOW HUGGINGFACE EMBEDDINGS WORK
─────────────────────────────────────────────────────────────────────────────
HuggingFaceEmbeddings uses a pre-trained transformer model (e.g. all-MiniLM-L6-v2)
to convert a piece of text into a fixed-size numeric vector (e.g. 384 dimensions).
  - Texts with similar *meaning* get vectors that are close together in the
    384-dimensional space, even if the exact words differ.
  - Example: "How is the weather?" and "What's the temperature outside?" would
    have very similar vectors because they mean nearly the same thing.
  - The model runs **locally on CPU** — no API key or internet needed after the
    first download of the model weights.
"""

import json
import logging
import requests
import asyncio
from pathlib import Path
from typing import List, Optional
from functools import lru_cache
from collections import OrderedDict
import aiohttp

# ─── LangChain components ───────────────────────────────────────────────────
# RecursiveCharacterTextSplitter: breaks long documents into smaller overlapping chunks.
# HuggingFaceEmbeddings:          wraps a sentence-transformers model to produce vectors.
# FAISS:                          LangChain wrapper around Facebook's FAISS library.
# Document:                       simple container holding page_content (str) + metadata (dict).
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

from config import (
    LEARNING_DATA_DIR,   # Path to database/learning_data/ (contains .txt knowledge files)
    VECTOR_STORE_DIR,    # Path to database/vector_store/ (where the FAISS index is saved on disk)
    EMBEDDING_MODEL,     # Name of the HuggingFace model, e.g. "all-MiniLM-L6-v2"
    CHUNK_SIZE,          # Maximum characters per text chunk (e.g. 1000)
    CHUNK_OVERLAP,       # Characters of overlap between consecutive chunks (e.g. 200)
    BUDDY_INTERNAL_SECRET, # Internal secret for service-to-service auth
)


logger = logging.getLogger("Hey buddy")


# =============================================================================
# VECTOR STORE SERVICE CLASS
# =============================================================================

class VectorStoreService:
    """
    Builds a FAISS index from learning_data .txt files and MongoDB-sourced chats,
    and provides a retriever to fetch the k most relevant chunks for a query.

    TYPICAL USAGE (inside app startup):
        vs = VectorStoreService()
        vs.create_vector_store()          # load data → chunk → embed → index → save
        retriever = vs.get_retriever(k=5) # later, per-request, fetch top-5 chunks

    WHY A CLASS?
    Encapsulating the embeddings model, text splitter, FAISS index, and retriever
    cache in one object makes it easy to pass around and to mock in tests.
    """

    def __init__(self):
        """
        Create the embedding model (local) and text splitter; vector_store is set
        later in create_vector_store().

        Nothing is loaded from disk yet — this just prepares the tools we'll need.
        """
        # ── Embedding model ─────────────────────────────────────────────────
        # HuggingFaceEmbeddings downloads the model on first run, then caches it.
        # model_kwargs={"device": "cpu"} forces CPU inference.  If you have a GPU
        # and want faster embedding, change to "cuda".
        # The embedding model converts text → vector (e.g. 384-dimensional float array).
        self.embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
        )

        # ── Text splitter ───────────────────────────────────────────────────
        # Documents can be thousands of characters long, but embeddings work best
        # on short passages.  The splitter breaks long text into chunks of at most
        # `chunk_size` characters, with `chunk_overlap` characters shared between
        # consecutive chunks.
        #
        # WHY OVERLAP?
        # If a relevant sentence falls right at the boundary between two chunks,
        # overlap ensures it appears in *both* chunks, so the retriever can still
        # find it regardless of which chunk it searches.
        #
        # "Recursive" means it tries to split on paragraph breaks first, then
        # sentences, then words — preserving natural boundaries when possible.
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )

        # The FAISS index itself — None until create_vector_store() is called.
        self.vector_store: Optional[FAISS] = None

        # Retriever cache: LRU cache with max 20 entries to prevent unbounded growth.
        # Maps (k, user_id) → retriever object.
        # Bounds memory usage: with ~100KB per retriever, 20 entries = ~2MB max.
        # LRU eviction prevents cache bloat when many user_ids query different k values.
        self._retriever_cache_max_size = 20
        self._retriever_cache: OrderedDict = OrderedDict()  # Manual LRU implementation

        # Shared aiohttp session with connection pooling for HTTP requests.
        # Reusing a session across requests multiplexes connections and reduces
        # overhead compared to creating new sessions per request.
        # TCPConnector settings: limit=100 (max concurrent connections),
        # limit_per_host=10 (max per domain to avoid overwhelming servers).
        self._http_session: Optional[aiohttp.ClientSession] = None

    # -------------------------------------------------------------------------
    # LOAD DOCUMENTS FROM DISK
    # -------------------------------------------------------------------------

    def load_learning_data(self) -> List[Document]:
        """
        Read all .txt files in database/learning_data/ and return one Document per file.
        Tag with user_id="system" for global availability.
        """
        documents = []
        for file_path in sorted(LEARNING_DATA_DIR.glob("*.txt")):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        # Tag as "system" so it's globally searchable
                        documents.append(Document(
                            page_content=content, 
                            metadata={"source": str(file_path.name), "user_id": "system"}
                        ))
                        logger.info("[VECTOR] Loaded learning data: %s", file_path.name)
            except Exception as e:
                logger.warning("Could not load learning data file %s: %s", file_path, e)
        return documents

    async def _get_http_session(self) -> aiohttp.ClientSession:
        """
        Lazy-create and reuse a shared HTTP session with connection pooling.
        This avoids creating a new session (and new connections) for each request.
        """
        if self._http_session is None or self._http_session.closed:
            connector = aiohttp.TCPConnector(
                limit=100,  # Max concurrent connections
                limit_per_host=10,  # Max per domain to avoid overwhelming servers
                ttl_dns_cache=300  # Cache DNS lookups for 5 minutes
            )
            self._http_session = aiohttp.ClientSession(connector=connector)
        return self._http_session

    async def _fetch_async(self, url: str, timeout: int = 15) -> Optional[dict]:
        """
        Helper: async HTTP GET with timeout and error handling.
        Uses a shared session with connection pooling for efficiency.
        Returns parsed JSON or None if request fails.
        """
        try:
            session = await self._get_http_session()
            headers = {"Authorization": f"Bearer {BUDDY_INTERNAL_SECRET}"} if BUDDY_INTERNAL_SECRET else {}
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    logger.warning("[VECTOR] HTTP GET failed: status=%d, url=%s", resp.status, url)
                    return None
        except asyncio.TimeoutError:
            logger.warning("[VECTOR] HTTP GET timeout after %ds: %s", timeout, url)
            return None
        except Exception as e:
            logger.warning("[VECTOR] HTTP GET error: %s", e)
            return None

    async def load_user_knowledge(self) -> List[Document]:
        """
        Consolidated loader for User Knowledge (Reminders, Memories, Docs, Prescriptions).
        Fetches everything from the Node.js backend's all-knowledge endpoint.
        Uses async/await to prevent blocking the event loop.
        """
        documents = []
        from config import NODE_BACKEND_URL

        try:
            logger.info("[VECTOR] Fetching consolidated knowledge from MongoDB...")
            data = await self._fetch_async(f"{NODE_BACKEND_URL}/api/knowledge/internal/all-knowledge", timeout=15)

            if data is None:
                return documents
            if data.get("success") and data.get("data"):
                knowledge = data["data"]

                # 1. Process Memories
                for mem in knowledge.get("memories", []):
                    uid = mem.get("userId", "unknown")
                    content = mem.get("content", "")
                    if content.strip():
                        documents.append(Document(
                            page_content=f"Memory: {content} (Category: {mem.get('category', 'general')})",
                            metadata={"source": f"memory_{mem.get('_id')}", "user_id": uid, "type": "memory"}
                        ))

                # 2. Process Reminders
                for rem in knowledge.get("reminders", []):
                    uid = rem.get("userId", "unknown")
                    title = rem.get("title", "")
                    desc = rem.get("description", "") or rem.get("notes", "")
                    reminder_text = f"Reminder: {title}\nDetails: {desc}\nDate: {rem.get('date')}\nTime: {rem.get('time')}\nLocation: {rem.get('location', 'N/A')}\nStatus: {rem.get('status')}"

                    if title.strip():
                        documents.append(Document(
                            page_content=reminder_text,
                            metadata={"source": f"reminder_{rem.get('_id')}", "user_id": uid, "type": "reminder"}
                        ))

                # 3. Process Documents (PDF/Image extractions)
                for doc in knowledge.get("documents", []):
                    uid = doc.get("userId", "unknown")
                    content = doc.get("content", "")
                    if content.strip():
                        documents.append(Document(
                            page_content=f"Document ({doc.get('fileName')}): {content}",
                            metadata={"source": f"doc_{doc.get('_id')}", "user_id": uid, "type": "document"}
                        ))

                # 4. Process Prescriptions
                for pres in knowledge.get("prescriptions", []):
                    uid = pres.get("userId", "unknown")
                    summary = pres.get("summary", "")
                    ext_data = pres.get("extractedData", {})
                    pres_text = f"Prescription Summary: {summary}\nExtracted Meds: {json.dumps(ext_data.get('medicines', []))}"

                    if summary.strip():
                        documents.append(Document(
                            page_content=pres_text,
                            metadata={"source": f"prescription_{pres.get('_id')}", "user_id": uid, "type": "prescription"}
                        ))

                logger.info("[VECTOR] Loaded %d items from backend knowledge pools", len(documents))
        except Exception as e:
            logger.warning("[VECTOR] Knowledge fetch failed: %s", e)

        return documents

    async def load_chat_history(self) -> List[Document]:
        """
        Load chat history for the vector store.

        NEW BEHAVIOR:
        1. Fetch all conversations from the Node.js backend (MongoDB) using async.
        2. Fall back to local .json files in database/chats_data/ only if backend fails or is empty.
        """
        documents = []

        # ── Step 1: Try backend (MongoDB) via async HTTP ─────────────────
        from config import NODE_BACKEND_URL
        try:
            logger.info("[VECTOR] Fetching all conversations from MongoDB for indexing...")
            data = await self._fetch_async(f"{NODE_BACKEND_URL}/api/conversations/internal/all", timeout=10)

            if data and data.get("success") and data.get("data"):
                conversations = data["data"]
                for conv in conversations:
                    uid = conv.get("userId", "unknown")
                    messages = conv.get("messages", [])

                    # Concatenate all messages in this conversation.
                    chat_content = "\n".join([
                        f"User: {msg.get('content', '')}" if msg.get('role') == 'user'
                        else f"Assistant: {msg.get('content', '')}"
                        for msg in messages
                    ])

                    if chat_content.strip():
                        documents.append(Document(
                            page_content=chat_content,
                            metadata={"source": f"db_{conv.get('_id')}", "user_id": uid}
                        ))

                if documents:
                    logger.info("[VECTOR] Successfully indexed %d conversations from MongoDB", len(documents))
                    # If we successfully loaded from DB, we can return now.
                    return documents
        except Exception as e:
            logger.warning("[VECTOR] Failed to fetch chat history from MongoDB: %s", e)

        return documents

    # -------------------------------------------------------------------------
    # BUILD AND SAVE FAISS INDEX
    # -------------------------------------------------------------------------

    async def create_vector_store(self) -> FAISS:
        """
        Full pipeline: Load → Chunk → Embed → Index → Save.
        """
        learning_docs = self.load_learning_data()
        chat_docs = await self.load_chat_history()
        knowledge_docs = await self.load_user_knowledge()
        
        all_documents = learning_docs + chat_docs + knowledge_docs
        
        if not all_documents:
            # Create a placeholder with "system" user_id
            self.vector_store = FAISS.from_texts(
                ["No data available yet."], 
                self.embeddings, 
                metadatas=[{"user_id": "system", "source": "placeholder"}]
            )
            logger.info("[VECTOR] Created placeholder index")
        else:
            chunks = self.text_splitter.split_documents(all_documents)
            self.vector_store = FAISS.from_documents(chunks, self.embeddings)
            logger.info("[VECTOR] Built multi-tenant index with %d chunks", len(chunks))

        self._retriever_cache.clear()
        self.save_vector_store()
        return self.vector_store

    def save_vector_store(self):
        """Write the index to disk."""
        if self.vector_store:
            try:
                self.vector_store.save_local(str(VECTOR_STORE_DIR))
            except Exception as e:
                logger.error("Failed to save vector store: %s", e)

    # -------------------------------------------------------------------------
    # PRIVACY-AWARE RETRIEVER
    # -------------------------------------------------------------------------

    def get_retriever(self, k: int = 10, user_id: str = None):
        """
        Return a retriever that strictly filters by user_id and 'system'.
        Uses LRU cache with max 20 entries to prevent unbounded memory growth.
        """
        if not self.vector_store:
            raise RuntimeError("Vector store not initialized")

        cache_key = (k, user_id)  # Use tuple instead of string for efficiency

        # LRU cache implementation: if key exists, move to end (most recent)
        if cache_key in self._retriever_cache:
            # Mark as accessed by moving to end (LRU pattern)
            self._retriever_cache.move_to_end(cache_key)
            return self._retriever_cache[cache_key]

        # Cache miss: create new retriever
        # Metadata filtering for privacy & shared knowledge
        # We want chunks that belong to THIS user OR the system (global knowledge)
        def _multi_tenant_filter(metadata):
            # Always allow system documents (learning data)
            # Also allow documents belonging to this specific user
            allowed_ids = ["system", "global"]
            if user_id:
                allowed_ids.append(str(user_id))

            doc_uid = str(metadata.get("user_id", "unknown"))
            return doc_uid in allowed_ids

        # Create retriever with multi-tenant filter
        retriever = self.vector_store.as_retriever(
            search_kwargs={"k": k, "filter": _multi_tenant_filter}
        )

        # Add to cache; evict oldest if at max capacity
        self._retriever_cache[cache_key] = retriever
        if len(self._retriever_cache) > self._retriever_cache_max_size:
            # Remove oldest (first) item
            self._retriever_cache.popitem(last=False)
            logger.debug("[VECTOR] Evicted oldest retriever from LRU cache (size capped at %d)",
                        self._retriever_cache_max_size)

        return retriever
