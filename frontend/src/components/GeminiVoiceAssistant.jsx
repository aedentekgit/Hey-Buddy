import React from 'react';
import { useSettings } from '../context/SettingsContext';

const GeminiVoiceAssistant = ({ onBack, user }) => {
    const { settings } = useSettings();

    // Use dynamic URL from settings or fallback to Python AI service port (8000)
    const baseAssistantUrl = settings?.ai?.aiAssistantApiUrl || 'http://localhost:8000/app/';

    // Prepare query parameters for proxying and auth
    const token = localStorage.getItem('token');
    const apiBase = window.location.protocol + '//' + window.location.hostname + ':5001/api/ai';

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
