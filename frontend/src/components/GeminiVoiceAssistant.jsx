import React, { useState, useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import voiceService from '../services/voiceService';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audio';
import { Mic, MicOff, Send, MessageSquare, Play, Square, Plus, ArrowUp, User, Sparkles, Brain, Clock, X, Image as ImageIcon, Loader2 } from 'lucide-react';

// --- Voice Orbit Component (Interactive Square Visualizer) ---
const VoiceOrbit = ({ isActive, isThinking, isSpeaking, volume, hasContent }) => {
    const canvasRef = useRef(null);
    const particles = useRef([]);
    const frameRef = useRef(null);
    const rotation = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        let height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;

        // Higher particle density for clarity
        const particleCount = 800;
        particles.current = Array.from({ length: particleCount }, () => {
            return {
                x: Math.random() * 2 - 1, // Normalized -1 to 1
                y: Math.random() * 2 - 1, // Normalized -1 to 1
                z: Math.random() * 2 - 1,
                size: 1.5 + Math.random() * 2,
                opacity: 0.4 + Math.random() * 0.5,
                colorPhase: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.8
            };
        });

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            const centerX = width / 2;
            const centerY = height / 2;

            let rotationSpeed = 0.007;
            let sphereScale = 1;

            if (isThinking) rotationSpeed = 0.05;
            if (isSpeaking) sphereScale = 1 + Math.sin(Date.now() * 0.008) * 0.18;
            if (isActive) sphereScale += volume * 12;

            rotation.current.y += rotationSpeed;
            rotation.current.x += rotationSpeed * 0.4;

            const projected = particles.current.map(p => {
                let s = 120 * sphereScale;

                // Volume positioning for strictly square/cube alignment
                let x = p.x;
                let y = p.y;
                let z = p.z;

                // Standard rotation for depth but rendered as a sharp square
                const smoothY = rotation.current.y;
                const smoothX = rotation.current.x;

                let ty = y * Math.cos(smoothY) - z * Math.sin(smoothY);
                let tz = y * Math.sin(smoothY) + z * Math.cos(smoothY);
                y = ty; z = tz;

                let tx = x * Math.cos(smoothX) + z * Math.sin(smoothX);
                tz = -x * Math.sin(smoothX) + z * Math.cos(smoothX);
                x = tx; z = tz;

                return { finalX: x * s, finalY: y * s, finalZ: z * s, p };
            }).sort((a, b) => a.finalZ - b.finalZ);

            projected.forEach(({ finalX, finalY, finalZ, p }) => {
                const scale = (finalZ + 150) / 300;
                const alpha = Math.max(0, p.opacity * (scale + 0.1));

                // Theme Colors: Indigo/Purple
                const hue = isThinking ? 280 : 255;
                const sat = 85;
                const light = 65 + Math.sin(Date.now() * 0.005 + p.colorPhase) * 15;

                const particleSize = Math.max(0.5, p.size * (scale + 0.5) * window.devicePixelRatio);

                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;

                // Render as Squares
                ctx.fillRect(
                    centerX + finalX * window.devicePixelRatio - particleSize / 2,
                    centerY + finalY * window.devicePixelRatio - particleSize / 2,
                    particleSize,
                    particleSize
                );

                // Add a permanent glow effect to foreground particles
                if (scale > 0.8) {
                    ctx.shadowColor = `hsla(${hue}, 100%, 70%, ${alpha * 0.6})`;
                    ctx.shadowBlur = 10 * (volume + 0.4);
                } else {
                    ctx.shadowBlur = 0;
                }
            });

            frameRef.current = requestAnimationFrame(animate);
        };

        animate();
        return () => cancelAnimationFrame(frameRef.current);
    }, [isActive, isThinking, isSpeaking, volume]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
};

