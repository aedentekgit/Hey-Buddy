import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { config } from '../config/env';

const GeminiVoiceAssistant = ({ onBack, user }) => {
    const { settings } = useSettings();
    const navigate = useNavigate();

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data === 'go_home') {
                navigate('/admin/dashboard');
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigate]);

    // Use dynamic URL from settings or fallback to local port 8000 if localhost
    const baseAssistantUrl = settings?.ai?.aiAssistantApiUrl ||
        (window.location.hostname === 'localhost' ? 'http://localhost:8000/app/' : `${window.location.origin}/assistant/app/`);


    // Prepare query parameters for proxying and auth
    const token = localStorage.getItem('token');
    const apiBase = `${config.API_URL}/ai`;

    const url = new URL(baseAssistantUrl);
    url.searchParams.set('apiBase', apiBase);
    if (token) url.searchParams.set('token', token);

    // Pass user ID to maintain conversation history across refreshes/logins
    if (user?._id) {
        url.searchParams.set('sessionId', user._id);
        url.searchParams.set('userId', user._id);
    }

    const assistantUrl = url.toString();

    return (
        <div style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            background: '#050510',
            overflow: 'hidden'
        }}>
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
        </div>
    );
};

export default GeminiVoiceAssistant;
