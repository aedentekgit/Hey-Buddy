import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import { playWakeSound, initAudio } from '../utils/wakeSound';
import { decode, decodeAudioData } from '../utils/audio';


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
    const isIntentionalStop = useRef(true);

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
                if (event.error === 'aborted') {
                    console.warn('[VoiceContext] Speech Recognition aborted, ignoring.');
                    return;
                }

                console.warn('[VoiceContext] Speech Recognition Error:', event.error);
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    isIntentionalStop.current = true;
                    setStatus('IDLE');
                    // Only show toast if it's a real failure, not just a splash-page block
                    if (!preventProcessing) {
                        toast.error('Microphone access denied. Please check permissions.');
                    }
                }
            };

            recognition.onend = () => {
                // If it wasn't a manual stop, restart immediately to keep "mic on"
                if (!isIntentionalStop.current) {
                    console.log('[VoiceContext] Browser stopped mic. Restarting for continuity...');
                    setTimeout(() => {
                        try {
                            // Only restart if still intentional and not already listening
                            if (!isIntentionalStop.current) {
                                recognition.start();
                            }
                        } catch (e) {
                            if (e.name !== 'InvalidStateError') {
                                console.error('[VoiceContext] Failed to restart recognition:', e);
                            }
                        }
                    }, 800);
                } else {
                    setStatus('IDLE');
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
                .join('').toLowerCase().trim();

            setTranscript(currentTranscript);

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                if (!currentTranscript) return;

                // Wake Word Detection Logic
                const WAKE_WORD = 'hey buddy';
                const hasWakeWord = currentTranscript.startsWith(WAKE_WORD) || currentTranscript.includes('hey body');

                if (hasWakeWord) {
                    console.log('[VoiceContext] 🧠 Wake word detected globally:', currentTranscript);

                    // Strip the wake word to get the actual command
                    let command = currentTranscript.replace(/^(hey buddy|hey body|buddy)/i, '').trim();
                    if (!command) {
                        // If it was just the wake word, maybe prompt the user or just navigate
                        speak("I'm listening!");
                        navigate('/admin/buddy');
                    } else {
                        processInteraction(command);
                    }
                    recognition.stop();
                } else {
                    // Not for us. Clear and keep listening.
                    setTranscript('');
                }
            }, 1200);
        };

        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [language]); // Only recreate/update language. Status handling moved.

    // State for external components to inhibit voice processing
    const [preventProcessing, setPreventProcessing] = useState(false);

    // Effect to start/stop recognition based on inhibitors
    useEffect(() => {
        if (!recognitionRef.current) return;

        // Only start recognition if user is authenticated AND processing is not inhibited
        if (preventProcessing || !user) {
            console.log(`[VoiceContext] ✋ Inhibiting global recognition (${!user ? 'No user' : 'Inhibited'})`);
            isIntentionalStop.current = true;
            try { recognitionRef.current.stop(); } catch (e) { }
        } else {
            // DO NOT auto-start on mount. Wait for user to enable it once or stick to intentional starts.
            if (isIntentionalStop.current) return;

            console.log('[VoiceContext] 🎧 Attempting to resume global recognition');
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Silently fail if blocked, don't trigger error state yet
            }
        }
    }, [preventProcessing, user]);

    // Turn-taking logic with inhibit check
    const processInteraction = async (text) => {
        // Mute/Disable if we have preventProcessing (e.g. on Buddy page)
        if (preventProcessing) {
            console.log('[VoiceContext] Interaction inhibited because preventProcessing is true');
            return;
        }
        try {
            // Correct argument order for voiceService.parseVoice (text, image, language, history, conversationId)
            const result = await voiceService.parseVoice(text, null, language, conversationHistory, conversationId);
            if (result.success) {
                const { reply, voice_reply, type, data, audio } = result.data;
                setConversationId(result.meta.conversationId);

                // Use high-quality audio if available, otherwise fallback to native TTS
                if (audio) {
                    await handleApiAudio(audio);
                } else {
                    await speak(voice_reply || reply);
                }

                if (type === 'reminder') {
                    navigate('/admin/reminders', { state: { parsedReminder: data } });
                }
            }
        } catch (error) {
            console.error('[VoiceContext] Error:', error);
            toast.error("I couldn't process that.");
        } finally {
            setStatus('IDLE');
            setTranscript('');
        }
    };

    const handleApiAudio = async (base64) => {
        return new Promise((resolve) => {
            try {
                const playAudio = async () => {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                    const bytes = decode(base64);
                    const buffer = await decodeAudioData(bytes, audioContext, 24000, 1);
                    const source = audioContext.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    source.onended = () => resolve();
                    source.start(0);
                };

                playAudio().catch((err) => {
                    console.error("API Audio playback failed:", err);
                    resolve();
                });
            } catch (err) {
                console.error("API Audio playback failed:", err);
                resolve();
            }
        });
    };

    // Step 7 & 8: Convert text to speech and Play
    const speak = (text) => {
        return new Promise((resolve) => {
            console.log('[VoiceContext] speak() called:', text);

            // Native Browser TTS fallback
            if (window.speechSynthesis) {
                // Cancel any ongoing speech
                window.speechSynthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = language;

                if (user?.resolvedVoiceConfig) {
                    utterance.rate = user.resolvedVoiceConfig.speechRate;
                    utterance.pitch = user.resolvedVoiceConfig.pitch;
                } else {
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                }

                // Attempt to find a suitable voice based on preferences
                if (user?.voicePreferences) {
                    const voices = window.speechSynthesis.getVoices();
                    const gender = user.voicePreferences.gender || 'female';
                    const tone = user.voicePreferences.tone || 'normal';

                    const sortedVoices = [...voices].sort((a, b) => (b.localService ? 1 : 0) - (a.localService ? 1 : 0));

                    const targetVoice = sortedVoices.find(v => {
                        const name = v.name.toLowerCase();
                        if (gender === 'female') {
                            if (tone === 'soft') return name.includes('samantha') || name.includes('tessa');
                            if (tone === 'energetic') return name.includes('moira') || name.includes('karen') || name.includes('fiona');
                            return name.includes('victoria') || name.includes('monica') || (name.includes('female') && v.localService);
                        } else {
                            if (tone === 'soft') return name.includes('daniel') || name.includes('thomas');
                            if (tone === 'energetic') return name.includes('alex') || name.includes('lee');
                            return name.includes('fred') || name.includes('oliver') || (name.includes('male') && v.localService);
                        }
                    }) || sortedVoices.find(v => {
                        const name = v.name.toLowerCase();
                        if (gender === 'female') return name.includes('female') || name.includes('woman');
                        return name.includes('male') || name.includes('man');
                    }) || sortedVoices[0];

                    if (targetVoice) {
                        utterance.voice = targetVoice;
                        console.log(`[VoiceContext] Selected browse voice: ${targetVoice.name}`);
                    }
                }

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

    const value = useMemo(() => ({
        status,
        transcript,
        setTranscript,
        language,
        conversationHistory,
        setConversationHistory,
        toggleAssistant,
        toggleListening: toggleAssistant,
        speak,
        setPreventProcessing,
        isListening: status === 'LISTENING',
        isProcessing: status === 'PROCESSING',
        isSpeaking: status === 'SPEAKING'
    }), [status, transcript, language, conversationHistory]);

    return (
        <VoiceAssistantContext.Provider value={value}>
            {children}
        </VoiceAssistantContext.Provider>
    );
};
