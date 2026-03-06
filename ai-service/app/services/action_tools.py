from langchain_core.tools import tool
import requests
import logging

from config import NODE_BACKEND_URL

logger = logging.getLogger("Hey buddy")

# Using the internal Node.js endpoint discovered
NODE_ACTION_URL = f"{NODE_BACKEND_URL}/api/ai/action"
INTERNAL_SECRET = "buddy-internal-secret"

def get_action_tools(user_id: str):
    
    @tool
    def schedule_reminder(title: str, date: str, time: str, description: str = "", location: str = ""):
        """Schedule a dynamic reminder for the user. Provide the title, date (YYYY-MM-DD), time (HH:MM or HH:MM AM/PM), description, and location."""
        logger.info(f"Executing tool: schedule_reminder for {title}")
        headers = {"Authorization": f"Bearer {INTERNAL_SECRET}"}
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
    def save_memory(content: str, category: str):
        """Save an important memory, fact, preference or instruction about the user. Category can be general, preference, fact, health."""
        logger.info(f"Executing tool: save_memory: {content}")
        headers = {"Authorization": f"Bearer {INTERNAL_SECRET}"}
        payload = {
            "action": "SAVE_MEMORY",
            "userId": user_id,
            "value": {
                "content": content,
                "category": category
            }
        }
        try:
            res = requests.post(NODE_ACTION_URL, json=payload, headers=headers)
            return "Successfully saved memory" if res.status_code == 200 else f"Failed: {res.text}"
        except Exception as e:
            return f"Error: {e}"

    return [schedule_reminder, save_memory]
