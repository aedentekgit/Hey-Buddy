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
import { TableContainerStyle } from '../components/TableStyles';
import GeminiVoiceAssistant from '../components/GeminiVoiceAssistant';
import voiceService from '../services/voiceService';
import './BuddyAssistant.css';

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
    // Legacy context states simulation for cards that still use them
    const [conversationHistory, setConversationHistory] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);

    const handleToolCall = async (name, args) => {
        if (name === 'create_reminder') {
            const { title, time, notes } = args;
            const reminder = {
                title,
                time,
                notes: notes || '',
                date: new Date().toISOString().split('T')[0]
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
            const res = await voiceService.uploadPrescription(file);
            if (res.success) {
                setAnalyzedPrescription(res.data);
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
                // If it already contains AM/PM, don't re-format
                if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
                    return timeStr;
                }
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
        { icon: <Plus size={18} />, text: "Create reminder", action: () => toast.info("Just say 'Set a reminder' to Gemini!") },
        { icon: <FilePlus size={18} />, text: "Upload Prescription", action: () => fileInputRef.current?.click() },
        { icon: <Brain size={18} />, text: "Remembered things", action: () => navigate('/admin/memories') },
        { icon: <List size={18} />, text: "Show active reminders", action: () => navigate('/admin/reminders') },
    ];

    return (
        <div className="assistant-page-wrapper" style={{ background: 'var(--bg-color)', minHeight: '100vh', overflow: 'hidden' }}>
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
                                background: 'rgba(15, 23, 42, 0.9)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div className="history-sidebar-header" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                                <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Clock size={20} className="text-indigo-400" />
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Conversation History</h3>
                                </div>
                                <button className="close-history" onClick={() => setShowHistory(false)} style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '50%', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
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
                                                    <span className="history-item-date" style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{new Date(chat.createdAt).toLocaleDateString()}</span>
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

            <div className="assistant-container" style={{ padding: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {!isMobile && (
                    <div style={{ position: 'fixed', left: '24px', top: '24px', display: 'flex', gap: '12px', zIndex: 100 }}>
                        <button
                            className="glass-card"
                            onClick={() => setShowHistory(true)}
                            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px' }}
                        >
                            <Clock size={20} className="text-indigo-400" />
                            <span style={{ fontWeight: '600' }}>History</span>
                        </button>
                        <button
                            className="glass-card"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ padding: '12px', borderRadius: '12px' }}
                        >
                            <Camera size={20} className="text-cyan-400" />
                        </button>
                    </div>
                )}

                <div className="center-interaction" style={{ flex: 1, width: '100%', maxWidth: '800px', padding: '120px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 100px)' }}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                    />

                    <AnimatePresence mode="wait">
                        {(isSaving || isUploading) ? (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ textAlign: 'center', padding: '100px 0' }}
                            >
                                <div className="animate-float">
                                    <Loader2 className="animate-spin text-indigo-500" size={80} style={{ margin: '0 auto 24px' }} />
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                                    {isUploading ? "AI Analyzing Prescription..." : "Securing to Memory..."}
                                </h3>
                                <p style={{ color: 'var(--text-sub)' }}>Just a moment while Buddy processes your health data.</p>
                            </motion.div>
                        ) : analyzedPrescription ? (
                            <motion.div
                                key="analyzed-prescription"
                                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                className="glass-panel"
                                style={{ padding: '40px', width: '100%' }}
                            >
                                <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '16px' }}>
                                        <ShieldPlus size={32} color="#10b981" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>Medical Protocol Analysis</h3>
                                        <p style={{ color: 'var(--text-sub)' }}>Extracted from provided prescription document</p>
                                    </div>
                                    <button onClick={() => setAnalyzedPrescription(null)} style={{ opacity: 0.5, background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="medicines-list" style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
                                    {analyzedPrescription.extractedData.medicines.map((med, idx) => (
                                        <div key={idx} className="glass-card" style={{ padding: '20px', borderRadius: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '2px' }}>{med.name}</h4>
                                                    <span style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>Dosage: {med.dosage}</span>
                                                </div>
                                                <div className="med-frequency" style={{ display: 'flex', gap: '6px' }}>
                                                    {med.frequency.morning && <span className="badge-pill" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>Morning</span>}
                                                    {med.frequency.afternoon && <span className="badge-pill" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>Noon</span>}
                                                    {med.frequency.night && <span className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem' }}>Night</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '24px', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {med.timing || 'As directed'}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {med.duration || 'Full course'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button className="btn-premium w-full" onClick={handleConfirmMedicalReminders} style={{ width: '100%' }}>
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                    Initialize Medication Reminders
                                </button>
                            </motion.div>
                        ) : parsedReminder ? (
                            <motion.div
                                key="parsed-card"
                                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                className="glass-panel"
                                style={{ padding: '40px', textAlign: 'center', width: '100%' }}
                            >
                                <div style={{ marginBottom: '24px' }}>
                                    <div className="animate-pulse-glow" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                        <CheckCircle2 size={40} className="text-indigo-400" />
                                    </div>
                                    <h3 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px' }}>Ready to Save?</h3>
                                    <p style={{ color: 'var(--text-sub)' }}>I've parsed the details for your new reminder.</p>
                                </div>

                                <div className="glass-card" style={{ padding: '24px', marginBottom: '32px', textAlign: 'left', borderRadius: '20px' }}>
                                    <h4 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px', color: 'var(--primary-color)' }}>{parsedReminder.title}</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Calendar className="text-indigo-400" size={18} />
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Date</p>
                                                <p style={{ fontWeight: '600' }}>{parsedReminder.date || 'Today'}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Clock className="text-indigo-400" size={18} />
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Time</p>
                                                <p style={{ fontWeight: '600' }}>{formatTime(parsedReminder.time)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button className="btn-premium w-full" onClick={handleSave} style={{ width: '100%', height: '60px', fontSize: '1.1rem' }}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : <Shield size={22} />}
                                    Commit to Memory
                                </button>
                                <button onClick={handleCancel} style={{ marginTop: '20px', color: 'var(--text-sub)', fontWeight: '600', fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    Cancel and Discard
                                </button>
                            </motion.div>
                        ) : chatResponse ? (
                            <motion.div
                                key="chat-response"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="glass-panel"
                                style={{ padding: '40px', width: '100%' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Sparkles size={20} color="white" />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Buddy's Insight</h3>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>AI Generated Response</p>
                                        </div>
                                    </div>
                                    <button onClick={handleCancel} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                                <p style={{ fontSize: '1.15rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '32px' }}>
                                    {chatResponse?.replace(/\*/g, '').replace(/_/g, '')}
                                </p>
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', gap: '12px' }}>
                                    <button className="glass-card" style={{ padding: '12px 24px', fontWeight: '600', borderRadius: '12px' }} onClick={() => toast.success("Insight added to health journal.")}>
                                        Add to Journal
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="hero-section"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.1 }}
                                style={{ textAlign: 'center', width: '100%' }}
                            >
                                <div style={{ height: '40px' }} /> {/* Spacing instead of logo */}

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                                    {quickCommands.map((cmd, index) => (
                                        <button key={index} className="glass-card" onClick={cmd.action} style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', cursor: 'pointer' }}>
                                            <div style={{ color: index % 2 === 0 ? 'var(--primary-color)' : 'var(--secondary-color)' }}>
                                                {cmd.icon}
                                            </div>
                                            <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{cmd.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div ref={chatEndRef} />
                </div>

                <div className="fixed-assistant-overlay" style={{
                    position: 'relative',
                    zIndex: 200,
                    width: '100%',
                    maxWidth: '600px',
                    margin: '0 auto 60px',
                    display: (!chatResponse && !parsedReminder && !analyzedPrescription && !isSaving && !isUploading) ? 'block' : 'none'
                }}>
                    <GeminiVoiceAssistant onToolCall={handleToolCall} />
                </div>
            </div>

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
