import sys
import os

try:
    dotenv_path = os.path.join(os.getcwd(), ".env")
    if os.path.exists(dotenv_path):
        with open(dotenv_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip().strip("'\"")
except Exception as e:
    print(f"[BUDDY] ⚠️ Warning loading .env manually: {e}")

from unittest.mock import MagicMock

# Mock GUI and other unavailable libraries when running headlessly on VPS
if "--headless" in sys.argv or (sys.platform.startswith('linux') and not os.environ.get('DISPLAY')):
    os.environ['DISPLAY'] = ':99'
    os.environ['QT_QPA_PLATFORM'] = 'offscreen'
    
    class MockModule(MagicMock):
        @classmethod
        def __getattr__(cls, name):
            return MagicMock()

    sys.modules['pyautogui'] = MockModule()
    sys.modules['pygetwindow'] = MockModule()
    sys.modules['pyscreeze'] = MockModule()
    sys.modules['mouseinfo'] = MockModule()
    sys.modules['pywinauto'] = MockModule()
    sys.modules['win10toast'] = MockModule()
    sys.modules['pycaw'] = MockModule()
    sys.modules['comtypes'] = MockModule()

import asyncio
import re
import threading
import json
import traceback
import base64
from pathlib import Path

import sounddevice as sd
from google import genai
from google.genai import types
from ui import BuddyUI
from memory.memory_manager import (
    load_memory, update_memory, format_memory_for_prompt,
)

from actions.file_processor import file_processor
from actions.flight_finder     import flight_finder
from actions.open_app          import open_app
from actions.weather_report    import weather_action
from actions.send_message      import send_message
from actions.reminder          import reminder
from actions.computer_settings import computer_settings
from actions.screen_processor  import screen_process
from actions.youtube_video     import youtube_video
from actions.desktop           import desktop_control
from actions.browser_control   import browser_control
from actions.file_controller   import file_controller
from actions.code_helper       import code_helper
from actions.dev_agent         import dev_agent
from actions.web_search        import web_search as web_search_action
from actions.computer_control  import computer_control
from actions.game_updater      import game_updater


BACKEND_PORT = int(os.environ.get("PORT", 5001))

def get_base_dir():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).resolve().parent


BASE_DIR        = get_base_dir()
API_CONFIG_PATH = BASE_DIR / "config" / "api_keys.json"
PROMPT_PATH     = BASE_DIR / "core" / "prompt.txt"
LIVE_MODEL          = "models/gemini-2.5-flash-native-audio-preview-12-2025"
CHANNELS            = 1
SEND_SAMPLE_RATE    = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE          = 1024

