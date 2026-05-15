import React from 'react';
import RealtimeBuddy from '../components/RealtimeBuddy';

const RealtimeChat = () => {
    return (
        <div className="page-container" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                    Buddy <span style={{ color: '#6366f1' }}>Realtime</span>
                </h1>
                <p style={{ color: '#64748b' }}>Experience zero-latency, full-duplex voice interactions.</p>
            </header>

            <RealtimeBuddy />

            <footer style={{ marginTop: '3rem', maxWidth: '600px', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                <p>Note: This interface uses the OpenAI Realtime API. Interruption is supported—just start speaking while Buddy is talking to take control of the conversation.</p>
            </footer>
        </div>
    );
};

export default RealtimeChat;
