import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Loader2, Volume2, StopCircle } from 'lucide-react';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import '../styles/VoicePopup.css';

const VoicePopup = ({ isOpen, onClose }) => {
    const {
        status,
        transcript,
        speak,
        toggleAssistant,
        isListening,
        isProcessing,
        isSpeaking
    } = useVoiceAssistant();

    const [input, setInput] = useState('');
    const [response, setResponse] = useState(null);

    // Sync local input with assistant transcript
    useEffect(() => {
        if (transcript) setInput(transcript);
    }, [transcript]);

    const handleClose = () => {
        if (isListening) toggleAssistant();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        setInput('');
        setResponse(null);
        onClose();
    };

    const handleManualSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || isProcessing) return;

        // Manual submission logic if user types instead of speaks
        // The assistant's linear model will handle the rest
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
                    <div className="popup-header">
                        <div className="header-content">
                            <div className="header-icon-container">
                                <div className="header-icon">
                                    <Mic size={22} className={isListening ? 'pulsing' : ''} />
                                </div>
                            </div>
                            <div>
                                <h3>Buddy 2.0</h3>
                                <div className="header-status">
                                    <span className="status-text">{status}</span>
                                </div>
                            </div>
                        </div>
                        <button className="close-btn" onClick={handleClose}><X size={20} /></button>
                    </div>

                    <div className="popup-body">
                        <div className="dialogue-container">
                            {input && (
                                <div className="message-bubble user-message">
                                    <p>{input}</p>
                                </div>
                            )}
                            {isProcessing && (
                                <div className="parsing-indicator">
                                    <Loader2 size={16} className="spinner" />
                                    <span>Thinking...</span>
                                </div>
                            )}
                            {response && (
                                <div className="message-bubble buddy-message">
                                    <p>{response}</p>
                                    <button onClick={() => speak(response)}><Volume2 size={14} /></button>
                                </div>
                            )}
                        </div>

                        <div className="input-form">
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={isListening ? "Listening..." : "How can I help?"}
                                    disabled={isProcessing}
                                />
                                <button className="mic-btn" onClick={toggleAssistant}>
                                    {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default VoicePopup;