def _get_api_key() -> str:
    with open(API_CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["gemini_api_key"]


def _load_system_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except Exception:
        return (
            "You are Buddy, an advanced AI assistant. "
            "Be concise, direct, and always use the provided tools to complete tasks. "
            "Never simulate or guess results — always call the appropriate tool."
        )

_CTRL_RE = re.compile(r"<ctrl\d+>", re.IGNORECASE)

def _clean_transcript(text: str) -> str:    
    text = _CTRL_RE.sub("", text)
    text = re.sub(r"[\x00-\x08\x0b-\x1f]", "", text)
    return text.strip()

TOOL_DECLARATIONS = [
    {
        "name": "open_app",
        "description": (
            "Opens any application on the computer. "
            "Use this whenever the user asks to open, launch, or start any app, "
            "website, or program. Always call this tool — never just say you opened it."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "app_name": {
                    "type": "STRING",
                    "description": "Exact name of the application (e.g. 'WhatsApp', 'Chrome', 'Spotify')"
                }
            },
            "required": ["app_name"]
        }
    },
    {
        "name": "web_search",
        "description": "Searches the web for any information.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query":  {"type": "STRING", "description": "Search query"},
                "mode":   {"type": "STRING", "description": "search (default) or compare"},
                "items":  {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Items to compare"},
                "aspect": {"type": "STRING", "description": "price | specs | reviews"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "weather_report",
        "description": "Gives the weather report to user",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "city": {"type": "STRING", "description": "City name"}
            },
            "required": ["city"]
        }
    },
    {
        "name": "send_message",
        "description": "Sends a text message via WhatsApp, Telegram, or other messaging platform.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "receiver":     {"type": "STRING", "description": "Recipient contact name"},
                "message_text": {"type": "STRING", "description": "The message to send"},
                "platform":     {"type": "STRING", "description": "Platform: WhatsApp, Telegram, etc."}
            },
            "required": ["receiver", "message_text", "platform"]
        }
    },
    {
        "name": "reminder",
        "description": "Sets a timed reminder using Task Scheduler.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "date":    {"type": "STRING", "description": "Date in YYYY-MM-DD format"},
                "time":    {"type": "STRING", "description": "Time in HH:MM format (24h)"},
                "message": {"type": "STRING", "description": "Reminder message text"}
            },
            "required": ["date", "time", "message"]
        }
    },
    {
        "name": "youtube_video",
        "description": (
            "Controls YouTube. Use for: playing videos, summarizing a video's content, "
            "getting video info, or showing trending videos."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action": {"type": "STRING", "description": "play | summarize | get_info | trending (default: play)"},
                "query":  {"type": "STRING", "description": "Search query for play action"},
                "save":   {"type": "BOOLEAN", "description": "Save summary to Notepad (summarize only)"},
                "region": {"type": "STRING", "description": "Country code for trending e.g. TR, US"},
                "url":    {"type": "STRING", "description": "Video URL for get_info action"},
            },
            "required": []
        }
    },
    {
        "name": "screen_process",
        "description": (
            "Captures and analyzes the screen or webcam image. "
            "MUST be called when user asks what is on screen, what you see, "
            "analyze my screen, look at camera, etc. "
            "You have NO visual ability without this tool. "
            "After calling this tool, stay SILENT — the vision module speaks directly."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "angle": {"type": "STRING", "description": "'screen' to capture display, 'camera' for webcam. Default: 'screen'"},
                "text":  {"type": "STRING", "description": "The question or instruction about the captured image"}
            },
            "required": ["text"]
        }
    },
    {
        "name": "computer_settings",
        "description": (
            "Controls the computer: volume, brightness, window management, keyboard shortcuts, "
            "typing text on screen, closing apps, fullscreen, dark mode, WiFi, restart, shutdown, "
            "scrolling, tab management, zoom, screenshots, lock screen, refresh/reload page. "
            "Use for ANY single computer control command. NEVER route to agent_task."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action":      {"type": "STRING", "description": "The action to perform"},
                "description": {"type": "STRING", "description": "Natural language description of what to do"},
                "value":       {"type": "STRING", "description": "Optional value: volume level, text to type, etc."}
            },
            "required": []
        }
    },
    {
        "name": "browser_control",
        "description": (
            "Controls any web browser. Use for: opening websites, searching the web, "
            "clicking elements, filling forms, scrolling, screenshots, navigation, any web-based task. "
            "Always pass the 'browser' parameter when the user specifies a browser (e.g. 'open in Edge', "
            "'use Firefox', 'open Chrome'). Multiple browsers can run simultaneously."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action":      {"type": "STRING", "description": "go_to | search | click | type | scroll | fill_form | smart_click | smart_type | get_text | get_url | press | new_tab | close_tab | screenshot | back | forward | reload | switch | list_browsers | close | close_all"},
                "browser":     {"type": "STRING", "description": "Target browser: chrome | edge | firefox | opera | operagx | brave | vivaldi | safari. Omit to use the currently active browser."},
                "url":         {"type": "STRING", "description": "URL for go_to / new_tab action"},
                "query":       {"type": "STRING", "description": "Search query for search action"},
                "engine":      {"type": "STRING", "description": "Search engine: google | bing | duckduckgo | yandex (default: google)"},
                "selector":    {"type": "STRING", "description": "CSS selector for click/type"},
                "text":        {"type": "STRING", "description": "Text to click or type"},
                "description": {"type": "STRING", "description": "Element description for smart_click/smart_type"},
                "direction":   {"type": "STRING", "description": "up | down for scroll"},
                "amount":      {"type": "INTEGER", "description": "Scroll amount in pixels (default: 500)"},
                "key":         {"type": "STRING", "description": "Key name for press action (e.g. Enter, Escape, F5)"},
                "path":        {"type": "STRING", "description": "Save path for screenshot"},
                "incognito":   {"type": "BOOLEAN", "description": "Open in private/incognito mode"},
                "clear_first": {"type": "BOOLEAN", "description": "Clear field before typing (default: true)"},
            },
            "required": ["action"]
        }
    },
    {
        "name": "file_controller",
        "description": "Manages files and folders: list, create, delete, move, copy, rename, read, write, find, disk usage.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action":      {"type": "STRING", "description": "list | create_file | create_folder | delete | move | copy | rename | read | write | find | largest | disk_usage | organize_desktop | info"},
                "path":        {"type": "STRING", "description": "File/folder path or shortcut: desktop, downloads, documents, home"},
                "destination": {"type": "STRING", "description": "Destination path for move/copy"},
                "new_name":    {"type": "STRING", "description": "New name for rename"},
                "content":     {"type": "STRING", "description": "Content for create_file/write"},
                "name":        {"type": "STRING", "description": "File name to search for"},
                "extension":   {"type": "STRING", "description": "File extension to search (e.g. .pdf)"},
                "count":       {"type": "INTEGER", "description": "Number of results for largest"},
            },
            "required": ["action"]
        }
    },
    {
        "name": "desktop_control",
        "description": "Controls the desktop: wallpaper, organize, clean, list, stats.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action": {"type": "STRING", "description": "wallpaper | wallpaper_url | organize | clean | list | stats | task"},
                "path":   {"type": "STRING", "description": "Image path for wallpaper"},
                "url":    {"type": "STRING", "description": "Image URL for wallpaper_url"},
                "mode":   {"type": "STRING", "description": "by_type or by_date for organize"},
                "task":   {"type": "STRING", "description": "Natural language desktop task"},
            },
            "required": ["action"]
        }
    },
    {
        "name": "code_helper",
        "description": "Writes, edits, explains, runs, or builds code files.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action":      {"type": "STRING", "description": "write | edit | explain | run | build | auto (default: auto)"},
                "description": {"type": "STRING", "description": "What the code should do or what change to make"},
                "language":    {"type": "STRING", "description": "Programming language (default: python)"},
                "output_path": {"type": "STRING", "description": "Where to save the file"},
                "file_path":   {"type": "STRING", "description": "Path to existing file for edit/explain/run/build"},
                "code":        {"type": "STRING", "description": "Raw code string for explain"},
                "args":        {"type": "STRING", "description": "CLI arguments for run/build"},
                "timeout":     {"type": "INTEGER", "description": "Execution timeout in seconds (default: 30)"},
            },
            "required": ["action"]
        }
    },
    {
        "name": "dev_agent",
        "description": "Builds complete multi-file projects from scratch: plans, writes files, installs deps, opens VSCode, runs and fixes errors.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "description":  {"type": "STRING", "description": "What the project should do"},
                "language":     {"type": "STRING", "description": "Programming language (default: python)"},
                "project_name": {"type": "STRING", "description": "Optional project folder name"},
                "timeout":      {"type": "INTEGER", "description": "Run timeout in seconds (default: 30)"},
            },
            "required": ["description"]
        }
    },
    {
        "name": "agent_task",
        "description": (
            "Executes complex multi-step tasks requiring multiple different tools. "
            "Examples: 'research X and save to file', 'find and organize files'. "
            "DO NOT use for single commands. NEVER use for Steam/Epic — use game_updater."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "goal":     {"type": "STRING", "description": "Complete description of what to accomplish"},
                "priority": {"type": "STRING", "description": "low | normal | high (default: normal)"}
            },
            "required": ["goal"]
        }
    },
    {
        "name": "computer_control",
        "description": "Direct computer control: type, click, hotkeys, scroll, move mouse, screenshots, find elements on screen.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action":      {"type": "STRING", "description": "type | smart_type | click | double_click | right_click | hotkey | press | scroll | move | copy | paste | screenshot | wait | clear_field | focus_window | screen_find | screen_click | random_data | user_data"},
                "text":        {"type": "STRING", "description": "Text to type or paste"},
                "x":           {"type": "INTEGER", "description": "X coordinate"},
                "y":           {"type": "INTEGER", "description": "Y coordinate"},
                "keys":        {"type": "STRING", "description": "Key combination e.g. 'ctrl+c'"},
                "key":         {"type": "STRING", "description": "Single key e.g. 'enter'"},
                "direction":   {"type": "STRING", "description": "up | down | left | right"},
                "amount":      {"type": "INTEGER", "description": "Scroll amount (default: 3)"},
                "seconds":     {"type": "NUMBER",  "description": "Seconds to wait"},
                "title":       {"type": "STRING",  "description": "Window title for focus_window"},
                "description": {"type": "STRING",  "description": "Element description for screen_find/screen_click"},
                "type":        {"type": "STRING",  "description": "Data type for random_data"},
                "field":       {"type": "STRING",  "description": "Field for user_data: name|email|city"},
                "clear_first": {"type": "BOOLEAN", "description": "Clear field before typing (default: true)"},
                "path":        {"type": "STRING",  "description": "Save path for screenshot"},
            },
            "required": ["action"]
        }
    },
    {
        "name": "game_updater",
        "description": (
            "THE ONLY tool for ANY Steam or Epic Games request. "
            "Use for: installing, downloading, updating games, listing installed games, "
            "checking download status, scheduling updates. "
            "ALWAYS call directly for any Steam/Epic/game request. "
            "NEVER use agent_task, browser_control, or web_search for Steam/Epic."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action":    {"type": "STRING",  "description": "update | install | list | download_status | schedule | cancel_schedule | schedule_status (default: update)"},
                "platform":  {"type": "STRING",  "description": "steam | epic | both (default: both)"},
                "game_name": {"type": "STRING",  "description": "Game name (partial match supported)"},
                "app_id":    {"type": "STRING",  "description": "Steam AppID for install (optional)"},
                "hour":      {"type": "INTEGER", "description": "Hour for scheduled update 0-23 (default: 3)"},
                "minute":    {"type": "INTEGER", "description": "Minute for scheduled update 0-59 (default: 0)"},
                "shutdown_when_done": {"type": "BOOLEAN", "description": "Shut down PC when download finishes"},
            },
            "required": []
        }
    },
    {
        "name": "flight_finder",
        "description": "Searches Google Flights and speaks the best options.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "origin":      {"type": "STRING",  "description": "Departure city or airport code"},
                "destination": {"type": "STRING",  "description": "Arrival city or airport code"},
                "date":        {"type": "STRING",  "description": "Departure date (any format)"},
                "return_date": {"type": "STRING",  "description": "Return date for round trips"},
                "passengers":  {"type": "INTEGER", "description": "Number of passengers (default: 1)"},
                "cabin":       {"type": "STRING",  "description": "economy | premium | business | first"},
                "save":        {"type": "BOOLEAN", "description": "Save results to Notepad"},
            },
            "required": ["origin", "destination", "date"]
        }
    },
    {
        "name": "shutdown_buddy",
        "description": (
            "Shuts down the assistant completely. "
            "Call this when the user expresses intent to end the conversation, "
            "close the assistant, say goodbye, or stop Buddy. "
            "The user can say this in ANY language."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        }
    },
    {
    "name": "file_processor",
    "description": (
        "Processes any file that the user has uploaded or dropped onto the interface. "
        "Use this when the user refers to an uploaded file and wants an action on it. "
        "Supports: images (describe/ocr/resize/compress/convert), "
        "PDFs (summarize/extract_text/to_word), "
        "Word docs & text files (summarize/fix/reformat/translate), "
        "CSV/Excel (analyze/stats/filter/sort/convert), "
        "JSON/XML (validate/format/analyze), "
        "code files (explain/review/fix/optimize/run/document/test), "
        "audio (transcribe/trim/convert/info), "
        "video (trim/extract_audio/extract_frame/compress/transcribe/info), "
        "archives (list/extract), "
        "presentations (summarize/extract_text). "
        "ALWAYS call this tool when a file has been uploaded and the user gives a command about it. "
        "If the user's command is ambiguous, pick the most logical action for that file type."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "file_path": {
                "type": "STRING",
                "description": "Full path to the uploaded file. Leave empty to use the currently uploaded file."
            },
            "action": {
                "type": "STRING",
                "description": (
                    "What to do with the file. Examples by type:\n"
                    "image: describe | ocr | resize | compress | convert | info\n"
                    "pdf: summarize | extract_text | to_word | info\n"
                    "docx/txt: summarize | fix | reformat | translate_hint | word_count | to_bullet\n"
                    "csv/excel: analyze | stats | filter | sort | convert | info\n"
                    "json: validate | format | analyze | to_csv\n"
                    "code: explain | review | fix | optimize | run | document | test\n"
                    "audio: transcribe | trim | convert | info\n"
                    "video: trim | extract_audio | extract_frame | compress | transcribe | info | convert\n"
                    "archive: list | extract\n"
                    "pptx: summarize | extract_text | analyze"
                )
            },
            "instruction": {
                "type": "STRING",
                "description": "Free-form instruction if action doesn't cover it. E.g. 'translate this to Turkish', 'find all email addresses'"
            },
            "format": {
                "type": "STRING",
                "description": "Target format for conversion. E.g. 'mp3', 'pdf', 'csv', 'png'"
            },
            "width":     {"type": "INTEGER", "description": "Target width for image resize"},
            "height":    {"type": "INTEGER", "description": "Target height for image resize"},
            "scale":     {"type": "NUMBER",  "description": "Scale factor for image resize (e.g. 0.5)"},
            "quality":   {"type": "INTEGER", "description": "Quality 1-100 for image/video compress"},
            "start":     {"type": "STRING",  "description": "Start time for trim: seconds or HH:MM:SS"},
            "end":       {"type": "STRING",  "description": "End time for trim: seconds or HH:MM:SS"},
            "timestamp": {"type": "STRING",  "description": "Timestamp for video frame extraction HH:MM:SS"},
            "column":    {"type": "STRING",  "description": "Column name for CSV filter/sort"},
            "value":     {"type": "STRING",  "description": "Filter value for CSV filter"},
            "condition": {"type": "STRING",  "description": "Filter condition: equals|contains|gt|lt"},
            "ascending": {"type": "BOOLEAN", "description": "Sort order for CSV sort (default: true)"},
            "save":      {"type": "BOOLEAN", "description": "Save result to file (default: true)"},
            "destination": {"type": "STRING", "description": "Output folder for archive extract"},
        },
        "required": []
    }
},
    {
        "name": "save_memory",
        "description": (
            "Save an important personal fact about the user to long-term memory. "
            "Call this silently whenever the user reveals something worth remembering: "
            "name, age, city, job, preferences, hobbies, relationships, projects, or future plans. "
            "Do NOT call for: weather, reminders, searches, or one-time commands. "
            "Do NOT announce that you are saving — just call it silently. "
            "Values must be in English regardless of the conversation language."
        ),
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "category": {
                    "type": "STRING",
                    "description": (
                        "identity — name, age, birthday, city, job, language, nationality | "
                        "preferences — favorite food/color/music/film/game/sport, hobbies | "
                        "projects — active projects, goals, things being built | "
                        "relationships — friends, family, partner, colleagues | "
                        "wishes — future plans, things to buy, travel dreams | "
                        "notes — habits, schedule, anything else worth remembering"
                    )
                },
                "key":   {"type": "STRING", "description": "Short snake_case key (e.g. name, favorite_food, sister_name)"},
                "value": {"type": "STRING", "description": "Concise value in English (e.g. Fatih, pizza, older sister)"},
            },
            "required": ["category", "key", "value"]
        }
    },
    {
        "name": "schedule_location_reminder",
        "description": "Schedules a location-based reminder tied to a geofence. Use this when the user says 'remind me at [place]'.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "title":       {"type": "STRING", "description": "Reminder title"},
                "location":    {"type": "STRING", "description": "Geofence location name or place (e.g. Home, Office, Supermarket)"},
                "description": {"type": "STRING", "description": "Optional description or note for the reminder"},
                "date":        {"type": "STRING", "description": "Optional date (YYYY-MM-DD)"},
                "time":        {"type": "STRING", "description": "Optional time (HH:MM)"}
            },
            "required": ["title", "location"]
        }
    },
    {
        "name": "save_document",
        "description": "Saves a document or analyzed text/image context to the user's permanent documents library.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "title":    {"type": "STRING", "description": "Document title"},
                "content":  {"type": "STRING", "description": "Full document content or text extract"},
                "summary":  {"type": "STRING", "description": "Brief summary of the document"},
                "file_url": {"type": "STRING", "description": "Optional file URL attachment"}
            },
            "required": ["title", "content"]
        }
    },
    {
        "name": "update_reminder",
        "description": "Updates fields of an existing reminder in the database. Use this ONLY when the user explicitly requests to CHANGE or UPDATE a reminder.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "reminder_id": {"type": "STRING", "description": "The Mongo ID of the reminder to update"},
                "title":       {"type": "STRING", "description": "New title"},
                "date":        {"type": "STRING", "description": "New date (YYYY-MM-DD)"},
                "time":        {"type": "STRING", "description": "New time (HH:MM)"},
                "description": {"type": "STRING", "description": "New description"},
                "location":    {"type": "STRING", "description": "New location name"}
            },
            "required": ["reminder_id"]
        }
    },
    {
        "name": "update_memory",
        "description": "Updates an existing saved memory in the database. Use this ONLY when the user provides new details to CHANGE a memory.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "memory_id": {"type": "STRING", "description": "The Mongo ID of the memory to update"},
                "content":   {"type": "STRING", "description": "New memory content"}
            },
            "required": ["memory_id", "content"]
        }
    },
    {
        "name": "get_reminders",
        "description": "Fetches all active, pending, calendar-based, and location-based reminders from the database.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
            "required": []
        }
    },
]

