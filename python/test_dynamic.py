import asyncio
from app.models import ChatRequest
from app.services.chat_service import ChatService
from app.services.groq_service import GroqService
from app.services.realtime_service import RealtimeGroqService

async def test_dynamic():
    req = ChatRequest(
        message="Hello world",
        api_key="TEST_KEY",
        provider="groq",
        model="llama-3.3-70b-versatile"
    )
    print("Testing dynamic args:")
    print("message:", req.message)
    print("api_key:", getattr(req, "api_key", None))
    print("provider:", getattr(req, "provider", None))
    print("model:", getattr(req, "model", None))
    
    # Let's verify the change in chat_service
    # If the signature in process_message handles the dynamic args correctly, we're good
    print("Process message signature should contain api_key, provider, model")
    
if __name__ == "__main__":
    asyncio.run(test_dynamic())
