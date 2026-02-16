import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import { playWakeSound, initAudio } from '../utils/wakeSound';

const VoiceAssistantContext = createContext();

export const useVoiceAssistant = () => useContext(VoiceAssistantContext);

/**
 * Buddy 2.0 Voice Assistant Provider
 * Implements the 8-step Voice Interaction Lifecycle
 */
export const VoiceAssistantProvider = ({ children }) => {
    const { user } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    // States representing the interaction lifecycle
    const [status, setStatus] = useState('IDLE'); // IDLE, LISTENING, PROCESSING, SPEAKING
    const [transcript, setTranscript] = useState('');
    const [conversationHistory, setConversationHistory] = useState([]);
    const [conversationId, setConversationId] = useState(null);

    // Refs for engine persistence
    const recognitionRef = useRef(null);
    const isSpeakingRef = useRef(false);
    const silenceTimerRef = useRef(null);
    const isIntentionalStop = useRef(false);

    // Sync settings
    const language = settings?.general?.language || 'en-US';

    // Step 1 & 2: Capture & ASR (Speech-to-Text)
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (!recognitionRef.current) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onstart = () => setStatus('LISTENING');

            recognition.onerror = (event) => {
                console.error('[VoiceContext] Speech Recognition Error:', event.error);
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    isIntentionalStop.current = true;
                    setStatus('IDLE');
                    toast.error('Microphone access denied. Please check permissions.');
                }
            };

            recognition.onend = () => {
                // If it wasn't a manual stop, restart immediately to keep "mic on"
                if (!isIntentionalStop.current) {
                    console.log('[VoiceContext] Browser stopped mic. Restarting for continuity...');
                    setTimeout(() => {
                        try {
                            // Double-check intention after delay
                            if (!isIntentionalStop.current) {
                                recognition.start();
                            }
                        } catch (e) {
                            // Ignore errors if it's already started
                        }
                    }, 500); // Small delay to prevent CPU spinning
                } else {
                    // User explicitly stopped
                    if (!isSpeakingRef.current) {
                        setStatus('IDLE');
                    }
                }
            };
            recognitionRef.current = recognition;
        }

        const recognition = recognitionRef.current;
        recognition.lang = language;

        recognition.onresult = (event) => {
            const results = Array.from(event.results);
            const currentTranscript = results
                .map(result => result[0].transcript)
                .join('');

            setTranscript(currentTranscript);

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (currentTranscript.trim()) {
                    processInteraction(currentTranscript);
                    recognition.stop();
                }
            }, 1200);
        };

        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [language]); // Only recreate/update language. Status handling moved.

    // State for external components to inhibit voice processing
    const [preventProcessing, setPreventProcessing] = useState(false);

    // Turn-taking logic with inhibit check
    const processInteraction = async (text) => {
        // Mute/Disable if we have preventProcessing (e.g. on Buddy page)
        if (preventProcessing) {
            console.log('[VoiceContext] Interaction inhibited because preventProcessing is true');
            return;
        }
        try {
            const result = await voiceService.parseVoice(text, language, conversationHistory, conversationId);
            if (result.success) {
                const { reply, voice_reply, type, data } = result.data;
                setConversationId(result.meta.conversationId);

                await speak(voice_reply || reply);

                if (type === 'reminder') {
                    navigate('/admin/reminders', { state: { parsedReminder: data } });
                }
            }
        } catch (error) {
            toast.error("I couldn't process that.");
        } finally {
            setStatus('IDLE'); // Ensure we ALWAYS go back to IDLE
            setTranscript('');
        }
    };

    // Step 7 & 8: Convert text to speech and Play
    const speak = (text) => {
        return new Promise((resolve) => {
            console.log('[VoiceContext] speak() called:', text);

            // Native Browser TTS fallback for notifications/reminders
            if (window.speechSynthesis) {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = language;
                utterance.rate = 1.0;
                utterance.pitch = 1.0;

                utterance.onend = () => resolve();
                utterance.onerror = (e) => {
                    console.error('[VoiceContext] TTS Error:', e);
                    resolve();
                };

                window.speechSynthesis.speak(utterance);
            } else {
                resolve();
            }
        });
    };

    const toggleAssistant = async () => {
        if (status === 'LISTENING') {
            isIntentionalStop.current = true; // Mark as manual stop
            recognitionRef.current?.stop();
        } else {
            try {
                // EXPLICIT PERMISSION REQUEST
                await navigator.mediaDevices.getUserMedia({ audio: true });

                isIntentionalStop.current = false; // Mark as manual start
                await initAudio();
                playWakeSound();
                recognitionRef.current?.start();
            } catch (err) {
                console.error('Microphone permission denied:', err);
                toast.error('Please allow microphone access to use the assistant.');
            }
        }
    };

    const value = {
        status,
        transcript,
        setTranscript,
        language,
        conversationHistory,
        setConversationHistory,
        toggleAssistant,
        toggleListening: toggleAssistant, // Aliased for legacy components
        speak,
        setPreventProcessing,
        isListening: status === 'LISTENING',
        isProcessing: status === 'PROCESSING',
        isSpeaking: status === 'SPEAKING'
    };

    return (
        <VoiceAssistantContext.Provider value={value}>
            {children}
        </VoiceAssistantContext.Provider>
    );
};