from http.server import HTTPServer, BaseHTTPRequestHandler

class RemoteControlHandler(BaseHTTPRequestHandler):
    buddy_live = None

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path == "/api/status":
            status = {
                "status": "online",
                "speaking": RemoteControlHandler.buddy_live._is_speaking if RemoteControlHandler.buddy_live else False,
                "connected": RemoteControlHandler.buddy_live.session is not None if RemoteControlHandler.buddy_live else False,
                "muted": RemoteControlHandler.buddy_live.ui.muted if (RemoteControlHandler.buddy_live and RemoteControlHandler.buddy_live.ui) else False
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(status).encode("utf-8"))
        elif self.path == "/api/screenshot":
            try:
                import pyautogui
                from io import BytesIO
                screenshot = pyautogui.screenshot()
                img_byte_arr = BytesIO()
                screenshot.save(img_byte_arr, format='PNG')
                img_byte_arr = img_byte_arr.getvalue()
                self._set_headers(200, "image/png")
                self.wfile.write(img_byte_arr)
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode("utf-8"))

    def do_POST(self):
        if self.path == "/api/command":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode("utf-8"))
                text = data.get("text", "")
                if text and RemoteControlHandler.buddy_live:
                    RemoteControlHandler.buddy_live._on_text_command(text)
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"result": "Command sent to Buddy"}).encode("utf-8"))
                else:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "No text provided or assistant not running"}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        elif self.path == "/api/action":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode("utf-8"))
                action = data.get("action", "")
                params = data.get("parameters", {})
                
                if action in ("mute_volume", "toggle_mute", "mute") and RemoteControlHandler.buddy_live:
                    live = RemoteControlHandler.buddy_live
                    if live.ui:
                        if getattr(live, "headless", False):
                            live.ui.muted = not live.ui.muted
                            new_mute = live.ui.muted
                            live.ui.set_state("MUTED" if new_mute else "LISTENING")
                        else:
                            new_mute = not live.ui.muted
                            from PyQt6.QtCore import QTimer
                            QTimer.singleShot(0, live.ui._win._toggle_mute)
                        
                        res = f"Muted set to {new_mute}"
                        state_str = "MUTED" if new_mute else "LISTENING"
                        if live.mobile_websocket and live._loop:
                            asyncio.run_coroutine_threadsafe(
                                live.mobile_websocket.send(json.dumps({"type": "state", "state": state_str})),
                                live._loop
                            )
                    else:
                        res = "No UI to mute"
                elif action == "clear_history" and RemoteControlHandler.buddy_live:
                    live = RemoteControlHandler.buddy_live
                    live.chat_history = []
                    res = "History cleared"
                    if live._loop:
                        asyncio.run_coroutine_threadsafe(
                            live._sync_history_to_db(),
                            live._loop
                        )
                else:
                    from actions.computer_settings import computer_settings
                    res = computer_settings(parameters={"action": action, **params})
                
                self._set_headers(200)
                self.wfile.write(json.dumps({"result": res}).encode("utf-8"))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode("utf-8"))

