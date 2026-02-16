import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const RealtimeVoiceContext = createContext();

export const useRealtimeVoice = () => useContext(RealtimeVoiceContext);

export const RealtimeVoiceProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [isAiSpeaking, setIsAiSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');

    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const workletNodeRef = useRef(null);
    const streamRef = useRef(null);

    // Audio Player for AI Output
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);

    /**
     * Start the Realtime Session
     */
    const startSession = async () => {
        setTranscript('');
        try {
            // 1. Initialize Socket
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
            const socket = io(backendUrl, {
                auth: { token: localStorage.getItem('token') }
            });

            socket.on('connect', () => {
                console.log('[Socket] Connected to backend');
                setIsConnected(true);
            });

            socket.on('connect_error', (err) => {
                console.error('[Socket] Connection Error:', err.message);
                setIsConnected(false);
            });

            socket.on('disconnect', (reason) => {
                console.warn('[Socket] Disconnected:', reason);
                setIsConnected(false);
            });

            // Handle AI Audio Output
            socket.on('audio_out', (base64Audio) => {
                console.log('[Socket] Received audio chunk');
                handleIncomingAudio(base64Audio);
            });

            // Handle Client-side clear queue (interruption)
            socket.on('clear_audio_queue', () => {
                console.log('[Socket] Clearing audio queue (interruption)');
                audioQueueRef.current = [];
                setIsAiSpeaking(false);
            });

            socket.on('caption', (text) => setTranscript(prev => prev + text));

            socketRef.current = socket;

            // 2. Initialize Audio Context & Worklet
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            await audioContext.audioWorklet.addModule('/audio-processor.js');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const source = audioContext.createMediaStreamSource(stream);
            const workletNode = new AudioWorkletNode(audioContext, 'buddy-audio-processor');

            workletNode.port.onmessage = (event) => {
                // Send raw PCM data to backend via Socket
                if (socket.connected) {
                    socket.emit('audio_chunk', event.data);
                }
            };

            source.connect(workletNode);
            workletNode.connect(audioContext.destination); // Required for process() to run

            audioContextRef.current = audioContext;
            workletNodeRef.current = workletNode;
            streamRef.current = stream;
            setIsActive(true);

        } catch (error) {
            console.error('Failed to start realtime session:', error);
            toast.error("Microphone access or connection failed.");
        }
    };

    /**
     * Stop the session
     */
    const stopSession = useCallback(() => {
        socketRef.current?.disconnect();
        streamRef.current?.getTracks().forEach(track => track.stop());
        audioContextRef.current?.close();
        setIsActive(false);
        setIsConnected(false);
    }, []);

    /**
     * Handle AI Audio Playback
     */
    const handleIncomingAudio = (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        audioQueueRef.current.push(new Int16Array(bytes.buffer));
        if (!isPlayingRef.current) playNextInQueue();
    };

    const playNextInQueue = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsAiSpeaking(false);
            return;
        }

        isPlayingRef.current = true;
        setIsAiSpeaking(true);
        const chunk = audioQueueRef.current.shift();

        // Convert Int16 to Float32 for Web Audio API
        const float32 = new Float32Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) float32[i] = chunk[i] / 0x7FFF;

        const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
        buffer.getChannelData(0).set(float32);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);

        source.onended = playNextInQueue;
        source.start();
    };

    return (
        <RealtimeVoiceContext.Provider value={{
            isConnected,
            isActive,
            isAiSpeaking,
            transcript,
            startSession,
            stopSession
        }}>
            {children}
        </RealtimeVoiceContext.Provider>
    );
};
