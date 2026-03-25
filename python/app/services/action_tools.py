from langchain_core.tools import tool
import requests
import logging
import os

from config import NODE_BACKEND_URL

logger = logging.getLogger("Hey buddy")

# Using the internal Node.js endpoint discovered
NODE_ACTION_URL = f"{NODE_BACKEND_URL}/api/ai/action"

# SECURITY: Load the internal secret from the environment — never hardcode it.
# Set BUDDY_INTERNAL_SECRET in your .env to a long random string.
# Example: openssl rand -hex 32
_INTERNAL_SECRET = os.getenv("BUDDY_INTERNAL_SECRET", "")
if not _INTERNAL_SECRET:
    logger.warning(
        "[SECURITY] BUDDY_INTERNAL_SECRET is not set. "
        "Action tool calls to Node.js backend will fail or be unauthenticated. "
        "Set BUDDY_INTERNAL_SECRET=<random-secret> in your .env."
    )

def get_action_tools(user_id: str):
    
    @tool
    def schedule_reminder(title: str, date: str, time: str, description: str = "", location: str = ""):
        """Schedule a dynamic reminder for the user. Provide the title, date (YYYY-MM-DD), time (HH:MM or HH:MM AM/PM), description, and location. DO NOT use this tool if the user is just asking what their reminders are."""
        logger.info(f"Executing tool: schedule_reminder for {title}")
        headers = {"Authorization": f"Bearer {_INTERNAL_SECRET}"}
        payload = {
            "action": "CREATE_REMINDER",
            "userId": user_id,
            "value": {
                "title": title,
                "date": date,
                "time": time,
                "description": description,
                "location": location
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully scheduled reminder" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    @tool
    def update_reminder(reminder_id: str, title: str = None, date: str = None, time: str = None, description: str = "", location: str = ""):
        """Update an existing reminder. Provide the reminder_id found in context and any fields to change. DO NOT use this tool to answer questions about a reminder. ONLY use it if the user asks to CHANGE or UPDATE it."""
        logger.info(f"Executing tool: update_reminder for {reminder_id}")
        headers = {"Authorization": f"Bearer {_INTERNAL_SECRET}"}
        payload = {
            "action": "UPDATE_REMINDER",
            "userId": user_id,
            "id": reminder_id,
            "value": {
                "title": title,
                "date": date,
                "time": time,
                "description": description,
                "location": location
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully updated reminder" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    @tool
    def save_memory(content: str, category: str, file_url: str = None, file_name: str = None):
        """Save a NEW important memory, fact, or user preference. If saving an image, document, or file, pass its URL directly to file_url, and give it a helpful name in file_name. NEVER use this for reminders, tasks, or appointments. ONLY use this when the user tells you explicitly NEW information to remember or explicitly asks to save a file."""
        logger.info(f"Executing tool: save_memory: {content}")
        headers = {"Authorization": f"Bearer {_INTERNAL_SECRET}"}
        payload = {
            "action": "SAVE_MEMORY",
            "userId": user_id,
            "value": {
                "content": content,
                "category": category,
                "fileUrl": file_url,
                "fileName": file_name
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully saved memory" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    @tool
    def update_memory(memory_id: str, content: str, category: str = None):
        """Update an existing memory/fact. Provide the memory_id found in context and the new content or category. DO NOT use this to just repeat or retrieve the memory. ONLY use it if the user provides new details to CHANGE it."""
        logger.info(f"Executing tool: update_memory: {memory_id}")
        headers = {"Authorization": f"Bearer {_INTERNAL_SECRET}"}
        payload = {
            "action": "UPDATE_MEMORY",
            "userId": user_id,
            "id": memory_id,
            "value": {
                "content": content,
                "category": category
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully updated memory" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    @tool
    def schedule_location_reminder(title: str, location: str, description: str = "", date: str = "", time: str = ""):
        """Schedule a reminder tied to a specific location (geofence). Use this when a user says 'remind me at [place]'. DO NOT use this tool if the user is just asking about an existing location reminder."""
        logger.info(f"Executing tool: schedule_location_reminder for {title} at {location}")
        headers = {"Authorization": f"Bearer {_INTERNAL_SECRET}"}
        payload = {
            "action": "CREATE_LOCATION_REMINDER",
            "userId": user_id,
            "value": {
                "title": title,
                "location": location,
                "description": description,
                "date": date,
                "time": time
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully scheduled location reminder" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    @tool
    def save_document(title: str, content: str, summary: str = "", file_url: str = None):
        """Save a long-form document, extracted text, or analyzed image data. If saving an image, document, or file, pass its URL directly to file_url. ONLY use this when the user explicitly asks to 'save this' or upload it for later."""
        logger.info(f"Executing tool: save_document for {title}")
        headers = {"Authorization": f"Bearer {_INTERNAL_SECRET}"}
        payload = {
            "action": "CREATE_DOCUMENT",
            "userId": user_id,
            "value": {
                "title": title,
                "content": content,
                "summary": summary,
                "fileUrl": file_url
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully saved document" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    return [schedule_reminder, save_memory, update_reminder, update_memory, schedule_location_reminder, save_document]
