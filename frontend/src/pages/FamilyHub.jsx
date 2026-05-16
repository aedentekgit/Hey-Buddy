import { useState, useEffect, useRef } from 'react';
import {
    Users, UserPlus, ShieldAlert, MessageCircle, UserMinus,
    Check, X, Mail, Loader2, Send,
    Lock, ShieldCheck, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUrl';

const FamilyHub = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connectEmail, setConnectEmail] = useState('');
    const [isSendingRequest, setIsSendingRequest] = useState(false);
    const [isSendingEmergency, setIsSendingEmergency] = useState(false);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef(null);

    useEffect(() => {
        fetchData();
        // Set up interval for refreshing messages/requests
        const interval = setInterval(() => {
            fetchData(false);
            if (activeChat) fetchMessages(activeChat.chat_id, false);
        }, 10000);
        return () => clearInterval(interval);
    }, [activeChat?.chat_id]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const fetchData = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const [membersRes, requestsRes] = await Promise.all([
                api.get('/family/members'),
                api.get('/family/requests')
            ]);

            if (membersRes.data.success) setMembers(membersRes.data.data);
            if (requestsRes.data.success) setRequests(requestsRes.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleConnect = async (e) => {
        e.preventDefault();
        if (!connectEmail) return;

        try {
            setIsSendingRequest(true);
            const res = await api.post('/family/request', { email: connectEmail });
            if (res.data.success) {
                toast.success(res.data.message || "Invitation sent!");
                setConnectEmail('');
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to send request");
        } finally {
            setIsSendingRequest(false);
        }
    };

    const handleRespond = async (requestId, action) => {
        try {
            const res = await api.post('/family/respond', { request_id: requestId, action });
            if (res.data.success) {
                toast.success(res.data.message);
                fetchData();
            }
        } catch (err) {
            toast.error("Action failed");
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!window.confirm("Are you sure you want to remove this family member?")) return;
        try {
            const res = await api.delete(`/family/member/${memberId}`);
            if (res.data.success) {
                toast.success("Member removed");
                fetchData();
            }
        } catch (err) {
            toast.error("Failed to remove member");
        }
    };

    const handleEmergencyAlert = async () => {
        if (!window.confirm("🚨 SEND EMERGENCY ALERT TO ALL FAMILY MEMBERS?")) return;

        try {
            setIsSendingEmergency(true);
            const res = await api.post('/family/emergency', { message: "Emergency help needed immediately!" });
            if (res.data.success) {
                toast.success("🚨 ALERT SENT!", {
                    duration: 5000,
                    style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' }
                });
            }
        } catch (err) {
            toast.error("Failed to send alert");
        } finally {
            setIsSendingEmergency(false);
        }
    };

    const startChat = async (memberId) => {
        try {
            const res = await api.get(`/chat/private/start?member_id=${memberId}`);
            if (res.data.success) {
                setActiveChat(res.data.data);
                fetchMessages(res.data.data.chat_id);
            }
        } catch (err) {
            toast.error("Could not start chat");
        }
    };

    const startGroupChat = async () => {
        try {
            const res = await api.get('/chat/group');
            if (res.data.success) {
                setActiveChat(res.data.data);
                fetchMessages(res.data.data.chat_id);
            }
        } catch (err) {
            toast.error("No family group chat found.");
        }
    };

    const fetchMessages = async (chatId, showLoading = true) => {
        try {
            const res = await api.get(`/chat/messages?chat_id=${chatId}`);
            if (res.data.success) {
                setMessages(res.data.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChat) return;

        try {
            const res = await api.post('/chat/send', {
                chat_id: activeChat.chat_id,
                content: newMessage
            });
            if (res.data.success) {
                setNewMessage('');
                fetchMessages(activeChat.chat_id);
            }
        } catch (err) {
            toast.error("Failed to send message");
        }
    };

    return (
        <div className="family-hub-page" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', color: 'var(--text-main)' }}>

            {/* Header Section */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="family-hub-header-actions"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '32px',
                    gap: '20px'
                }}
            >
                <div>
                    <h1 style={{ fontSize: '2.4rem', fontStretch: '120%', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Users size={40} color="var(--primary-color)" /> Family Hub
                    </h1>
                    <p style={{ color: 'var(--text-sub)', fontWeight: '500' }}>Stay connected and keep your loved ones safe with real-time updates.</p>
                </div>

                <button
                    onClick={handleEmergencyAlert}
                    disabled={isSendingEmergency}
                    className="btn btn-premium animate-pulse-glow"
                    style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)',
                        padding: '16px 32px'
                    }}
                >
                    <ShieldAlert size={20} />
                    <span style={{ letterSpacing: '0.05em' }}>EMERGENCY BROADCAST</span>
                </button>
            </motion.header >

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>

                {/* Left Panel: Family Management (5 cols) */}
                <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: '24px' }} className="management-panel">

                    {/* Invite Section */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={18} color="var(--primary-color)" /> Invite Family
                        </h3>
                        <form onSubmit={handleConnect} className="family-hub-invite-form" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                <input
                                    type="email"
                                    placeholder="Enter family member's email"
                                    value={connectEmail}
                                    onChange={(e) => setConnectEmail(e.target.value)}
                                    style={{ paddingLeft: '44px' }}
                                />
                            </div>
                            <button type="submit" className="btn-primary" disabled={isSendingRequest || !connectEmail}>
                                {isSendingRequest ? <Loader2 size={18} className="animate-spin" /> : 'Invite'}
                            </button>
                        </form>
                    </div>

                    {/* Pending Requests */}
                    <AnimatePresence>
                        {requests.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="glass-panel"
                                style={{ padding: '24px', background: 'rgba(255, 191, 0, 0.05)', borderColor: 'rgba(255, 191, 0, 0.2)' }}
                            >
                                <h3 className="section-title" style={{ color: '#b45309' }}>Connection Requests</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                    {requests.map(req => (
                                        <div key={req.request_id} className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                                                    {req.sender_name[0]}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>{req.sender_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{req.sender_email}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleRespond(req.request_id, 'accept')} style={{ padding: '8px', background: '#10b981', color: 'white', borderRadius: '8px' }}><Check size={16} /></button>
                                                <button onClick={() => handleRespond(req.request_id, 'decline')} style={{ padding: '8px', background: '#ef4444', color: 'white', borderRadius: '8px' }}><X size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Members List */}
                    <div className="glass-panel" style={{ padding: '24px', flex: 1 }}>
                        <div className="family-hub-circle-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 className="section-title" style={{ margin: 0 }}>Family Circle</h3>
                            <button onClick={startGroupChat} style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary-color)', background: 'none' }}>
                                FAMILY GROUP CHAT
                            </button>
                        </div>

                        {loading && members.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 size={32} className="animate-spin" color="var(--primary-color)" /></div>
                        ) : members.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-sub)' }}>
                                <Heart size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                <p>Start your family circle by inviting members.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {members.map(member => (
                                    <motion.div
                                        key={member.user_id || member.email}
                                        whileHover={{ x: 5 }}
                                        className="glass-card"
                                        style={{
                                            padding: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => member.user_id && startChat(member.user_id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-lite)', border: '2px solid var(--border-color)' }}>
                                                    {member.profilePicture ? (
                                                        <img src={getImageUrl(member.profilePicture)} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-sub)' }}>
                                                            {member.name[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '-2px',
                                                    right: '-2px',
                                                    width: '14px',
                                                    height: '14px',
                                                    borderRadius: '50%',
                                                    background: member.status === 'connected' ? '#10b981' : '#fbbf24',
                                                    border: '2px solid white'
                                                }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '800', fontSize: '1rem' }}>{member.name} {member.user_id === user?._id && <span style={{ color: 'var(--primary-color)', fontSize: '0.7rem' }}>(YOU)</span>}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{member.email}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {member.user_id !== user?._id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.user_id); }}
                                                    className="btn-icon"
                                                    style={{ color: 'var(--danger-color)', width: '36px', height: '36px' }}
                                                >
                                                    <UserMinus size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Chat (7 cols) */}
                <div style={{ gridColumn: 'span 7' }} className="chat-panel">
                    <div className="glass-panel" style={{ height: '700px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        {!activeChat ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
                                <div style={{ width: '80px', height: '80px', background: 'var(--bg-lite)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                    <MessageCircle size={40} style={{ opacity: 0.2 }} />
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px' }}>Private & Secure Chat</h3>
                                <p style={{ color: 'var(--text-sub)', maxWidth: '300px', margin: '0 auto 32px auto' }}>
                                    Select a family member to start an end-to-end encrypted private conversation.
                                </p>
                                <button className="btn-premium" onClick={startGroupChat}>
                                    <Users size={18} /> OPEN FAMILY GROUP
                                </button>

                                <div style={{ marginTop: '48px', display: 'flex', gap: '24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-sub)' }}>
                                        <ShieldCheck size={16} color="#10b981" /> SECURE
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-sub)' }}>
                                        <Lock size={16} color="#10b981" /> ENCRYPTED
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Chat Header */}
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255,255,255,0.3)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {activeChat.type === 'group' ? <Users size={20} color="white" /> : <MessageCircle size={20} color="white" />}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: '800', fontSize: '1rem' }}>{activeChat.type === 'group' ? "Family Group Chat" : "Private Conversation"}</div>
                                            <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: '800', letterSpacing: '0.05em' }}>END-TO-END ENCRYPTED</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveChat(null)} className="btn-icon"><X size={20} /></button>
                                </div>

                                {/* Messages */}
                                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {messages.length === 0 ? (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                            No messages yet. Send a greeting!
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => {
                                            const isMe = msg.sender_id === user?._id;
                                            return (
                                                <div key={msg.id || idx} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                    <div style={{
                                                        maxWidth: '75%',
                                                        padding: '12px 16px',
                                                        borderRadius: '16px',
                                                        borderTopRightRadius: isMe ? '4px' : '16px',
                                                        borderTopLeftRadius: !isMe ? '4px' : '16px',
                                                        background: isMe ? 'var(--primary-color)' : 'var(--bg-lite)',
                                                        color: isMe ? 'white' : 'var(--text-main)',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                                        position: 'relative'
                                                    }}>
                                                        {activeChat.type === 'group' && !isMe && (
                                                            <div style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.7 }}>{msg.sender_name}</div>
                                                        )}
                                                        <div style={{ fontSize: '0.9rem', fontWeight: '500', lineHeight: '1.4' }}>{msg.content}</div>
                                                        <div style={{ fontSize: '0.6rem', textAlign: 'right', marginTop: '4px', opacity: 0.6 }}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Chat Input */}
                                <form onSubmit={handleSendMessage} style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.3)' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            type="text"
                                            placeholder="Type a secure message..."
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            style={{ flex: 1, borderRadius: '16px', border: '1px solid var(--border-color)', padding: '12px 20px', background: 'white' }}
                                        />
                                        <button type="submit" className="btn-primary" style={{ width: '48px', height: '48px', padding: 0, borderRadius: '16px' }} disabled={!newMessage.trim()}>
                                            <Send size={20} />
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .family-hub-page {
                    transition: all 0.3s ease;
                }
                
                @media (max-width: 1024px) {
                    .family-hub-page .management-panel, 
                    .family-hub-page .chat-panel {
                        grid-column: span 12 !important;
                    }
                    .family-hub-page .chat-panel .glass-panel {
                        height: 500px !important;
                    }
                }

                @media (max-width: 768px) {
                    .family-hub-page {
                        padding: 16px !important;
                    }
                    .family-hub-page h1 {
                        font-size: 1.8rem !important;
                    }
                    .family-hub-page .btn-premium {
                        width: 100%;
                        padding: 14px 20px !important;
                        font-size: 0.85rem !important;
                    }
                    .family-hub-page .glass-panel {
                        padding: 20px !important;
                        border-radius: var(--radius-md) !important;
                    }
                    .family-hub-invite-form {
                        flex-direction: column;
                    }
                    .family-hub-invite-form button {
                        width: 100%;
                    }
                    .family-hub-header-actions {
                        flex-direction: column;
                        align-items: stretch !important;
                    }
                }

                @media (max-width: 480px) {
                    .family-hub-page h1 {
                        font-size: 1.5rem !important;
                    }
                    .family-hub-page p {
                        font-size: 0.85rem !important;
                    }
                    .family-hub-circle-header {
                        flex-direction: column;
                        align-items: flex-start !important;
                        gap: 12px;
                    }
                }
            `}</style>

        </div >
    );
};

export default FamilyHub;
