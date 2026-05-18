# Buddy AI — Project Overview

Multi-service AI assistant platform with a Node.js API server, Python AI processing service, React admin frontend, and Flutter mobile app.

---

## Architecture

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│   Flutter   │────▶│  Node.js API   │────▶│  MongoDB     │
│  Mobile App │     │  (Port 5001)   │     │              │
└─────────────┘     └───────┬────────┘     └──────────────┘
                            │
                     ┌──────▼────────┐
                     │  Python AI    │
                     │ (Port 8000)   │
                     │               │
                     │  • RAG        │
                     │  • Voice/TTS  │
                     │  • Actions    │
                     └───────────────┘
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Node.js API | 5001 | REST API, auth, reminders, socket.io |
| Python AI (Mark-XXXIX) | 5002 / 5003 | Real-time Voice (5002) & Remote Control (5003) |
| React Frontend | 5173 | Admin dashboard |

---

## Key Directories

| Path | Purpose |
|------|---------|
| `backend/` | Node.js Express API server |
| `backend/controllers/` | Route handlers (split into `reminders/` subdirectory) |
| `backend/services/` | Business logic (notificationService, emailService, smartReminderService, geminiService, etc.) |
| `backend/sockets/` | Socket.io handlers (voiceHandler.js, chatHandler.js) |
| `backend/middlewares/` | Auth, upload, rate-limiting |
| `backend/models/` | Mongoose models |
| `frontend/` | React + Vite admin dashboard |
| `frontend/src/pages/AdminSettings/` | Split Admin Settings (see below) |
| `python/` | Python AI Service (Mark-XXXIX Engine) |
| `Flutter/` | Flutter mobile app |

### AdminSettings Refactor

The monolithic `AdminSettings.jsx` (3687 lines) was split into:
- `frontend/src/pages/AdminSettings/index.jsx` — main router + state
- `frontend/src/pages/AdminSettings/constants/settingsConstants.js` — all constants (FONTS, TABS, DEFAULT_SETTINGS, etc.)
- `frontend/src/pages/AdminSettings/components/shared/sharedComponents.jsx` — reusable UI primitives
- `frontend/src/pages/AdminSettings/components/SMSSettings.jsx` — SMS gateway config
- `frontend/src/pages/AdminSettings/components/GoogleMapsSettings.jsx` — Google Maps config
- `frontend/src/pages/AdminSettings/styles/settings.module.css` — extracted CSS

### reminderController Refactor

The 973-line `reminderController.js` was split into:
- `backend/controllers/reminders/helpers.js` — `triggerVectorReload`, `calcAdjustedNotification`, `appendOverdueStatus`
- `backend/controllers/reminders/crud.js` — `getReminders`, `createReminder`, `updateReminder`, `deleteReminder`, `batchDeleteReminders`, `getAdjustedNotification`, `getCalendarStats`
- `backend/controllers/reminders/sharing.js` — `shareReminder`, `unshareReminder`
- `backend/controllers/reminders/calendar.js` — `getGoogleAuthUrl`, `googleCallback`
- `backend/controllers/reminders/travel.js` — `getTravelStats`
- `backend/controllers/reminders/index.js` — re-exports all (backward compatible)

---

## Environment Variables

### Backend (`backend/.env`)
Core variables needed:
- `PORT` — server port (default: 5001)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret
- `INTERNAL_SECRET` / `BUDDY_API_KEY` — Python-to-Node auth
- `AI_SERVICE_URL` — Python service URL (default: `http://localhost:8000`)
- `DISABLE_AUTH` — Set to `true` for local development only (allows unauthenticated socket connections)
- `MONGODB_TLS` — Set to `true` for production MongoDB connections

### Python (`python/.env`)
- `BUDDY_API_KEY` — Node.js auth secret
- `NODE_BACKEND_URL` — Node.js service URL (default: `http://localhost:5001`)
- `GOOGLE_API_KEY` — Gemini API key
- `ELEVENLABS_API_KEY` — ElevenLabs TTS

See `backend/.env.example` and `frontend/.env.example` for full variable lists.

---

## Development Commands

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Python AI Service
cd python && pip install -r requirements.txt && python main.py
```

---

## Security Notes

- Socket.io connections require JWT authentication by default. Set `DISABLE_AUTH=true` only for local dev.
- MongoDB TLS can be enabled with `MONGODB_TLS=true`.
- `.env` files are gitignored. Use `.env.example` as a template.
- AI proxy routes have explicit body size limits (`1mb` JSON, `1mb` text).
- `googleCalendar.clientSecret` is stored with `select: '+googleCalendar.clientSecret'` (excluded from default queries).

---

## API Routes

### Reminders
| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/reminders` | Yes |
| GET | `/api/reminders/calendar-stats` | Yes |
| GET | `/api/reminders/:id/travel-stats` | Yes |
| POST | `/api/reminders` | Yes |
| POST | `/api/reminders/adjusted-notification` | Yes |
| POST | `/api/reminders/batch-delete` | Yes |
| POST | `/api/reminders/:id/share` | Yes |
| PUT | `/api/reminders/:id` | Yes |
| DELETE | `/api/reminders/:id` | Yes |
| DELETE | `/api/reminders/:id/unshare/:userId` | Yes |

### AI Proxy
- All AI proxy routes are under `/api/ai/` with `{ mergeParams: true }` and body size limits.