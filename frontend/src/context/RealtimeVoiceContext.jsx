import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { config as envConfig } from '../config/env';
import { decode, decodeAudioData } from '../utils/audio';
import { useSettings } from './SettingsContext';

const RealtimeVoiceContext = createContext();

export const useRealtimeVoice = () => useContext(RealtimeVoiceContext);

export const RealtimeVoiceProvider = ({ children }) => {
    const { settings } = useSettings();
    const [isConnected, setIsConnected] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);

    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const mediaStreamRef = useRef(null);
    const audioProcessorRef = useRef(null);
    const currentTranscriptRef = useRef('');

    // ── Audio Processing Setup ───────────────────────────────────────────────
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        }
        if (audioContextRef.current.state === 'suspended') {
            return audioContextRef.current.resume();
        }
        return Promise.resolve();
    }, []);

    // ── Socket Initialization ────────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const setupSocket = () => {
            if (socketRef.current && socketRef.current.connected) return;

            const backendUrl = envConfig.BACKEND_URL;
            const socket = io(backendUrl, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            socket.on('connect', () => {
                console.log('[RealtimeVoice] 🟢 Socket connected');
                setIsConnected(true);
                // Don't auto-setup agent on connect - wait for startSession to do it
                // This ensures fresh state for each session
            });

            socket.on('disconnect', () => {
                console.log('[RealtimeVoice] 🔴 Socket disconnected');
                setIsConnected(false);
                setIsActive(false);
                setIsRecording(false);
            });

            // ── Agent Event Handlers ──────────────────────────────────────
            socket.on('user_transcript', (text) => {
                console.log('[RealtimeVoice] 🎙️ Transcript:', text);
                currentTranscriptRef.current = text;
                setTranscript(text);
            });

            socket.on('caption', (chunk) => {
                setTranscript(prev => prev + chunk);
            });

            socket.on('turn_started', () => {
                console.log('[RealtimeVoice] ⏳ Turn started');
                setIsAiSpeaking(true);
            });

            socket.on('audio_out', (audioData) => {
                console.log('[RealtimeVoice] 🔊 Received audio chunk');
                handleIncomingAudio(audioData);
            });

            socket.on('buddy_response_audio', (audioData) => {
                handleIncomingAudio(audioData);
            });

            socket.on('response_done', () => {
                console.log('[RealtimeVoice] ✅ Response done');
                setIsAiSpeaking(false);
                setIsRecording(true); // Continue listening after response
            });

            socket.on('barge_in_detected', () => {
                console.log('[RealtimeVoice] 🔥 Barge-in detected');
                audioQueueRef.current = [];
                isPlayingRef.current = false;
                setIsAiSpeaking(false);
            });

            socket.on('clear_audio_queue', () => {
                console.log('[RealtimeVoice] 🛑 Clearing audio queue');
                audioQueueRef.current = [];
                isPlayingRef.current = false;
                setIsAiSpeaking(false);
            });

            socket.on('error', (err) => {
                console.error('[RealtimeVoice] ❌ Socket error:', err);
                setIsActive(false);
            });

            socket.on('stop_command', () => {
                console.log('[RealtimeVoice] ⏹️ Stop command received');
                audioQueueRef.current = [];
                isPlayingRef.current = false;
                setIsAiSpeaking(false);
                setIsActive(false);
            });

            socketRef.current = socket;
        };

        setupSocket();

        return () => {
            stopRecording();
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [settings?.general?.language]);

    // ── Background Voice Alert Handler ──────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || !socketRef.current) return;

        const handleVoiceAlert = async (data) => {
            console.log('[RealtimeVoice] 🔔 Voice Alert triggered:', data);
            try {
                await initAudioContext();
                const text = typeof data === 'string' ? data : data.text;
                const gender = data.gender || settings?.voicePreferences?.gender || 'female';
                const tone = data.tone || settings?.voicePreferences?.tone || 'soft';

                const url = `${envConfig.BACKEND_URL}/api/voice/preview-voice?text=${encodeURIComponent(text)}&gender=${gender}&tone=${tone}`;
                const res = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const resData = await res.json();
                if (resData.success && resData.audio) {
                    handleIncomingAudio(resData.audio);
                }
            } catch (e) {
                console.error('[RealtimeVoice] Failed to generate voice alert:', e);
            }
        };

        socketRef.current.on('voice_alert', handleVoiceAlert);

        return () => {
            if (socketRef.current) {
                socketRef.current.off('voice_alert', handleVoiceAlert);
            }
        };
    }, [settings?.voicePreferences?.gender, settings?.voicePreferences?.tone]);

    // ── Audio Queue Management ───────────────────────────────────────────────
    const handleIncomingAudio = async (base64) => {
        try {
            await initAudioContext();
            const bytes = decode(base64);
            const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);

            audioQueueRef.current.push(buffer);
            if (!isPlayingRef.current) playNextInQueue();
        } catch (err) {
            console.error('[RealtimeVoice] Audio decode failed:', err);
        }
    };

    const playNextInQueue = () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsAiSpeaking(false);
            return;
        }

        isPlayingRef.current = true;
        setIsAiSpeaking(true);
        const buffer = audioQueueRef.current.shift();

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
            setTimeout(playNextInQueue, 50); // Small delay between sentences
        };
        source.start();
    };

    // ── Recording Management ──────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        try {
            await initAudioContext();

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000
                }
            });

            mediaStreamRef.current = stream;
            setIsRecording(true);
            setIsActive(true);
            currentTranscriptRef.current = '';
            setTranscript('');

            // Create audio context for processing
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (e) => {
                if (!socketRef.current?.connected || !isRecording) return;

                const inputData = e.inputBuffer.getChannelData(0);
                // Convert to 16-bit PCM
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
                }
                // Convert to base64
                const buffer = new ArrayBuffer(pcmData.length * 2);
                const view = new DataView(buffer);
                for (let i = 0; i < pcmData.length; i++) {
                    view.setInt16(i * 2, pcmData[i], true);
                }
                const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

                socketRef.current.emit('audio_chunk', base64);
            };

            audioProcessorRef.current = processor;
            source.connect(processor);
            processor.connect(audioContext.destination);

            console.log('[RealtimeVoice] 🎤 Recording started');
        } catch (err) {
            console.error('[RealtimeVoice] Failed to start recording:', err);
            setIsRecording(false);
            setIsActive(false);
            throw err;
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (audioProcessorRef.current) {
            audioProcessorRef.current.disconnect();
            audioProcessorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        setIsRecording(false);
        console.log('[RealtimeVoice] ⏹️ Recording stopped');
    }, []);

    // ── Session Control ───────────────────────────────────────────────────────
    const startSession = useCallback(async () => {
        if (!socketRef.current?.connected) {
            console.error('[RealtimeVoice] Socket not connected');
            throw new Error('Not connected to server');
        }

        // Setup the agent with language before starting
        socketRef.current.emit('setup_agent', {
            language: settings?.general?.language || 'en-US',
            standby: false
        });

        try {
            await startRecording();
            // Activate the agent after recording starts
            socketRef.current.emit('activate_agent');
        } catch (err) {
            console.error('[RealtimeVoice] Failed to start session:', err);
            throw err;
        }
    }, [startRecording, settings?.general?.language]);

    const stopSession = useCallback(() => {
        stopRecording();
        setIsActive(false);
        setTranscript('');
        currentTranscriptRef.current = '';

        if (socketRef.current?.connected) {
            socketRef.current.emit('user_interruption');
        }

        console.log('[RealtimeVoice] 🛑 Session stopped');
    }, [stopRecording]);

    // ── Interrupt / Barge-in ──────────────────────────────────────────────────
    const interrupt = useCallback(() => {
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        setIsAiSpeaking(false);

        if (socketRef.current?.connected) {
            socketRef.current.emit('user_interruption');
        }
    }, []);

    // ── Text Message ──────────────────────────────────────────────────────────
    const sendTextMessage = useCallback((text) => {
        if (!socketRef.current?.connected) {
            console.error('[RealtimeVoice] Socket not connected');
            return;
        }
        socketRef.current.emit('text_message', text);
    }, []);

    // ── Resume AudioContext on User Interaction ───────────────────────────────
    useEffect(() => {
        const handleInteraction = () => {
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    return (
        <RealtimeVoiceContext.Provider value={{
            isConnected,
            isActive,
            isAiSpeaking,
            isRecording,
            transcript,
            socket: socketRef.current,
            startSession,
            stopSession,
            interrupt,
            sendTextMessage
        }}>
            {children}
        </RealtimeVoiceContext.Provider>
    );
};
