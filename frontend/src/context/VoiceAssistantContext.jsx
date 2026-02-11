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
    const lastStartAttemptRef = useRef(0);
    const isActuallyRunningRef = useRef(false);
    const isStartingRef = useRef(false);
    const [listeningDuration, setListeningDuration] = useState(1000); // 1.0s silence gap for balanced responsiveness
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const silenceTimerRef = useRef(null);
    const lastErrorRef = useRef(null);
    const isProcessingRef = useRef(false);

    // Sync with global settings
    useEffect(() => {
        if (settings?.general?.language && settings.general.language !== language) {
            setLanguage(settings.general.language);
        }
        if (settings?.ai?.listeningDuration) {
            const newDuration = settings.ai.listeningDuration * 1000;
            if (newDuration !== listeningDuration) {
                setListeningDuration(newDuration);
            }
        }
    }, [settings, language, listeningDuration]);

    // Unified diagnostic logger
    const logStatus = (action) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🎤 [${timestamp}] [${action}] | Running: ${isActuallyRunningRef.current} | Starting: ${isStartingRef.current} | Speaking: ${isSpeakingRef.current}`);
    };

    // Helper to start recognition safely with retry logic
    const ensureRecognition = () => {
        // WAKE WORD MODE check is the only requirement now. 
        // We don't wait for 'isUnlocked' anymore because we WANT the browser's permission prompt to show up.
        if (!recognitionRef.current || !wakeWordMode) return;
        if (isActuallyRunningRef.current || isStartingRef.current || isSpeakingRef.current) return;

        const now = Date.now();
        // Reduced cooldowns: 0.8s between any attempt, 3s if we just had an error
        const cooldown = now - lastErrorTimeRef.current < 10000 ? 3000 : 800;

        if (now - lastStartAttemptRef.current < cooldown) {
            return;
        }

        logStatus("Attempting Start");
        isStartingRef.current = true;
        lastStartAttemptRef.current = now;

        try {
            recognitionRef.current.start();
        } catch (e) {
            isStartingRef.current = false;
            if (e.name === 'InvalidStateError') {
                isActuallyRunningRef.current = true;
                return;
            }
            console.warn("🎤 Mic Start Exception:", e.message);
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
            console.log("🖱️ User interaction detected, unlocking capabilities...");
            unlock();
            document.removeEventListener('click', handleInteraction);
            document.removeEventListener('touchstart', handleInteraction, { passive: true });
            document.removeEventListener('keydown', handleInteraction);
        };

        // Do NOT call unlock() immediately here, it will fail and show error on console.
        // Wait for actual user gesture.
        document.addEventListener('click', handleInteraction, { once: true });
        document.addEventListener('touchstart', handleInteraction, { once: true, passive: true });
        document.addEventListener('keydown', handleInteraction, { once: true });

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
        }
    }, [isConversationMode]);

    // Aggressive Mic Watchdog
    useEffect(() => {
        if (!isUnlocked || !wakeWordMode) return;
        const watchdog = setInterval(() => {
            if (isSpeakingRef.current && !window.speechSynthesis.speaking) {
                isSpeakingRef.current = false;
            }

            // v2.5 fix: Restart if we are supposed to be active (ambient OR listening) but the mic is dead
            const shouldBeRunning = wakeWordMode && !isSpeakingRef.current;
            const isActuallyOff = !isActuallyRunningRef.current && !isStartingRef.current;

            if (shouldBeRunning && isActuallyOff) {
                micStuckCounterRef.current += 1;
                // If it's been off for 2 consecutive checks (6 seconds), force a restart
                if (micStuckCounterRef.current >= 2) {
                    console.log("⏰ Watchdog: Mic is stuck. Forcing restart...");
                    ensureRecognition();
                    micStuckCounterRef.current = 0;
                }
            } else {
                micStuckCounterRef.current = 0;
            }
        }, 3000);
        return () => clearInterval(watchdog);
    }, [isUnlocked, wakeWordMode, isListening, isAmbient]);

    // Route Change Logic - Simplified to just clear transcript
    useEffect(() => {
        setTranscript('');
        // We don't force a restart here anymore; onend handles it if the mic was naturally closed
    }, [location.pathname]);

    // Initialize Speech Recognition
    // We use a ref to track the last used language to avoid double initialization
    const lastInitializedLangRef = useRef(null);
    const lastInitializedModeRef = useRef(null);

    useEffect(() => {
        // Only initialize if something actually changed and we are in dev/unlocked mode
        console.log(`🛠️ [v2.5] Configuring Speech Recognition | Lang: ${language} | WakeMode: ${wakeWordMode}`);
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("❌ [v2.5] Speech Recognition not supported in this browser.");
            return;
        }

        lastInitializedLangRef.current = language;
        lastInitializedModeRef.current = wakeWordMode;

        if (recognitionRef.current) {
            console.log("🛠️ [v2.5] Cleaning up old Speech Recognition object...");
            recognitionRef.current.onend = null;
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            try { recognitionRef.current.abort(); } catch (e) { }
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Continuous mode for better wake-word reliability
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            // Wake Word Detection - SUPER SENSITIVE
            // Any interim result containing "buddy" triggers it.
            const results = Array.from(event.results);
            const transcriptRaw = results.map(r => r[0].transcript.toLowerCase()).join(' ');

            if (transcriptRaw.trim()) {
                console.log("🎤 Hearing:", transcriptRaw);
            } else {
                // Log even empty/silent results to confirm engine is alive
                console.log("🎤 Audio captured (but silent/unclear)");
            }

            // 1. Check for Exit Words (Only if already waked/in conversation)
            if (isConversationModeRef.current) {
                const exitWords = [
                    'stop', 'bye', 'goodbye', 'exit', 'cancel', 'close', 'dismiss', 'end session', 'close it',
                    'शुक्रिया', 'नमस्ते', 'बन्द करो', 'போயிட்டு வர்றேன்', 'சென்று வருகிறேன்'
                ];
                // Clean the text first to avoid false positives (like "stopping by")
                const cleanForExit = transcriptRaw.replace(/hey|buddy|bodi|body/gi, '').trim().toLowerCase();

                if (exitWords.some(w => cleanForExit === w || cleanForExit === w + '.')) {
                    console.log("👋 Exit word detected and confirmed:", cleanForExit);
                    setIsConversationMode(false);
                    setIsListening(false);
                    isListeningRef.current = false;
                    isConversationModeRef.current = false;
                    speak(language.startsWith('hi') ? "ठीक है, फिर मिलते हैं!" : "Okay, catch you later!");
                    if (recognitionRef.current) recognitionRef.current.abort();
                    return;
                }
            }

            // 2. Wake Word Detection (If not already waked)
            let waked = isListeningRef.current || isConversationModeRef.current;

            if (!waked) {
                const wakeWords = [
                    'buddy', 'bodi', 'birdie', 'body', 'bud', 'bub', 'बडी', 'बड्डी', 'படி', 'பட்டி', 'பட்யை', 'பட்ய', 'బడ్డీ', 'బడ్డి', 'ಬಡ್ಡಿ',
                    'hey buddy', 'hello buddy', 'hi buddy', 'hey bud', 'hey bub',
                    'हे बडी', 'हाय बडी', 'नमस्ते बडी',
                    'ஹே படி', 'ஹே பட்டி', 'வணக்கம் பட்டி',
                    'హే బడ్డీ', 'హలో బడ్డీ', 'హే బడ్డి',
                    'ಹೇ ಬಡ್ಡಿ'
                ];

                const matchesWakeWord = wakeWords.some(w => transcriptRaw.includes(w));

                if (matchesWakeWord) {
                    console.log("🔔 Wake Word Triggered:", transcriptRaw);
                    waked = true;
                    setIsConversationMode(true);
                    isConversationModeRef.current = true;

                    if (isUnlockedRef.current) {
                        playWakeSound();
                        if (navigator.vibrate) navigator.vibrate(50);
                    }

                    setIsListening(true);
                    isListeningRef.current = true;
                    setIsAmbient(false);

                    // Reset all timers
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => {
                        console.log("⏳ 4s Silence: No command after wake word");
                        if (recognitionRef.current) recognitionRef.current.stop();
                    }, 4000);
                }
            }

            // 3. Command Capture (If waked)
            if (waked) {
                const cleanRegex = /hey|hello|hi|ok|okay|buddy|bodi|birdie|body|bud|bub|बडी|बड्डी|हे|हाय|नमस्ते|படி|பட்டி|வணக்கம்|బడ్డీ|బడ్డి|హే|హలో|ಬడ్ಡಿ|ಹೇ/gi;
                let cleanText = transcriptRaw.replace(cleanRegex, '').replace(/\s+/g, ' ').trim();

                if (cleanText.length > 0) {
                    // Update state to listening if we hear actual command words
                    if (!isListeningRef.current) {
                        setIsListening(true);
                        isListeningRef.current = true;
                    }

                    setTranscript(cleanText);
                    lastInteractionTimeRef.current = Date.now();

                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = setTimeout(() => {
                        console.log("⏳ Command Finished:", cleanText);
                        if (recognitionRef.current) recognitionRef.current.stop();
                    }, listeningDuration);
                }
            }
        };

        recognition.onstart = () => {
            isActuallyRunningRef.current = true;
            isStartingRef.current = false;
            logStatus("Mic Active & Listening");
            setIsAmbient(true);
        };

        recognition.onend = () => {
            isActuallyRunningRef.current = false;
            isStartingRef.current = false;
            setIsAmbient(false);

            logStatus("Mic session ended");
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            // ONLY reset isListening if we are NOT in conversation mode
            // This ensures the UI remains in "Listening" state during multi-turn chats
            if (!isConversationModeRef.current) {
                setIsListening(false);
                isListeningRef.current = false;
            }

            // AUTO-RECOVERY with deliberate pause
            if (wakeWordMode && !isSpeakingRef.current) {
                // If it was just a housekeeping abort, restart very quickly
                const isHousekeeping = (Date.now() - lastErrorTimeRef.current < 200) && lastErrorRef.current === 'aborted';
                const pause = isHousekeeping ? 300 : (Date.now() - lastErrorTimeRef.current < 10000 ? 2500 : 500);

                logStatus(`Scheduling recovery in ${pause}ms (Housekeeping: ${isHousekeeping})`);
                setTimeout(ensureRecognition, pause);
            }
        };

        recognition.onerror = (e) => {
            isStartingRef.current = false;
            isActuallyRunningRef.current = false;
            lastErrorTimeRef.current = Date.now();
            lastErrorRef.current = e.error;

            if (e.error === 'aborted') {
                logStatus("Info: Aborted (Chrome housekeeping)");
                return;
            }

            if (e.error === 'no-speech') {
                // Silent end, perfectly normal for non-continuous mode
                return;
            }

            console.warn(`🎤 Mic Error [${e.error}]`);
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                setWakeWordMode(false);
                toast.error("Microphone Access Issue - Please check permissions or try again");
            }
        };

        recognitionRef.current = recognition;

        // v2.5 FIX: Always try to start immediately if wakeWordMode is on.
        if (wakeWordMode) {
            console.log("🚀 [v2.5] Initializing auto-start...");
            setTimeout(ensureRecognition, 1200);
        }

        return () => {
            if (recognitionRef.current) try { recognitionRef.current.abort(); } catch (e) { }
        };
    }, [language, wakeWordMode]);

    const handleVoiceCommand = async (text) => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;
        try {
            const result = await voiceService.parseVoice(text, language, conversationHistory, currentConversationId);
            if (result.success) {
                const { type, data, reply, voice_reply } = result.data;
                const speechText = voice_reply || reply;

                if (result.meta?.conversationId) {
                    setCurrentConversationId(result.meta.conversationId);
                }

                setConversationHistory(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }]);

                if (type === 'chat') {
                    speak(speechText);
                } else if (type === 'reminder') {
                    // Auto-save to Buddy DB to ensure it's not lost, then navigate
                    let autoSavedId = null;
                    try {
                        const saveRes = await voiceService.saveReminder(data, 'buddy');
                        if (saveRes.success && saveRes.data?._id) {
                            autoSavedId = saveRes.data._id;
                            console.log("✅ Voice reminder auto-saved to Buddy DB:", autoSavedId);
                        }
                        toast.success("Reminder auto-saved!");
                        window.dispatchEvent(new CustomEvent('buddy-data-updated'));
                    } catch (e) {
                        console.warn("Failed to auto-save voice reminder:", e);
                    }
                    speak(speechText);
                    navigate('/admin/buddy', {
                        state: {
                            parsedReminder: data,
                            reply,
                            voice_reply: speechText,
                            autoSaved: true,
                            autoSavedId: autoSavedId
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Voice command error:", error);
            toast.error("Processing failed");
        } finally {
            isProcessingRef.current = false;
        }
    };

    // Auto-Parse Effect
    useEffect(() => {
        const isBuddyPage = window.location.pathname === '/admin/buddy';
        // If transcript exists and we are NOT currently listening (meaning silence timeout hit), process it.
        // Also ensure no other process is running
        if (transcript.trim().length > 1 && !isListening && !isBuddyPage && !preventProcessing && !isProcessingRef.current) {
            console.log("🚀 [Global] Auto-processing:", transcript);
            handleVoiceCommand(transcript);
            setTranscript('');
        }
    }, [transcript, isListening, preventProcessing]);

    const speak = async (text, onComplete = null) => {
        if (!window.speechSynthesis || !text) {
            if (onComplete) onComplete();
            return;
        }

        // v2.6 FIX: Strip emojis so they aren't spoken as "Smiling face with hearts"
        // Uses Unicode property escapes (\p{...}) to catch emojis and pictographs
        const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, '').trim();

        if (!cleanText) {
            if (onComplete) onComplete();
            return; // Don't speak if it was only emojis
        }

        // Chrome/Browser Fix: Always resume if stuck
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }

        // Ensure any pending speech is cleared to prevent deadlocks
        window.speechSynthesis.cancel();

        isSpeakingRef.current = true;

        // Stop recognition while speaking to prevent Buddy from hearing himself
        if (recognitionRef.current && isActuallyRunningRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }

        // Wait for voices if empty, with timeout
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            await new Promise(resolve => {
                const timer = setTimeout(resolve, 1000);
                window.speechSynthesis.onvoiceschanged = () => {
                    clearTimeout(timer);
                    voices = window.speechSynthesis.getVoices();
                    resolve();
                };
            });
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Ensure language is set (fallback to en-US if invalid)
        try {
            utterance.lang = language || 'en-US';
        } catch (e) {
            utterance.lang = 'en-US';
        }

        // Apply Voice Personalization
        const prefs = user?.voicePreferences || { gender: 'female', tone: 'soft' };
        const langCode = (language || 'en').split('-')[0].toLowerCase();

        // Filter voices by language match
        let filteredVoices = voices.filter(v => v.lang.toLowerCase().includes(langCode));
        if (filteredVoices.length === 0) filteredVoices = voices;

        // Try to find matching gender
        const targetGender = prefs.gender || 'female';
        const femaleKeywords = ['female', 'zira', 'samantha', 'victoria', 'google female', 'natural female', 'en-in-x-ife-local'];
        const maleKeywords = ['male', 'david', 'alex', 'google male', 'natural male', 'en-in-x-ime-local'];

        let selectedVoice = null;
        if (targetGender === 'female') {
            selectedVoice = filteredVoices.find(v => femaleKeywords.some(k => v.name.toLowerCase().includes(k)));
        } else {
            selectedVoice = filteredVoices.find(v => maleKeywords.some(k => v.name.toLowerCase().includes(k)));
        }

        // Fallback
        if (!selectedVoice) selectedVoice = filteredVoices.find(v => v.default) || filteredVoices[0];

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log(`🔊 Speaking [${langCode}]: ${selectedVoice.name}`);
        }

        // Tone adjustments
        const toneSettings = {
            soft: { rate: 0.9, pitch: 1.05 },
            energetic: { rate: 1.15, pitch: 1.1 },
            normal: { rate: 1.0, pitch: 1.0 }
        };
        const tone = toneSettings[prefs.tone] || toneSettings.normal;
        utterance.rate = tone.rate;
        utterance.pitch = tone.pitch;

        const safetyTimeout = setTimeout(() => {
            if (isSpeakingRef.current) {
                console.warn("🔊 TTS safety timeout hit. Forcing mic recovery...");
                isSpeakingRef.current = false;
                ensureRecognition();
            }
        }, 20000); // 20s max for any turn

        utterance.onend = () => {
            clearTimeout(safetyTimeout);
            isSpeakingRef.current = false;
            console.log("🔊 Finished speaking");
            if (onComplete) onComplete();

            // Critical fix for multi-turn: Push isListening back to TRUE immediately
            if (isConversationModeRef.current) {
                setIsListening(true);
                isListeningRef.current = true;
            }

            // Small delay to let speech cleanup happen, then RE-ENGAGE mic
            setTimeout(() => {
                if (isConversationModeRef.current || wakeWordMode) {
                    logStatus("Speech finished, restarting mic for turn continuation");
                    try {
                        recognitionRef.current.start();
                    } catch (e) {
                        console.log("Mic restart via start() failed, using ensureRecognition fallback");
                        ensureRecognition();
                    }
                }
            }, 300);
        };

        utterance.onerror = (err) => {
            clearTimeout(safetyTimeout);
            console.error("🔊 TTS Error:", err);
            isSpeakingRef.current = false;
            setIsListening(false); // Reset on error
            ensureRecognition();
        };

        // Final Chrome fix attempt: speak in small timeout
        setTimeout(() => {
            window.speechSynthesis.speak(utterance);
        }, 50);
    };

    const toggleListening = () => {
        // Manual toggle - also ensures audio is unlocked if this is the first interaction
        if (!isUnlockedRef.current) {
            initAudio().then(() => {
                setIsUnlocked(true);
                isUnlockedRef.current = true;
            });
        }

        if (isListening) {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
            setIsListening(false);
            isListeningRef.current = false;
        } else {
            isListeningRef.current = true;
            isConversationModeRef.current = true;
            setIsConversationMode(true);
            setIsListening(true);
            setIsAmbient(false);
            ensureRecognition();
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
        setConversationHistory,
        currentConversationId,
        setCurrentConversationId
    };

    return (
        <VoiceAssistantContext.Provider value={value}>
            {children}
        </VoiceAssistantContext.Provider>
    );
};
