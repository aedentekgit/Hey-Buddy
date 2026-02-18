import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Plus, Trash2, Copy, Check, ExternalLink, Terminal, Shield, Zap, Loader2 } from 'lucide-react';
import automationService from '../services/automationService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const Automations = () => {
    const [webhooks, setWebhooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [newWebhook, setNewWebhook] = useState({ name: '', targetAction: 'create_reminder' });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

    useEffect(() => {
        fetchWebhooks();
    }, []);

    const fetchWebhooks = async () => {
        setIsLoading(true);
        try {
            const res = await automationService.getWebhooks();
            if (res.success) setWebhooks(res.data);
        } catch (error) {
            toast.error("Failed to load automations");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newWebhook.name) return;
        setIsCreating(true);
        try {
            const res = await automationService.createWebhook(newWebhook.name, newWebhook.targetAction);
            if (res.success) {
                toast.success("Webhook automation created!");
                setNewWebhook({ name: '', targetAction: 'create_reminder' });
                fetchWebhooks();
            }
        } catch (error) {
            toast.error("Creation failed");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const confirmDelete = async () => {
        const id = deleteModal.id;
        if (!id) return;
        try {
            await automationService.deleteWebhook(id);
            toast.success("Automation removed");
            fetchWebhooks();
        } catch (error) {
            toast.error("Deletion failed");
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success("URL Copied!");
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="automations-container">
            <div className="kb-header">
                <div className="kb-title-area">
                    <h1>Buddy Automations</h1>
                    <p>Connect Buddy to external tools like Zapier, IFTTT, or your own scripts.</p>
                </div>
            </div>

            <div className="auto-grid">
                {/* Creation Form */}
                <div className="auto-card creation-section">
                    <div className="card-header">
                        <Zap size={20} color="var(--primary-color)" />
                        <h2>New Automation</h2>
                    </div>
                    <form onSubmit={handleCreate}>
                        <div className="form-group">
                            <label>Automation Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Zapier Inbound"
                                value={newWebhook.name}
                                onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Action on Trigger</label>
                            <select
                                value={newWebhook.targetAction}
                                onChange={(e) => setNewWebhook({ ...newWebhook, targetAction: e.target.value })}
                            >
                                <option value="create_reminder">Create Reminder</option>
                                <option value="create_notification">Push Notification</option>
                            </select>
                        </div>
                        <button type="submit" className="btn-primary full-width" disabled={isCreating}>
                            {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                            Create Webhook
                        </button>
                    </form>

                    <div className="zapier-promo">
                        <div className="promo-content">
                            <h3>Connect with Zapier</h3>
                            <p>Send data to Buddy from Gmail, Slack, and 5,000+ other apps.</p>
                            <a href="https://zapier.com/apps/webhook/integrations" target="_blank" rel="noreferrer">
                                View Guide <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Webhooks List */}
                <div className="auto-card list-section">
                    <div className="card-header">
                        <Terminal size={20} color="var(--primary-color)" />
                        <h2>Active Connections</h2>
                    </div>

                    <div className="webhook-list">
                        {isLoading ? (
                            <div className="loading-state"><Loader2 className="animate-spin" /></div>
                        ) : webhooks.length === 0 ? (
                            <div className="empty-state">No active automations.</div>
                        ) : (
                            webhooks.map((hook, idx) => (
                                <motion.div
                                    key={hook._id}
                                    className="webhook-item"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                >
                                    <div className="hook-info">
                                        <h3>{hook.name}</h3>
                                        <div className="hook-badge">{hook.config.targetAction.replace('_', ' ')}</div>
                                    </div>
                                    <div className="hook-url-box">
                                        <input readOnly value={`${API_BASE}/automations/incoming/${hook.secret}`} />
                                        <button onClick={() => copyToClipboard(`${API_BASE}/automations/incoming/${hook.secret}`, hook._id)}>
                                            {copiedId === hook._id ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <button className="btn-delete-small" onClick={() => handleDelete(hook._id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={confirmDelete}
                title="Delete Automation"
                message="Are you sure you want to delete this automation? This connection will stop working immediately."
                confirmText="Delete"
            />
            <style>{`
                .automations-container {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .auto-grid {
                    display: grid;
                    grid-template-columns: 350px 1fr;
                    gap: 2rem;
                    margin-top: 2rem;
                }

                .auto-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    padding: 2rem;
                    display: flex;
                    flex-direction: column;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 2rem;
                }
                .card-header h2 { font-size: 1.1rem; color: var(--text-main); }

                .form-group { margin-bottom: 1.5rem; }
                .form-group label { display: block; font-size: 0.8rem; color: var(--text-sub); margin-bottom: 8px; font-weight: 600; }
                .form-group input, .form-group select {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 12px;
                    color: #fff;
                    outline: none;
                }

                .zapier-promo {
                    margin-top: auto;
                    padding-top: 2rem;
                    border-top: 1px solid var(--border-color);
                }
                .promo-content h3 { font-size: 1rem; color: var(--primary-color); margin-bottom: 10px; }
                .promo-content p { font-size: 0.8rem; color: var(--text-sub); margin-bottom: 15px; }
                .promo-content a { 
                    display: inline-flex; 
                    align-items: center; 
                    gap: 6px; 
                    color: #fff; 
                    font-size: 0.8rem; 
                    font-weight: 700; 
                    text-decoration: none; 
                }

                .webhook-list { display: flex; flex-direction: column; gap: 1rem; }
                .webhook-item {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .hook-info { flex: 1; }
                .hook-info h3 { font-size: 1rem; color: var(--text-main); margin-bottom: 6px; }
                .hook-badge { 
                    display: inline-block; 
                    font-size: 0.65rem; 
                    font-weight: 800; 
                    text-transform: uppercase; 
                    background: rgba(var(--primary-rgb), 0.1); 
                    color: var(--primary-color); 
                    padding: 4px 8px; 
                    border-radius: 6px; 
                }

                .hook-url-box {
                    flex: 2;
                    display: flex;
                    background: #000;
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                }
                .hook-url-box input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: #555;
                    font-family: monospace;
                    font-size: 0.75rem;
                    padding: 10px;
                    pointer-events: none;
                }
                .hook-url-box button {
                    background: rgba(255, 255, 255, 0.05);
                    border: none;
                    border-left: 1px solid var(--border-color);
                    padding: 0 15px;
                    color: #fff;
                    cursor: pointer;
                }

                .btn-delete-small {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }

                .full-width { width: 100%; }
                .loading-state, .empty-state { padding: 3rem; text-align: center; color: var(--text-sub); }

                @media (max-width: 900px) {
                    .auto-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Automations;
