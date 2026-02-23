import api from '../services/api';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic, MicOff, Send, Calendar, CheckCircle2, Clock, MapPin, Repeat, Loader2,
    Zap, Volume2, Sparkles, Plus, List, CalendarDays, Brain, FilePlus, Heart,
    ShieldPlus, Shield, X, Trash2, Camera, ArrowRight, Search
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import toast from 'react-hot-toast';
import { requestNotificationPermission, saveTokenToServer } from '../services/notificationService';
import { TableContainerStyle } from '../styles/tableStyles';
import GeminiVoiceAssistant from '../components/GeminiVoiceAssistant';
import voiceService from '../services/voiceService';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatTime, formatDate } from '../utils/dateUtils';
import '../styles/BuddyAssistant.css';

const BuddyAssistant = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, refreshUser } = useAuth();
    const { setPreventProcessing } = useVoiceAssistant() || {};

    const [parsedReminder, setParsedReminder] = useState(null);
    const [saveDestination, setSaveDestination] = useState('both');
    const [isSaving, setIsSaving] = useState(false);
    const [chatResponse, setChatResponse] = useState(null);
    const [chatVoiceResponse, setChatVoiceResponse] = useState(null);
    const [analyzedPrescription, setAnalyzedPrescription] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const [autoSavedId, setAutoSavedId] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [preferredLanguage, setPreferredLanguage] = useState('auto');

    // Legacy context states simulation for cards that still use them
    const [conversationHistory, setConversationHistory] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, type: 'single' });
    const loadIntoChatRef = useRef(null); // Receives the loader fn from GeminiVoiceAssistant

    const handleToolCall = async (name, args) => {
        if (name === 'create_reminder') {
            const { title, time, notes } = args;
            const reminder = {
                title,
                time,
                notes: notes || '',
                // Use Local Date (YYYY-MM-DD) to match backend worker logic
                date: new Date().toLocaleDateString('en-CA')
            };
            setParsedReminder(reminder);
            return { status: 'success', message: `Reminder for ${title} at ${time} prepared.` };
        }
        if (name === 'get_user_info') {
            return {
                name: user?.name || 'User',
                status: 'Active',
                medications: ['Aspirin', 'Lisinopril']
            };
        }
        if (name === 'save_memory') {
            const { content, category } = args;
            try {
                const result = await voiceService.createMemory(content, category);
                return { status: 'success', message: 'Memory saved successfully.' };
            } catch (err) {
                return { status: 'error', message: 'Failed to save memory.' };
            }
        }
        if (name === 'list_reminders') {
            try {
                const res = await voiceService.getReminders(1, 100);
                const reminders = res.data.data || [];
                return {
                    status: 'success',
                    reminders: reminders.map(r => ({ id: r._id, title: r.title, time: r.time, date: r.date, notes: r.notes }))
                };
            } catch (err) {
                return { status: 'error', message: 'Failed to fetch reminders.' };
            }
        }
        if (name === 'delete_reminder') {
            const { id, title } = args;
            try {
                let reminderId = id;
                if (!reminderId && title) {
                    const res = await voiceService.getReminders(1, 100);
                    const match = (res.data.data || []).find(r => r.title.toLowerCase().includes(title.toLowerCase()));
                    if (match) reminderId = match._id;
                }
                if (!reminderId) return { status: 'error', message: `Could not find reminder matching "${title || id}"` };
                await voiceService.deleteReminder(reminderId);
                return { status: 'success', message: 'Reminder deleted successfully.' };
            } catch (err) {
                return { status: 'error', message: 'Failed to delete reminder.' };
            }
        }
        if (name === 'list_memories') {
            try {
                const res = await voiceService.getMemories(1, 100);
                const memories = res.data.data || [];
                return {
                    status: 'success',
                    memories: memories.map(m => ({ id: m._id, content: m.content, category: m.category }))
                };
            } catch (err) {
                return { status: 'error', message: 'Failed to fetch memories.' };
            }
        }
        if (name === 'delete_memory') {
            const { id, query } = args;
            try {
                let memoryId = id;
                if (!memoryId && query) {
                    const res = await voiceService.getMemories(1, 100);
                    const match = (res.data.data || []).find(m => m.content.toLowerCase().includes(query.toLowerCase()));
                    if (match) memoryId = match._id;
                }
                if (!memoryId) return { status: 'error', message: `Could not find memory matching "${query || id}"` };
                await voiceService.deleteMemory(memoryId);
                return { status: 'success', message: 'Memory deleted successfully.' };
            } catch (err) {
                return { status: 'error', message: 'Failed to delete memory.' };
            }
        }
        if (name === 'search_memories') {
            const { query } = args;
            try {
                const res = await voiceService.getMemories(1, 100, query);
                const memories = res.data.data || [];
                return {
                    status: 'success',
                    results: memories.map(m => ({ content: m.content, category: m.category, date: m.createdAt }))
                };
            } catch (err) {
                return { status: 'error', message: 'Failed to search memories.' };
            }
        }
        if (name === 'get_medication_info') {
            const { medication_name } = args;
            return { status: 'success', message: `Fetching expert info for ${medication_name}...` };
        }
        if (name === 'analyze_health_summary') {
            try {
                const [remindersRes, memoriesRes] = await Promise.all([
                    voiceService.getReminders(1, 20),
                    voiceService.getMemories(1, 20)
                ]);
                const reminders = remindersRes.data.data || [];
                const memories = memoriesRes.data.data || [];
                return {
                    status: 'success',
                    data: {
                        recent_reminders: reminders.map(r => ({ title: r.title, time: r.time, date: r.date, notes: r.notes })),
                        recent_memories: memories.map(m => ({ content: m.content, category: m.category })),
                        user_context: {
                            name: user?.name || 'User',
                            status: 'Active'
                        }
                    }
                };
            } catch (err) {
                return { status: 'error', message: 'Failed to synthesize health summary.' };
            }
        }
        return { error: 'Tool not found' };
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-scroll to bottom when response changes
    useEffect(() => {
        if (chatResponse || parsedReminder) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatResponse, parsedReminder]);


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


    useEffect(() => {
        if (setPreventProcessing) {
            setPreventProcessing(true);
            return () => setPreventProcessing(false);
        }
    }, [setPreventProcessing]);


    // Check if we received reminder data from navigation (with autoSave support)
    useEffect(() => {
        if (location.state?.parsedReminder) {
            setParsedReminder(location.state.parsedReminder);
            if (location.state?.conversationId && !currentConversationId) {
                setCurrentConversationId(location.state.conversationId);
            }
            if (location.state.autoSaved) {
                setIsSaving(false);
            }
            if (location.state.autoSavedId) {
                setAutoSavedId(location.state.autoSavedId);
            }
            if (location.state.reply) {
                toast.success(location.state.reply);
                setConversationHistory(prev => [...prev,
                { role: 'assistant', content: location.state.reply }
                ]);
            }
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, setConversationHistory, currentConversationId]);



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
                setShowHistory(false);
                // Load messages directly into the chat bubble view
                if (loadIntoChatRef.current) {
                    loadIntoChatRef.current(conv.messages, conv._id);
                }
            }
        } catch (error) {
            toast.error("Failed to load conversation");
        }
    };

    const deleteConversation = async (e, id) => {
        e.stopPropagation();
        setDeleteModal({ isOpen: true, id, type: 'single' });
    };

    const deleteAllHistory = async () => {
        setDeleteModal({ isOpen: true, id: 'all', type: 'all' });
    };

    const confirmDeleteConversation = async () => {
        const { id, type } = deleteModal;
        if (!id) return;

        try {
            if (type === 'all') {
                await api.delete('/conversations');
                setHistoryList([]);
                setCurrentConversationId(null);
                setConversationHistory([]);
                setChatResponse(null);
                // Clear the chat bubble view too
                if (loadIntoChatRef.current) {
                    loadIntoChatRef.current([], null);
                }
                toast.success("All conversations deleted");
            } else {
                await api.delete(`/conversations/${id}`);
                setHistoryList(prev => prev.filter(c => c._id !== id));
                if (id === currentConversationId) {
                    setCurrentConversationId(null);
                    setConversationHistory([]);
                    setChatResponse(null);
                    // Clear the chat bubble view too
                    if (loadIntoChatRef.current) {
                        loadIntoChatRef.current([], null);
                    }
                }
                toast.success("Conversation deleted");
            }
        } catch (error) {
            toast.error("Failed to delete");
        } finally {
            setDeleteModal({ isOpen: false, id: null, type: 'single' });
        }
    };

    const startNewChat = () => {
        setCurrentConversationId(null);
        setConversationHistory([]);
        setChatResponse(null);
        setParsedReminder(null);
        setShowHistory(false);
        // Clear the chat bubble view too
        if (loadIntoChatRef.current) {
            loadIntoChatRef.current([], null);
        }
    };

    useEffect(() => {
        if (showHistory) {
            fetchHistory();
        }
    }, [showHistory]);


    const handleSave = async () => {
        if (!parsedReminder) return;
        setIsSaving(true);
        try {
            let result;
            if (autoSavedId) {
                // If we already auto-saved, update it with full details (including Google sync)
                result = await voiceService.updateReminder(autoSavedId, {
                    ...parsedReminder,
                    saveTo: saveDestination // Backend updateReminder needs to handle this or we handle it here
                });
            } else {
                result = await voiceService.saveReminder(parsedReminder, saveDestination);
            }

            if (result.success) {
                toast.success("Reminder saved successfully!");
                setParsedReminder(null);
                setAutoSavedId(null);
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
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setAnalyzedPrescription(null);
        setChatResponse(null);
        setParsedReminder(null);

        try {
            const res = await voiceService.uploadPrescription(file, preferredLanguage);
            if (res.success) {
                setAnalyzedPrescription(res.data);
                toast.success("Image analyzed!");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to analyze image");
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
                setAnalyzedPrescription(null);
                refreshUser();
            }
        } catch (err) {
            toast.error("Failed to save reminders");
        } finally {
            setIsSaving(false);
        }
    };



    const quickCommands = [
        { icon: <Plus size={18} />, text: "Create reminder", action: () => toast("Just say 'Set a reminder' to Gemini!") },
        { icon: <Camera size={18} />, text: "Upload Image", action: () => fileInputRef.current?.click() },
        { icon: <Brain size={18} />, text: "Remembered things", action: () => navigate('/admin/memories') },
        { icon: <List size={18} />, text: "Show active reminders", action: () => navigate('/admin/reminders') },
    ];

    return (
        <div className="assistant-page-wrapper" style={{ background: 'var(--bg-color)', minHeight: '100vh', overflow: 'hidden', position: 'relative' }}>
            {/* History Sidebar - Overhauled for slide-over glass effect */}
            <AnimatePresence>
                {showHistory && (
                    <>
                        <motion.div
                            className="history-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowHistory(false)}
                            style={{ backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }}
                        />
                        <motion.div
                            className="glass-panel history-sidebar"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '320px',
                                zIndex: 1000,
                                borderRadius: '0 24px 24px 0',
                                borderLeft: 'none',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div className="history-sidebar-header" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Conversation History</h3>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {historyList.length > 0 && (
                                        <button
                                            onClick={deleteAllHistory}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                                color: '#ef4444',
                                                padding: '6px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                            title="Clear All History"
                                        >
                                            <Trash2 size={12} />
                                            Clear All
                                        </button>
                                    )}
                                    <button className="close-history" onClick={() => setShowHistory(false)} style={{ background: 'var(--bg-lite)', padding: '8px', borderRadius: '50%', border: '1px solid var(--border-color)', color: 'var(--text-main)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: '24px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <button className="btn-premium w-full" onClick={startNewChat} style={{ width: '100%', marginBottom: '24px' }}>
                                    <Plus size={18} />
                                    New Conversation
                                </button>

                                <div className="history-list-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                                    {historyLoading ? (
                                        <div className="history-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0' }}>
                                            <Loader2 className="animate-spin text-indigo-500" size={32} />
                                            <span style={{ color: 'var(--text-sub)' }}>Synchronizing history...</span>
                                        </div>
                                    ) : historyList.length === 0 ? (
                                        <div className="history-empty" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-sub)' }}>
                                            <Sparkles size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
                                            <p>No past moments found</p>
                                        </div>
                                    ) : (
                                        historyList.map(chat => (
                                            <div
                                                key={chat._id}
                                                className={`glass-card history-item ${chat._id === currentConversationId ? 'active' : ''}`}
                                                onClick={() => loadConversation(chat._id)}
                                                style={{
                                                    padding: '16px',
                                                    marginBottom: '12px',
                                                    cursor: 'pointer',
                                                    border: chat._id === currentConversationId ? '1px solid var(--primary-color)' : '1px solid rgba(255,255,255,0.05)',
                                                    background: chat._id === currentConversationId ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.02)',
                                                    position: 'relative',
                                                    borderRadius: '16px'
                                                }}
                                            >
                                                <div className="history-item-content">
                                                    <span className="history-item-title" style={{ display: 'block', fontWeight: '600', fontSize: '0.95rem', marginBottom: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.title || 'Health Journal Entry'}</span>
                                                    <span className="history-item-date" style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{formatDate(chat.createdAt, user?.dateFormat)}</span>
                                                </div>
                                                <button
                                                    className="delete-history-btn"
                                                    onClick={(e) => deleteConversation(e, chat._id)}
                                                    style={{ position: 'absolute', right: '12px', top: '16px', opacity: 0.5, background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="assistant-container" style={{
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                height: '100vh',
                justifyContent: 'center',
                position: 'relative'
            }}>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                />

                {/* Main Assistant UI - ALWAYS VISIBLE */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 10
                }}>
                    <GeminiVoiceAssistant
                        onToolCall={handleToolCall}
                        quickActions={quickCommands}
                        onToggleHistory={setShowHistory}
                        language={preferredLanguage}
                        onLanguageChange={setPreferredLanguage}
                        user={user}
                        onRegisterLoader={(fn) => { loadIntoChatRef.current = fn; }}
                        onBack={() => navigate(-1)}
                    />
                </div>

                {/* Overlays / Action Cards (Modals) */}
                <AnimatePresence>
                    {(isSaving || isUploading || analyzedPrescription || parsedReminder || chatResponse) && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 100,
                                background: 'rgba(255, 255, 255, 0.4)',
                                backdropFilter: 'blur(12px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '24px'
                            }}
                        >
                            <div className="center-interaction" style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <AnimatePresence mode="wait">
                                    {(isSaving || isUploading) ? (
                                        <motion.div
                                            key="loading"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            style={{ textAlign: 'center' }}
                                        >
                                            <div className="animate-float">
                                                <Loader2 className="animate-spin text-indigo-500" size={64} style={{ margin: '0 auto 24px' }} />
                                            </div>
                                            <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                                                {isUploading ? "Analyzing Image..." : "Saving to Memory..."}
                                            </h3>
                                        </motion.div>
                                    ) : analyzedPrescription ? (
                                        <motion.div
                                            key="analyzed-prescription"
                                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                            className="glass-panel"
                                            style={{
                                                padding: '32px',
                                                width: '100%',
                                                background: 'white',
                                                borderRadius: '32px',
                                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                                                border: '1px solid rgba(0,0,0,0.05)'
                                            }}
                                        >
                                            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ background: 'var(--primary-glow)', padding: '12px', borderRadius: '16px' }}>
                                                    <ShieldPlus size={24} style={{ color: 'var(--primary-color)' }} />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Analysis Results</h3>
                                                </div>
                                                <button onClick={() => setAnalyzedPrescription(null)} style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <X size={20} />
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px', maxHeight: '40vh', overflowY: 'auto', paddingRight: '8px' }}>
                                                {analyzedPrescription.extractedData.medicines.map((med, idx) => (
                                                    <div key={idx} style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.03)' }}>
                                                        <h4 style={{ fontWeight: '700', marginBottom: '4px' }}>{med.name}</h4>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>{med.dosage} • {med.timing}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            <button className="btn-premium w-full" onClick={handleConfirmMedicalReminders} style={{ width: '100%', height: '52px' }}>
                                                Confirm & Save
                                            </button>
                                        </motion.div>
                                    ) : parsedReminder ? (
                                        <motion.div
                                            key="parsed-card"
                                            initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                            className="glass-panel"
                                            style={{
                                                padding: '32px',
                                                width: '100%',
                                                background: 'white',
                                                borderRadius: '32px',
                                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ marginBottom: '24px' }}>
                                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                                    <Calendar size={28} style={{ color: 'var(--primary-color)' }} />
                                                </div>
                                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Create Reminder?</h3>
                                            </div>

                                            <div style={{ padding: '20px', marginBottom: '24px', textAlign: 'left', borderRadius: '20px', background: 'rgba(0,0,0,0.02)' }}>
                                                <h4 style={{ fontWeight: '700', marginBottom: '8px' }}>{parsedReminder.title}</h4>
                                                <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)' }}>{formatDate(parsedReminder.date, user?.dateFormat) || 'Today'} at {formatTime(parsedReminder.time, user?.timeFormat)}</p>
                                            </div>

                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button onClick={handleCancel} style={{ flex: 1, height: '48px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'transparent', fontWeight: '600', cursor: 'pointer' }}>
                                                    Cancel
                                                </button>
                                                <button className="btn-premium" onClick={handleSave} style={{ flex: 2, height: '48px', borderRadius: '14px' }}>
                                                    Save Reminder
                                                </button>
                                            </div>
                                        </motion.div>
                                    ) : chatResponse ? (
                                        <motion.div
                                            key="chat-response"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="glass-panel"
                                            style={{
                                                padding: '32px',
                                                width: '100%',
                                                background: 'white',
                                                borderRadius: '32px',
                                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <Sparkles size={20} style={{ color: 'var(--primary-color)' }} />
                                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Buddy's Insight</h3>
                                                </div>
                                                <button onClick={handleCancel} style={{ opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '24px' }}>
                                                {chatResponse?.replace(/\*/g, '').replace(/_/g, '')}
                                            </p>
                                            <button className="btn-premium w-full" onClick={() => { toast.success("Insight saved."); handleCancel(); }}>
                                                Close
                                            </button>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null, type: 'single' })}
                onConfirm={confirmDeleteConversation}
                title={deleteModal.type === 'all' ? "Clear All History" : "Delete Conversation"}
                message={deleteModal.type === 'all'
                    ? "Are you sure you want to delete ALL conversations? This action cannot be undone."
                    : "Are you sure you want to delete this conversation? All messages will be permanently removed."}
                confirmText="Delete"
                type="danger"
            />


            <style>{`
                .animate-spin { animation: spin 1s linear infinite; } 
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .glass-card { transition: all 0.3s ease; }
                .glass-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); }

                @media (max-width: 768px) {
                    .history-sidebar { width: 85% !important; }
                    .center-interaction { padding-top: 80px !important; }
                }

                .badge-pill { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
            `}</style>
        </div>
    );
};

export default BuddyAssistant;
