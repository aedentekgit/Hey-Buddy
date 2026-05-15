"""
CONSENSUS SERVICE MODULE
========================

This service implements "Consensus Mode" — a premium feature that calls multiple
LLMs (e.g. Groq, Gemini, OpenAI) in parallel for the same question, then uses
a "Verifying LLM" to analyze all responses and synthesize a final, verified
consensus answer.

WHY CONSENSUS MODE:
  - Higher reliability: reduces hallucinations by cross-checking multiple models.
  - Better quality: synthesizes strengths from different architectures.
  - Confidence scoring: can identify when models disagree (and thus might be hallucinating).

FLOW:
  1. Receive question and history.
  2. Call 3+ LLMs in parallel (async).
  3. Collect all responses.
  4. Pass all responses to a fast LLM (Gemini Flash or Groq) with a "Synthesis Prompt".
  5. The synthesizing LLM produces the final verified answer.
"""

import logging
import asyncio
import time
from typing import List, Optional, Any
from app.services.groq_service import GroqService

logger = logging.getLogger("Hey buddy")

class ConsensusService:
    def __init__(self, groq_service: GroqService):
        """
        Initialize with an existing GroqService which already has multiple LLM clients.
        """
        self.groq_service = groq_service

    async def get_consensus_response(self, question: str, chat_history: List[tuple] = None, user_id: str = None) -> str:
        """
        Call multiple LLMs in parallel and synthesize a consensus answer.
        """
        t0 = time.perf_counter()
        
        # We need at least 2 models to do consensus.
        if len(self.groq_service.llms) < 2:
            logger.warning("[CONSENSUS] Less than 2 models available. Falling back to standard response.")
            return self.groq_service.get_response(question, chat_history, user_id=user_id)

        # 1. Prepare parallel tasks
        # We take up to 3 diverse models (e.g. first 3 in the list which might be Groq, Gemini, OpenAI)
        tasks = []
        models_used = []
        for i, llm in enumerate(self.groq_service.llms[:3]):
            provider = type(llm).__name__
            models_used.append(provider)
            
            # Create a clean prompt for this specific model
            prompt, messages, system_message = self.groq_service._build_prompt_and_messages(
                question, chat_history, user_id=user_id
            )
            
            # Wrap invoke in an async task
            # Note: langchain's invoke is usually sync, so we use run_in_executor
            tasks.append(self._async_invoke(llm, prompt, messages, system_message, question))

        logger.info(f"[CONSENSUS] Calling {len(tasks)} models in parallel: {models_used}")

        # 2. Execute in parallel
        try:
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            valid_responses = []
            for i, res in enumerate(responses):
                if isinstance(res, Exception):
                    logger.warning(f"[CONSENSUS] Model #{i+1} failed: {res}")
                elif res:
                    valid_responses.append(res)
            
            if not valid_responses:
                logger.error("[CONSENSUS] All parallel model calls failed.")
                return "I'm sorry, I encountered an error while trying to verify the information across multiple sources."

            if len(valid_responses) == 1:
                logger.info("[CONSENSUS] Only one model succeeded. Returning its response directly.")
                return valid_responses[0]

            # 3. Synthesize consensus
            logger.info(f"[CONSENSUS] Synthesizing final answer from {len(valid_responses)} responses...")
            
            synthesis_prompt = (
                "You are an expert fact-checker and synthesizer. "
                "Below are multiple independent responses to the same user question. "
                "Your task is to analyze them for accuracy, resolve any contradictions, "
                "and produce a single, comprehensive, and verified high-quality response. "
                "If the models disagree on a fact, highlight the most likely correct info or provide a nuanced view.\n\n"
                f"USER QUESTION: {question}\n\n"
                "INDEPENDENT RESPONSES:\n"
            )
            for i, res in enumerate(valid_responses, 1):
                synthesis_prompt += f"\n--- RESPONSE {i} ---\n{res}\n"
            
            synthesis_prompt += "\nFINAL VERIFIED ANSWER:"

            # Use the primary LLM (usually the fastest/best) for synthesis
            final_answer = self.groq_service.get_response(
                question=synthesis_prompt, 
                chat_history=[], # Don't need history for the synthesis step
                user_id=user_id
            )
            
            logger.info(f"[CONSENSUS] Done in {time.perf_counter() - t0:.3f}s")
            return final_answer

        except Exception as e:
            logger.error(f"[CONSENSUS] Error in parallel processing: {e}")
            return self.groq_service.get_response(question, chat_history, user_id=user_id)

    async def _async_invoke(self, llm, prompt, messages, system_message, question) -> str:
        """Helper to run a sync LLM invoke in a thread."""
        loop = asyncio.get_event_loop()
        def _call():
            formatted = prompt.format_messages(system_message=system_message, history=messages, question=question)
            res = llm.invoke(formatted)
            return self.groq_service.get_text_content(res.content)
            
        return await loop.run_in_executor(None, _call)
