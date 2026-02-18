import React, { useState, useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import voiceService from '../services/voiceService';
import { createPcmBlob, decode, decodeAudioData } from '../utils/audio';
import { Mic, MicOff, Send, MessageSquare, Play, Square, Plus, ArrowUp, User, Sparkles, Brain, Clock, X, Image as ImageIcon, Loader2 } from 'lucide-react';

// --- Voice Orbit Component (Advanced 3D Spherical Visualizer) ---
const VoiceOrbit = ({ isActive, isThinking, isSpeaking, volume }) => {
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
        const particleCount = 1000;
        particles.current = Array.from({ length: particleCount }, () => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            return {
                baseTheta: theta,
                basePhi: phi,
                radius: 100 + Math.random() * 25, // Slightly tighter
                size: 1.2 + Math.random() * 1.5,  // Larger particles
                opacity: 0.5 + Math.random() * 0.4, // Higher base visibility
                colorPhase: Math.random() * Math.PI * 2
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
                let r = p.radius * sphereScale;
                let x = Math.sin(p.basePhi) * Math.cos(p.baseTheta + rotation.current.y);
                let y = Math.sin(p.basePhi + rotation.current.x) * Math.sin(p.baseTheta + rotation.current.y);
                let z = Math.cos(p.basePhi + rotation.current.x);
                return { finalX: x * r, finalY: y * r, finalZ: z * r, p };
            }).sort((a, b) => a.finalZ - b.finalZ);

            projected.forEach(({ finalX, finalY, finalZ, p }) => {
                const scale = (finalZ + 150) / 300;
                const alpha = Math.max(0, p.opacity * (scale + 0.1));

                // More vivid 'Power Amber'
                const hue = isThinking ? 42 : 36;
                const sat = 100;
                const light = 50 + Math.sin(Date.now() * 0.005 + p.colorPhase) * 20;

                ctx.beginPath();
                ctx.arc(
                    centerX + finalX * window.devicePixelRatio,
                    centerY + finalY * window.devicePixelRatio,
                    Math.max(0.1, p.size * (scale + 0.5) * window.devicePixelRatio),
                    0, 2 * Math.PI
                );
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;

                // Add a permanent glow effect to foreground particles
                if (scale > 0.8) {
                    ctx.shadowColor = `rgba(255, 140, 0, ${alpha * 0.8})`;
                    ctx.shadowBlur = 12 * (volume + 0.5);
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.fill();
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

const GeminiVoiceAssistant = ({ onToolCall, quickActions, onToggleHistory }) => {
    // --- States ---
    const [isActive, setIsActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [transcripts, setTranscripts] = useState([]);
    const [error, setError] = useState(null);
    const [volume, setVolume] = useState(0);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
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
            // Using the backend API for text/image interactions
            const response = await voiceService.parseVoice(text, img);

            if (response.success && response.data) {
                addTranscript('ai', response.data.reply);
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
            recognition.lang = 'en-US';

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
            {/* 1. PREMIUM HEADER */}
            <div style={{
                height: '72px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 40,
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(0,0,0,0.03)'
            }}>
                {/* Left: History Button */}
                <button
                    onClick={() => onToggleHistory?.(true)}
                    style={{
                        padding: '10px 14px',
                        borderRadius: '14px',
                        background: 'rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--text-main)',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <Clock size={16} />
                </button>

                {/* Center: Branding */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={18} style={{ color: 'var(--primary-color)' }} />
                        <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.25rem', letterSpacing: '-0.03em' }}>Buddy</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isActive ? '#10b981' : '#94a3b8',
                            boxShadow: isActive ? '0 0 8px #10b981' : 'none'
                        }} className={isActive ? "animate-pulse" : ""} />
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', letterSpacing: '0.05em' }}>
                            {isActive ? (inputMode === 'voice' ? 'Listening' : 'Active') : 'Idle'}
                        </span>
                    </div>
                </div>

                {/* Right: Profile */}
                <button style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    border: '1px solid rgba(0,0,0,0.05)',
                    background: 'rgba(0,0,0,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-sub)',
                    cursor: 'pointer'
                }}>
                    <User size={20} />
                </button>
            </div>

            {/* Orbit Animation UI - Only active if voice-related */}
            <div style={{
                position: 'fixed',
                top: '40%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: isMobile ? '350px' : '500px',
                zIndex: 5,
                pointerEvents: 'none',
                opacity: transcripts.length === 0 ? 1 : 0,
                transition: 'opacity 0.8s ease'
            }}>
                <VoiceOrbit
                    isActive={isActive && inputMode === 'voice'}
                    isThinking={isThinking}
                    isSpeaking={isAISpeaking}
                    volume={volume}
                />
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
                                    width: isActive ? '200px' : '120px',
                                    height: isActive ? '200px' : '120px',
                                    background: 'var(--primary-gradient)',
                                    borderRadius: '50%',
                                    filter: 'blur(100px)',
                                    opacity: isActive ? 0.35 : 0.1,
                                    transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />

                                {/* Orb removed for ultimate minimalism */}

                                <h1 style={{
                                    fontSize: isMobile ? '2rem' : '2.5rem',
                                    fontWeight: '800',
                                    color: 'var(--text-main)',
                                    marginBottom: '8px',
                                    textAlign: 'center',
                                    letterSpacing: '-0.03em'
                                }}>
                                    Buddy Assistant
                                </h1>
                                <p style={{
                                    fontSize: '1rem',
                                    color: 'var(--text-sub)',
                                    textAlign: 'center',
                                    fontStyle: 'italic',
                                    marginBottom: '32px'
                                }}>
                                    "Hey Buddy, what's new today?"
                                </p>

                                {/* Wake Word indicator */}
                                {!isActive && isWakeWordListening && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '14px 28px',
                                        borderRadius: '99px',
                                        background: 'white',
                                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                                        border: '1px solid rgba(0,0,0,0.03)',
                                        color: 'var(--primary-color)',
                                        fontSize: '0.9rem',
                                        fontWeight: '700'
                                    }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }} className="animate-pulse" />
                                        Say "Hey Buddy"
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Chat Messages */}
                    {transcripts.map((t, i) => (
                        <div key={t.id} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: t.type === 'user' ? 'flex-end' : 'flex-start',
                        }}>
                            <div style={{
                                maxWidth: isMobile ? '90%' : '85%',
                                padding: '14px 20px',
                                borderRadius: '24px',
                                fontSize: '1.05rem',
                                lineHeight: '1.55',
                                background: t.type === 'user' ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: t.type === 'ai' ? 'blur(10px)' : 'none',
                                color: t.type === 'user' ? 'white' : 'var(--text-main)',
                                borderBottomRightRadius: t.type === 'user' ? '4px' : '24px',
                                borderBottomLeftRadius: t.type === 'ai' ? '4px' : '24px',
                                border: '1px solid rgba(0,0,0,0.03)',
                                boxShadow: t.type === 'ai' ? '0 4px 20px -5px rgba(0,0,0,0.03)' : '0 10px 25px -5px rgba(99, 102, 241, 0.25)',
                                animation: 'slideUp 0.4s cubic-bezier(0, 0, 0.2, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}>
                                {t.image && (
                                    <img
                                        src={t.image}
                                        alt="User upload"
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '300px',
                                            borderRadius: '16px',
                                            objectFit: 'cover',
                                            border: t.type === 'user' ? '2px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.05)'
                                        }}
                                    />
                                )}
                                {t.text && <span>{t.text}</span>}
                            </div>
                        </div>
                    ))}

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

            {/* 3. FIXED BOTTOM INPUT BAR */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: isMobile ? '100%' : '90%',
                maxWidth: '920px', // Desktop max-width as requested
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: isMobile ? '12px 16px' : '20px 24px',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 12px)',
                background: 'linear-gradient(to top, var(--bg-color) 80%, transparent)',
                zIndex: 100, // Above everything
                boxSizing: 'border-box'
            }}>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '12px' : '16px'
                }}>

                    {/* Image Preview Area */}
                    {(imagePreview || isProcessingImage) && (
                        <div style={{
                            alignSelf: 'flex-start',
                            position: 'relative',
                            padding: '4px',
                            background: 'white',
                            borderRadius: '16px',
                            boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            animation: 'slideUp 0.3s ease-out'
                        }}>
                            {isProcessingImage ? (
                                <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Loader2 className="animate-spin" size={20} color="var(--primary-color)" />
                                </div>
                            ) : (
                                <div style={{ position: 'relative', width: '60px', height: '60px' }}>
                                    <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                    <button
                                        onClick={clearImage}
                                        style={{
                                            position: 'absolute',
                                            top: '-8px',
                                            right: '-8px',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                                        }}
                                    >
                                        <X size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            )}
                            <div style={{ paddingRight: '12px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)', display: 'block' }}>Image Attached</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>{isProcessingImage ? 'Analyzing...' : 'Ready to analyze'}</span>
                            </div>
                        </div>
                    )}

                    {/* Suggestions Chips - Responsive horizontal scroll */}
                    {!isActive && quickActions && quickActions.length > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: '10px',
                            overflowX: 'auto',
                            padding: '4px 2px',
                            maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                            scrollbarWidth: 'none'
                        }}>
                            {quickActions.map((cmd, i) => (
                                <button key={i} onClick={cmd.action} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 18px',
                                    background: 'white',
                                    border: '1px solid rgba(0,0,0,0.05)',
                                    borderRadius: '16px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    color: 'var(--text-main)',
                                    fontSize: '0.9rem',
                                    fontWeight: '600',
                                    boxShadow: '0 4px 12px -5px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s',
                                    flexShrink: 0
                                }}>
                                    <span style={{ opacity: 0.7 }}>{cmd.icon}</span> {cmd.text}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Main Input Pillar - High Precision Flexbox Layout */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        paddingLeft: '12px',
                        background: 'white',
                        border: '1px solid rgba(0,0,0,0.06)',
                        borderRadius: '32px',
                        boxShadow: '0 15px 35px -10px rgba(0,0,0,0.12)',
                        width: '100%',
                        boxSizing: 'border-box'
                    }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleImageChange}
                        />
                        {/* Plus button - Fixed Action Width */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                width: '44px',
                                height: '44px',
                                minWidth: '44px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(0,0,0,0.03)',
                                border: 'none',
                                color: 'var(--text-sub)',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}>
                            <Plus size={22} strokeWidth={2} />
                        </button>

                        {/* Input Field - Consumes remaining space */}
                        <input
                            style={{
                                flex: 1,
                                height: '44px',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-main)',
                                fontSize: '1.05rem',
                                fontFamily: 'inherit',
                                padding: '0 8px',
                                width: '100%', // Required for some browsers
                                minWidth: 0 // Safety for flex-basis
                            }}
                            placeholder="Message Buddy..."
                            value={textInput}
                            disabled={isActive && inputMode === 'voice'}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                        />

                        {/* Mic / Send Button - Fixed Action Width */}
                        <div style={{ display: 'flex', alignItems: 'center', minWidth: '44px' }}>
                            {textInput.trim() ? (
                                <button
                                    onClick={handleSendText}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '22px',
                                        background: 'var(--primary-gradient)',
                                        border: 'none',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)'
                                    }}
                                >
                                    <ArrowUp size={22} strokeWidth={2.5} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => isActive ? stopAssistant() : startAssistant(true)}
                                    style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '22px',
                                        background: isActive && inputMode === 'voice' ? '#ef4444' : 'rgba(99, 102, 241, 0.08)',
                                        border: 'none',
                                        color: isActive && inputMode === 'voice' ? 'white' : 'var(--primary-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        boxShadow: isActive && inputMode === 'voice' ? '0 0 25px rgba(239, 68, 68, 0.45)' : 'none'
                                    }}
                                >
                                    {isActive ? <Square size={18} fill="white" /> : <Mic size={22} strokeWidth={2} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
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
            `}</style>
        </div>
    );
};

export default GeminiVoiceAssistant;
