import React, { useState, useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import voiceService from '../services/voiceService';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audio';
import { Mic, MicOff, Send, MessageSquare, Play, Square, Plus, ArrowUp, User, Sparkles, Brain, Clock, X, Image as ImageIcon, Loader2, Zap, History, ArrowLeft, Globe } from 'lucide-react';
import { getImageUrl } from '../utils/imageUrl';
import { config } from '../config/env';



const GeminiVoiceAssistant = ({ onToolCall, quickActions, onBack, language = 'en-US', onLanguageChange, user, onRegisterLoader }) => {
    // --- States ---
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [transcripts, setTranscripts] = useState([]);
    const [error, setError] = useState(null);
    const [volume, setVolume] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Restart session if language changes while active
    useEffect(() => {
        if (isActive && !isConnecting && sessionRef.current) {
            console.log('[Assistant] Language changed, resetting session...');
            cleanup();
            startAssistant(!isStandby, isStandby);
        }
    }, [language]);

    // Wake Word is OFF by default. User must start conversation to enable it (or we can add a toggle)
    // However, per user request "No background listening without user consent", we default to false.
    const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
    const [isWakeWordListening, setIsWakeWordListening] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [inputMode, setInputMode] = useState('idle'); // 'idle' | 'voice' | 'text'
    const [selectedImage, setSelectedImage] = useState(null); // { inlineData: { data: string, mimeType: string } }
    const [imagePreview, setImagePreview] = useState(null);
    const imagePreviewRef = useRef(null); // Added to track preview for callbacks
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const [isStandby, setIsStandby] = useState(false);
    const [streamingResponse, setStreamingResponse] = useState('');
    const fileInputRef = useRef(null);

    // --- Refs for managing session & audio ---
    const sessionRef = useRef(null);
    const connectingRef = useRef(false); // New lock ref
    const isMicPausedLocal = useRef(false); // Pauses mic stream without stopping tracks
    const shouldMuteResponseRef = useRef(false); // Mutes AI audio if input was text
    const conversationIdRef = useRef(null); // Persists the current conversation thread ID
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
    const manualStopRef = useRef(false);

    // --- Helpers ---
    const addTranscript = useCallback((type, text, image = null) => {
        if (!text?.trim() && !image) return;
        setTranscripts((prev) => [
            ...prev,
            {
                id: Math.random().toString(36).substr(2, 9),
                type,
                text,
                image,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    // Expose a function to BuddyAssistant so it can load history into the chat view
    useEffect(() => {
        if (onRegisterLoader) {
            onRegisterLoader((messages, convId) => {
                // messages: [{role: 'user'|'assistant', content: string}]
                const mapped = messages.map((m) => ({
                    id: Math.random().toString(36).substr(2, 9),
                    type: m.role === 'user' ? 'user' : 'ai',
                    text: m.content,
                    image: null,
                    timestamp: Date.now(),
                }));
                setTranscripts(mapped);
                if (convId) conversationIdRef.current = convId;
            });
        }
    }, [onRegisterLoader]);

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
        connectingRef.current = false;

        // 1. Disconnect audio graph
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }

        // 2. Stop all MediaStream tracks (RELEASES MIC)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                track.stop();
                console.log('[Media] Track stopped:', track.label);
            });
            streamRef.current = null;
        }

        // 3. Stop all playing AI audio
        stopAllAudio();

        // 4. Close Backend Socket
        if (sessionRef.current) {
            try {
                sessionRef.current.disconnect();
                console.log('[Socket] Session disconnected.');
            } catch (e) { }
            sessionRef.current = null;
        }
    }, [stopAllAudio]);

    const connectMicrophone = async () => {
        if (!sessionRef.current || streamRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const source = inputAudioCtxRef.current.createMediaStreamSource(stream);
            const analyser = inputAudioCtxRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const scriptProcessor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
                if (isMicPausedLocal.current) return;

                const inputData = e.inputBuffer.getChannelData(0);
                // Volume calc
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                setVolume(Math.sqrt(sum / inputData.length));

                if (sessionRef.current && sessionRef.current.connected) {
                    const int16Buffer = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        int16Buffer[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
                    }
                    sessionRef.current.emit('audio_chunk', int16Buffer.buffer);
                }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtxRef.current.destination);
            scriptProcessorRef.current = scriptProcessor;

            setInputMode('voice');
            shouldMuteResponseRef.current = false;
        } catch (err) {
            console.error("Mic Error:", err);
            setError("Microphone access denied.");
        }
    };

    const startAssistant = async (enableMic = true, standby = false) => {
        if (connectingRef.current) return;

        // If we are already connected but in standby, just request activation if standby=false
        if (isActive && sessionRef.current && isStandby && !standby) {
            console.log('[Assistant] 🚀 Manual activation from standby');
            sessionRef.current.emit('activate_agent'); // We might need to add this to backend
            setIsStandby(false);
            return;
        }

        connectingRef.current = true;
        setIsConnecting(true);
        setError(null);
        if (enableMic) setTranscripts([]);
        if (!isActive) setTranscripts([]);

        manualStopRef.current = false;

        try {
            // 1. Setup Audio Contexts
            if (!inputAudioCtxRef.current) {
                inputAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            }
            if (!outputAudioCtxRef.current) {
                outputAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            }

            await inputAudioCtxRef.current.resume();
            await outputAudioCtxRef.current.resume();

            if (enableMic) setIsWakeWordEnabled(true);

            // Connect to Backend Socket.io
            const token = localStorage.getItem('token');
            const backendUrl = config.BACKEND_URL;

            const socket = io(backendUrl, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            socket.on('connect', async () => {
                console.log('[Socket] Connected to Backend (Standby:', standby, ')');
                setIsActive(true);
                setIsStandby(standby);
                setIsConnecting(false);
                connectingRef.current = false;

                // Configure the agent with selected language and conversation context
                socket.emit('setup_agent', {
                    language,
                    conversationId: conversationIdRef.current,
                    standby
                });

                if (enableMic) {
                    await connectMicrophone();
                }

                setInputMode(prev => prev === 'voice' ? 'voice' : 'text');
                setIsThinking(false);
                setIsAISpeaking(false);
            });

            socket.on('audio_out', async (base64) => {
                if (outputAudioCtxRef.current) {
                    const ctx = outputAudioCtxRef.current;

                    // Resume context if suspended (browser policy)
                    if (ctx.state === 'suspended') {
                        await ctx.resume();
                    }

                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                    try {
                        const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
                        const sourceNode = ctx.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(ctx.destination);
                        sourceNode.onended = () => {
                            sourcesRef.current.delete(sourceNode);
                            if (sourcesRef.current.size === 0) setIsAISpeaking(false);
                        };

                        setIsThinking(false);
                        setIsAISpeaking(true);
                        sourceNode.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(sourceNode);
                    } catch (decodeErr) {
                        console.error('[Audio] Decoding failed:', decodeErr);
                    }
                }
            });

            socket.on('caption', (text) => {
                setIsThinking(false);
                currentOutputTranscription.current += text;
                setStreamingResponse(currentOutputTranscription.current);
            });

            socket.on('user_caption', (text) => {
                setIsThinking(false);
                currentInputTranscription.current = text;
            });

            socket.on('response_done', () => {
                if (currentInputTranscription.current) {
                    addTranscript('user', currentInputTranscription.current);
                    currentInputTranscription.current = '';
                }
                if (currentOutputTranscription.current) {
                    addTranscript('ai', currentOutputTranscription.current);
                    currentOutputTranscription.current = '';
                    setStreamingResponse('');
                }
                setIsThinking(false);
            });

            socket.on('conversation_updated', (data) => {
                if (data && data.conversationId) {
                    conversationIdRef.current = data.conversationId;
                }
            });

            socket.on('clear_audio_queue', () => {
                stopAllAudio();
                setIsAISpeaking(false);
                setIsThinking(false);
            });

            socket.on('wake_word_detected', (data) => {
                console.log('[Assistant] 🔔 Back-end detected Wake Word!');
                setIsStandby(false);
                setIsThinking(false);
                setIsAISpeaking(false);
                setInputMode('voice');
            });

            socket.on('connect_error', (err) => {
                console.error('[Socket] Connection error:', err);
                setError('Failed to connect to assistant service.');
                setIsConnecting(false);
                connectingRef.current = false;
                cleanup();
            });

            socket.on('disconnect', () => {
                console.log('[Socket] Disconnected');
                cleanup();
            });

            sessionRef.current = socket;

        } catch (err) {
            console.error('Failed to start assistant:', err);
            setError(err.message || 'Failed to start. Check your connection.');
            setIsConnecting(false);
            connectingRef.current = false;
        }
    };

    const stopAssistant = () => {
        manualStopRef.current = true;
        setIsWakeWordEnabled(false);
        setIsWakeWordListening(false);
        setIsStandby(false);
        cleanup();
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError("Please select a valid image file (JPG, PNG, WEBP).");
            return;
        }

        setIsProcessingImage(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result.split(',')[1];
            setSelectedImage({
                data: base64,
                mimeType: file.type
            });
            setImagePreview(event.target.result);
            imagePreviewRef.current = event.target.result;
            setIsProcessingImage(false);

            // Note: In backend mode, we don't sync the image immediately over socket.
            // It will be sent with the next text command.
        };
        reader.onerror = () => {
            setError("Failed to read image file.");
            setIsProcessingImage(false);
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        imagePreviewRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendText = async () => {
        if (!textInput.trim() && !selectedImage) return;

        // Ensure audio context is ready if user interacts
        if (outputAudioCtxRef.current?.state === 'suspended') {
            await outputAudioCtxRef.current.resume();
        }

        const text = textInput;
        const img = selectedImage;
        const preview = imagePreview;

        setTextInput('');
        clearImage();

        // IF ACTIVE: Use the Live session (Gemini Multimodal Live) for real-time voice output
        if (isActive && sessionRef.current && sessionRef.current.connected) {
            console.log('[Assistant] Sending text via Socket.io for voice response');
            sessionRef.current.emit('text_message', text);
            addTranscript('user', text, preview);
            setIsThinking(true);
            return;
        }

        // IF NOT ACTIVE: Fallback to REST API (No live voice/multimodal stream)
        addTranscript('user', text, img ? { inlineData: { data: img.data, mimeType: img.mimeType } } : null);
        setIsThinking(true);
        setTextInput(''); // Clear input immediately for speed feel

        try {
            const response = await voiceService.parseVoice(text, img, language, [], conversationIdRef.current);
            setIsThinking(false);

            if (response.success && response.data) {
                addTranscript('ai', response.data.reply);
                // Save the conversation ID for the next message
                if (response.meta?.conversationId) {
                    conversationIdRef.current = response.meta.conversationId;
                }

                // Play returned audio for personality consistency
                if (response.data.audio) {
                    try {
                        if (!outputAudioCtxRef.current) {
                            outputAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                        }
                        const ctx = outputAudioCtxRef.current;
                        if (ctx.state === 'suspended') await ctx.resume();

                        const audioBuffer = await decodeAudioData(decode(response.data.audio), ctx, 24000, 1);
                        const sourceNode = ctx.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(ctx.destination);

                        sourceNode.onended = () => {
                            sourcesRef.current.delete(sourceNode);
                            if (sourcesRef.current.size === 0) setIsAISpeaking(false);
                        };

                        setIsAISpeaking(true);
                        sourceNode.start(0);
                        sourcesRef.current.add(sourceNode);
                    } catch (audioErr) {
                        console.error('[Assistant] Failed to play response audio:', audioErr);
                    }
                }
            }
        } catch (err) {
            console.error("Text interaction failed:", err);
            setError("Failed to send message.");
        } finally {
            setIsThinking(false);
        }
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

    // --- Unified Wake Word Strategy (Backend Detection) ---
    const [isMicBlocked, setIsMicBlocked] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    useEffect(() => {
        const handleInteraction = () => setHasInteracted(true);
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    useEffect(() => {
        // Automatically start listening for Wake Word when component is idle
        // Only attempt if user has interacted at least once with the page
        if (!isActive && !isConnecting && !manualStopRef.current && hasInteracted) {
            setIsWakeWordEnabled(true);
            startAssistant(true, true).then(() => {
                setIsMicBlocked(false);
                console.log('[Assistant] Standby active and listening...');
            }).catch(err => {
                console.error('[Assistant] Auto-start standby failed:', err);
                if (err.message && (err.message.includes('denied') || err.message.includes('Permission'))) {
                    setIsMicBlocked(true);
                }
            });
        }
    }, [isActive, isConnecting, hasInteracted]);

    return (
        <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            backgroundColor: 'var(--bg-color)',
            fontFamily: 'var(--font-family)',
            overflow: 'hidden',
        }}>
            {/* 1. FLUTTER-STYLE HEADER */}
            <div style={{
                height: '64px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                zIndex: 50,
                position: 'relative',
                background: 'transparent',
            }}>
                {/* Left side: Back Button (Mobile only) */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    {isMobile && (
                        <div
                            onClick={() => onBack ? onBack() : window.history.back()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                borderRadius: '20px',
                                padding: '8px 16px',
                                cursor: 'pointer',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                                transition: 'all 0.2s ease'
                            }}
                            title="Go Back"
                            className="hover-lift"
                        >
                            <ArrowLeft size={16} strokeWidth={2.5} />
                            <span style={{
                                fontSize: '0.82rem',
                                fontWeight: '800',
                                letterSpacing: '0.04em'
                            }}>BACK</span>
                        </div>
                    )}
                </div>

                {/* Center: Language Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        padding: '6px 14px',
                        borderRadius: '16px',
                        border: '1px solid rgba(0,0,0,0.05)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                        <Globe size={14} color="var(--primary-color)" />
                        <select
                            value={language}
                            onChange={(e) => onLanguageChange?.(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                color: '#1e293b',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="en-US">English</option>
                            <option value="ta-IN">Tamil (தமிழ்)</option>
                            <option value="hi-IN">Hindi (हिंदी)</option>
                            <option value="te-IN">Telugu (తెలుగు)</option>
                            <option value="es-ES">Spanish</option>
                            <option value="fr-FR">French</option>
                        </select>
                    </div>
                </div>

                {/* Right side: Empty space or other actions */}
                <div style={{ width: '42px' }}></div>
            </div>

            {/* 2. CHAT AREA */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingBottom: isMobile ? '140px' : '170px'
                }}
            >
                <div style={{
                    width: '100%',
                    maxWidth: '840px',
                    padding: transcripts.length === 0 ? '0' : '20px 18px 40px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    minHeight: transcripts.length === 0 ? 'calc(100% - 72px)' : 'auto'
                }}>

                    {/* Flutter-style Idle Screen */}
                    {transcripts.length === 0 && (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px 20px 20px',
                            animation: 'fadeIn 0.6s ease',
                        }}>
                            {/* Removed brain icon and container as per user request */}

                            {/* "Hey Buddy!" title */}
                            <h1 style={{
                                fontSize: isMobile ? '2rem' : '2.4rem',
                                fontWeight: '800',
                                color: '#1e293b',
                                margin: '0 0 10px 0',
                                textAlign: 'center',
                                letterSpacing: '-0.02em'
                            }}>Hey Buddy!</h1>

                            {/* Subtitle */}
                            <p style={{
                                fontSize: '1rem',
                                color: isStandby ? 'var(--primary-color)' : (isMicBlocked ? '#ef4444' : (!hasInteracted ? 'var(--primary-color)' : '#94a3b8')),
                                fontWeight: '600',
                                margin: '0',
                                textAlign: 'center',
                                opacity: (isStandby || !hasInteracted) ? 0.8 : 1,
                                animation: (isStandby || !hasInteracted) ? 'pulse 2s infinite' : 'none',
                                cursor: !hasInteracted ? 'pointer' : 'default'
                            }} onClick={() => !hasInteracted && setHasInteracted(true)}>
                                {isStandby ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                        <Sparkles size={16} /> Listening for "Hey Buddy"
                                    </span>
                                ) : isMicBlocked ? (
                                    "Microphone blocked. Click Mic button to enable."
                                ) : !hasInteracted ? (
                                    "Click anywhere to activate Buddy"
                                ) : "Tap to speak or type below"}
                            </p>
                        </div>
                    )}

                    {/* Flutter-style Chat Messages */}
                    {transcripts.map((t, i) => {
                        const isUser = t.type === 'user';
                        return isUser ? (
                            /* USER bubble — right aligned, purple gradient */
                            <div key={t.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                animation: 'fadeIn 0.35s ease-out'
                            }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    color: 'white',
                                    padding: '13px 18px',
                                    borderRadius: '22px 22px 5px 22px',
                                    fontSize: '0.97rem',
                                    lineHeight: '1.6',
                                    fontWeight: '500',
                                    maxWidth: '78%',
                                    boxShadow: '0 4px 16px rgba(99,102,241,0.28)',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {t.image && (
                                        <div style={{ marginBottom: '8px', borderRadius: '10px', overflow: 'hidden' }}>
                                            <img src={t.image} alt="Visual" style={{ width: '100%', display: 'block', maxWidth: '260px' }} />
                                        </div>
                                    )}
                                    {t.text}
                                </div>
                            </div>
                        ) : (
                            /* BUDDY card — Flutter-style white card with BUDDY label */
                            <div key={t.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                animation: 'fadeIn 0.35s ease-out'
                            }}>
                                <div style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    padding: '16px 18px',
                                    maxWidth: '85%',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                                    border: '1px solid rgba(0,0,0,0.04)'
                                }}>
                                    {/* BUDDY label */}
                                    <div style={{
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        color: '#6366f1',
                                        letterSpacing: '0.08em',
                                        textTransform: 'uppercase',
                                        marginBottom: '8px'
                                    }}>BUDDY</div>
                                    {t.image && (
                                        <div style={{ marginBottom: '10px', borderRadius: '10px', overflow: 'hidden' }}>
                                            <img src={t.image} alt="Visual" style={{ width: '100%', display: 'block', maxWidth: '280px' }} />
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '1rem',
                                        color: '#1e293b',
                                        lineHeight: '1.65',
                                        fontWeight: '450',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}>{t.text}</div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Streaming AI Response */}
                    {streamingResponse && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            <div style={{
                                background: 'white',
                                borderRadius: '16px',
                                padding: '16px 18px',
                                maxWidth: '85%',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                                border: '1px solid rgba(0,0,0,0.04)'
                            }}>
                                <div style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '800',
                                    color: '#6366f1',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    marginBottom: '8px'
                                }}>BUDDY</div>
                                <div style={{
                                    fontSize: '1rem',
                                    color: '#1e293b',
                                    lineHeight: '1.65',
                                    fontWeight: '450',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>{streamingResponse}</div>
                            </div>
                        </div>
                    )}

                    {/* Typing Animation */}
                    {isActive && inputMode === 'text' && isMicPausedLocal.current && (
                        <div style={{ display: 'flex', padding: '8px 4px' }}>
                            <div style={{
                                padding: '12px 18px',
                                borderRadius: '24px',
                                borderBottomLeftRadius: '4px',
                                background: 'white',
                                display: 'flex',
                                gap: '6px'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', opacity: 0.6, animation: 'bounce 1s infinite' }} />
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', opacity: 0.6, animation: 'bounce 1s infinite', animationDelay: '0.2s' }} />
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', opacity: 0.6, animation: 'bounce 1s infinite', animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ textAlign: 'center', margin: '12px 0' }}>
                            <span style={{
                                padding: '10px 20px',
                                borderRadius: '14px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                border: '1px solid rgba(239, 68, 68, 0.1)'
                            }}>
                                {error}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. FLUTTER-STYLE INPUT BAR */}
            <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 18px 20px 18px',
                background: 'linear-gradient(to top, var(--bg-color) 75%, transparent)',
                zIndex: 100
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '840px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'max-width 0.5s ease'
                }}>
                    {/* Image Preview Area - Integrated */}
                    {(imagePreview || isProcessingImage) && (
                        <div style={{
                            alignSelf: 'center',
                            minWidth: isMobile ? '100%' : '400px',
                            background: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(15px)',
                            padding: '12px',
                            borderRadius: '20px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            border: '1px solid rgba(255,255,255,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            animation: 'slideUp 0.4s cubic-bezier(0.1, 0.9, 0.2, 1)'
                        }}>
                            {isProcessingImage ? (
                                <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                                    <Loader2 className="animate-spin" size={20} color="var(--primary-color)" />
                                </div>
                            ) : (
                                <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                                    <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                    <button
                                        onClick={clearImage}
                                        style={{
                                            position: 'absolute',
                                            top: '-6px',
                                            right: '-6px',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            background: '#1e293b',
                                            color: 'white',
                                            border: '1px solid white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <X size={12} strokeWidth={3} />
                                    </button>
                                </div>
                            )}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b' }}>Visual Input Attached</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: '600' }}>{isProcessingImage ? 'Analyzing structures...' : 'Ready for intelligence analysis'}</div>
                            </div>
                        </div>
                    )}

                    {/* Suggestions Chips - Premium Minimalist Chips */}
                    {!isActive && quickActions && quickActions.length > 0 && transcripts.length === 0 && (
                        <div className="quick-actions-scroll" style={{
                            display: 'flex',
                            gap: '12px',
                            justifyContent: isMobile ? 'flex-start' : 'center',
                            overflowX: 'auto',
                            padding: isMobile ? '8px 18px' : '4px 12px',
                            margin: isMobile ? '0 -18px' : '0',
                            width: isMobile ? 'calc(100% + 36px)' : '100%',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            WebkitOverflowScrolling: 'touch',
                        }}>
                            {quickActions.map((cmd, i) => (
                                <button key={i} onClick={cmd.action} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: isMobile ? '8px' : '10px',
                                    padding: isMobile ? '8px 14px' : '12px 20px',
                                    background: 'rgba(255, 255, 255, 0.85)',
                                    border: '1px solid rgba(0,0,0,0.04)',
                                    borderRadius: isMobile ? '12px' : '16px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    color: '#1e293b',
                                    fontSize: isMobile ? '0.8rem' : '0.9rem',
                                    fontWeight: '700',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    flexShrink: 0
                                }} className="hover-lift">
                                    <span style={{ color: 'var(--primary-color)', background: 'rgba(99, 102, 241, 0.08)', padding: isMobile ? '4px' : '6px', borderRadius: '8px', display: 'flex', transform: isMobile ? 'scale(0.9)' : 'scale(1)' }}>{cmd.icon}</span>
                                    {cmd.text}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Flutter-style pill input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isMobile ? '6px' : '10px',
                        padding: isMobile ? '6px 6px 6px 16px' : '10px 10px 10px 20px',
                        background: 'rgba(255, 255, 255, 0.85)',
                        border: '1px solid rgba(0,0,0,0.04)',
                        borderRadius: '100px',
                        width: '100%',
                        boxSizing: 'border-box',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
                    }}>
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleImageChange}
                        />

                        {/* Text field */}
                        <input
                            style={{
                                flex: 1,
                                height: '36px',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#1e293b',
                                fontSize: '1rem',
                                fontWeight: '500',
                                width: '100%',
                            }}
                            placeholder="Ask Buddy anything..."
                            value={textInput}
                            disabled={isActive && inputMode === 'voice'}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        />

                        {/* Right icons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* Image attach */}
                            <button onClick={() => fileInputRef.current?.click()} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '6px' }} className="hover-lift">
                                <ImageIcon size={20} />
                            </button>
                            {/* Mic */}
                            <button onClick={() => !isActive && startAssistant(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '6px' }} className="hover-lift">
                                <Mic size={20} />
                            </button>
                            {/* Send — Flutter purple paper-plane */}
                            <button
                                onClick={textInput.trim() ? handleSendText : (isActive && inputMode === 'voice' ? stopAssistant : () => { })}
                                style={{
                                    width: isMobile ? '36px' : '42px',
                                    height: isMobile ? '36px' : '42px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                    border: 'none',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                                    transition: 'all 0.25s ease',
                                    flexShrink: 0
                                }}
                                className="hover-lift"
                            >
                                {isActive && inputMode === 'voice' ? (
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        <div style={{ width: '3px', height: '13px', background: 'white', borderRadius: '4px', animation: 'bounce 0.8s infinite' }} />
                                        <div style={{ width: '3px', height: '13px', background: 'white', borderRadius: '4px', animation: 'bounce 0.8s infinite 0.2s' }} />
                                        <div style={{ width: '3px', height: '13px', background: 'white', borderRadius: '4px', animation: 'bounce 0.8s infinite 0.4s' }} />
                                    </div>
                                ) : (
                                    <Send size={18} strokeWidth={2.5} />
                                )}
                            </button>
                        </div>
                    </div>

                    <div style={{
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        textAlign: 'center',
                        paddingBottom: '4px',
                        fontWeight: '500',
                        letterSpacing: '0.01em',
                        opacity: 0.8
                    }}>
                        Buddy AI can make mistakes. Check important information.
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes float {
                    0%, 100% { transform: translate(-50%, 0); }
                    50% { transform: translate(-50%, -10px); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                .hover-lift {
                    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hover-lift:hover {
                    transform: translateY(-2px);
                }
                .hover-lift:active {
                    transform: translateY(1px);
                }
            `}</style>
        </div>
    );
};

export default GeminiVoiceAssistant;
