import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import api from '../services/api';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import { playWakeSound, initAudio } from '../utils/wakeSound';

const VoiceAssistantContext = createContext();

export const useVoiceAssistant = () => useContext(VoiceAssistantContext);

export const VoiceAssistantProvider = ({ children }) => {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [isListening, setIsListening] = useState(false);
    const [isAmbient, setIsAmbient] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [language, setLanguage] = useState('en-US');
    const [wakeWordMode, setWakeWordMode] = useState(true);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isConversationMode, setIsConversationMode] = useState(false);
    const [conversationHistory, setConversationHistory] = useState([]);
    const [preventProcessing, setPreventProcessing] = useState(false);

    const recognitionRef = useRef(null);
    const isListeningRef = useRef(false);
    const isSpeakingRef = useRef(false);
    const isUnlockedRef = useRef(false);
    const navigate = useNavigate();
    const location = useLocation();
    const micStuckCounterRef = useRef(0);
    const lastErrorTimeRef = useRef(0);
    const isRestartingRef = useRef(0);
    const isRestartingFlagRef = useRef(false);
    const inactivePromptCountRef = useRef(0);
    const lastInteractionTimeRef = useRef(Date.now());
    const isConversationModeRef = useRef(false);

    const [listeningDuration, setListeningDuration] = useState(1500); // 1.5s silence gap
    const silenceTimerRef = useRef(null);

    // Sync with global settings
    useEffect(() => {
        if (settings?.general?.language) {
            setLanguage(settings.general.language);
        }
    }, [settings]);

    // Helper to start recognition safely with retry logic
    const ensureRecognition = (retryCount = 0) => {
        if (!recognitionRef.current) return;
        if (!wakeWordMode) return;
        if (isSpeakingRef.current) return;
        if (isListeningRef.current) return; // Don't interrupt active listening

        // COOLDOWN CHECK
        const now = Date.now();
        if (now - lastErrorTimeRef.current < 1000 || isRestartingFlagRef.current) {
            return;
        }

        try {
            recognitionRef.current.start();
        } catch (e) {
            // If already started, we are good. Don't retry.
            if (e.name === 'InvalidStateError' || e.message?.includes('InvalidStateError')) {
                console.log("🎤 Mic already running (InvalidStateError). Skipping start.");
                return;
            }

            if (retryCount < 5) {
                const delay = 300 + (retryCount * 200);
                console.log(`🎤 Mic start pending (${e.name}), retry ${retryCount + 1}...`);
                setTimeout(() => ensureRecognition(retryCount + 1), delay);
            } else {
                console.warn("🎤 Mic failed to start. Hard reset.");
                try { recognitionRef.current.abort(); } catch (err) { }
            }
        }
    };

    // Unlock Audio
    useEffect(() => {
        const unlock = async () => {
            if (isUnlockedRef.current) return;
            try {
                await initAudio();
                if (navigator.vibrate) navigator.vibrate(1);
                setIsUnlocked(true);
                isUnlockedRef.current = true;
                ensureRecognition();
            } catch (e) {
                console.warn("Failed to unlock Buddy capabilities:", e);
            }
        };

        const handleInteraction = () => {
            unlock();
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);
        document.addEventListener('keydown', handleInteraction);

        return () => {
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction);
            document.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        isConversationModeRef.current = isConversationMode;
        if (!isConversationMode) {
            setConversationHistory([]);
            // When conversation mode ends, FORCE restart ambient logic
            if (!isListeningRef.current) {
                console.log("🔄 Conversation ended, force restarting ambient listener...");
                setTimeout(ensureRecognition, 500);
            }
        }
    }, [isConversationMode]);

    // Aggressive Mic Watchdog
    useEffect(() => {
        if (!isUnlocked || !wakeWordMode) return;
        const watchdog = setInterval(() => {
            if (isSpeakingRef.current && !window.speechSynthesis.speaking) {
                isSpeakingRef.current = false;
            }
            // If supposed to be ambient but stopped
            if (recognitionRef.current && !isSpeakingRef.current && !isListeningRef.current && !isAmbient) {
                // Try to restart ambient if it fell asleep
                micStuckCounterRef.current += 1;
                if (micStuckCounterRef.current > 5) {
                    console.log("⏰ Watchdog restarting ambient mic...");
                    ensureRecognition();
                    micStuckCounterRef.current = 0;
                }
            }
        }, 3000);
        return () => clearInterval(watchdog);
    }, [isUnlocked, wakeWordMode, isListening, isAmbient]);

    // Route Change Logic
    useEffect(() => {
        console.log("📍 Route changed to:", location.pathname);
        setIsListening(false);
        isListeningRef.current = false;
        setIsAmbient(false);
        setTranscript('');

        // Force a fresh restart on route change
        if (recognitionRef.current) {
            try { recognitionRef.current.abort(); } catch (e) { }
            setTimeout(ensureRecognition, 500);
        }
    }, [location.pathname]);

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (recognitionRef.current) {
            recognitionRef.current.onend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            try { recognitionRef.current.abort(); } catch (e) { }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onresult = (event) => {
            // Wake Word Detection - SUPER SENSITIVE
            // Any interim result containing "buddy" triggers it.
            const results = Array.from(event.results);
            const lastResult = results[results.length - 1];
            const transcriptRaw = lastResult[0].transcript.toLowerCase();

            // Exit Word Check
            const exitWords = ['stop', 'bye', 'goodbye', 'exit', 'cancel'];
            if (isConversationModeRef.current && exitWords.some(w => transcriptRaw.includes(w))) {
                console.log("👋 Exit word detected");
                setIsConversationMode(false);
                setIsListening(false);
                speak(language.startsWith('hi') ? "ठीक है" : "Okay, bye!");
                recognition.stop();
                return;
            }

            // Check if we are already listening
            let waked = isListeningRef.current || isConversationModeRef.current;

            if (!waked) {
                // SENSITIVE WAKE WORD LOGIC
                // Matches "buddy" anywhere, or "hey" + anything
                if (transcriptRaw.includes('buddy') ||
                    transcriptRaw.includes('bodi') ||
                    transcriptRaw.includes('birdie') ||
                    transcriptRaw.includes('hey body') ||
                    (transcriptRaw.includes('hey') && transcriptRaw.length < 15)) { // "Hey..." short phrase

                    console.log("🔔 Wake Word Detected:", transcriptRaw);
                    waked = true;
                    setIsConversationMode(true);
                    inactivePromptCountRef.current = 0;
                    lastInteractionTimeRef.current = Date.now();

                    if (isUnlockedRef.current) {
                        playWakeSound();
                        if (navigator.vibrate) navigator.vibrate(50);
                    }

                    setIsListening(true);
                    isListeningRef.current = true; // Urgent update
                    setIsAmbient(false);

                    // Restart safety timer
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => {
                        console.log("⏳ No command followed wake word");
                        recognition.stop();
                    }, 4000); // Give 4s to speak command
                }
            }

            // Capture Command
            if (waked) {
                // Strip wake words loosely
                let cleanText = transcriptRaw
                    .replace(/hey|hello|hi|ok|okay|buddy|bodi|birdie/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (cleanText.length > 0) {
                    lastInteractionTimeRef.current = Date.now();
                    setTranscript(cleanText);

                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    // Debounce silence for end of speech
                    silenceTimerRef.current = setTimeout(() => {
                        console.log("⏳ Silence timeout (end of speech)");
                        recognition.stop();
                    }, listeningDuration);
                }
            }
        };

        recognition.onstart = () => {
            console.log("🎤 Mic Started");
            if (!isListeningRef.current) {
                setIsAmbient(true);
            }
        };

        recognition.onend = () => {
            console.log("🎤 Mic Ended");
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            setIsAmbient(false);

            // Only turn off UI 'listening' if we are truly stopping (e.g. to process)
            // But usually we want to keep it false so onstart can decide.
            if (isListening) setIsListening(false);

            // AGGRESSIVE RESTART
            const isReallySpeaking = isSpeakingRef.current || window.speechSynthesis.speaking;

            if (wakeWordMode && !isReallySpeaking && !isRestartingFlagRef.current) {
                isRestartingFlagRef.current = true;
                setTimeout(() => {
                    isRestartingFlagRef.current = false;
                    // Always try to restart. check refs inside ensures no double-start.
                    if (isConversationModeRef.current) {
                        // If in conversation, maybe we want to listen again immediately?
                        // Usually yes, for multi-turn.
                        try { recognition.start(); setIsListening(true); } catch (e) { ensureRecognition(); }
                    } else {
                        ensureRecognition(); // Go back to ambient
                    }
                }, 500);
            }
        };

        recognition.onerror = (e) => {
            if (e.error !== 'no-speech' && e.error !== 'aborted') console.error("Mic Error:", e.error);
            if (e.error === 'not-allowed') {
                setWakeWordMode(false);
                toast.error("Microphone Access Denied");
            }
        };

        recognitionRef.current = recognition;
        if (wakeWordMode && isUnlockedRef.current) {
            ensureRecognition();
        }

        return () => {
            if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) { }
        };
    }, [language, wakeWordMode]);

    const handleVoiceCommand = async (text) => {
        try {
            const result = await voiceService.parseVoice(text, language, conversationHistory);
            if (result.success) {
                const { type, data, reply, voice_reply } = result.data;
                const speechText = voice_reply || reply;

                setConversationHistory(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }]);

                if (type === 'chat') {
                    speak(speechText);
                } else if (type === 'reminder') {
                    speak(speechText);
                    navigate('/admin/buddy', { state: { parsedReminder: data, reply, voice_reply: speechText } });
                }
            }
        } catch (error) {
            console.error("Voice command error:", error);
            toast.error("Processing failed");
        }
    };

    // Auto-Parse Effect
    useEffect(() => {
        const isBuddyPage = window.location.pathname === '/admin/buddy';
        // If transcript exists and we are NOT currently listening (meaning silence timeout hit), process it.
        if (transcript.trim().length > 1 && !isListening && !isBuddyPage && !preventProcessing) {
            console.log("🚀 Processing:", transcript);
            handleVoiceCommand(transcript);
            setTranscript('');
        }
    }, [transcript, isListening]);

    const speak = async (text) => {
        if (!window.speechSynthesis || !text) return;

        isSpeakingRef.current = true;
        if (recognitionRef.current) recognitionRef.current.abort(); // Stop mic while speaking
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;

        // Apply Voice Personalization Settings
        const prefs = user?.voicePreferences || { gender: 'female', tone: 'soft' };

        // Asynchronously get voices (Chrome fix)
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            await new Promise(resolve => {
                window.speechSynthesis.onvoiceschanged = () => {
                    voices = window.speechSynthesis.getVoices();
                    resolve();
                };
            });
        }

        // 1. Filter by language
        const langCode = language.split('-')[0];
        let filteredVoices = voices.filter(v => v.lang.includes(langCode));

        if (filteredVoices.length === 0) filteredVoices = voices;

        // 2. Filter by Gender preference
        let selectedVoice = null;
        const targetGender = prefs.gender || 'female';

        // Keywords for gender detection in voice names
        const femaleKeywords = ['female', 'zira', 'samantha', 'victoria', 'google female', 'natural female'];
        const maleKeywords = ['male', 'david', 'alex', 'google male', 'natural male'];

        if (targetGender === 'female') {
            selectedVoice = filteredVoices.find(v =>
                femaleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
            );
        } else {
            selectedVoice = filteredVoices.find(v =>
                maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
            );
        }

        // Fallback to first voice of language if gender-specific not found
        if (!selectedVoice) selectedVoice = filteredVoices[0];

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log(`🔊 Speaking with voice: ${selectedVoice.name} (${targetGender})`);
        }

        // 3. Apply Tone (Pitch/Rate) Settings
        switch (prefs.tone) {
            case 'soft':
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                break;
            case 'energetic':
                utterance.rate = 1.15;
                utterance.pitch = 1.1;
                break;
            case 'normal':
            default:
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                break;
        }

        utterance.onend = () => {
            isSpeakingRef.current = false;
            console.log("🔊 TTS Done. Restarting Mic...");
            // Force restart mic after speaking
            setTimeout(() => {
                if (isConversationModeRef.current) {
                    setIsListening(true);
                    isListeningRef.current = true;
                    try { recognitionRef.current.start(); } catch (e) { ensureRecognition(); }
                } else {
                    ensureRecognition();
                }
            }, 300);
        };

        utterance.onerror = (err) => {
            console.error("TTS Error:", err);
            isSpeakingRef.current = false;
            ensureRecognition();
        };

        window.speechSynthesis.speak(utterance);
    };

    const toggleListening = () => {
        // Manual toggle
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
            isListeningRef.current = false;
        } else {
            try {
                isListeningRef.current = true;
                isConversationModeRef.current = true;
                setIsConversationMode(true);
                setIsListening(true);
                setIsAmbient(false);
                recognitionRef.current.start();
            } catch (e) {
                console.warn("Manual start fail", e);
            }
        }
    };

    const value = {
        isListening,
        isAmbient,
        transcript,
        setTranscript,
        language,
        wakeWordMode,
        setWakeWordMode,
        speak,
        toggleListening,
        isConversationMode,
        setIsConversationMode,
        preventProcessing,
        setPreventProcessing,
        conversationHistory,
        setConversationHistory
    };

    return (
        <VoiceAssistantContext.Provider value={value}>
            {children}
        </VoiceAssistantContext.Provider>
    );
};