class BuddyHTTPServer(HTTPServer):
    allow_reuse_address = True

def start_remote_server():
    try:
        port = int(os.environ.get("REMOTE_PORT", 5003))
        host = os.environ.get("AI_HOST", "0.0.0.0")
        server_address = (host, port)
        httpd = BuddyHTTPServer(server_address, RemoteControlHandler)
        print(f"[BUDDY] 🌐 Remote control server running on port {port} on host {host}")
        httpd.serve_forever()
    except Exception as e:
        print(f"[BUDDY] ❌ Remote Server Error: {e}")

import websockets

class MobileVoiceServer:
    buddy_live = None

    @classmethod
    async def handler(cls, websocket, path=None):
        print("[BUDDY] 🎙️ Mobile voice client connected!")
        if cls.buddy_live:
            cls.buddy_live.mobile_websocket = websocket
            cls.buddy_live._is_speaking = False
            
            # Send current state to sync client immediately
            state_str = "MUTED" if cls.buddy_live.ui.muted else "LISTENING"
            try:
                await websocket.send(json.dumps({"type": "state", "state": state_str}))
                print(f"[BUDDY] 🎙️ Sent initial state '{state_str}' to mobile client.")
            except Exception as ex:
                print(f"[BUDDY] 🎙️ Failed to send initial state: {ex}")
            
            # Send history
            history_logs = []
            for msg in cls.buddy_live.chat_history:
                prefix = "You: " if msg["role"] == "user" else "Buddy: "
                history_logs.append(prefix + msg["content"])
            
            print(f"[BUDDY] 🎙️ Sending {len(history_logs)} history logs to mobile client...")
            if history_logs:
                try:
                    await websocket.send(json.dumps({"type": "history", "logs": history_logs}))
                    print("[BUDDY] 🎙️ Sent history logs successfully.")
                except Exception as ex:
                    print(f"[BUDDY] 🎙️ Failed to send history logs: {ex}")
        
        try:
            async for message in websocket:
                if isinstance(message, bytes) and cls.buddy_live:
                    # Throttled logging to avoid flooding the logs
                    if not hasattr(cls, "_chunk_count"):
                        cls._chunk_count = 0
                    cls._chunk_count += 1
                    
                    # Calculate peak amplitude to verify if mic is actually recording voice
                    max_amp = -1
                    try:
                        import struct
                        count = len(message) // 2
                        if count > 0:
                            shorts = struct.unpack(f"<{count}h", message)
                            max_amp = max(abs(x) for x in shorts) if shorts else 0
                    except Exception:
                        pass

                    if cls._chunk_count % 50 == 1 or cls._chunk_count < 5:
                        amp_str = f"MaxAmp: {max_amp}" if max_amp != -1 else "MaxAmp: N/A"
                        hex_prefix = message[:20].hex()
                        print(f"[BUDDY] 🎙️ Received audio chunk #{cls._chunk_count} ({len(message)} bytes, {amp_str}) from mobile client. Hex preview: {hex_prefix}")

                    # Proactive user interruption: User talks while Buddy is speaking
                    if cls.buddy_live._is_speaking:
                        print("[BUDDY] 🎙️ Mic bytes received while speaking! Triggering proactive interruption.")
                        cls.buddy_live.set_speaking(False)
                        
                        # Clear playback queues
                        if cls.buddy_live.audio_in_queue:
                            while not cls.buddy_live.audio_in_queue.empty():
                                try:
                                    cls.buddy_live.audio_in_queue.get_nowait()
                                except asyncio.QueueEmpty:
                                    break
                                
                        # Cancel mobile playback
                        try:
                            await websocket.send(json.dumps({"type": "audio_cancel"}))
                        except Exception:
                            pass

                    if cls.buddy_live.session and cls.buddy_live.out_queue:
                        try:
                            cls.buddy_live.out_queue.put_nowait({
                                "data": message,
                                "mime_type": "audio/pcm;rate=16000"
                            })
                        except asyncio.QueueFull:
                            if cls._chunk_count % 100 == 0:
                                print(f"[BUDDY] ⚠️ Warning: out_queue is FULL (size={cls.buddy_live.out_queue.qsize()})! Dropping audio packet.")
                elif isinstance(message, str) and cls.buddy_live:
                    print(f"[BUDDY] 🎙️ Received string message: {message}")
                    try:
                        data = json.loads(message)
                        if data.get("type") == "text":
                            cls.buddy_live._on_text_command(data.get("text", ""))
                        elif data.get("type") == "clear_history":
                            cls.buddy_live.chat_history = []
                            asyncio.create_task(cls.buddy_live._sync_history_to_db())
                            print("[BUDDY] 🎙️ Chat history cleared by mobile client and synced.")
                    except Exception as e:
                        print(f"[BUDDY] 🎙️ Error handling websocket message: {e}")
        except websockets.exceptions.ConnectionClosed:
            print("[BUDDY] 🔌 Mobile voice client disconnected.")
        finally:
            if cls.buddy_live and cls.buddy_live.mobile_websocket == websocket:
                cls.buddy_live.mobile_websocket = None

