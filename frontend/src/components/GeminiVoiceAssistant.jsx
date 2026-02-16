
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audio';

const GeminiVoiceAssistant = ({ onToolCall }) => {
    // --- States ---
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [transcripts, setTranscripts] = useState([]);
    const [error, setError] = useState(null);
    const [volume, setVolume] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isWakeWordListening, setIsWakeWordListening] = useState(false);

    // --- Refs for managing session & audio ---
    const sessionRef = useRef(null);
    const inputAudioCtxRef = useRef(null);
    const outputAudioCtxRef = useRef(null);
    const streamRef = useRef(null);
    const sourcesRef = useRef(new Set());
    const nextStartTimeRef = useRef(0);
    const scriptProcessorRef = useRef(null);
    const analyserRef = useRef(null);

    // Transcriptions are built up iteratively
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    // --- Helpers ---
    const addTranscript = useCallback((type, text) => {
        if (!text.trim()) return;
        setTranscripts((prev) => [
            ...prev,
            {
                id: Math.random().toString(36).substr(2, 9),
                type,
                text,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    const stopAllAudio = useCallback(() => {
        sourcesRef.current.forEach((source) => {
            try { source.stop(); } catch (e) { }
        });
        sourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    const cleanup = useCallback(() => {
        setIsActive(false);
        setIsConnecting(false);

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { }
            sessionRef.current = null;
        }
        stopAllAudio();
    }, [stopAllAudio]);

    const startAssistant = async () => {
        if (isConnecting || isActive) return;
        setIsConnecting(true);
        setError(null);

        try {
            // 1. Setup Audio Contexts
            if (!inputAudioCtxRef.current) {
                inputAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioCtxRef.current) {
                outputAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            }

            // Resume context (browser security)
            await inputAudioCtxRef.current.resume();
            await outputAudioCtxRef.current.resume();

            // 2. Get Microphone
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Analyser for UI feedback
            const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
            const analyser = inputAudioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Use the API key from environment variables
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('VITE_GEMINI_API_KEY is not defined in .env file');
            }

            const ai = new GoogleGenAI({ apiKey });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: `You are Buddy, a helpful health and personal assistant.
                    You can set reminders, check health history, and analyze prescriptions.
                    You have a "Buddy Memory" where you store important facts the user tells you.
                    When a user asks a question about something you should know or remember (like "Where is my wallet?" or "What is my blood type?"), ALWAYS check both your reminders and your stored memories using list_reminders and list_memories / search_memories tools.
                    When a user asks about a medication, usage, or side effects, use the get_medication_info tool.
                    When a user asks for a health summary or oversight of their recent data, use the analyze_health_summary tool.
                    When a user asks to set a reminder, use the create_reminder tool.
                    When a user tells you a fact to remember, use the save_memory tool.
                    Always be professional, sympathetic, and concise.`,
                    tools: [
                        {
                            functionDeclarations: [
                                {
                                    name: 'create_reminder',
                                    description: 'Set a new medication or health reminder for the user.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            title: { type: 'STRING', description: 'The title or medication name' },
                                            time: { type: 'STRING', description: 'The time for the reminder (e.g. 08:00 PM)' },
                                            notes: { type: 'STRING', description: 'Additional instructions' }
                                        },
                                        required: ['title', 'time']
                                    }
                                },
                                {
                                    name: 'get_user_info',
                                    description: 'Get information about the current user and their active medications.',
                                    parameters: { type: 'OBJECT', properties: {} }
                                },
                                {
                                    name: 'save_memory',
                                    description: 'Save an important fact or piece of information about the user that they want you to remember.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            content: { type: 'STRING', description: 'The fact or information to remember' },
                                            category: { type: 'STRING', description: 'Optional category (health, personal, family, etc.)' }
                                        },
                                        required: ['content']
                                    }
                                },
                                {
                                    name: 'list_reminders',
                                    description: 'Fetch the list of current reminders for the user.',
                                    parameters: { type: 'OBJECT', properties: {} }
                                },
                                {
                                    name: 'delete_reminder',
                                    description: 'Delete a specific reminder by its ID or title.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            id: { type: 'STRING', description: 'The internal ID of the reminder (if known)' },
                                            title: { type: 'STRING', description: 'The title of the reminder to match' }
                                        },
                                        required: []
                                    }
                                },
                                {
                                    name: 'list_memories',
                                    description: 'Fetch the list of stored memories (buddy memories) for the user.',
                                    parameters: { type: 'OBJECT', properties: {} }
                                },
                                {
                                    name: 'delete_memory',
                                    description: 'Delete a specific memory by its ID or content fragment.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            id: { type: 'STRING', description: 'The internal ID of the memory (if known)' },
                                            query: { type: 'STRING', description: 'A snippet of the memory content to match' }
                                        },
                                        required: []
                                    }
                                },
                                {
                                    name: 'search_memories',
                                    description: 'Search for a specific piece of information in the users stored memories.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            query: { type: 'STRING', description: 'The search term or question to look for in memories' }
                                        },
                                        required: ['query']
                                    }
                                },
                                {
                                    name: 'get_medication_info',
                                    description: 'Get detailed information about a medication, including usage, side effects, and precautions.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            medication_name: { type: 'STRING', description: 'The name of the medication to look up' }
                                        },
                                        required: ['medication_name']
                                    }
                                },
                                {
                                    name: 'analyze_health_summary',
                                    description: 'Analyze the users recent health history by looking at their reminders, medications, and stored memories.',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            timeframe: { type: 'STRING', description: 'The timeframe to analyze (e.g. recent, last month)' }
                                        }
                                    }
                                }
                            ]
                        }
                    ],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        console.log('Gemini Session Opened');
                        setIsActive(true);
                        setIsConnecting(false);

                        // Start streaming audio data to Gemini
                        const scriptProcessor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);

                            // Simple volume calculation for visualization
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                            setVolume(Math.sqrt(sum / inputData.length));

                            const pcmBlob = createPcmBlob(inputData);
                            sessionPromise.then(session => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioCtxRef.current.destination);
                        scriptProcessorRef.current = scriptProcessor;
                    },
                    onmessage: async (message) => {
                        // Handle Audio Output
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioCtxRef.current) {
                            const ctx = outputAudioCtxRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const sourceNode = ctx.createBufferSource();
                            sourceNode.buffer = audioBuffer;
                            sourceNode.connect(ctx.destination);
                            sourceNode.onended = () => sourcesRef.current.delete(sourceNode);

                            sourceNode.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(sourceNode);
                        }

                        // Handle Tool Calls
                        const toolCall = message.toolCall;
                        if (toolCall && onToolCall) {
                            console.log('Gemini requested tool:', toolCall);
                            const results = [];
                            for (const call of toolCall.functionCalls) {
                                try {
                                    const result = await onToolCall(call.name, call.args);
                                    results.push({
                                        name: call.name,
                                        id: call.id,
                                        response: { result }
                                    });
                                } catch (e) {
                                    results.push({
                                        name: call.name,
                                        id: call.id,
                                        response: { error: e.message }
                                    });
                                }
                            }
                            const session = await sessionPromise;
                            session.sendToolResponse({ functionResponses: results });
                        }

                        // Handle Interruptions
                        if (message.serverContent?.interrupted) {
                            stopAllAudio();
                        }

                        // Handle Transcriptions
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        }

                        // Turn completion: finalize transcript entries
                        if (message.serverContent?.turnComplete) {
                            if (currentInputTranscription.current) {
                                addTranscript('user', currentInputTranscription.current);
                                currentInputTranscription.current = '';
                            }
                            if (currentOutputTranscription.current) {
                                addTranscript('ai', currentOutputTranscription.current);
                                currentOutputTranscription.current = '';
                            }
                        }
                    },
                    onerror: (e) => {
                        console.error('Gemini Error:', e);
                        setError('Connection error. Please check your API key and network.');
                        cleanup();
                    },
                    onclose: () => {
                        console.log('Gemini Session Closed');
                        cleanup();
                    },
                },
            });

            sessionRef.current = await sessionPromise;
        } catch (err) {
            console.error('Failed to start assistant:', err);
            setError(err.message || 'Failed to start. Check microphone permissions.');
            setIsConnecting(false);
        }
    };

    const stopAssistant = () => {
        cleanup();
    };

    // Auto-scroll transcripts
    const scrollRef = useRef(null);
    // Mobile detection
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcripts]);

    // --- Wake Word Detection ('Hey Buddy') ---
    useEffect(() => {
        let recognition = null;
        let shouldRestart = true;

        const startWakeWordRecognition = () => {
            if (isActive || isConnecting) return;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsWakeWordListening(true);
                // console.log('[Wake Word] Listening for "Hey Buddy"...');
            };

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript.toLowerCase())
                    .join('');

                if (transcript.includes('hey buddy')) {
                    console.log('[Wake Word] Detected "Hey Buddy"!');
                    shouldRestart = false;
                    recognition.stop();
                    startAssistant();
                }
            };

            recognition.onerror = (event) => {
                if (event.error === 'not-allowed') {
                    shouldRestart = false;
                    setIsWakeWordListening(false);
                }
            };

            recognition.onend = () => {
                if (shouldRestart && !isActive && !isConnecting) {
                    setTimeout(startWakeWordRecognition, 1000);
                } else {
                    setIsWakeWordListening(false);
                }
            };

            try { recognition.start(); } catch (e) { }
        };

        if (!isActive && !isConnecting) {
            startWakeWordRecognition();
        }

        return () => {
            shouldRestart = false;
            if (recognition) {
                try { recognition.stop(); } catch (e) { }
            }
        };
    }, [isActive, isConnecting, startAssistant]);

    return (
        <div className="flex flex-col gap-6" style={{ width: '100%' }}>
            {/* Visual Feedback Area */}
            <div className="flex flex-col items-center justify-center py-8 relative">
                {/* Wake Word Hint */}
                {!isActive && !isConnecting && isWakeWordListening && (
                    <div
                        className="wake-word-hint"
                        style={{
                            color: '#64748b',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            zIndex: 10
                        }}
                    >
                        <span className="pulse-dot" style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 8px #10b981'
                        }} />
                        Listening for "Hey Buddy"...
                    </div>
                )}
                <div className="relative flex items-center justify-center">
                    {/* Glowing Aura */}
                    <div
                        className={`absolute inset-0 rounded-full bg-blue-500/20 blur-3xl transition-all duration-300 ${isActive ? 'scale-150 opacity-100' : 'scale-0 opacity-0'}`}
                        style={{
                            transform: `scale(${1 + volume * 5})`,
                            borderRadius: '9999px',
                            zIndex: 0
                        }}
                    />

                    {/* Main Ring */}
                    <div
                        className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${isActive ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 bg-slate-800'}`}
                        style={{
                            width: isMobile ? '96px' : '128px',
                            height: isMobile ? '96px' : '128px',
                            borderRadius: '9999px',
                            borderWidth: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 300ms',
                            borderColor: isActive ? '#60a5fa' : '#334155',
                            backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : '#1e293b'
                        }}
                    >
                        {isActive ? (
                            <div className="flex gap-1 items-end h-8" style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '32px' }}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className="w-1.5 bg-blue-400 rounded-full transition-all duration-75"
                                        style={{
                                            width: '6px',
                                            backgroundColor: '#60a5fa',
                                            borderRadius: '9999px',
                                            height: `${Math.max(4, volume * 100 * (0.5 + Math.random()))}px`
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <svg
                                style={{
                                    width: isMobile ? '36px' : '48px',
                                    height: isMobile ? '36px' : '48px',
                                    color: '#64748b'
                                }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        )}
                    </div>
                </div>

                <div className="mt-6 text-center" style={{ marginTop: '24px', textAlign: 'center' }}>
                    {isConnecting ? (
                        <span style={{ color: '#60a5fa', fontWeight: 500 }}>Connecting to Gemini...</span>
                    ) : isActive ? (
                        <span style={{ color: '#4ade80', fontWeight: 500 }}>Listening... Go ahead, talk to me!</span>
                    ) : (
                        <span style={{ color: '#64748b', fontWeight: 500 }}>Ready when you are</span>
                    )}
                </div>
            </div>

            {/* Transcript Log */}
            <div
                ref={scrollRef}
                style={{
                    height: isMobile ? '160px' : '256px',
                    overflowY: 'auto',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '16px',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}
            >
                {transcripts.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontStyle: 'italic', textAlign: 'center', width: '100%' }}>
                        <div style={{ width: '100%' }}>No conversation yet...</div>
                    </div>
                ) : (
                    transcripts.map((t) => (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: t.type === 'user' ? 'flex-end' : 'flex-start' }}>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px', paddingLeft: '8px', paddingRight: '8px' }}>
                                {t.type === 'user' ? 'You' : 'Gemini'}
                            </span>
                            <div style={{
                                maxWidth: '85%',
                                padding: '8px 16px',
                                borderRadius: '16px',
                                fontSize: '14px',
                                backgroundColor: t.type === 'user' ? '#2563eb' : '#334155',
                                color: t.type === 'user' ? '#ffffff' : '#e2e8f0',
                                borderTopRightRadius: t.type === 'user' ? '0' : '16px',
                                borderTopLeftRadius: t.type === 'ai' ? '0' : '16px'
                            }}>
                                {t.text}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Error Message */}
            {
                error && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', padding: '12px', borderRadius: '12px', fontSize: '14px', textAlign: 'center' }}>
                        {error}
                    </div>
                )
            }

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
                {!isActive ? (
                    <button
                        onClick={startAssistant}
                        disabled={isConnecting}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '16px 32px',
                            borderRadius: '9999px',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            backgroundColor: isConnecting ? '#334155' : '#2563eb',
                            cursor: isConnecting ? 'not-allowed' : 'pointer',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            transition: 'all 200ms'
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Start Conversation
                    </button>
                ) : (
                    <button
                        onClick={stopAssistant}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '16px 32px',
                            borderRadius: '9999px',
                            fontWeight: 'bold',
                            color: '#ffffff',
                            backgroundColor: '#dc2626',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            transition: 'all 200ms'
                        }}
                    >
                        <svg style={{ width: '20px', height: '20px' }} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                        Stop Assistant
                    </button>
                )}
            </div>
        </div >
    );
};

export default GeminiVoiceAssistant;
