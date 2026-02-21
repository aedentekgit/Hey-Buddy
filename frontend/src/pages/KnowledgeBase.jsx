import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Upload, Search, MessageSquare, FileText, Trash2, Loader2, Plus, Sparkles, Send, Brain } from 'lucide-react';
import knowledgeService from '../services/knowledgeService';
import toast from 'react-hot-toast';
import { formatDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

const KnowledgeBase = () => {
    const { user } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('library'); // 'library' or 'chat'

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await knowledgeService.getDocuments();
            if (res.success) setDocuments(res.data);
        } catch (error) {
            toast.error("Failed to load knowledge base");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await knowledgeService.uploadDocument(file);
            if (res.success) {
                toast.success("Knowledge ingested successfully!");
                fetchDocuments();
            }
        } catch (error) {
            toast.error("Failed to process document");
        } finally {
            setIsUploading(false);
        }
    };

    const handleQuery = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        const userMsg = { role: 'user', text: query };
        setChatHistory(prev => [...prev, userMsg]);
        const currentQuery = query;
        setQuery('');
        setIsSearching(true);

        try {
            const res = await knowledgeService.queryKnowledge(currentQuery);
            if (res.success) {
                setChatHistory(prev => [...prev, {
                    role: 'buddy',
                    text: res.answer,
                    sources: res.sources
                }]);
            }
        } catch (error) {
            toast.error("AI deep-search failed");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="kb-container">
            <div className="kb-header">
                <div className="kb-title-area">
                    <h1>Buddy Knowledge Base</h1>
                    <p>Train your personal AI on your own documents and data.</p>
                </div>
                <div className="kb-tabs">
                    <button
                        className={`kb-tab ${activeTab === 'library' ? 'active' : ''}`}
                        onClick={() => setActiveTab('library')}
                    >
                        <BookOpen size={18} /> Library
                    </button>
                    <button
                        className={`kb-tab ${activeTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveTab('chat')}
                    >
                        <Brain size={18} /> Consult AI
                    </button>
                </div>
            </div>

            <main className="kb-content">
                <AnimatePresence mode="wait">
                    {activeTab === 'library' ? (
                        <motion.div
                            key="library"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="kb-library"
                        >
                            <div className="upload-header">
                                <label className="upload-btn">
                                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    Upload Document
                                    <input type="file" hidden onChange={handleFileUpload} disabled={isUploading} />
                                </label>
                            </div>

                            <div className="doc-grid">
                                {documents.length === 0 ? (
                                    <div className="empty-state">
                                        <FileText size={48} opacity={0.2} />
                                        <p>Your library is empty. Upload PDFs or text notes to start.</p>
                                    </div>
                                ) : (
                                    documents.map((doc, idx) => (
                                        <motion.div
                                            key={doc._id}
                                            className="doc-card"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                        >
                                            <div className="doc-icon">
                                                <FileText size={24} color="var(--primary-color)" />
                                            </div>
                                            <div className="doc-info">
                                                <h3>{doc.fileName}</h3>
                                                <span>{(doc.metadata?.size / 1024).toFixed(1)} KB • {formatDate(doc.createdAt, user?.dateFormat)}</span>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="kb-chat"
                        >
                            <div className="chat-window">
                                {chatHistory.length === 0 ? (
                                    <div className="empty-chat">
                                        <Sparkles size={48} color="var(--primary-color)" />
                                        <h2>Deep Search enabled</h2>
                                        <p>Ask anything about your uploaded documents.</p>
                                    </div>
                                ) : (
                                    chatHistory.map((msg, i) => (
                                        <div key={i} className={`chat-bubble ${msg.role}`}>
                                            <div className="bubble-content">
                                                <p>{msg.text}</p>
                                                {msg.sources && (
                                                    <div className="sources">
                                                        {msg.sources.map((s, idx) => <span key={idx}>Source: {s}</span>)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isSearching && (
                                    <div className="chat-bubble buddy">
                                        <div className="bubble-content thinking">
                                            <Loader2 size={16} className="animate-spin" /> Buddy is searching your files...
                                        </div>
                                    </div>
                                )}
                            </div>

                            <form className="chat-input-area" onSubmit={handleQuery}>
                                <input
                                    type="text"
                                    placeholder="Query your knowledge base..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    disabled={isSearching}
                                />
                                <button type="submit" disabled={isSearching || !query.trim()}>
                                    <Send size={18} />
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <style>{`
                .kb-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                    height: calc(100vh - 100px);
                    display: flex;
                    flex-direction: column;
                }

                @media (max-width: 768px) {
                    .kb-container {
                        padding: 0;
                    }
                }

                .kb-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 2rem;
                }

                .kb-title-area h1 {
                    font-size: 2.2rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(135deg, #fff 0%, var(--primary-color) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .kb-title-area p { color: var(--text-sub); }

                .kb-tabs {
                    display: flex;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 6px;
                    border-radius: 14px;
                }

                .kb-tab {
                    padding: 10px 20px;
                    border-radius: 10px;
                    border: none;
                    background: transparent;
                    color: var(--text-sub);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }

                .kb-tab.active {
                    background: var(--primary-color);
                    color: #fff;
                }

                .kb-content { flex: 1; overflow: hidden; position: relative; }

                .kb-library { height: 100%; display: flex; flex-direction: column; }

                .upload-header { margin-bottom: 1.5rem; }
                .upload-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 24px;
                    background: var(--primary-color);
                    color: #fff;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .upload-btn:hover { transform: translateY(-2px); }

                .doc-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                    overflow-y: auto;
                    padding-bottom: 2rem;
                }

                .doc-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 18px;
                    padding: 1.5rem;
                    display: flex;
                    gap: 1.25rem;
                    align-items: center;
                    transition: all 0.2s;
                }
                .doc-card:hover { border-color: var(--primary-color); background: rgba(var(--primary-rgb), 0.05); }

                .doc-icon {
                    width: 48px;
                    height: 48px;
                    background: rgba(var(--primary-rgb), 0.1);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .doc-info h3 { font-size: 0.95rem; margin-bottom: 4px; color: var(--text-main); }
                .doc-info span { font-size: 0.75rem; color: var(--text-sub); }

                .kb-chat {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: var(--card-bg);
                    border-radius: 24px;
                    border: 1px solid var(--border-color);
                }

                .chat-window {
                    flex: 1;
                    padding: 2rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .chat-bubble { max-width: 80%; }
                .chat-bubble.user { align-self: flex-end; }
                .chat-bubble.buddy { align-self: flex-start; }

                .bubble-content {
                    padding: 1rem 1.5rem;
                    border-radius: 18px;
                    font-size: 0.95rem;
                    line-height: 1.5;
                }

                .user .bubble-content { background: var(--primary-color); color: #fff; border-bottom-right-radius: 4px; }
                .buddy .bubble-content { background: rgba(255, 255, 255, 0.05); color: var(--text-main); border-bottom-left-radius: 4px; }

                .sources {
                    margin-top: 10px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    font-size: 0.7rem;
                }
                .sources span { background: rgba(255, 255, 255, 0.1); padding: 4px 8px; border-radius: 4px; color: var(--text-sub); }

                .chat-input-area {
                    padding: 1.5rem;
                    border-top: 1px solid var(--border-color);
                    display: flex;
                    gap: 1rem;
                }

                .chat-input-area input {
                    flex: 1;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 12px 18px;
                    color: #fff;
                    outline: none;
                }

                .chat-input-area button {
                    width: 48px;
                    height: 48px;
                    background: var(--primary-color);
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }

                .empty-chat, .empty-state {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: var(--text-sub);
                    gap: 1.5rem;
                }

                .thinking { display: flex; align-items: center; gap: 10px; color: var(--primary-color); }
            `}</style>
        </div>
    );
};

export default KnowledgeBase;