async def start_voice_server():
    try:
        port = int(os.environ.get("VOICE_PORT", 5002))
        host = os.environ.get("AI_HOST", "0.0.0.0")
        async with websockets.serve(MobileVoiceServer.handler, host, port):
            print(f"[BUDDY] 🎙️ Voice streaming server running on port {port} on host {host}")
            await asyncio.Future()
    except Exception as e:
        print(f"[BUDDY] ❌ Voice Server Error: {e}")

class BuddyLive:

    def __init__(self, ui: BuddyUI):
        self.ui             = ui
        self.mobile_websocket = None
        self.headless       = False
        RemoteControlHandler.buddy_live = self
        threading.Thread(target=start_remote_server, daemon=True).start()
        self.session        = None
        self.audio_in_queue = None
        self.out_queue      = None
        self._loop          = None
        self._is_speaking   = False
        self._speaking_lock = threading.Lock()
        self.ui.on_text_command = self._on_text_command
        self._turn_done_event: asyncio.Event | None = None
        self.conversation_id = None
        self.chat_history   = self._fetch_initial_history()

    def _fetch_initial_history(self):
        try:
            import requests
            headers = {"Authorization": "Bearer 562af79bd1304d6e96b59cd9ad727e99ee07f057d0a8bfcd35c7bd77c9547bde"}
            user_id = self._get_primary_user_id()
            print(f"[BUDDY] 🔍 Fetching history for user: {user_id}")
            if not user_id: return []
            res = requests.get(f"http://localhost:{BACKEND_PORT}/api/conversations/internal/{user_id}", headers=headers, timeout=2)
            print(f"[BUDDY] 🔍 History API response code: {res.status_code}")
            if res.status_code == 200:
                data = res.json().get("data", {})
                self.conversation_id = data.get("_id")
                messages = data.get("messages", [])
                print(f"[BUDDY] 🔍 Fetched {len(messages)} past messages from DB.")
                return messages
        except Exception as e:
            print(f"[BUDDY] ⚠️ Failed to fetch initial history: {e}")
        return []

    def _stream_transcript(self, role: str, text: str, is_final: bool):
        if self.mobile_websocket and self._loop:
            try:
                import json
                import asyncio
                asyncio.run_coroutine_threadsafe(
                    self.mobile_websocket.send(json.dumps({
                        "type": "transcript",
                        "role": role,
                        "text": text,
                        "is_final": is_final
                    })),
                    self._loop
                )
            except Exception:
                pass

    def _on_text_command(self, text: str):
        if not self._loop or not self.session:
            return
        asyncio.run_coroutine_threadsafe(
            self.session.send_client_content(
                turns={"parts": [{"text": text}]},
                turn_complete=True
            ),
            self._loop
        )

    def set_speaking(self, value: bool):
        with self._speaking_lock:
            self._is_speaking = value
        if value:
            self.ui.set_state("SPEAKING")
        else:
            self.ui.set_state("MUTED" if self.ui.muted else "LISTENING")

    def speak(self, text: str):
        if not self._loop or not self.session:
            return
        asyncio.run_coroutine_threadsafe(
            self.session.send_client_content(
                turns={"parts": [{"text": text}]},
                turn_complete=True
            ),
            self._loop
        )

    def speak_error(self, tool_name: str, error: str):
        short = str(error)[:120]
        self.ui.write_log(f"ERR: {tool_name} — {short}")
        self.speak(f"Sir, {tool_name} encountered an error. {short}")

    def _get_primary_user_id(self) -> str:
        try:
            import requests
            headers = {"Authorization": "Bearer 562af79bd1304d6e96b59cd9ad727e99ee07f057d0a8bfcd35c7bd77c9547bde"}
            res = requests.get(f"http://localhost:{BACKEND_PORT}/api/conversations/internal/users/first", headers=headers, timeout=2)
            if res.status_code == 200:
                user_data = res.json().get("data", {})
                if user_data and "_id" in user_data:
                    return str(user_data.get("_id"))
        except Exception as e:
            print(f"[BUDDY] ⚠️ Warning fetching primary user ID from internal route: {e}")
        return "65f123456789abcdef012345"

    def _send_node_action(self, action_type: str, payload: dict, item_id: str = None) -> str:
        try:
            import requests
            headers = {
                "Authorization": "Bearer 562af79bd1304d6e96b59cd9ad727e99ee07f057d0a8bfcd35c7bd77c9547bde",
                "Content-Type": "application/json"
            }
            user_id = self._get_primary_user_id()
            body = {
                "action": action_type,
                "userId": user_id,
                "value": payload
            }
            if item_id:
                body["id"] = item_id

            res = requests.post(f"http://localhost:{BACKEND_PORT}/api/ai/action", json=body, headers=headers, timeout=5)
            if res.status_code == 200:
                res_data = res.json()
                msg = res_data.get("message") or res_data.get("msg") or "Action executed successfully."
                return f"[Database Success] {msg}"
            else:
                return f"[Database Error] {res.text}"
        except Exception as e:
            return f"[Database Connection Failure] Error connecting to Node.js backend: {e}"

    async def _sync_history_to_db(self):
        try:
            user_id = await asyncio.to_thread(self._get_primary_user_id)
            if not user_id:
                return

            payload = {
                "userId": user_id,
                "messages": self.chat_history
            }
            if self.conversation_id:
                payload["conversationId"] = self.conversation_id

            import requests
            headers = {
                "Authorization": "Bearer 562af79bd1304d6e96b59cd9ad727e99ee07f057d0a8bfcd35c7bd77c9547bde",
                "Content-Type": "application/json"
            }
            
            res = await asyncio.to_thread(
                lambda: requests.post(
                    f"http://localhost:{BACKEND_PORT}/api/conversations/sync",
                    json=payload,
                    headers=headers,
                    timeout=5
                )
            )
            if res.status_code == 200:
                data = res.json()
                if "conversationId" in data:
                    self.conversation_id = data["conversationId"]
                    print(f"[BUDDY] 💾 Scoped sync completed. session_id: {self.conversation_id}")
        except Exception as e:
            print(f"[BUDDY] ⚠️ Sync error: {e}")

    def _get_mongodb_context(self) -> dict:
        try:
            import requests
            headers = {
                "Authorization": "Bearer 562af79bd1304d6e96b59cd9ad727e99ee07f057d0a8bfcd35c7bd77c9547bde",
                "Content-Type": "application/json"
            }
            user_id = self._get_primary_user_id()
            if not user_id:
                return {}
            
            res = requests.get(f"http://localhost:{BACKEND_PORT}/api/conversations/internal/{user_id}/context", headers=headers, timeout=3)
            if res.status_code == 200:
                data = res.json()
                if data.get("success"):
                    return data.get("data", {})
        except Exception as e:
            print(f"[BUDDY] ⚠️ Error fetching MongoDB RAG context: {e}")
        return {}

    def _build_config(self) -> types.LiveConnectConfig:
        from datetime import datetime
        import pytz

        # 1. Fetch MongoDB dynamic context
        db_context = self._get_mongodb_context()
        user_ctx_cfg = db_context.get("userContext", {})
        
        # Resolve Timezone
        tz_name = user_ctx_cfg.get("timeZone", "UTC")
        try:
            tz = pytz.timezone(tz_name)
        except Exception:
            tz = pytz.utc

        now = datetime.now(tz)
        time_str = now.strftime("%A, %B %d, %Y — %I:%M %p %Z")
        
        time_ctx = (
            f"[CURRENT DATE & TIME]\n"
            f"User Timezone: {tz_name}\n"
            f"Right now it is: {time_str}\n"
            f"Use this current date & time to calculate exact times for reminders relative to the user.\n\n"
        )

        parts = [time_ctx]

        # 2. Add Saved Memories from MongoDB
        db_memories = db_context.get("memories", [])
        if db_memories:
            mem_lines = ["[SAVED PERSONAL MEMORIES & PREFERENCES (MongoDB)]"]
            for m in db_memories:
                cat = m.get("category", "general")
                content = m.get("content", "")
                m_id = m.get("id", "")
                if content:
                    mem_lines.append(f"- [{cat.upper()}] {content} (Database ID: {m_id})")
            mem_lines.append("Use these details as active user preferences. Refer to them or update them if the user clarifies details.\n")
            parts.append("\n".join(mem_lines))

        # 3. Add Active Reminders from MongoDB
        db_reminders = db_context.get("reminders", [])
        if db_reminders:
            rem_lines = ["[ACTIVE REMINDERS & CALENDAR (MongoDB)]"]
            for r in db_reminders:
                title = r.get("title", "")
                date_val = r.get("date", "Whenever")
                time_val = r.get("time", "")
                loc_val = r.get("location", "")
                r_id = r.get("id", "")
                
                details = f'- "{title}" on {date_val}'
                if time_val:
                    details += f' at {time_val}'
                if loc_val:
                    details += f' [Location: {loc_val}]'
                details += f' (Database ID: {r_id})'
                
                rem_lines.append(details)
            rem_lines.append("To reschedule or change any of these, use the update_reminder tool and pass its unique Database ID.\n")
            parts.append("\n".join(rem_lines))

        # 4. Add local backup memories
        memory     = load_memory()
        mem_str    = format_memory_for_prompt(memory)
        if mem_str:
            parts.append(mem_str)

        # 5. Add dynamic language configuration
        system_lang = user_ctx_cfg.get("systemLanguage", "en-US")
        lang_prompt = (
            f"\n[LANGUAGE PROTOCOL]\n"
            f"- User Preferred Language (Default): {system_lang}\n"
            f"- STRICT LANGUAGE RULE: Always detect the language of the user's latest input (speech or text) and respond in that EXACT same language. If the user speaks/types in Tamil, you MUST respond in Tamil. If in English, you MUST respond in English. If in Hindi, you MUST respond in Hindi.\n"
            f"- The input language takes absolute priority over the user's default preferred language setting and over the language of any past conversational history. Under no circumstances should you respond in English if the user asked in Tamil or Hindi.\n"
            f"- For tool calls and parameters, always use English.\n"
        )
        parts.append(lang_prompt)

        # 6. Add dynamic conversation history context for continuous session memory
        if self.chat_history:
            history_lines = ["\n[RECENT CONVERSATION HISTORY (FOR CONTINUITY & CONTEXT)]"]
            for msg in self.chat_history[-12:]:
                role = "User" if msg["role"] == "user" else "Buddy"
                history_lines.append(f"{role}: {msg['content']}")
            history_lines.append("Use this chat history to maintain the flow of conversation. Do NOT repeat greeting instructions like 'How can I help you today?' if they are already in the history.\n")
            parts.append("\n".join(history_lines))

        # 7. Add system persona prompt
        sys_prompt = _load_system_prompt()
        parts.append(sys_prompt)

        # Resolve dynamic voice options
        voice_gender = user_ctx_cfg.get("voicePreferences", {}).get("gender", "female").lower()
        voice_name = "Charon" if voice_gender == "male" else "Puck"

        # Prioritize the user's preferred language, with others as fallback candidates
        candidate_langs = ["en-US", "ta-IN", "hi-IN", "te-IN", "kn-IN", "ml-IN"]
        preferred_lang = system_lang
        # Handle simple language codes
        if preferred_lang == "ta":
            preferred_lang = "ta-IN"
        elif preferred_lang == "hi":
            preferred_lang = "hi-IN"
        elif preferred_lang == "te":
            preferred_lang = "te-IN"
        elif preferred_lang == "kn":
            preferred_lang = "kn-IN"
        elif preferred_lang == "ml":
            preferred_lang = "ml-IN"
        elif preferred_lang == "en":
            preferred_lang = "en-US"

        if preferred_lang in candidate_langs:
            candidate_langs.remove(preferred_lang)
        candidate_langs.insert(0, preferred_lang)

        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            output_audio_transcription=types.AudioTranscriptionConfig(),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            system_instruction="\n".join(parts),
            tools=[{"function_declarations": TOOL_DECLARATIONS}],
            session_resumption=types.SessionResumptionConfig(),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name
                    )
                )
            ),
        )

    async def _execute_tool(self, fc) -> types.FunctionResponse:
        name = fc.name
        args = dict(fc.args or {})

        print(f"[BUDDY] 🔧 {name}  {args}")
        self.ui.set_state("THINKING")

        if name == "save_memory":
            category = args.get("category", "notes")
            key      = args.get("key", "")
            value    = args.get("value", "")
            if key and value:
                update_memory({category: {key: {"value": value}}})
                print(f"[Memory] 💾 save_memory: {category}/{key} = {value}")
                
                # Sync to MongoDB in background
                loop = asyncio.get_event_loop()
                payload = {
                    "content": f"{key}: {value}" if key else value,
                    "category": category
                }
                loop.run_in_executor(None, lambda: self._send_node_action("SAVE_MEMORY", payload))

            self.ui.set_state("MUTED" if self.ui.muted else "LISTENING")
            return types.FunctionResponse(
                id=fc.id, name=name,
                response={"result": "ok", "silent": True}
            )

        loop   = asyncio.get_event_loop()
        result = "Done."

        try:
            if name == "open_app":
                r = await loop.run_in_executor(None, lambda: open_app(parameters=args, response=None, player=self.ui))
                result = r or f"Opened {args.get('app_name')}."

            elif name == "weather_report":
                r = await loop.run_in_executor(None, lambda: weather_action(parameters=args, player=self.ui))
                result = r or "Weather delivered."

            elif name == "browser_control":
                r = await loop.run_in_executor(None, lambda: browser_control(parameters=args, player=self.ui))
                result = r or "Done."

            elif name == "file_controller":
                r = await loop.run_in_executor(None, lambda: file_controller(parameters=args, player=self.ui))
                result = r or "Done."

            elif name == "send_message":
                r = await loop.run_in_executor(None, lambda: send_message(parameters=args, response=None, player=self.ui, session_memory=None))
                result = r or f"Message sent to {args.get('receiver')}."

            elif name == "reminder":
                payload = {
                    "title": args.get("message", "Reminder"),
                    "date": args.get("date"),
                    "time": args.get("time"),
                    "description": f"Timed reminder: {args.get('message', '')}"
                }
                try:
                    await loop.run_in_executor(None, lambda: reminder(parameters=args, response=None, player=self.ui))
                except Exception as ex:
                    print(f"[Reminder Backup] ⚠️ Local schedule failed: {ex}")
                result = await loop.run_in_executor(None, lambda: self._send_node_action("CREATE_REMINDER", payload))

            elif name == "schedule_location_reminder":
                payload = {
                    "title": args.get("title", "Location Reminder"),
                    "location": args.get("location"),
                    "description": args.get("description", ""),
                    "date": args.get("date"),
                    "time": args.get("time")
                }
                result = await loop.run_in_executor(None, lambda: self._send_node_action("CREATE_LOCATION_REMINDER", payload))

            elif name == "save_document":
                payload = {
                    "title": args.get("title", "AI Generated Document"),
                    "content": args.get("content"),
                    "summary": args.get("summary", ""),
                    "fileUrl": args.get("file_url")
                }
                result = await loop.run_in_executor(None, lambda: self._send_node_action("CREATE_DOCUMENT", payload))

            elif name == "update_reminder":
                reminder_id = args.get("reminder_id")
                payload = {
                    "title": args.get("title"),
                    "date": args.get("date"),
                    "time": args.get("time"),
                    "description": args.get("description"),
                    "location": args.get("location")
                }
                result = await loop.run_in_executor(None, lambda: self._send_node_action("UPDATE_REMINDER", payload, reminder_id))

            elif name == "update_memory":
                memory_id = args.get("memory_id")
                payload = {
                    "content": args.get("content")
                }
                result = await loop.run_in_executor(None, lambda: self._send_node_action("UPDATE_MEMORY", payload, memory_id))

            elif name == "get_reminders":
                try:
                    import json
                    db_context = self._get_mongodb_context()
                    db_reminders = db_context.get("reminders", [])
                    if not db_reminders:
                        result = "There are no reminders currently set in your database."
                    else:
                        result = json.dumps(db_reminders)
                except Exception as ex:
                    print(f"[get_reminders] Error: {ex}")
                    result = "Error fetching reminders."

            elif name == "youtube_video":
                r = await loop.run_in_executor(None, lambda: youtube_video(parameters=args, response=None, player=self.ui))
                result = r or "Done."

            elif name == "screen_process":
                threading.Thread(
                    target=screen_process,
                    kwargs={"parameters": args, "response": None,
                            "player": self.ui, "session_memory": None},
                    daemon=True
                ).start()
                result = "Vision module activated. Stay completely silent — vision module will speak directly."

            elif name == "computer_settings":
                r = await loop.run_in_executor(None, lambda: computer_settings(parameters=args, response=None, player=self.ui))
                result = r or "Done."

            elif name == "desktop_control":
                r = await loop.run_in_executor(None, lambda: desktop_control(parameters=args, player=self.ui))
                result = r or "Done."

            elif name == "code_helper":
                r = await loop.run_in_executor(None, lambda: code_helper(parameters=args, player=self.ui, speak=self.speak))
                result = r or "Done."

            elif name == "dev_agent":
                r = await loop.run_in_executor(None, lambda: dev_agent(parameters=args, player=self.ui, speak=self.speak))
                result = r or "Done."

            elif name == "agent_task":
                from agent.task_queue import get_queue, TaskPriority
                priority_map = {"low": TaskPriority.LOW, "normal": TaskPriority.NORMAL, "high": TaskPriority.HIGH}
                priority = priority_map.get(args.get("priority", "normal").lower(), TaskPriority.NORMAL)
                task_id  = get_queue().submit(goal=args.get("goal", ""), priority=priority, speak=self.speak)
                result   = f"Task started (ID: {task_id})."

            elif name == "web_search":
                r = await loop.run_in_executor(None, lambda: web_search_action(parameters=args, player=self.ui))
                result = r or "Done."
            elif name == "file_processor":
                if not args.get("file_path") and self.ui.current_file:
                    args["file_path"] = self.ui.current_file
                r = await loop.run_in_executor(
                    None,
                    lambda: file_processor(parameters=args, player=self.ui, speak=self.speak)
                )
                result = r or "Done."

            elif name == "computer_control":
                r = await loop.run_in_executor(None, lambda: computer_control(parameters=args, player=self.ui))
                result = r or "Done."

            elif name == "game_updater":
                r = await loop.run_in_executor(None, lambda: game_updater(parameters=args, player=self.ui, speak=self.speak))
                result = r or "Done."

            elif name == "flight_finder":
                r = await loop.run_in_executor(None, lambda: flight_finder(parameters=args, player=self.ui))
                result = r or "Done."

            elif name == "shutdown_buddy":
                self.ui.write_log("SYS: Shutdown requested.")
                self.speak("Goodbye, sir.")
                if not self.headless and not self.mobile_websocket:
                    def _shutdown():
                        import time, os
                        time.sleep(1)
                        os._exit(0)
                    threading.Thread(target=_shutdown, daemon=True).start()
                else:
                    self.ui.muted = True
                    self.ui.set_state("MUTED")
                result = "Shutdown requested."

            else:
                result = f"Unknown tool: {name}"

        except Exception as e:
            result = f"Tool '{name}' failed: {e}"
            traceback.print_exc()
            self.speak_error(name, e)

        self.ui.set_state("MUTED" if self.ui.muted else "LISTENING")

        print(f"[BUDDY] 📤 {name} → {str(result)[:80]}")
        return types.FunctionResponse(
            id=fc.id, name=name,
            response={"result": result}
        )

    async def _send_realtime(self):
        while True:
            msg = await self.out_queue.get()
            await self.session.send_realtime_input(media=msg)

    async def _listen_audio(self):
        print("[BUDDY] 🎤 Mic started")
        loop = asyncio.get_event_loop()

        def callback(indata, frames, time_info, status):
            if self.mobile_websocket is not None or self.headless:
                return
            with self._speaking_lock:
                buddy_speaking = self._is_speaking
            if not buddy_speaking and not self.ui.muted:
                data = indata.tobytes()
                loop.call_soon_threadsafe(
                    self.out_queue.put_nowait,
                    {"data": data, "mime_type": "audio/pcm;rate=16000"}
                )

        try:
            with sd.InputStream(
                samplerate=SEND_SAMPLE_RATE,
                channels=CHANNELS,
                dtype="int16",
                blocksize=CHUNK_SIZE,
                callback=callback,
            ):
                print("[BUDDY] 🎤 Mic stream open")
                while True:
                    await asyncio.sleep(0.1)
        except Exception as e:
            print(f"[BUDDY] ⚠️ Local mic stream error: {e}")

    async def _receive_audio(self):
        print("[BUDDY] 👂 Recv started")
        out_buf, in_buf = [], []

        try:
            while True:
                async for response in self.session.receive():

                    if response.data:
                        if self._turn_done_event and self._turn_done_event.is_set():
                            self._turn_done_event.clear()
                        self.audio_in_queue.put_nowait(response.data)

                    if response.server_content:
                        sc = response.server_content

                        # Handle server-driven interruption (user talked over Buddy)
                        if getattr(sc, "interrupted", False):
                            print("[BUDDY] 🛑 Server-driven interruption detected! Clearing playback buffers.")
                            self.set_speaking(False)
                            if self.audio_in_queue:
                                while not self.audio_in_queue.empty():
                                    try:
                                        self.audio_in_queue.get_nowait()
                                    except asyncio.QueueEmpty:
                                        break
                            if self.mobile_websocket:
                                try:
                                    await self.mobile_websocket.send(json.dumps({"type": "audio_cancel"}))
                                except Exception:
                                    pass

                        if sc.output_transcription and sc.output_transcription.text:
                            txt = _clean_transcript(sc.output_transcription.text)
                            if txt:
                                out_buf.append(txt)
                                self._stream_transcript("Buddy", " ".join(out_buf).strip(), is_final=False)

                        if sc.input_transcription and sc.input_transcription.text:
                            txt = _clean_transcript(sc.input_transcription.text)
                            if txt:
                                in_buf.append(txt)
                                self._stream_transcript("You", " ".join(in_buf).strip(), is_final=False)

                        if sc.turn_complete:
                            if self._turn_done_event:
                                self._turn_done_event.set()

                            full_in = " ".join(in_buf).strip()
                            if full_in:
                                self.ui.write_log(f"You: {full_in}")
                                self.chat_history.append({"role": "user", "content": full_in})
                                self._stream_transcript("You", full_in, is_final=True)
                            in_buf = []

                            full_out = " ".join(out_buf).strip()
                            if full_out:
                                self.ui.write_log(f"Buddy: {full_out}")
                                self.chat_history.append({"role": "assistant", "content": full_out})
                                self._stream_transcript("Buddy", full_out, is_final=True)
                            out_buf = []

                            if full_in or full_out:
                                asyncio.create_task(self._sync_history_to_db())

                    if response.tool_call:
                        fn_responses = []
                        for fc in response.tool_call.function_calls:
                            print(f"[BUDDY] 📞 {fc.name}")
                            fr = await self._execute_tool(fc)
                            fn_responses.append(fr)
                        await self.session.send_tool_response(
                            function_responses=fn_responses
                        )
        except Exception as e:
            print(f"[BUDDY] ❌ Recv: {e}")
            traceback.print_exc()
            raise

    async def _play_audio(self):
        print("[BUDDY] 🔊 Play started")

        stream = None
        try:
            stream = sd.RawOutputStream(
                samplerate=RECEIVE_SAMPLE_RATE,
                channels=CHANNELS,
                dtype="int16",
                blocksize=CHUNK_SIZE,
            )
            stream.start()
        except Exception as e:
            print(f"[BUDDY] ⚠️ Local speaker not available: {e}")

        try:
            while True:
                try:
                    chunk = await asyncio.wait_for(
                        self.audio_in_queue.get(),
                        timeout=0.1
                    )
                except asyncio.TimeoutError:
                    if (
                        self._turn_done_event
                        and self._turn_done_event.is_set()
                        and self.audio_in_queue.empty()
                    ):
                        self.set_speaking(False)
                        self._turn_done_event.clear()
                        # Notify mobile client that speaking turn is finished
                        if self.mobile_websocket:
                            try:
                                await self.mobile_websocket.send(json.dumps({"type": "audio_end"}))
                            except Exception:
                                pass
                    continue
                
                self.set_speaking(True)
                
                # Stream audio chunk to mobile client if connected
                if self.mobile_websocket:
                    try:
                        b64_data = base64.b64encode(chunk).decode("utf-8")
                        await self.mobile_websocket.send(json.dumps({"type": "audio", "data": b64_data}))
                    except Exception as e:
                        print(f"[BUDDY] ⚠️ Error sending audio chunk to mobile: {e}")

                if stream is not None:
                    await asyncio.to_thread(stream.write, chunk)
        except Exception as e:
            print(f"[BUDDY] ❌ Play: {e}")
            raise
        finally:
            self.set_speaking(False)
            if stream is not None:
                stream.stop()
                stream.close()

    async def run(self):
        self._loop          = asyncio.get_event_loop()
        self.audio_in_queue = asyncio.Queue()
        self.out_queue      = asyncio.Queue(maxsize=200)
        self._turn_done_event = asyncio.Event()
        MobileVoiceServer.buddy_live = self
        
        # Start the persistent voice server immediately on startup
        asyncio.create_task(start_voice_server())

        client = genai.Client(
            api_key=_get_api_key(),
            http_options={"api_version": "v1beta"}
        )

        while True:
            try:
                print("[BUDDY] 🔌 Connecting to Gemini Live API...")
                self.ui.set_state("THINKING")
                config = self._build_config()

                async with (
                    client.aio.live.connect(model=LIVE_MODEL, config=config) as session,
                    asyncio.TaskGroup() as tg,
                ):
                    self.session        = session
                    print("[BUDDY] ✅ Connected to Gemini Live API.")
                    self.ui.set_state("MUTED" if self.ui.muted else "LISTENING")
                    self.ui.write_log("SYS: Buddy online.")

                    tg.create_task(self._send_realtime())
                    tg.create_task(self._listen_audio())
                    tg.create_task(self._receive_audio())
                    tg.create_task(self._play_audio())

            except Exception as e:
                print(f"[BUDDY] ⚠️ {e}")
                traceback.print_exc()
            self.session = None
            self.set_speaking(False)
            self.ui.set_state("THINKING")
            print("[BUDDY] 🔄 Reconnecting to Gemini Live API in 3s...")
            await asyncio.sleep(3)

