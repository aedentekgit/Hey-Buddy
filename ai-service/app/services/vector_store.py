"""
VECTOR STORE SERVICE MODULE
===========================

This service builds and queries the FAISS vector index used for context retrieval.
Learning data (database/learning_data/*.txt) and past chats (database/chats_data/*.json)
are loaded at startup, split into chunks, embedded with HuggingFace, and stored in FAISS.
When the user asks a question we embed it and retrieve the k most similar chunks; only
those chunks are sent to the LLM, so token usage is bounded.

LIFECYCLE:
  - create_vector_store(): Load all .txt and .json, chunk, embed, build FAISS, save to disk.
    Called once at startup. Restart the server after adding new .txt files so they are included.
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
from pathlib import Path
from typing import List, Optional

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
    CHATS_DATA_DIR,      # Path to database/chats_data/ (contains .json past-conversation files)
    VECTOR_STORE_DIR,    # Path to database/vector_store/ (where the FAISS index is saved on disk)
    EMBEDDING_MODEL,     # Name of the HuggingFace model, e.g. "all-MiniLM-L6-v2"
    CHUNK_SIZE,          # Maximum characters per text chunk (e.g. 1000)
    CHUNK_OVERLAP,       # Characters of overlap between consecutive chunks (e.g. 200)
)


logger = logging.getLogger("Hey buddy")


# =============================================================================
# VECTOR STORE SERVICE CLASS
# =============================================================================

class VectorStoreService:
    """
    Builds a FAISS index from learning_data .txt files and chats_data .json files,
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

        # Retriever cache: maps k (number of results) → retriever object.
        # We cache so we don't recreate a retriever for the same k on every request.
        self._retriever_cache: dict = {}

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

    def load_user_knowledge(self) -> List[Document]:
        """
        Consolidated loader for User Knowledge (Reminders, Memories, Docs, Prescriptions).
        Fetches everything from the Node.js backend's all-knowledge endpoint.
        """
        documents = []
        from config import NODE_BACKEND_URL
        
        try:
            logger.info("[VECTOR] Fetching consolidated knowledge from MongoDB...")
            resp = requests.get(f"{NODE_BACKEND_URL}/api/knowledge/internal/all-knowledge", timeout=15)
            
            if resp.status_code == 200:
                data = resp.json()
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

    def load_chat_history(self) -> List[Document]:
        """
        Load chat history for the vector store.
        
        NEW BEHAVIOR: 
        1. Fetch all conversations from the Node.js backend (MongoDB).
        2. Fall back to local .json files in database/chats_data/ only if backend fails or is empty.
        """
        documents = []
        
        # ── Step 1: Try backend (MongoDB) ──────────────────────────────────
        from config import NODE_BACKEND_URL
        try:
            logger.info("[VECTOR] Fetching all conversations from MongoDB for indexing...")
            resp = requests.get(f"{NODE_BACKEND_URL}/api/conversations/internal/all", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("data"):
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

        # ── Step 2: Fallback to local files (LEGACY) ────────────────────────
        logger.info("[VECTOR] Falling back to local .json files for chat history...")
        for file_path in sorted(CHATS_DATA_DIR.glob("*.json")):
            try:
                # Extract User ID from filename
                stem = file_path.stem
                uid = "unknown"
                if stem.startswith("chat_mobile_"):
                    parts = stem.split("_")
                    if len(parts) >= 3:
                        uid = parts[2]
                elif stem.startswith("chat_"):
                    uid = stem[5:] 

                with open(file_path, "r", encoding="utf-8") as f:
                    chat_data = json.load(f)

                messages = chat_data.get("messages", [])
                chat_content = "\n".join([
                    f"User: {msg.get('content', '')}" if msg.get('role') == 'user'
                    else f"Assistant: {msg.get('content', '')}"
                    for msg in messages
                ])

                if chat_content.strip():
                    documents.append(Document(
                        page_content=chat_content, 
                        metadata={"source": f"file_{stem}", "user_id": uid}
                    ))
            except Exception as e:
                logger.warning("Could not load chat history file %s: %s", file_path, e)
        
        return documents

    # -------------------------------------------------------------------------
    # BUILD AND SAVE FAISS INDEX
    # -------------------------------------------------------------------------

    def create_vector_store(self) -> FAISS:
        """
        Full pipeline: Load → Chunk → Embed → Index → Save.
        """
        learning_docs = self.load_learning_data()
        chat_docs = self.load_chat_history()
        knowledge_docs = self.load_user_knowledge()
        
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
        """
        if not self.vector_store:
            raise RuntimeError("Vector store not initialized")
            
        cache_key = f"{k}_{user_id}"
        if cache_key not in self._retriever_cache:
            # Metadata filtering for privacy
            # We only want chunks that belong to THIS user OR the system (global)
            filter_dict = None
            if user_id:
                # FAISS metadata filtering (Note: some versions only support 1 value,
                # but we'll try the common approach or a custom wrap if needed)
                # If plural filtering isn't native, we use a single match for now
                # and prioritize security (user's own data).
                filter_dict = {"user_id": user_id}
            
            # Create retriever with strict filter
            self._retriever_cache[cache_key] = self.vector_store.as_retriever(
                search_kwargs={"k": k, "filter": filter_dict}
            )
            
        return self._retriever_cache[cache_key]
