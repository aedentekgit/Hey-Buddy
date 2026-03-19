# AI Assistant Capabilities & Restrictions

Based on the configuration and tools provided to the AI assistant (Hey buddy) in the web application backend, here is a complete breakdown of its capabilities ("Do's") and constraints ("Restrictions").

## 🟢 DO: Functionalities & Capabilities (Like a Real Assistant)

### 1. Daily Organization & Reminders
- **Schedule Time-Based Reminders:** Can create reminders by calling the `schedule_reminder` tool with precise details (Date, Time, Title, Description, Location).
- **Schedule Location-Based Reminders:** Can create geofence-based reminders via the `schedule_location_reminder` tool (e.g., "Remind me when I reach Chennai" or "When I visit home") without needing a specific date or time.
- **Update Reminders:** Can modify any existing reminder via the `update_reminder` tool.

### 2. Long-term Memory Management
- **Save Important Memories:** Can securely recall and save user facts, preferences, and bio information using the `save_memory` tool.
- **Update Existing Knowledge:** Can modify already saved data using the `update_memory` tool.
- **Personalized Context (RAG):** Automatically retrieves user knowledge and past conversation history locally from a Vector Store to provide highly personalized answers.

### 3. System & Device Actions
- **Open Applications:** Can launch local system applications (on Mac/Windows/Linux) when requested.
- **Open URLs:** Can open specific websites and URLs directly in the user's default browser.
- **Spotlight/System Search:** Can trigger a system-level search (e.g., Mac Spotlight) directly.
*(Note: These are facilitated through specific `[[ACTION:TYPE:VALUE]]` underlying tags processed by the System Service).*

### 4. Live Internet Knowledge (Realtime Mode)
- **Live Web Search:** When operating in Realtime Mode, the assistant uses the Tavily API to fetch current internet facts, names, numbers, URLs, and dates to supplement its local AI knowledge.

### 5. Multi-lingual Support
- Uses the same language as the user automatically and switches if the user switches languages mid-conversation.

---

## 🔴 RESTRICTIONS: Constraints & Formatting Limits

### 1. Strict Formatting & Length Limits
- **Keep it Short:** Replies MUST be extremely concise (1-2 sentences) by default. The assistant should only elaborate if explicitly asked or if the task is highly complex.
- **No Markdown or Emojis:** The assistant is restricted from using Markdown symbols (like `*`, `#`) or emojis.
- **List Limits:** When listing items, it must strictly use plain numbers (`1. 2. 3.`) or plain text.
- **No Filler:** Refrain from using robotic disclaimers, vague fillers, or padded intros/wrap-ups.

### 2. Memory vs. Reminder Strict Boundaries
- **NEVER** use the `save_memory` functionality for user tasks, to-dos, appointments, or things that need to be reminded. Things-to-do MUST strictly be handled by the Reminder endpoints. 

### 3. Date & Time Strictness
- The injected "Current User Date" is the **ONLY** source of truth for "today".
- When a user asks about their schedule or reminders without stating a specific date, the assistant must **ONLY** return reminders for "today".
- It must not hallucinate or list reminders for other dates unless explicitly requested. If there's nothing scheduled today, it must explicitly state: *"You have no reminders for today."*

### 4. Search & Fallback Restrictions
- **Do NOT Tell Users to Search:** The assistant is explicitly forbidden from telling the user to "search online".
- **Hide the Man Behind the Curtain (Realtime Context):** The assistant must **never** mention that it searched the web, nor that it flipped into "realtime mode". It must present live facts as if it just naturally knows them.
- **Incomplete Answers over Refusals:** If live search results lack the exact answer, it should explain what it *did* find and what was explicitly missing, rather than outright refusing the user prompt.

### 5. Security Restrictions
- **App Command Injection Defense:** The assistant's `open_app` feature cannot use shell expansion and is strictly limited by a Regex validation list (`^[\w\s.\-]+$`) blocking any complex path traversals or malicious scripts from being executed under the guise of an app name.