class HeadlessUI:
    def __init__(self):
        self.on_text_command = None
        self.muted = False
        self.buddy = None
    def wait_for_api_key(self):
        pass
    def set_state(self, state):
        print(f"[STATUS] {state}")
        if self.buddy and getattr(self.buddy, "mobile_websocket", None):
            try:
                asyncio.run_coroutine_threadsafe(
                    self.buddy.mobile_websocket.send(json.dumps({
                        "type": "state",
                        "state": state
                    })),
                    self.buddy._loop
                )
            except Exception:
                pass
    def write_log(self, text):
        print(f"[LOG] {text}")
        if self.buddy and getattr(self.buddy, "mobile_websocket", None):
            try:
                asyncio.run_coroutine_threadsafe(
                    self.buddy.mobile_websocket.send(json.dumps({
                        "type": "log",
                        "text": text
                    })),
                    self.buddy._loop
                )
            except Exception:
                pass

def print_local_ips():
    import socket
    try:
        hostname = socket.gethostname()
        print(f"[BUDDY] 🖥️ Hostname: {hostname}")
        ips = []
        try:
            ips = socket.gethostbyname_ex(hostname)[2]
        except Exception:
            pass
        ips = [ip for ip in ips if not ip.startswith("127.")]
        
        # Primary interface connection fallback
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('10.255.255.255', 1))
            primary_ip = s.getsockname()[0]
            if primary_ip not in ips and not primary_ip.startswith("127."):
                ips.append(primary_ip)
        except Exception:
            pass
        finally:
            s.close()
            
        print("\n" + "="*60)
        print("📱 TO CONNECT A PHYSICAL MOBILE PHONE / APK:")
        print("1. Ensure phone is on the SAME Wi-Fi network as this computer.")
        print("2. Tap the settings/gear icon in the top-right of the app's Splash screen.")
        print("3. Enter this IP address in the configuration:")
        if ips:
            for ip in ips:
                print(f"   👉 {ip}:5001")
        else:
            print("   👉 [YOUR_COMPUTER_IP]:5001")
        print("4. Tap 'Save & Connect'.")
        print("="*60 + "\n")
    except Exception as e:
        print(f"[BUDDY] ⚠️ Local IP detection warning: {e}")

def main():
    print_local_ips()
    headless_mode = "--headless" in sys.argv
    if headless_mode:
        print("[BUDDY] 🚀 Starting in HEADLESS server mode...")
        ui = HeadlessUI()
        buddy = BuddyLive(ui)
        buddy.headless = True
        ui.buddy = buddy
        try:
            asyncio.run(buddy.run())
        except KeyboardInterrupt:
            print("\n🔴 Shutting down...")
            import os
            os._exit(0)
    else:
        ui = BuddyUI("face.png")

        def runner():
            ui.wait_for_api_key()
            buddy = BuddyLive(ui)
            buddy.headless = False
            ui.buddy = buddy
            try:
                asyncio.run(buddy.run())
            except KeyboardInterrupt:
                print("\n🔴 Shutting down...")
                import os
                os._exit(0)

        threading.Thread(target=runner, daemon=True).start()
        ui.root.mainloop()

if __name__ == "__main__":
    main()