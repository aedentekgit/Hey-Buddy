# Hey buddy Performance Architecture: The "Ultra-Fast" Secret

The "ultra-fast" performance of Hey buddy is achieved through a combination of cutting-edge hardware acceleration, optimized software architecture, and real-time streaming techniques.

Here is the technical breakdown of how it works, spanning both the backend server and the frontend client.

---

## 1. Groq LPU™ Inference Engine (The "Secret Sauce")
The primary reason for the speed is the use of **Groq's LPU (Language Processing Unit)**. Unlike traditional GPUs, Groq is purpose-built for Large Language Models (LLMs). 
* **Inference Speed:** It can generate hundreds of tokens per second.
* **Latency:** The "Time to First Token" (TTFT) is often as low as **200–500 milliseconds**, which makes the response feel instantaneous.

## 2. Multi-Key Fallback Strategy (Backend)
If a Groq API key gets rate-limited, this piece of code instantly switches to the next one so you never experience a delay. This "primary-first" loop guarantees maximum uptime.

*File: `app/services/groq_service.py`*
```python
def _invoke_llm(self, prompt: ChatPromptTemplate, messages: list, question: str) -> str:
    """Call the LLM using PRIMARY-FIRST fallback across all API keys."""
    n = len(self.llms)
    last_exc = None

    for i in range(n):
        llm = self.llms[i]
        try:
            # Compile the prompt and call the LLM
            chain = prompt | llm
            response = with_retry(
                lambda: chain.invoke({"history": messages, "question": question}),
                max_retries=2,
                initial_delay=0.5,
            )
            return response.content
        except Exception as e:
            last_exc = e
            # If it's a rate limit or failure, it simply loops to the next key (i+1)
            if i < n - 1:
                continue
            break

    raise AllGroqApisFailedError("All API services are temporarily unavailable.") from last_exc
```

## 3. Full-Stack SSE Streaming & Audio Chunking (Backend)
Instead of waiting for the full response, the server yields text word-by-word via **Server-Sent Events (SSE)**. 
While doing this, it constantly checks if a full sentence was completed. If so, it dispatches an async background job to generate the Text-to-Speech audio, and then embeds the resulting base64 audio chunk in the same streaming connection.

*File: `app/main.py`*
```python
def _stream_generator(session_id: str, chunk_iter, is_realtime: bool, tts_enabled: bool = False):
    """The core SSE (Server-Sent Events) generator for streaming chat responses."""
    
    # 1. Start the SSE Stream
    yield f"data: {json.dumps({'session_id': session_id, 'chunk': '', 'done': False})}\\n\\n"
    buffer = ""       
    audio_queue = []  # Background thread jobs calculating speech audio

    # 2. As words/tokens arrive from the Groq API
    for chunk in chunk_iter:
        if not chunk: continue

        # 3. FASTEST PART: Yield text token to UI instantly as it was generated
        yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\\n\\n"

        if tts_enabled:
            buffer += chunk
            # 4. Check if the text ends with punctuation forming a sentence
            sentences, buffer = _split_sentences(buffer)
            
            # Send complete sentences to background Edge-TTS worker pool
            for sent in sentences:
               audio_queue.append((_tts_pool.submit(_generate_tts_sync, sent, TTS_VOICE, TTS_RATE), sent))

            # 5. Check if previous audio jobs finished, and stream the base64 mp3 binary
            while audio_queue and audio_queue[0][0].done():
                fut, completed_sent = audio_queue.pop(0)
                audio = fut.result()
                b64 = base64.b64encode(audio).decode("ascii")
                yield f"data: {json.dumps({'audio': b64, 'sentence': completed_sent})}\\n\\n"
```

## 4. Real-Time Chat Rendering (Frontend)
The frontend uses lightweight Vanilla JavaScript (no heavy frameworks like React) for maximum speed. It reads the raw byte stream as chunks chunk arrive, instantly injecting the text into the HTML (simulating typing).

*File: `frontend/script.js`*
```javascript
async function sendMessage(text) {
    // 1. Post to streaming backend
    const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, tts: true })
    });

    // 2. Read raw byte stream (Server Sent Events)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        let sseBuffer += decoder.decode(value, { stream: true });
        
        // 3. Process every JSON payload packet immediately
        const lines = sseBuffer.split('\\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                
                // If it's pure text, update the UI bubble instantly
                if (data.chunk) {
                    messageBubble.textContent += data.chunk; 
                }
                // If it's an audio chunk, enqueue it for playing
                if (data.audio) {
                    ttsPlayer.enqueue(data.audio);
                }
            }
        }
    }
}
```

## 5. Background Audio Playing Queue (Frontend)
Because audio comes in chunks, you don't wait for a huge MP3 file to download. This queue allows Hey buddy to **start speaking the first sentence while the LLM is busy thinking about the second sentence**.

*File: `frontend/script.js`*
```javascript
class TTSPlayer {
    constructor() {
        this.queue = [];
        this.playing = false;
        this.audio = document.createElement('audio'); // Reused single audio element
    }

    enqueue(base64Audio) {
        this.queue.push(base64Audio);
        // Start playing immediately if not already playing
        if (!this.playing) this._playLoop();
    }

    async _playLoop() {
        this.playing = true;
        orb.setActive(true); // Triggers visual animation to sync with speaking

        while (this.queue.length > 0) {
            const b64 = this.queue.shift(); // Get next sentence component
            await this._playB64(b64);       // Wait for audio clip to finish
        }

        this.playing = false;
        orb.setActive(false);
    }

    _playB64(b64) {
        return new Promise(resolve => {
            this.audio.src = 'data:audio/mp3;base64,' + b64;
            this.audio.onended = resolve; // Move to next chunk automatically
            this.audio.play();
        });
    }
}
```

## Summary
By combining **Groq's fast inference**, **Server-Sent Events (SSE)** for zero-wait text streaming, **on-the-fly chunked Text-to-Speech generation**, and a **lightweight DOM update loop**, Hey buddy achieves its extremely low latency and smooth conversational design.
