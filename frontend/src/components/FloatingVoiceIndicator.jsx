import { useState, useEffect } from 'react';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import { Mic, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VoicePopup from './VoicePopup';
import './FloatingVoiceIndicator.css';

const FloatingVoiceIndicator = () => {
    const { isListening, isAmbient, transcript } = useVoiceAssistant();
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const handleClick = () => {
        setIsPopupOpen(true);
    };

    // Auto-open popup when wake word is detected
    useEffect(() => {
        // Only open if we have actual text and it's not the buddy page
        // AND we are not just starting ambient listening
        if (isListening && transcript && window.location.pathname !== '/admin/buddy') {
            setIsPopupOpen(true);
        }
    }, [isListening, transcript]);

    // Don't show on Buddy page (it has its own UI)
    // IMPORTANT: This must be BELOW the useHooks to avoid "Rendered fewer hooks than expected" error
    if (window.location.pathname === '/admin/buddy') return null;

    return (
        <>
            <div className="floating-voice-indicator">
                <AnimatePresence>
                    {isAmbient && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="voice-bubble"
                            onClick={handleClick}
                            style={{ cursor: 'pointer' }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <div className={`voice-icon ${isListening ? 'listening' : 'ambient'}`}>
                                {isAmbient ? <Zap size={20} /> : <Mic size={20} />}
                            </div>
                            {isListening && transcript && (
                                <div className="voice-transcript">
                                    <p>"{transcript}"</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <VoicePopup isOpen={isPopupOpen} onClose={() => setIsPopupOpen(false)} />
        </>
    );
};

export default FloatingVoiceIndicator;
