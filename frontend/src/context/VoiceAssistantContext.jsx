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

    // Sync settings
    const language = settings?.general?.language || 'en-US';

    // Step 1 & 2: Capture & ASR (Speech-to-Text)
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onresult = (event) => {
            const results = Array.from(event.results);
            const currentTranscript = results
                .map(result => result[0].transcript)
                .join('');

            setTranscript(currentTranscript);

            // Step 3: Turn-taking (Detect end of speech)
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (currentTranscript.trim()) {
                    processInteraction(currentTranscript);
                    recognition.stop();
                }
            }, 1200); // 1.2s silence confirms turn end
        };

        recognition.onstart = () => setStatus('LISTENING');
        recognition.onend = () => {
            if (!isSpeakingRef.current && status === 'LISTENING') {
                setStatus('IDLE');
            }
        };

        recognitionRef.current = recognition;
    }, [language, status]);

    // State for external components to inhibit voice processing
    const [preventProcessing, setPreventProcessing] = useState(false);

    // Turn-taking logic with inhibit check
    const processInteraction = async (text) => {
        // Mute/Disable if we have preventProcessing (e.g. on Buddy page)
        if (preventProcessing) {
            console.log('[VoiceContext] Interaction inhibited because preventProcessing is true');
            return;
        }
        setStatus('PROCESSING');
        try {
            const result = await voiceService.parseVoice(text, language, conversationHistory, conversationId);
            if (result.success) {
                const { reply, voice_reply, type, data } = result.data;
                setConversationId(result.meta.conversationId);

                // Step 7 & 8: TTS & Playback
                await speak(voice_reply || reply);

                if (type === 'reminder') {
                    // Logic to show/route to reminder
                    navigate('/admin/reminders', { state: { parsedReminder: data } });
                }
            }
        } catch (error) {
            toast.error("I couldn't process that.");
            setStatus('IDLE');
        }
    };

    // Step 7 & 8: Convert text to speech and Play (Muted to favor Gemini)
    const speak = (text) => {
        return new Promise((resolve) => {
            console.log('[VoiceContext] speak() called (MUTED):', text);
            // window.speechSynthesis.speak(utterance) removed to ensure single-voice experience
            resolve();
        });
    };

    const toggleAssistant = async () => {
        if (status === 'LISTENING') {
            recognitionRef.current?.stop();
        } else {
            await initAudio();
            playWakeSound();
            recognitionRef.current?.start();
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
