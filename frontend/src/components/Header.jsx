import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Menu, Home, Mic, Send, Search, Bell, User, Trash2, CheckCircle, Clock, Info, X, Settings, LogOut, Brain } from 'lucide-react';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime, formatDate } from '../utils/dateUtils';
import { config as envConfig } from '../config/env';

const Header = ({ onMenuClick, title, hideSearch }) => {
    const [scrolled, setScrolled] = useState(false);
    const {
        speak, isListening, toggleListening, language,
        transcript, setTranscript, conversationHistory, setConversationHistory
    } = useVoiceAssistant();
    const { user } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [manualInput, setManualInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const userMenuRef = React.useRef(null);
    const notificationRef = React.useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const navigate = useNavigate();

    // Keyboard shortcut for search (Cmd+K or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const performSearch = async (val) => {
        if (!val.trim()) {
            setSearchResults(null);
            return;
        }
        setIsSearching(true);
        try {
            const res = await api.get(`/search?query=${val}`);
            if (res.data.success) {
                setSearchResults(res.data.data);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery) performSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

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



    const { logout } = useAuth();

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const getProfileImageUrl = () => {
        if (!user?.profilePicture) return null;
        if (user.profilePicture.startsWith('http')) return user.profilePicture;
        const baseUrl = envConfig.API_URL;
        const rootUrl = baseUrl.replace('/api', '');
        const cleanRoot = rootUrl.endsWith('/') ? rootUrl.slice(0, -1) : rootUrl;
        const cleanPath = user.profilePicture.startsWith('/') ? user.profilePicture : `/${user.profilePicture}`;
        return `${cleanRoot}${cleanPath}`;
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
                        background: 'var(--bg-lite)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        marginLeft: '8px',
                        height: '24px'
                    }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary-color)', letterSpacing: '0.02em' }}>
                            {formatTime(currentTime, user?.timeFormat)}
                        </span>
                        <span style={{ width: '1px', height: '10px', background: 'var(--border-color)' }} />
                        <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-sub)' }}>
                            {formatDate(currentTime, user?.dateFormat)}
                        </span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1, justifyContent: 'flex-end' }}>


                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className="notification-wrapper" style={{ position: 'relative' }} ref={notificationRef}>
                        <Bell
                            size={18}
                            style={{ color: showNotifications ? 'var(--primary-color)' : 'var(--text-sub)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                            onClick={() => setShowNotifications(!showNotifications)}
                            onMouseEnter={e => !showNotifications && (e.target.style.color = 'var(--text-main)')}
                            onMouseLeave={e => !showNotifications && (e.target.style.color = 'var(--text-sub)')}
                        />
                        {unreadCount > 0 && (
                            <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: 'var(--primary-color)', borderRadius: '50%', border: '2px solid var(--bg-color)', boxShadow: '0 0 10px rgba(var(--primary-rgb), 0.5)' }} />
                        )}

                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className="notification-dropdown"
                                >
                                    <div className="dropdown-header">
                                        <h3>Notifications</h3>
                                        {unreadCount > 0 && (
                                            <button onClick={() => markAllAsRead()}>Mark all as read</button>
                                        )}
                                    </div>
                                    <div className="notifications-list">
                                        {notifications.length > 0 ? (
                                            notifications.map(notif => (
                                                <div
                                                    key={notif._id}
                                                    className={`notification-item ${!notif.read ? 'unread' : ''}`}
                                                    onClick={() => {
                                                        markAsRead(notif._id);
                                                        if (notif.actionUrl) navigate(notif.actionUrl);
                                                        setShowNotifications(false);
                                                    }}
                                                >
                                                    <div className="notification-icon">
                                                        {notif.type === 'alert' ? <Info size={16} /> : <Bell size={16} />}
                                                    </div>
                                                    <div className="notification-content">
                                                        <p className="notif-title">{notif.title}</p>
                                                        <p className="notif-message">{notif.message}</p>
                                                        <span className="notif-time">{new Date(notif.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <button
                                                        className="delete-notif"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteNotification(notif._id);
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-notifications">
                                                <Bell size={32} opacity={0.2} />
                                                <p>No new notifications</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="user-profile-container" style={{ position: 'relative' }} ref={userMenuRef}>
                        <div
                            className="header-user-profile"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'var(--bg-lite)',
                                padding: '4px 10px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <div className="user-avatar-container" style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'var(--primary-glow)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 12px rgba(var(--primary-rgb), 0.4)',
                                transition: 'all 0.3s ease',
                                overflow: 'hidden'
                            }}>
                                {getProfileImageUrl() ? (
                                    <img
                                        src={getProfileImageUrl()}
                                        alt="User"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <User size={14} color="white" />
                                )}
                            </div>
                            <span className="user-name-text" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                {user?.name || 'User'}
                            </span>
                        </div>

                        <AnimatePresence>
                            {showUserMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="user-dropdown-menu"
                                >
                                    <div className="dropdown-user-info">
                                        <span className="info-name">{user?.name}</span>
                                        <span className="info-role">{user?.role}</span>
                                    </div>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" onClick={() => { navigate('/user/settings'); setShowUserMenu(false); }}>
                                        <Settings size={16} />
                                        <span>Account Settings</span>
                                    </button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item logout-item" onClick={() => { logout(); setShowUserMenu(false); }}>
                                        <LogOut size={16} />
                                        <span>Sign Out</span>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
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

            {/* Global Search Overlay */}
            <AnimatePresence>
                {showSearch && (
                    <motion.div
                        className="search-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="search-modal"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                        >
                            <div className="search-modal-header">
                                <Search size={20} className="modal-search-icon" />
                                <input
                                    autoFocus
                                    placeholder="Search everything..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <button className="close-search" onClick={() => setShowSearch(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="search-results-area">
                                {!searchQuery ? (
                                    <div className="search-placeholder">
                                        <Clock size={24} />
                                        <p>Find reminders, notes, or past chats instantly</p>
                                    </div>
                                ) : isSearching ? (
                                    <div className="search-loading">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        >
                                            <Search size={24} />
                                        </motion.div>
                                        <p>Searching through your Buddy data...</p>
                                    </div>
                                ) : (!searchResults || (searchResults.reminders.length === 0 && searchResults.memories.length === 0 && searchResults.conversations.length === 0)) ? (
                                    <div className="search-empty">
                                        <p>No results found for "{searchQuery}"</p>
                                    </div>
                                ) : (
                                    <div className="results-list">
                                        {searchResults.reminders.length > 0 && (
                                            <div className="search-category">
                                                <h4>Reminders</h4>
                                                {searchResults.reminders.map(rem => (
                                                    <div key={rem._id} className="result-item" onClick={() => { navigate('/admin/calendar'); setShowSearch(false); }}>
                                                        <Clock size={16} />
                                                        <div className="result-info">
                                                            <span className="result-title">{rem.title}</span>
                                                            <span className="result-sub">{rem.date} @ {rem.time}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {searchResults.memories.length > 0 && (
                                            <div className="search-category">
                                                <h4>Memories</h4>
                                                {searchResults.memories.map(mem => (
                                                    <div key={mem._id} className="result-item" onClick={() => { navigate('/admin/memories'); setShowSearch(false); }}>
                                                        <Brain size={16} />
                                                        <div className="result-info">
                                                            <span className="result-title">{mem.content}</span>
                                                            <span className="result-sub">{mem.category}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {searchResults.conversations.length > 0 && (
                                            <div className="search-category">
                                                <h4>Chats</h4>
                                                {searchResults.conversations.map(chat => (
                                                    <div key={chat._id} className="result-item" onClick={() => { navigate('/admin/buddy'); setShowSearch(false); }}>
                                                        <Mic size={16} />
                                                        <div className="result-info">
                                                            <span className="result-title">{chat.title || "Buddy Conversation"}</span>
                                                            <span className="result-sub">{new Date(chat.updatedAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .notification-wrapper {
                    position: relative;
                }

                .notification-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background: #ff4d4d;
                    color: white;
                    font-size: 0.65rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 2px solid var(--bg-lite);
                    min-width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .notification-dropdown {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    width: 340px;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    margin-top: 12px;
                    box-shadow: var(--card-shadow);
                    z-index: 1001;
                    overflow: hidden;
                    max-height: 500px;
                    display: flex;
                    flex-direction: column;
                }

                .dropdown-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: var(--bg-lite);
                }

                .dropdown-header h3 {
                    font-size: 0.9rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--text-main);
                }

                .dropdown-header button {
                    font-size: 0.75rem;
                    color: var(--primary-color);
                    font-weight: 600;
                    background: none;
                    border: none;
                    cursor: pointer;
                }

                .notifications-list {
                    overflow-y: auto;
                    flex: 1;
                }

                .notification-item {
                    padding: 12px 16px;
                    display: flex;
                    gap: 12px;
                    border-bottom: 1px solid var(--border-color);
                    transition: background 0.2s;
                    cursor: pointer;
                    position: relative;
                }

                .notification-item:hover {
                    background: var(--bg-lite);
                }

                .notification-item.unread {
                    background: rgba(var(--primary-rgb), 0.03);
                }

                .notification-item.unread::before {
                    content: '';
                    position: absolute;
                    left: 4px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 4px;
                    height: 4px;
                    background: var(--primary-color);
                    border-radius: 50%;
                }

                .notification-icon {
                    width: 32px;
                    height: 32px;
                    background: var(--bg-lite);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-color);
                    flex-shrink: 0;
                }

                .notification-content {
                    flex: 1;
                }

                .notif-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin: 0 0 4px 0;
                }

                .notif-message {
                    font-size: 0.75rem;
                    color: var(--text-sub);
                    margin: 0 0 6px 0;
                    line-height: 1.4;
                }

                .notif-time {
                    font-size: 0.65rem;
                    color: var(--text-sub);
                    opacity: 0.6;
                }

                .delete-notif {
                    opacity: 0;
                    background: none;
                    border: none;
                    color: #ff4d4d;
                    cursor: pointer;
                    padding: 4px;
                    transition: opacity 0.2s;
                }

                .notification-item:hover .delete-notif {
                    opacity: 1;
                }

                .empty-notifications {
                    padding: 40px 20px;
                    text-align: center;
                    color: var(--text-sub);
                }

                .empty-notifications svg {
                    margin: 0 auto 12px;
                    display: block;
                }

                .dropdown-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1000;
                }

                /* Header Actions */
                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .search-pill {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--bg-lite);
                    padding: 4px 12px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: var(--text-sub);
                    font-size: 0.75rem;
                    font-weight: 600;
                    height: 32px;
                }

                .search-pill:hover {
                    border-color: var(--primary-color);
                    color: var(--text-main);
                }

                .search-pill span {
                    margin-top: 1px;
                }

                .user-profile-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--bg-lite);
                    padding: 4px 10px;
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    cursor: pointer;
                }

                /* Global Search Overlay */
                .search-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    padding-top: 10vh;
                    z-index: 2000;
                }

                .search-modal {
                    background: var(--card-bg);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 600px;
                    box-shadow: var(--card-shadow);
                    display: flex;
                    flex-direction: column;
                    max-height: 80vh;
                    overflow: hidden;
                }

                .search-modal-header {
                    display: flex;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color);
                    gap: 12px;
                }

                .modal-search-icon {
                    color: var(--text-sub);
                }

                .search-modal-header input {
                    flex: 1;
                    background: none;
                    border: none;
                    font-size: 1rem;
                    color: var(--text-main);
                    outline: none;
                    padding: 0;
                }

                .search-modal-header input::placeholder {
                    color: var(--text-sub);
                }

                .close-search {
                    background: none;
                    border: none;
                    color: var(--text-sub);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    transition: background 0.2s;
                }

                .close-search:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .search-results-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                .search-placeholder, .search-loading, .search-empty {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--text-sub);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }

                .search-placeholder svg, .search-loading svg {
                    color: var(--primary-color);
                }

                .search-loading p {
                    margin-top: 8px;
                }

                .results-list {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .search-category h4 {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    margin-bottom: 12px;
                    letter-spacing: 0.05em;
                }

                .result-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: background 0.2s, border-color 0.2s;
                    border: 1px solid transparent;
                }

                .result-item:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: var(--primary-color);
                }

                .result-item svg {
                    color: var(--primary-color);
                    flex-shrink: 0;
                }

                .result-info {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .result-title {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-main);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .result-sub {
                    font-size: 0.75rem;
                    color: var(--text-sub);
                    margin-top: 2px;
                }

                .user-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 12px);
                    right: 0;
                    width: 220px;
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 8px;
                    box-shadow: var(--card-shadow);
                    z-index: 1001;
                }

                .dropdown-user-info {
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .info-name {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--text-main);
                }

                .info-role {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--text-sub);
                    text-transform: capitalize;
                }

                .dropdown-divider {
                    height: 1px;
                    background: var(--border-color);
                    margin: 4px 8px;
                }

                .dropdown-item {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 14px;
                    background: transparent;
                    border: none;
                    border-radius: 10px;
                    color: var(--text-sub);
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .dropdown-item:hover {
                    background: var(--row-hover);
                    color: var(--text-main);
                }

                .dropdown-item.logout-item {
                    color: #ff3b3b;
                }

                .dropdown-item.logout-item:hover {
                    background: rgba(255, 59, 59, 0.05);
                }

                @media (max-width: 1023px) {
                    .menu-toggle-btn {
                        display: none !important;
                    }
                }
                @media (max-width: 767px) {
                    .notification-dropdown {
                        width: 100vw;
                        position: fixed;
                        top: 60px;
                        left: 0;
                        right: 0;
                        margin-top: 0;
                        border-radius: 0;
                        max-height: calc(100vh - 60px);
                    }
                    .header-breadcrumbs {
                        display: none !important;
                    }
                    .header-clock-pill {
                        display: none !important;
                    }
                    .user-name-text {
                        display: none !important;
                    }
                    /* START EDIT: Hide notification on mobile */
                    .header-actions {
                       /* Adjust spacing if needed */
                    }
                    div:has(> .user-name-text) {
                       /* Target the user profile container */
                    }
                    
                    
                    /* Hide Bell icon wrapper specifically on mobile - using class for robustness */
                    .notification-wrapper {
                        display: none !important;
                    }
                    /* END EDIT */
                    .app-header {
                        padding: 0 16px !important;
                    }
                    .user-avatar-container {
                        width: 32px !important;
                        height: 32px !important;
                    }
                    .user-avatar-container svg {
                        width: 18px !important;
                        height: 18px !important;
                    }
                    .header-user-profile {
                        padding: 0 !important;
                        background: none !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .search-pill span {
                        display: none;
                    }
                    .search-pill {
                        padding: 4px 8px;
                    }
                    .user-profile-header {
                        padding: 4px 8px;
                    }
                }
                @media (max-width: 480px) {
                    .app-header h2 {
                        font-size: 0.85rem !important;
                    }
                    .search-modal {
                        width: 100%;
                        border-radius: 0;
                        max-height: 100vh;
                        padding-top: 0;
                    }
                    .search-overlay {
                        padding-top: 0;
                    }
                }
            `}</style>
        </header >
    );
};

export default Header;

