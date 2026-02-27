import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
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

    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);

    // Initialize Global Socket for Background Announcements
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const setupGlobalSocket = () => {
            if (socketRef.current) return;

            const backendUrl = envConfig.BACKEND_URL;
            const socket = io(backendUrl, {
                auth: { token }
            });

            socket.on('connect', () => {
                console.log('[GlobalSocket] 🟢 Connected for background alerts');
                setIsConnected(true);
            });

            socket.on('voice_alert', async (data) => {
                console.log('[GlobalSocket] 🔔 Voice Alert triggered:', data);
                try {
                    await resumeAudio();
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
                    console.error("Failed to generate voice alert:", e);
                }
            });

            socket.on('clear_audio_queue', () => {
                audioQueueRef.current = [];
                setIsAiSpeaking(false);
            });

            socketRef.current = socket;
        };

        setupGlobalSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [settings?.general?.language]); // Re-setup if language changes

    // Ensure AudioContext is ready (must be resumed on user interaction)
    const resumeAudio = async () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        }
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
    };

    // Attach resume to window clicks once
    useEffect(() => {
        const handleInteraction = () => {
            resumeAudio().catch(console.error);
        };
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    const handleIncomingAudio = async (base64) => {
        try {
            await resumeAudio();
            const bytes = decode(base64);
            const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);

            audioQueueRef.current.push(buffer);
            if (!isPlayingRef.current) playNextInQueue();
        } catch (err) {
            console.error('[GlobalAudio] Decoding failed:', err);
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

        source.onended = playNextInQueue;
        source.start();
    };

    return (
        <RealtimeVoiceContext.Provider value={{
            isConnected,
            isActive,
            isAiSpeaking,
            transcript,
            socket: socketRef.current
        }}>
            {children}
        </RealtimeVoiceContext.Provider>
    );
};
