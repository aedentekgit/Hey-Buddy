import api from '../services/api';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, MicOff, Send, Calendar, CheckCircle2, Clock, MapPin, Repeat, Loader2,
    Zap, Volume2, Sparkles, Plus, List, CalendarDays, Brain, FilePlus, Heart,
    ShieldPlus, Shield, X, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import { requestNotificationPermission, saveTokenToServer } from '../services/notificationService';
import { TableContainerStyle } from '../components/TableStyles';
import './BuddyAssistant.css';

const BuddyAssistant = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const {
        language, speak, isListening, isAmbient,
        transcript: globalTranscript, setTranscript, toggleListening,
        isConversationMode, setIsConversationMode,
        conversationHistory, setConversationHistory
    } = useVoiceAssistant();

    const [parsedReminder, setParsedReminder] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [saveDestination, setSaveDestination] = useState('both');
    const [isSaving, setIsSaving] = useState(false);
    const [chatResponse, setChatResponse] = useState(null);
    const [chatVoiceResponse, setChatVoiceResponse] = useState(null);
    const [localTranscript, setLocalTranscript] = useState('');
    const [manualInput, setManualInput] = useState('');
    const [analyzedPrescription, setAnalyzedPrescription] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [historyList, setHistoryList] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    // Auto-scroll to bottom when response changes
    useEffect(() => {
        if (chatResponse || parsedReminder || isParsing) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatResponse, parsedReminder, isParsing]);

    // Reset state when user starts speaking again for continuous conversation
    useEffect(() => {
        if (isListening && (chatResponse || parsedReminder)) {
            // Optional: Keep visual context but prepare for new input
            // setChatResponse(null); 
            // setParsedReminder(null);
        }
    }, [isListening]);

    // Listen for Google Auth callback success
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data === 'GOOGLE_AUTH_SUCCESS') {
                refreshUser();
                toast.success("Google Calendar Linked!");
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [refreshUser]);

    // Use global transcript or local one
    const transcript = globalTranscript || localTranscript;

    // Check if we received reminder data from navigation
    useEffect(() => {
        if (location.state?.parsedReminder) {
            setParsedReminder(location.state.parsedReminder);
            if (location.state.reply) {
                toast.success(location.state.reply);
                // Also add to history if entering from navigation
                setConversationHistory(prev => [...prev,
                { role: 'assistant', content: location.state.reply }
                ]);
            }
            // Clear the navigation state
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, setConversationHistory]);

    useEffect(() => {
        const setupNotifications = async () => {
            const token = await requestNotificationPermission();
            if (token) {
                await saveTokenToServer(token);
            }
        };
        setupNotifications();
    }, []);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const response = await api.get('/conversations');
            if (response.data.success) {
                setHistoryList(response.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadConversation = async (id) => {
        try {
            const response = await api.get(`/conversations/${id}`);
            if (response.data.success) {
                const conv = response.data.data;
                setCurrentConversationId(conv._id);
                setConversationHistory(conv.messages);
                setChatResponse(conv.messages[conv.messages.length - 1].content);
                setShowHistory(false);
            }
        } catch (error) {
            toast.error("Failed to load conversation");
        }
    };

    const deleteConversation = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Delete this conversation?")) return;
        try {
            await api.delete(`/conversations/${id}`);
            setHistoryList(prev => prev.filter(c => c._id !== id));
            if (id === currentConversationId) {
                setCurrentConversationId(null);
                setConversationHistory([]);
                setChatResponse(null);
            }
            toast.success("Conversation deleted");
        } catch (error) {
            toast.error("Failed to delete");
        }
    };

    const startNewChat = () => {
        setCurrentConversationId(null);
        setConversationHistory([]);
        setChatResponse(null);
        setParsedReminder(null);
        setShowHistory(false);
    };

    useEffect(() => {
        if (showHistory) {
            fetchHistory();
        }
    }, [showHistory]);

    const handleParse = async (manualText = null) => {
        // Expanded wake word regex for cleanup
        const wakeWordRegex = /^(hey\s+buddy|hello\s+buddy|hi\s+buddy|हे\s+बडी|हाय\s+बडी|नमस्ते\s+बडी|ஹே\s+படி|ஹே\s+பட்டி|வணக்கம்\s+பட்டி|హే\s+బడ్డీ|హలో\s+బడ్డీ|హే\s+బడ్డి|ಹೇ\s+ಬಡ್ಡಿ)[,\s.]*/gi;
        const textToParse = (manualText || transcript).replace(wakeWordRegex, '').trim();

        if (!textToParse || textToParse.trim() === '') return;
        if (textToParse.length < 3) return;

        setIsParsing(true);
        // Don't clear immediately to allow user to see what they said
        // setParsedReminder(null);
        // setChatResponse(null);
        setTranscript(''); // Clear global transcript once we start parsing

        try {
            // Pass history AND conversationId for context!
            const result = await voiceService.parseVoice(textToParse, language, conversationHistory, currentConversationId);

            if (result.success) {
                const { type, data, reply, voice_reply } = result.data;
                const { conversationId } = result.meta || {};

                if (conversationId && !currentConversationId) {
                    setCurrentConversationId(conversationId);
                }

                const speechText = voice_reply || reply;

                // Update History (Frontend)
                const newTurns = [
                    { role: 'user', content: textToParse },
                    { role: 'assistant', content: reply || (type === 'reminder' ? 'Reminder Set' : 'Done') }
                ];
                setConversationHistory(prev => [...prev, ...newTurns]);

                if (type === 'chat') {
                    setChatResponse(reply);
                    setChatVoiceResponse(speechText);
                    speak(speechText);
                    setParsedReminder(null); // Clear reminder if it's just chat
                } else if (type === 'reminder') {
                    setParsedReminder(data);
                    setChatResponse(reply); // Show the reply text too
                    setChatVoiceResponse(speechText);
                    if (reply) speak(speechText);
                }

                if (result.isDemo) {
                    toast.success("Parsed in Demo Mode");
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to process voice command.");
        } finally {
            setIsParsing(false);
            setManualInput(''); // Clear input after processing
        }
    };

    useEffect(() => {
        // Determine if we should parse automatically (only for voice)
        const shouldParse = transcript.length > 3 && !isParsing;

        if (isListening) {
            // User is still potentially speaking, wait for pause
            const timeout = setTimeout(() => {
                if (shouldParse) {
                    handleParse();
                }
            }, 1500); // 1.5s silence to trigger processing
            return () => clearTimeout(timeout);
        } else {
            // Mic stopped. If we have a pending transcript so parse it.
            if (shouldParse && !isParsing) {
                handleParse();
            }
        }
    }, [transcript, isListening, isParsing]);

    const handleSave = async () => {
        if (!parsedReminder) return;
        setIsSaving(true);
        try {
            const result = await voiceService.saveReminder(parsedReminder, saveDestination);
            if (result.success) {
                toast.success("Reminder saved successfully!");
                setParsedReminder(null);
                setLocalTranscript('');
                setTimeout(() => navigate('/admin/reminders'), 1500);
            }
        } catch (error) {
            toast.error("Failed to save.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLinkCalendar = async () => {
        try {
            const { url } = await voiceService.getGoogleAuthUrl();
            const width = 600, height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            window.open(url, 'Link Google Calendar', `width=${width},height=${height},left=${left},top=${top}`);
        } catch (error) {
            toast.error("Failed to start Google linking process.");
        }
    };

    const handleCancel = () => {
        setParsedReminder(null);
        setChatResponse(null);
        setChatVoiceResponse(null);
        setLocalTranscript('');
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualInput.trim()) {
            handleParse(manualInput);
        }
    };

    const toggleMic = () => {
        if (isListening) {
            toggleListening(); // Stop
        } else {
            toggleListening(); // Start
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setAnalyzedPrescription(null);
        setChatResponse(null);
        setParsedReminder(null);

        try {
            const res = await voiceService.uploadPrescription(file, language);
            if (res.success) {
                setAnalyzedPrescription(res.data);
                speak(res.data.summary);
                toast.success("Prescription analyzed!");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to analyze prescription");
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirmMedicalReminders = async () => {
        if (!analyzedPrescription) return;
        setIsSaving(true);
        try {
            const res = await voiceService.confirmMedicalReminders(
                analyzedPrescription._id,
                analyzedPrescription.extractedData
            );
            if (res.success) {
                toast.success(res.message);
                speak(language.startsWith('hi') ? "दवा के रिमाइंडर सेट कर दिए गए हैं।" : "Medical reminders have been set successfully.");
                setAnalyzedPrescription(null);
                refreshUser();
            }
        } catch (err) {
            toast.error("Failed to save reminders");
        } finally {
            setIsSaving(false);
        }
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return 'Not set';
        try {
            if (timeStr.includes(':')) {
                const [hours, mins] = timeStr.split(':');
                const h = parseInt(hours);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                return `${h12}:${mins} ${ampm}`;
            }
        } catch (e) {
            return timeStr;
        }
        return timeStr;
    };

    const quickCommands = [
        { icon: <Plus size={18} />, text: "Create reminder", action: () => speak("What reminder would you like to set?") },
        { icon: <FilePlus size={18} />, text: "Upload Prescription", action: () => fileInputRef.current?.click() },
        { icon: <CalendarDays size={18} />, text: "Check my schedule", action: () => handleParse("Check my schedule") },
        { icon: <Clock size={18} />, text: "What's next today", action: () => handleParse("What's next today") },
        { icon: <Brain size={18} />, text: "Remembered things", action: () => navigate('/admin/memories') },
        { icon: <List size={18} />, text: "Show active reminders", action: () => navigate('/admin/reminders') },
    ];

    return (
        <div className="assistant-page-wrapper">
            {/* History Sidebar */}
            <AnimatePresence>
                {showHistory && (
                    <>
                        <motion.div
                            className="history-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowHistory(false)}
                        />
                        <motion.div
                            className="history-sidebar"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                            <div className="history-sidebar-header">
                                <div className="header-title">
                                    <Clock size={20} />
                                    <h3>History</h3>
                                </div>
                                <button className="close-history" onClick={() => setShowHistory(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <button className="new-chat-btn" onClick={startNewChat}>
                                <Plus size={18} />
                                Start New Chat
                            </button>

                            <div className="history-list-scroll">
                                {historyLoading ? (
                                    <div className="history-loading">
                                        <Loader2 className="animate-spin" />
                                        <span>Loading history...</span>
                                    </div>
                                ) : historyList.length === 0 ? (
                                    <div className="history-empty">
                                        <Sparkles size={32} opacity={0.3} />
                                        <p>No conversations yet</p>
                                    </div>
                                ) : (
                                    historyList.map(chat => (
                                        <div
                                            key={chat._id}
                                            className={`history-item ${chat._id === currentConversationId ? 'active' : ''}`}
                                            onClick={() => loadConversation(chat._id)}
                                        >
                                            <div className="history-item-content">
                                                <span className="history-item-title">{chat.title || 'Chat'}</span>
                                                <span className="history-item-date">{new Date(chat.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <button
                                                className="delete-history-btn"
                                                onClick={(e) => deleteConversation(e, chat._id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="assistant-container" style={{ color: 'var(--text-main)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <button
                    className="history-toggle-btn"
                    onClick={() => setShowHistory(true)}
                >
                    <Clock size={20} />
                    <span>History</span>
                </button>
                <div className="center-interaction" style={{ flex: 1 }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                    />

                    <AnimatePresence mode="wait">
                        {analyzedPrescription ? (
                            <motion.div
                                key="analyzed-prescription"
                                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                className="analysis-card-glass"
                                style={{ position: 'relative', zIndex: 10 }}
                            >
                                <div className="analysis-header">
                                    <div className="analysis-icon">
                                        <ShieldPlus size={24} color="#10b981" />
                                    </div>
                                    <div className="analysis-title">
                                        <h3>Medical Analysis</h3>
                                        <p>Prescription from {analyzedPrescription.extractedData.doctorName || 'Doctor'}</p>
                                    </div>
                                    <button className="analysis-close" onClick={() => setAnalyzedPrescription(null)}>
                                        <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
                                    </button>
                                </div>

                                <div className="analysis-body">
                                    {analyzedPrescription.extractedData.patientName && (
                                        <div className="patient-tag">
                                            <Heart size={14} /> <span>Patient: {analyzedPrescription.extractedData.patientName}</span>
                                        </div>
                                    )}

                                    <div className="medicines-list">
                                        {analyzedPrescription.extractedData.medicines.map((med, idx) => (
                                            <div key={idx} className="medicine-item-vision">
                                                <div className="med-info-main">
                                                    <div className="med-capsule">
                                                        <span className="med-name">{med.name}</span>
                                                        <span className="med-dosage">{med.dosage}</span>
                                                    </div>
                                                    <div className="med-frequency">
                                                        {med.frequency.morning && <span className="freq-pill">Morning</span>}
                                                        {med.frequency.afternoon && <span className="freq-pill">Afternoon</span>}
                                                        {med.frequency.night && <span className="freq-pill">Night</span>}
                                                    </div>
                                                </div>
                                                <div className="med-details-row">
                                                    <span className="med-timing"><Clock size={12} /> {med.timing || 'As directed'}</span>
                                                    <span className="med-duration"><Calendar size={12} /> {med.duration || '5 days'}</span>
                                                </div>
                                                {med.instructions && <p className="med-instr">Note: {med.instructions}</p>}
                                            </div>
                                        ))}
                                    </div>

                                    {analyzedPrescription.extractedData.notes && (
                                        <div className="analysis-notes">
                                            <label>Additional Notes</label>
                                            <p>{analyzedPrescription.extractedData.notes}</p>
                                        </div>
                                    )}

                                    <div className="medical-disclaimer">
                                        <Shield size={12} /> This is a reminder assistant, not medical advice.
                                    </div>
                                </div>

                                <div className="analysis-footer">
                                    <button
                                        className="btn-vision-primary"
                                        onClick={handleConfirmMedicalReminders}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                        Set Medication Reminders
                                    </button>
                                </div>
                            </motion.div>
                        ) : parsedReminder ? (
                            <motion.div
                                key="parsed-card"
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                className="confirmation-card"
                                style={{ position: 'relative', zIndex: 10 }}
                            >
                                <div className="confirmation-header">
                                    <CheckCircle2 size={32} color="var(--primary-color)" />
                                    <div>
                                        <h3>Review Reminder</h3>
                                        <p>Ready to save {parsedReminder.intent}</p>
                                    </div>
                                    <button className="cancel-corner-btn" onClick={handleCancel}>
                                        <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
                                    </button>
                                </div>

                                <div className="reminder-details">
                                    <div className="detail-item">
                                        <span className="detail-label">Title</span>
                                        <span className="detail-value">{parsedReminder.title}</span>
                                    </div>
                                    <div className="detail-row">
                                        <div className="detail-item">
                                            <span className="detail-label">Date</span>
                                            <span className="detail-value">{parsedReminder.date || 'Today'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Time</span>
                                            <span className="detail-value">{formatTime(parsedReminder.time)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="confirmation-actions">
                                    <div className="save-selector">
                                        <button
                                            className={saveDestination === 'buddy' ? 'active' : ''}
                                            onClick={() => setSaveDestination('buddy')}
                                        >
                                            Buddy Only
                                        </button>
                                        <button
                                            className={saveDestination === 'both' ? 'active' : ''}
                                            onClick={() => setSaveDestination('both')}
                                        >
                                            Buddy + Google
                                        </button>
                                    </div>
                                    <button
                                        className="btn-save-confirm"
                                        onClick={handleSave}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                        Confirm and Save
                                    </button>
                                </div>
                            </motion.div>
                        ) : chatResponse ? (
                            <motion.div
                                key="chat-response"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="chat-response-card"
                                style={{ position: 'relative', zIndex: 10 }}
                            >
                                <div className="chat-response-header">
                                    <p className="chat-query-label">You asked:</p>
                                    {globalTranscript && <p className="chat-query-text">"{globalTranscript}"</p>}
                                </div>

                                <div className="chat-answer-section">
                                    <div className="chat-buddy-header">
                                        <p className="chat-buddy-label">Buddy says:</p>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                type="button"
                                                className="chat-replay-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    speak(chatVoiceResponse || chatResponse);
                                                }}
                                                title="Play again"
                                            >
                                                <Volume2 size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                className="chat-replay-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancel();
                                                }}
                                                title="Close"
                                                style={{ color: '#ef4444' }}
                                            >
                                                <Plus size={18} style={{ transform: 'rotate(45deg)' }} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="chat-buddy-text">{chatResponse}</p>
                                </div>
                            </motion.div>
                        ) : (isParsing || isSaving || isUploading) ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="loader-section"
                                style={{ color: 'var(--primary-color)' }}
                            >
                                <div className="loading-orbit">
                                    <Loader2 className="animate-spin" size={64} />
                                    <Sparkles className="sparkle-ai" size={24} />
                                </div>
                                <span style={{ marginTop: '1.5rem', display: 'block', fontWeight: '600', fontSize: '1.1rem', letterSpacing: '0.02em' }}>
                                    {isUploading ? "Analyzing Prescription..." : isSaving ? "Saving Reminder..." : "Buddy is thinking..."}
                                </span>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="default-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    position: 'relative',
                                    zIndex: (isListening || isConversationMode) ? 950 : 1
                                }}
                            >
                                <div className="mic-wrapper">
                                    <button className={`main-mic-btn ${isListening ? 'listening' : ''} ${isParsing ? 'parsing' : ''}`} onClick={toggleMic}>
                                        <div className="ai-orb-container">
                                            <div className="ai-orb-glow"></div>
                                            <div className="ai-orb-ring ai-orb-ring-1"></div>
                                            <div className="ai-orb-ring ai-orb-ring-2"></div>
                                            <div className="ai-orb-ring ai-orb-ring-3"></div>
                                            <div className="ai-orb-inner">
                                                <div className="ai-orb-flux"></div>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {(isListening || isConversationMode) && (
                                    <div className="interaction-text">
                                        <h2 className={isListening ? 'text-gradient-animate' : ''}>
                                            {isListening ? "I'm Listening..." : "Conversation Active..."}
                                        </h2>
                                        {isListening && <p className="listening-subtext">Go ahead, I'm listening.</p>}
                                        {isConversationMode && !isListening && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <p className="listening-subtext ambient">Session is active, no wake word needed</p>
                                                <button
                                                    onClick={() => setIsConversationMode(false)}
                                                    style={{
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        padding: '4px 12px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '700',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    End Session
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="quick-commands-section">
                                    <span className="quick-commands-label">Quick Commands</span>
                                    <div className="commands-list">
                                        {quickCommands.map((cmd, index) => (
                                            <button key={index} className="command-pill" onClick={cmd.action}>
                                                <div className="command-icon-box">
                                                    {cmd.icon}
                                                </div>
                                                <span className="command-text">{cmd.text}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div ref={chatEndRef} />
                </div>

                {/* Input Area - Restored for the main Buddy AI page */}
                <div className="input-area">
                    <form onSubmit={handleManualSubmit} className="input-container">
                        <input
                            type="text"
                            className="text-input"
                            placeholder="Type or speak to Buddy..."
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            disabled={isListening}
                        />
                        <button
                            type="submit"
                            className="send-btn-round"
                            style={{
                                background: manualInput.trim() ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                                color: manualInput.trim() ? 'white' : 'rgba(255,255,255,0.35)',
                            }}
                            disabled={isParsing}
                            onClick={(e) => {
                                if (!manualInput.trim()) {
                                    e.preventDefault();
                                    toggleMic();
                                }
                            }}
                        >
                            {manualInput.trim() ? <Send size={20} /> : <Mic size={22} style={{ color: isListening ? '#ef4444' : 'inherit' }} />}
                        </button>
                    </form>
                </div>

                <style>{`
                .assistant-container {
                    position: relative;
                }
                .assistant-container::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 600px;
                    height: 600px;
                    background: radial-gradient(circle, rgba(var(--primary-rgb), 0.05) 0%, transparent 70%);
                    pointer-events: none;
                    z-index: 0;
                }
                .animate-spin { animation: spin 1s linear infinite; } 
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* History Sidebar Styles */
                .assistant-page-wrapper {
                    display: flex;
                    height: calc(100vh - 84px);
                    width: 100%;
                    overflow: hidden;
                    position: relative;
                }

                .history-toggle-btn {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    color: var(--text-main);
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s;
                }

                .history-toggle-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: var(--primary-color);
                }

                .history-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    z-index: 1000;
                }

                .history-sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: 320px;
                    background: var(--bg-lite);
                    border-right: 1px solid var(--border-color);
                    z-index: 1001;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 20px 0 50px rgba(0, 0, 0, 0.3);
                }

                .history-sidebar-header {
                    padding: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid var(--border-color);
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: var(--text-main);
                }

                .header-title h3 {
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin: 0;
                }

                .close-history {
                    background: none;
                    border: none;
                    color: var(--text-sub);
                    cursor: pointer;
                    padding: 4px;
                    transition: color 0.2s;
                }

                .close-history:hover {
                    color: var(--text-main);
                }

                .new-chat-btn {
                    margin: 20px;
                    padding: 12px;
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .new-chat-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.4);
                }

                .history-list-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 12px 24px;
                }

                .history-item {
                    padding: 14px 16px;
                    border-radius: 12px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: transparent;
                    border: 1px solid transparent;
                }

                .history-item:hover {
                    background: rgba(255, 255, 255, 0.03);
                    border-color: rgba(255, 255, 255, 0.05);
                }

                .history-item.active {
                    background: rgba(var(--primary-rgb), 0.1);
                    border-color: rgba(var(--primary-rgb), 0.2);
                }

                .history-item-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    overflow: hidden;
                }

                .history-item-title {
                    color: var(--text-main);
                    font-size: 0.9rem;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .history-item-date {
                    color: var(--text-sub);
                    font-size: 0.75rem;
                }

                .delete-history-btn {
                    opacity: 0;
                    background: none;
                    border: none;
                    color: var(--text-sub);
                    padding: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .history-item:hover .delete-history-btn {
                    opacity: 1;
                }

                .delete-history-btn:hover {
                    color: #ef4444;
                }

                .history-empty, .history-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    color: var(--text-sub);
                    text-align: center;
                    gap: 12px;
                }
            `}</style>
            </div>
        </div>
    );
};

export default BuddyAssistant;