const GeminiVoiceAssistant = ({ onToolCall, quickActions, onToggleHistory, language = 'en-US', onLanguageChange, user, onRegisterLoader }) => {
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

    const startAssistant = async (enableMic = true) => {
        if (connectingRef.current) return;

        if (isActive && sessionRef.current) {
            if (enableMic && !streamRef.current) {
                await connectMicrophone();
            }
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
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

            const socket = io(backendUrl, {
                auth: { token },
                transports: ['websocket']
            });

            socket.on('connect', async () => {
                console.log('[Socket] Connected to Backend');
                setIsActive(true);
                setIsConnecting(false);
                connectingRef.current = false;

                // Configure the agent with selected language
                socket.emit('setup_agent', { language });

                if (enableMic) {
                    await connectMicrophone();
                }

                setInputMode(prev => prev === 'voice' ? 'voice' : 'text');
                setIsThinking(false);
                setIsAISpeaking(false);
            });

            socket.on('audio_out', async (base64) => {
                if (outputAudioCtxRef.current && !shouldMuteResponseRef.current) {
                    const ctx = outputAudioCtxRef.current;
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

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
                }
            });

            socket.on('caption', (text) => {
                setIsThinking(false);
                currentOutputTranscription.current += text;
            });

            socket.on('response_done', () => {
                if (currentOutputTranscription.current) {
                    addTranscript('ai', currentOutputTranscription.current);
                    currentOutputTranscription.current = '';
                }
                setIsThinking(false);
            });

            socket.on('clear_audio_queue', () => {
                stopAllAudio();
                setIsAISpeaking(false);
                setIsThinking(false);
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
        setIsWakeWordEnabled(false); // KILL SWITCH: Disable wake word loop
        setIsWakeWordListening(false);
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

        shouldMuteResponseRef.current = true;
        const text = textInput;
        const img = selectedImage;
        const preview = imagePreview;

        setTextInput('');
        clearImage();

        addTranscript('user', text, preview);
        setIsThinking(true);

        try {
            // Pass the current conversationId to continue the same thread
            const response = await voiceService.parseVoice(text, img, language, [], conversationIdRef.current);

            if (response.success && response.data) {
                addTranscript('ai', response.data.reply);
                // Save the conversation ID for the next message
                if (response.meta?.conversationId) {
                    conversationIdRef.current = response.meta.conversationId;
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

    // --- Wake Word Detection ('Hey Buddy') ---
    // --- Wake Word Detection ('Hey Buddy') ---
    useEffect(() => {
        // Master Kill Switch check
        if (!isWakeWordEnabled) {
            setIsWakeWordListening(false);
            return;
        }

        let recognition = null;
        let shouldRestart = true;
        let triggerAssistantAfterEnd = false;

        const startWakeWordRecognition = () => {
            if (isActive || isConnecting || !isWakeWordEnabled) return;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = language;

            recognition.onstart = () => {
                setIsWakeWordListening(true);
            };

            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript.toLowerCase())
                    .join('');

                if (transcript.includes('hey buddy')) {
                    console.log('[Wake Word] Detected "Hey Buddy"!');
                    shouldRestart = false;
                    triggerAssistantAfterEnd = true;
                    recognition.stop();
                }
            };

            recognition.onerror = (event) => {
                if (event.error === 'not-allowed') {
                    shouldRestart = false;
                    setIsWakeWordListening(false);
                    // If permission denied, disable system
                    setIsWakeWordEnabled(false);
                }
            };

            recognition.onend = () => {
                setIsWakeWordListening(false);
                if (triggerAssistantAfterEnd) {
                    startAssistant();
                } else if (shouldRestart && !isActive && !isConnecting && isWakeWordEnabled && !manualStopRef.current) {
                    setTimeout(startWakeWordRecognition, 300);
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
    }, [isActive, isConnecting, isWakeWordEnabled]); // Added isWakeWordEnabled dependency

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
            {/* 1. PROFESSIONAL INTEGRATED HEADER */}
            <div style={{
                height: '64px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 50,
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(30px) saturate(180%)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
            }}>
                {/* Left: History & Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => onToggleHistory?.(true)}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'rgba(99, 102, 241, 0.05)',
                            border: '1px solid rgba(99, 102, 241, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        className="hover-lift"
                        title="Conversation History"
                    >
                        <Clock size={18} />
                    </button>

                    <div style={{ height: '24px', width: '1px', background: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isActive ? '#10b981' : '#94a3b8',
                            boxShadow: isActive ? '0 0 10px rgba(16, 185, 129, 0.4)' : 'none'
                        }} className={isActive ? "animate-pulse" : ""} />
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: 'var(--text-sub)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            {isActive ? (inputMode === 'voice' ? 'Synthesizing voice' : 'Neural Active') : 'System Idle'}
                        </span>
                    </div>
                </div>


                {/* Right: Profile Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        background: 'white',
                        flexShrink: 0
                    }}>
                        {user?.profilePicture ? (
                            <img
                                src={user.profilePicture.startsWith('http') ? user.profilePicture : `${import.meta.env.VITE_BACKEND_URL}${user.profilePicture}`}
                                alt={user?.name || 'Profile'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1rem', fontWeight: '700' }}>
                                {user?.name ? user.name.charAt(0).toUpperCase() : <User size={20} />}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. DYNAMIC VISUALIZER DASHBOARD - only visible when no chat */}
            {transcripts.length === 0 && (
                <div style={{
                    position: 'fixed',
                    top: '42%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '100%',
                    maxWidth: '600px',
                    height: isMobile ? '350px' : '500px',
                    zIndex: 5,
                    pointerEvents: 'none',
                    opacity: 1,
                    transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <VoiceOrbit isActive={isActive && inputMode === 'voice'} isThinking={isThinking} isSpeaking={isAISpeaking} volume={volume} hasContent={false} />
                </div>
            )}

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
                    paddingBottom: isMobile ? '120px' : '160px' // Ensure messages clear the fixed bar
                }}
            >
                <div style={{
                    width: '100%',
                    maxWidth: '840px',
                    padding: transcripts.length === 0 ? '0' : '20px 24px 40px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    minHeight: transcripts.length === 0 ? 'calc(100% - 72px)' : 'auto'
                }}>

                    {/* Empty State visualizer */}
                    {transcripts.length === 0 && (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '40px 20px',
                            animation: 'fadeIn 0.8s ease',
                            zIndex: 10
                        }}>
                            <div style={{ position: 'relative', marginBottom: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {/* Soft Background Glow */}
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: isActive ? '240px' : '160px',
                                    height: isActive ? '240px' : '160px',
                                    background: 'var(--primary-gradient)',
                                    borderRadius: '16px',
                                    filter: 'blur(60px)',
                                    boxShadow: '0 0 40px rgba(99, 102, 241, 0.4)',
                                    opacity: isActive ? 0.5 : 0.2,
                                    transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />

                                {/* Ultimate Minimalism Dashboard Core */}
                                <div style={{
                                    width: '320px',
                                    height: '320px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative'
                                }}>

                                    {/* Core Background Glow */}
                                    <div style={{
                                        width: isActive ? '280px' : '200px',
                                        height: isActive ? '280px' : '200px',
                                        background: 'var(--primary-gradient)',
                                        borderRadius: '40px',
                                        filter: 'blur(80px)',
                                        opacity: isActive ? 0.45 : 0.12,
                                        transition: 'all 1.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat Bubble Conversation Flow */}
                    {transcripts.map((t, i) => {
                        const isUser = t.type === 'user';
                        return (
                            <div key={t.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isUser ? 'flex-end' : 'flex-start',
                                gap: '4px',
                                padding: '6px 0',
                                animation: 'fadeIn 0.4s ease-out'
                            }}>
                                {/* Sender label */}
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    color: isUser ? '#6366f1' : '#94a3b8',
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                    paddingLeft: isUser ? 0 : '4px',
                                    paddingRight: isUser ? '4px' : 0,
                                }}>
                                    {isUser ? 'You' : 'Buddy AI'}
                                </span>

                                {/* Bubble row with avatar */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    gap: '8px',
                                    flexDirection: isUser ? 'row-reverse' : 'row',
                                    maxWidth: '75%'
                                }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        background: isUser ? 'rgba(99,102,241,0.1)' : 'var(--primary-gradient)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isUser ? '#6366f1' : 'white',
                                        boxShadow: isUser ? 'none' : '0 2px 8px rgba(99,102,241,0.25)',
                                        fontSize: '0.75rem',
                                        fontWeight: '700'
                                    }}>
                                        {isUser ? <User size={14} /> : <Sparkles size={14} />}
                                    </div>

                                    {/* Bubble */}
                                    <div style={{
                                        background: isUser
                                            ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                            : 'white',
                                        color: isUser ? 'white' : '#1e293b',
                                        padding: '12px 16px',
                                        borderRadius: isUser
                                            ? '20px 20px 4px 20px'
                                            : '20px 20px 20px 4px',
                                        fontSize: '0.97rem',
                                        lineHeight: '1.65',
                                        fontWeight: '450',
                                        boxShadow: isUser
                                            ? '0 4px 14px rgba(99,102,241,0.25)'
                                            : '0 2px 12px rgba(0,0,0,0.06)',
                                        wordBreak: 'break-word'
                                    }}>
                                        {t.image && (
                                            <div style={{
                                                marginBottom: '8px',
                                                borderRadius: '10px',
                                                overflow: 'hidden',
                                                maxWidth: '280px'
                                            }}>
                                                <img
                                                    src={t.image}
                                                    alt="Visual context"
                                                    style={{ width: '100%', display: 'block' }}
                                                />
                                            </div>
                                        )}
                                        {t.text && (
                                            <div style={{ whiteSpace: 'pre-wrap' }}>
                                                {t.text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

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

            {/* 3. PROFESSIONAL COMMAND CENTER INPUT (SCREENSOT STYLE) */}
            <div style={{
                position: 'fixed',
                bottom: '0',
                left: '0',
                right: '0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '24px 24px 16px 24px',
                background: 'linear-gradient(to top, white 80%, rgba(255,255,255,0))',
                zIndex: 100
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: transcripts.length === 0 ? '720px' : '840px', // Wider when chatting
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
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
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'center',
                            overflowX: 'auto',
                            padding: '4px',
                            maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent 100%)',
                            scrollbarWidth: 'none'
                        }}>
                            {quickActions.map((cmd, i) => (
                                <button key={i} onClick={cmd.action} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 20px',
                                    background: 'rgba(255, 255, 255, 0.85)',
                                    border: '1px solid rgba(0,0,0,0.04)',
                                    borderRadius: '16px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    color: '#1e293b',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    flexShrink: 0
                                }} className="hover-lift">
                                    <span style={{ color: 'var(--primary-color)', background: 'rgba(99, 102, 241, 0.08)', padding: '6px', borderRadius: '8px', display: 'flex' }}>{cmd.icon}</span>
                                    {cmd.text}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Command Pill */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        background: 'white',
                        border: '1px solid rgba(0,0,0,0.12)',
                        borderRadius: '100px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                        width: '100%',
                        boxSizing: 'border-box'
                    }}>
                        {/* Plus button on left */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleImageChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                transition: 'color 0.2s',
                                border: 'none',
                                background: 'none'
                            }}
                            className="hover-lift"
                        >
                            <Plus size={22} strokeWidth={2.5} />
                        </button>

                        <input
                            style={{
                                flex: 1,
                                height: '40px',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#1e293b',
                                fontSize: '1.05rem',
                                fontWeight: '500',
                                width: '100%',
                                paddingLeft: '4px'
                            }}
                            placeholder="Ask anything"
                            value={textInput}
                            disabled={isActive && inputMode === 'voice'}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        />

                        {/* Right Action Stack (Screenshot Style) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingRight: '8px', borderRight: '1px solid rgba(0,0,0,0.06)', marginRight: '8px' }}>
                                {/* Attach icon */}
                                <ImageIcon size={20} style={{ color: '#64748b', cursor: 'pointer' }} className="hover-lift" onClick={() => fileInputRef.current?.click()} />
                                {/* Mic icon */}
                                <Mic size={20} style={{ color: '#64748b', cursor: 'pointer' }} className="hover-lift" onClick={() => !isActive && startAssistant(true)} />
                            </div>

                            {/* Blue Circle Send Button */}
                            <button
                                onClick={textInput.trim() ? handleSendText : (isActive && inputMode === 'voice' ? stopAssistant : () => { })}
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: '#3b82f6', // Solid professional blue
                                    border: 'none',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                                className="hover-lift"
                            >
                                {isActive && inputMode === 'voice' ? (
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        <div style={{ width: '3px', height: '14px', background: 'white', borderRadius: '4px', animation: 'bounce 0.8s infinite' }} />
                                        <div style={{ width: '3px', height: '14px', background: 'white', borderRadius: '4px', animation: 'bounce 0.8s infinite 0.2s' }} />
                                        <div style={{ width: '3px', height: '14px', background: 'white', borderRadius: '4px', animation: 'bounce 0.8s infinite 0.4s' }} />
                                    </div>
                                ) : (
                                    <ArrowUp size={22} strokeWidth={3} />
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
