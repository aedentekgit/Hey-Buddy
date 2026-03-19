import os
from langchain_groq import ChatGroq

groq_key = "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"
print("Testing deprecated Llama 3 70B model...")
try:
    llm = ChatGroq(groq_api_key=groq_key, model_name="llama3-70b-8192")
    res = llm.invoke("Hi")
    print("✅ Success!")
except Exception as e:
    print("❌ Failed:", e)
