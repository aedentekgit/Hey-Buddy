import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { config } from '../config/env';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Loader2, Home } from 'lucide-react';

const GeminiVoiceAssistant = ({ onBack, user }) => {
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [status, setStatus] = useState('checking'); // checking | online | offline
    const [retryKey, setRetryKey] = useState(0);

    // Use dynamic URL from settings or fallback to local port 8000 if localhost
    const isLocal = ['localhost', '127.0.0.1', '10.0.2.2'].includes(window.location.hostname);
    const baseAssistantUrl = settings?.ai?.aiAssistantApiUrl ||
        (isLocal ? `http://${window.location.hostname}:8000/app/` : `${window.location.origin}/assistant/app/`);

    useEffect(() => {
        let isMounted = true;

        const checkConnection = async () => {
            if (retryKey > 0) setStatus('checking');

            try {
                // Short timeout to check if the AI service is reachable
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);

                await fetch(baseAssistantUrl, {
                    method: 'GET',
                    mode: 'no-cors',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                if (isMounted) setStatus('online');
            } catch (err) {
                console.warn("AI Service connection failed:", err);
                if (isMounted) setStatus('offline');
            }
        };

        checkConnection();
        return () => { isMounted = false; };
    }, [baseAssistantUrl, retryKey]);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data === 'go_home') {
                navigate('/admin/dashboard');
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigate]);

    const token = localStorage.getItem('token');
    const apiBase = `${config.API_URL}/ai`;

    const url = new URL(baseAssistantUrl);
    url.searchParams.set('apiBase', apiBase);
    if (token) url.searchParams.set('token', token);

    if (user?._id) {
        url.searchParams.set('sessionId', user._id);
        url.searchParams.set('userId', user._id);
    }

    const assistantUrl = url.toString();

    const handleRetry = () => setRetryKey(prev => prev + 1);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            background: '#050510',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <AnimatePresence mode="wait">
                {status === 'checking' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ textAlign: 'center', color: 'white' }}
                    >
                        <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary-color)', marginBottom: '20px' }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', opacity: 0.8 }}>Initializing Buddy...</p>
                    </motion.div>
                )}

                {status === 'offline' && (
                    <motion.div
                        key="offline"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -20 }}
                        className="glass-panel"
                        style={{
                            padding: '48px',
                            maxWidth: '480px',
                            width: '90%',
                            textAlign: 'center',
                            background: 'rgba(15, 23, 42, 0.8)',
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        }}
                    >
                        <div className="animate-float" style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '24px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                            <WifiOff size={40} style={{ color: '#EF4444' }} />
                        </div>

                        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'white', marginBottom: '12px' }}>
                            Buddy is Offline
                        </h2>

                        <p style={{ color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.6', marginBottom: '32px', fontSize: '1.05rem' }}>
                            Buddy was Not connected. <br />
                            We couldn't reach the AI service. Please ensure the backend server is running and try again.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                className="btn-premium"
                                onClick={handleRetry}
                                style={{ width: '100%', height: '52px' }}
                            >
                                <RefreshCw size={18} />
                                Reconnect Buddy
                            </button>
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    height: '48px',
                                    borderRadius: '14px',
                                    fontWeight: '600',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Home size={18} />
                                Back to Dashboard
                            </button>
                        </div>
                    </motion.div>
                )}

                {status === 'online' && (
                    <motion.div
                        key="online"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <iframe
                            src={assistantUrl}
                            title="Buddy AI Assistant"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                borderRadius: '0'
                            }}
                            allow="microphone; camera; autoplay; encrypted-media; fullscreen;"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-float { animation: float 4s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default GeminiVoiceAssistant;

