import os
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

def test_keys():
    groq_key = "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"
    gemini_key = "AIzaSyAi88SyHYA6-88wNv8Sa5k7AqhHvvo1YFM"
    openai_key = "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"
    
    # Test Groq
    try:
        print("Testing Groq...")
        llm = ChatGroq(groq_api_key=groq_key, model_name="llama-3.1-8b-instant")
        res = llm.invoke("Hi")
        print("✅ Groq Success:", type(res))
    except Exception as e:
        print("❌ Groq Failed:", e)

    # Test Gemini
    try:
        print("Testing Gemini...")
        llm2 = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=gemini_key)
        res2 = llm2.invoke("Hi")
        print("✅ Gemini Success:", type(res2))
    except Exception as e:
        print("❌ Gemini Failed:", e)

    # Test OpenAI
    try:
        print("Testing OpenAI...")
        llm3 = ChatOpenAI(model="gpt-4o-mini", openai_api_key=openai_key)
        res3 = llm3.invoke("Hi")
        print("✅ OpenAI Success:", type(res3))
    except Exception as e:
        print("❌ OpenAI Failed:", e)

test_keys()
