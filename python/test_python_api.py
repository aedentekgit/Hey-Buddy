import requests
import json

payload = {
    "message": "What can you do?",
    "session_id": "testsession123",
    "tts": False,
    "user_id": "660c1d68a5c2f3b9abc12345",
    "provider": "anthropic",
    "model": "claude-3.5-sonnet",
    "api_key": "dummy_claude_key",
    "fallback_groq_key": "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",
    "api_keys": {
        "groq": "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",
        "gemini": "AIzaSyAi88SyHYA6-88wNv8Sa5k7AqhHvvo1YFM",
        "openai": "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",
        "claude": "dummy_claude_key",
        "deepseek": None
    }
}

try:
    print("Sending POST to local python server /chat/stream...")
    headers = {
        "X-API-KEY": "dev_secret",
        "Authorization": "Bearer dev_secret"
    }
    response = requests.post("http://localhost:8000/chat/stream", json=payload, stream=True, headers=headers)
    for line in response.iter_lines():
        if line:
            print("Received:", line.decode("utf-8"))
except Exception as e:
    print("Error:", e)
