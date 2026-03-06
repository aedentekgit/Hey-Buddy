import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from app.services.action_tools import get_action_tools
from dotenv import load_dotenv
import os

load_dotenv()

async def test():
    tools = get_action_tools("test-user-id")
    api_key = os.getenv("GEMINI_API_KEY")
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=api_key)
    llm_with_tools = llm.bind_tools(tools)
    tools_map = {t.name: t for t in tools}
    
    msgs = [
        SystemMessage(content="You can schedule reminders."),
        HumanMessage(content="Schedule a reminder to drink water tomorrow at 10 AM.")
    ]
    try:
        accumulated = None
        for chunk in llm_with_tools.stream(msgs):
            if accumulated is None:
                accumulated = chunk
            else:
                accumulated += chunk
        
        print("Accumulated tool calls:", accumulated.tool_calls)
        msgs.append(accumulated)
        for tc in accumulated.tool_calls:
            result = "Success"
            msgs.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))
            
        print("Calling again with tools!")
        for chunk in llm_with_tools.stream(msgs):
            print("Next chunk text:", chunk.content)

    except Exception as e:
        print("Exception:", type(e), e)

if __name__ == "__main__":
    asyncio.run(test())
