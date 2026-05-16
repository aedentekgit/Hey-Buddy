# Python AI Service — Buddy

Handles RAG-based knowledge retrieval, text-to-speech (ElevenLabs), and action execution for the Buddy platform.

---

## Quick Start

```bash
cd python
pip install -r requirements.txt
python run.py
```

Runs on `http://localhost:8000` by default.

---

## Configuration (`python/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `BUDDY_API_KEY` | Yes | Secret shared with Node.js backend for internal auth |
| `NODE_BACKEND_URL` | Yes | URL of the Node.js API server (default: `http://localhost:5001`) |
| `GOOGLE_API_KEY` | Yes | Gemini API key for AI inference |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key for TTS |
| `ELEVENLABS_VOICE_ID` | No | Default voice ID (default: `21m00Tcm4TlvDq8ikWAM`) |

---

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/system/reload` | Reload vector store (called by Node.js after reminder changes) |
| `POST` | `/chat/voice` | Voice/RAG chat endpoint |
| `POST` | `/audio/speak` | TTS via ElevenLabs |

---

## Architecture

- `app/main.py` — FastAPI app with all route handlers
- `app/services/` — Business logic (RAG, TTS, action tools)
- `app/utils/` — Shared utilities

Action tools callback to the Node.js backend at `NODE_BACKEND_URL` using the `BUDDY_API_KEY` header.

---

## Internal Auth

All requests from Node.js must include the `X-API-Key` header with the `BUDDY_API_KEY` value.