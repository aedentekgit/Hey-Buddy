import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Wifi, WifiOff, MessageSquareText, Loader2 } from 'lucide-react';
import { useRealtimeVoice } from '../context/RealtimeVoiceContext';
import '../styles/RealtimeBuddy.css';

const RealtimeBuddy = () => {
    const {
        isConnected,
        isActive,
        isAiSpeaking,
        isRecording,
        transcript,
        startSession,
        stopSession
    } = useRealtimeVoice();

    const [error, setError] = useState(null);

    React.useEffect(() => {
        if (isConnected) {
            console.log("[RealtimeBuddy] Realtime Link Established.");
        }
    }, [isConnected]);

    const handleStartSession = async () => {
        setError(null);
        try {
            await startSession();
        } catch (err) {
            console.error('Failed to start session:', err);
            setError('Microphone access denied or service unavailable.');
        }
    };

    const handleStopSession = () => {
        setError(null);
        stopSession();
    };

    const getStatusText = () => {
        if (!isConnected) return 'Disconnected';
        if (isAiSpeaking) return 'Buddy is speaking...';
        if (isRecording) return 'Listening...';
        if (isActive) return 'Session active';
        return 'Ready for a real-time chat?';
    };

    return (
        <div className="realtime-buddy-container">
            <div className="glow-background" />

            <div className="status-badge">
                <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                <span>{isConnected ? 'Realtime Link Active' : 'Disconnected'}</span>
                {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            </div>

            <motion.div
                className={`visualizer-orb ${isActive ? 'active' : ''} ${isAiSpeaking ? 'ai-speaking' : ''}`}
                animate={isActive ? {
                    scale: isAiSpeaking ? [1, 1.1, 1] : [1, 1.05, 1],
                    rotate: isAiSpeaking ? [0, 5, -5, 0] : 0
                } : { scale: 1 }}
                transition={{
                    repeat: Infinity,
                    duration: isAiSpeaking ? 1.5 : 3,
                    ease: "easeInOut"
                }}
            >
                {!isConnected ? (
                    <Loader2 size={40} color="white" className="animate-spin" />
                ) : isAiSpeaking ? (
                    <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <Wifi size={40} color="white" />
                    </motion.div>
                ) : (
                    <Mic size={40} color="white" className={isActive ? 'pulsing' : ''} />
                )}
            </motion.div>

            <div className="transcript-area">
                <AnimatePresence mode="wait">
                    {transcript ? (
                        <motion.p
                            key="transcript"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="transcript-text"
                        >
                            {transcript}
                        </motion.p>
                    ) : (
                        <motion.p
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="placeholder-text"
                        >
                            {getStatusText()}
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="error-message"
                >
                    {error}
                </motion.div>
            )}

            <div className="controls">
                {!isActive ? (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="action-btn start-btn"
                        onClick={handleStartSession}
                        disabled={!isConnected}
                    >
                        <Mic size={20} />
                        Start Voice Session
                    </motion.button>
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="action-btn stop-btn"
                        onClick={handleStopSession}
                    >
                        <Square size={20} />
                        End Session
                    </motion.button>
                )}
            </div>

            {isActive && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="agent-info"
                    style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#64748b' }}
                >
                    <MessageSquareText size={12} style={{ marginRight: '0.5rem' }} />
                    {isRecording ? 'Microphone active - speak now!' : 'Session ending...'}
                </motion.div>
            )}
        </div>
    );
};

export default RealtimeBuddy;
