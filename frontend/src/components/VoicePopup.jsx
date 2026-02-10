import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Send, Loader2, Volume2, StopCircle } from 'lucide-react';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import './VoicePopup.css';

const VoicePopup = ({ isOpen, onClose }) => {
    const {
        language,
        speak,
        transcript,
        isListening,
        setTranscript,
        setIsConversationMode,
        toggleListening,
        setPreventProcessing,
        conversationHistory,
        setConversationHistory
    } = useVoiceAssistant();

    const [input, setInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [response, setResponse] = useState(null);

    // Prevent global context from auto-processing while popup is open
    useEffect(() => {
        if (isOpen) {
            setPreventProcessing(true);
        }
        return () => {
            // Delay unsetting to prevent race condition with closing logic
            setTimeout(() => setPreventProcessing(false), 500);
        };
    }, [isOpen, setPreventProcessing]);

    // Update input when transcript changes
    useEffect(() => {
        if (transcript && isListening) {
            // Additional wake-word filtering for safety
            const wakeWords = ['hey buddy', 'hello buddy', 'hi buddy'];
            const regex = new RegExp(`(${wakeWords.join('|')})`, 'gi');
            const cleaned = transcript.replace(regex, '').replace(/\s+/g, ' ').trim();
            setInput(cleaned);
        }
    }, [transcript, isListening]);

    // Speak greeting when opened manually
    useEffect(() => {
        // Only speak if opened, strict checks to avoid repeat
        if (isOpen && !isListening && !response && !input) {
            const timer = setTimeout(() => {
                const greetings = [
                    "How can I help you?",
                    "I'm listening...",
                    "What's on your mind?"
                ];
                const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
                speak(randomGreeting);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!input.trim() || isParsing) return;

        setIsParsing(true);
        setResponse(null);

        try {
            // Pass conversationHistory for continuous context
            const result = await voiceService.parseVoice(input, language, conversationHistory);

            if (result.success) {
                const { type, reply, voice_reply, data } = result.data;
                const speechText = voice_reply || reply;

                // Update History locally so context is maintained for next turn
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user', content: input },
                    { role: 'assistant', content: reply || speechText }
                ]);

                if (type === 'chat') {
                    setResponse(reply);
                    speak(speechText);
                } else if (type === 'reminder') {
                    toast.success(reply || 'Reminder created! Check Buddy AI page for details.');
                    speak(speechText || 'Reminder created successfully');
                    setTimeout(() => handleClose(), 5000); // 5s to read before closing
                }
            }
        } catch (error) {
            const errorMsg = error.response?.data?.message || "Failed to process your request.";
            toast.error(errorMsg);
        } finally {
            setIsParsing(false);
        }
    };

    // Auto-submit when user stops speaking
    useEffect(() => {
        // Only submit if mic stopped, we have input, and not already processing
        if (!isListening && input.trim() && !isParsing && !response) {
            const timeout = setTimeout(() => {
                if (!isListening && input.trim()) {
                    handleSubmit();
                }
            }, 300); // Small debounce
            return () => clearTimeout(timeout);
        }
    }, [isListening, input]); // Added input dependency to be redundant safe

    const handleClose = () => {
        // Stop conversation flow to prevent auto-reopening
        setIsConversationMode(false);
        setTranscript('');

        // Stop listening if active
        if (isListening) {
            toggleListening();
        }

        setInput('');
        setResponse(null);
        onClose();

        // Stop any ongoing speech
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="voice-popup-overlay" onClick={handleClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="voice-popup"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="popup-header">
                        <div className="header-content">
                            <div className="header-icon-container">
                                <div className="header-icon">
                                    <Mic size={22} weight="bold" />
                                </div>
                            </div>
                            <div>
                                <h3>Buddy AI</h3>
                                <div className="header-status">
                                    <div className={`status-dot ${isListening ? 'pulsing' : ''}`}></div>
                                    <span className="status-text">
                                        {isParsing ? 'Thinking...' : isListening ? 'Listening...' : 'Ready'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="close-btn" onClick={handleClose} aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="popup-body">

                        {/* Response / Dialogue Area */}

                        {(input || response) ? (
                            <div className="dialogue-container">
                                {/* User Input Display */}
                                {input && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="message-bubble user-message"
                                    >
                                        <span className="message-label">You Asked</span>
                                        <p>{input}</p>
                                    </motion.div>
                                )}

                                {/* Loading State */}
                                {isParsing && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="parsing-indicator"
                                    >
                                        <Loader2 size={16} className="spinner" />
                                        <span>Buddy is thinking...</span>
                                    </motion.div>
                                )}

                                {/* Buddy Response */}
                                {response && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="message-bubble buddy-message"
                                    >
                                        <div className="message-header">
                                            <span className="message-label">Buddy Says</span>
                                            <button
                                                className="action-icon-btn"
                                                onClick={() => speak(response)}
                                                title="Read aloud"
                                            >
                                                <Volume2 size={14} />
                                            </button>
                                        </div>
                                        <p>{response}</p>
                                    </motion.div>
                                )}
                            </div>
                        ) : (
                            /* Empty State / Welcome */
                            <div className="empty-state">
                                <p>How can I help you today?</p>
                            </div>
                        )}

                        {/* Listening Indicator (Waveform) */}
                        <AnimatePresence>
                            {isListening && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="listening-indicator"
                                >
                                    <div className="siri-waveform">
                                        <div className="wave-bar"></div>
                                        <div className="wave-bar"></div>
                                        <div className="wave-bar"></div>
                                        <div className="wave-bar"></div>
                                        <div className="wave-bar"></div>
                                    </div>
                                    <span className="listening-text">Listening...</span>
                                    <button className="stop-listening-btn" onClick={toggleListening}>
                                        <StopCircle size={14} /> Stop
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Input Form */}
                        <form onSubmit={handleSubmit} className="input-form">
                            <div className={`input-wrapper ${isListening ? 'active-listening' : ''}`}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={isListening ? "Listening..." : "Type a message..."}
                                    className="voice-input"
                                    disabled={isParsing}
                                />
                                <div className="input-actions">
                                    {!isListening && (
                                        <button
                                            type="button"
                                            className="mic-btn"
                                            onClick={toggleListening}
                                            title="Start Voice"
                                        >
                                            <Mic size={20} />
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="send-btn"
                                        disabled={!input.trim() || isParsing}
                                    >
                                        {isParsing ? (
                                            <Loader2 size={20} className="spinner" />
                                        ) : (
                                            <Send size={20} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>

                        {/* Quick Suggestions - Only show when empty */}
                        {!input && !response && (
                            <div className="quick-actions">
                                <button className="quick-btn" onClick={() => setInput("What's the weather?")}>
                                    Weather
                                </button>
                                <button className="quick-btn" onClick={() => setInput("Set a reminder for 5pm")}>
                                    Reminder
                                </button>
                                <button className="quick-btn" onClick={() => setInput("Tell me a clear joke")}>
                                    Joke
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default VoicePopup;
