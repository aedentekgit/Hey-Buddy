import { useState, useEffect } from 'react';
import { Menu, Home, Mic, Send, Search, Bell, User } from 'lucide-react';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import { useAuth } from '../context/AuthContext';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';

const Header = ({ onMenuClick, title, hideSearch }) => {
    const [scrolled, setScrolled] = useState(false);
    const {
        speak, isListening, toggleListening, language,
        transcript, setTranscript, conversationHistory, setConversationHistory
    } = useVoiceAssistant();
    const { user } = useAuth();
    const [manualInput, setManualInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);

    // Handle scroll for dynamic styling
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 10) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    };

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        const text = manualInput.trim();
        if (!text) return;

        setIsParsing(true);
        setManualInput('');

        try {
            const result = await voiceService.parseVoice(text, language, conversationHistory);
            if (result.success) {
                const { reply, voice_reply } = result.data;
                const speechText = voice_reply || reply;

                toast.success(reply, { icon: '🤖' });
                speak(speechText);

                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user', content: text },
                    { role: 'assistant', content: reply }
                ]);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to process request");
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <header className={`app-header ${scrolled ? 'scrolled' : ''}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="header-breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                    <Home size={12} style={{ opacity: 0.5 }} />
                    <span style={{ opacity: 0.3 }}>/</span>
                    <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'var(--text-main)'} onMouseLeave={e => e.target.style.color = 'var(--text-sub)'}>Pages</span>
                    <span style={{ opacity: 0.3 }}>/</span>
                    <span style={{ color: 'var(--text-main)' }}>{title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '0.95rem',
                        fontWeight: '800',
                        color: 'var(--text-main)',
                        letterSpacing: '-0.02em',
                        marginTop: '2px'
                    }}>
                        {title}
                    </h2>

                    <div className="header-clock-pill" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        marginLeft: '8px',
                        height: '24px'
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary-color)', letterSpacing: '0.02em' }}>
                            {formatTime(currentTime)}
                        </span>
                        <span style={{ width: '1px', height: '10px', background: 'rgba(255, 255, 255, 0.1)' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-sub)' }}>
                            {formatDate(currentTime)}
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, justifyContent: 'flex-end' }}>


                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ position: 'relative' }}>
                        <Bell size={18} style={{ color: 'var(--text-sub)', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'var(--text-main)'} onMouseLeave={e => e.target.style.color = 'var(--text-sub)'} />
                        <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', background: 'var(--primary-color)', borderRadius: '50%', border: '1px solid var(--bg-color)' }} />
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer'
                    }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.3)' }}>
                            <User size={12} color="white" />
                        </div>
                        <span className="user-name-text" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            {user?.name || 'User'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={onMenuClick}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', display: 'flex' }}
                    className="menu-toggle-btn"
                >
                    <Menu size={18} />
                </button>
            </div>

            <style>{`
                @media (max-width: 1023px) {
                    .menu-toggle-btn {
                        display: none !important;
                    }
                }
                @media (max-width: 767px) {
                    .header-breadcrumbs {
                        display: none !important;
                    }
                    .header-clock-pill {
                        display: none !important;
                    }
                    .user-name-text {
                        display: none !important;
                    }
                    .app-header {
                        padding: 0 12px !important;
                    }
                }
                @media (max-width: 480px) {
                    .app-header h2 {
                        font-size: 0.85rem !important;
                    }
                }
            `}</style>
        </header>
    );
};

export default Header;

