import React, { useState, useEffect } from 'react';
import { ListTodo, Trash2, Calendar, Clock, MapPin, Search, Loader2, Eye, Edit2, Save, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import voiceService from '../services/voiceService';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import SmartReminderDetails from '../components/SmartReminderDetails';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, ActionButtonStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle
} from '../components/TableStyles';

const Reminders = () => {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [editModal, setEditModal] = useState({ isOpen: false, reminder: null, isCreate: false });
    const [editForm, setEditForm] = useState({ title: '', date: '', time: '', location: '' });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        total: 0,
        limit: 10
    });

    // Unified effect for initial load and search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchReminders(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const fetchReminders = async (page = 1) => {
        try {
            setLoading(true);
            const res = await voiceService.getReminders(page, pagination.limit, searchTerm);
            if (res.data.success) {
                setReminders(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (err) {
            console.error("Fetch reminders error:", err);
            toast.error("Failed to load reminders");
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        fetchReminders(newPage);
    };

    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const handleDelete = async () => {
        const id = deleteModal.id;
        if (!id) return;

        try {
            const res = await voiceService.deleteReminder(id);
            if (res.success) {
                toast.success("Reminder deleted");
                setReminders(reminders.filter(r => r._id !== id));
                setDeleteModal({ isOpen: false, id: null });
            }
        } catch (err) {
            toast.error("Failed to delete reminder");
        }
    };

    const handleViewClick = (reminder) => {
        setSelectedReminder(reminder);
    };

    const handleEditClick = (reminder) => {
        setEditForm({
            title: reminder.title || '',
            date: reminder.date ? new Date(reminder.date).toISOString().split('T')[0] : '',
            time: reminder.time || '',
            location: reminder.location || ''
        });
        setEditModal({ isOpen: true, reminder, isCreate: false });
    };

    const handleCreateClick = () => {
        setEditForm({ title: '', date: '', time: '', location: '' });
        setEditModal({ isOpen: true, reminder: null, isCreate: true });
    };

    const handleSubmit = async () => {
        if (!editForm.title) {
            toast.error("Title is required");
            return;
        }

        try {
            if (editModal.isCreate) {
                console.log("Creating reminder...", editForm);
                const res = await voiceService.saveReminder({
                    ...editForm,
                    intent: 'manual_creation',
                    repeat: false
                }, 'buddy'); // Default to buddy only for manual

                if (res.success) {
                    toast.success("Reminder created successfully");
                    fetchReminders();
                    setEditModal({ isOpen: false, reminder: null, isCreate: false });
                }
            } else {
                const id = editModal.reminder?._id;
                if (!id) return;

                const res = await voiceService.updateReminder(id, editForm);
                if (res.success) {
                    toast.success("Reminder updated successfully");
                    fetchReminders();
                    setEditModal({ isOpen: false, reminder: null, isCreate: false });
                }
            }
        } catch (err) {
            console.error("Submit Error:", err);
            const msg = err.response?.data?.message || err.message || "Unknown error";
            toast.error(editModal.isCreate ? `Creation failed: ${msg}` : `Update failed: ${msg}`);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'No date';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);

        const diffTime = d.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 1 && diffDays < 7) {
            return d.toLocaleDateString('en-IN', { weekday: 'long' });
        }

        return d.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return 'All day';
        try {
            // Check if it's HH:mm format
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

    // Search is now handled on the backend
    const filteredReminders = reminders;

    return (
        <div className="reminders-page">
            <div style={TableContainerStyle} className="table-responsive-container">
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ ...SearchBoxStyle, marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                        <input
                            type="text"
                            placeholder="Search reminders..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={SearchInputStyle}
                        />
                    </div>
                    <button
                        onClick={handleCreateClick}
                        className="btn-primary"
                        style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}
                    >
                        <Plus size={18} /> <span className="hide-mobile-text">New Reminder</span><span className="show-mobile-text">New</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '50px', borderRadius: '12px 0 0 12px' }}>S.No</th>
                                <th style={{ ...ThStyle, textAlign: 'left', minWidth: '180px' }}>Reminder Info</th>
                                <th style={{ ...ThStyle, minWidth: '120px' }}>Date & Time</th>
                                <th style={ThStyle} className="hide-on-compact">Category</th>
                                <th style={{ ...ThStyle, width: '100px', borderRadius: '0 12px 12px 0' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                                    </td>
                                </tr>
                            ) : filteredReminders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>
                                        No reminders found. Create one to get started!
                                    </td>
                                </tr>
                            ) : (
                                filteredReminders.map((reminder, index) => (
                                    <motion.tr
                                        key={reminder._id}
                                        whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                                        style={{ transition: 'background-color 0.2s ease' }}
                                    >
                                        <td style={{ ...TdStyle, textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.8rem', borderRadius: '12px 0 0 12px', padding: '18px 10px' }}>{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={TdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }} className="hide-mobile-col">
                                                    <ListTodo size={16} color="var(--primary-glow)" />
                                                </div>
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{reminder.title}</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                                        {reminder.location && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <MapPin size={10} /> {reminder.location}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Calendar size={10} /> {formatDate(reminder.date)} • {formatTime(reminder.time)}
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.2)' }}>
                                                            Set on: {new Date(reminder.createdAt).toLocaleDateString('en-IN')} {new Date(reminder.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={TdStyle}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: 'white',
                                                    fontWeight: '600',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {formatDate(reminder.date)}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--primary-glow)', fontWeight: 'bold' }}>
                                                    {formatTime(reminder.time)}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={TdStyle} className="hide-on-compact">
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.7rem',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase',
                                                background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
                                                color: 'var(--primary-glow)',
                                                border: '1px solid color-mix(in srgb, var(--primary-color) 20%, transparent)',
                                                display: 'inline-block'
                                            }}>{reminder.intent || 'General'}</span>
                                        </td>
                                        <td style={{ ...TdStyle, borderRadius: '0 12px 12px 0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleViewClick(reminder)}
                                                    title="Smart Details"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
                                                >
                                                    <Eye size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditClick(reminder)}
                                                    title="Edit"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(reminder._id)}
                                                    title="Delete"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Reminder"
                message="Are you sure you want to delete this reminder? This action cannot be undone."
                confirmText="Delete"
            />

            <AnimatePresence>
                {selectedReminder && (
                    <SmartReminderDetails
                        reminder={selectedReminder}
                        onClose={() => setSelectedReminder(null)}
                        onUpdate={() => {
                            fetchReminders();
                        }}
                    />
                )}
            </AnimatePresence>

            {editModal.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
                }} onClick={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(e) => e.stopPropagation()}
                        className="responsive-modal"
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {editModal.isCreate ? <Plus size={20} color="var(--primary-color)" /> : <Edit2 size={20} color="var(--primary-color)" />}
                                {editModal.isCreate ? 'New Reminder' : 'Edit Reminder'}
                            </h3>
                            <button onClick={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })} style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label className="modal-label">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="modal-input"
                                />
                            </div>
                            <div className="modal-row">
                                <div style={{ flex: 1 }}>
                                    <label className="modal-label">Date</label>
                                    <input
                                        type="date"
                                        value={editForm.date}
                                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                        className="modal-input"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="modal-label">Time</label>
                                    <input
                                        type="time"
                                        value={editForm.time}
                                        onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                        className="modal-input"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="modal-label">Location (Optional)</label>
                                <input
                                    type="text"
                                    value={editForm.location}
                                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    className="modal-input"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexDirection: window.innerWidth < 480 ? 'column' : 'row' }}>
                                <button
                                    onClick={handleSubmit}
                                    className="btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    <Save size={16} /> {editModal.isCreate ? 'Create' : 'Save'}
                                </button>
                                <button
                                    onClick={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })}
                                    className="btn-outline"
                                    style={{ padding: '12px 24px', borderRadius: '12px', background: 'transparent', color: 'var(--text-sub)', border: '1px solid var(--border-color)', fontWeight: '700' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; } 
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .table-wrapper {
                    overflow-x: auto;
                    width: 100%;
                }

                .modal-label {
                    font-size: 0.75rem; 
                    color: var(--text-sub); 
                    text-transform: uppercase; 
                    font-weight: 700; 
                    letter-spacing: 0.05em; 
                    display: block; 
                    margin-bottom: 8px;
                }

                .modal-input {
                    width: 100%; 
                    padding: 12px 16px; 
                    border-radius: 12px;
                    background: var(--bg-lite); 
                    border: 1px solid var(--border-color);
                    color: var(--text-main); 
                    font-size: 14px; 
                    outline: none;
                }

                .modal-row {
                    display: flex;
                    gap: 16px;
                }

                .responsive-modal {
                    background: var(--card-bg); 
                    border-radius: 24px; 
                    padding: 32px;
                    max-width: 500px; 
                    width: 90%; 
                    border: 1px solid var(--border-color);
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }

                .show-mobile-text { display: none; }

                @media (max-width: 768px) {
                    .table-responsive-container {
                        padding: 16px !important;
                    }
                    .hide-on-compact {
                        display: none !important;
                    }
                    th, td { padding: 12px 10px !important; }
                    .responsive-modal {
                        padding: 24px;
                        width: 95%;
                    }
                    .modal-row {
                        flex-direction: column;
                        gap: 12px;
                    }
                    .hide-mobile-text { display: none; }
                    .show-mobile-text { display: inline-block; }
                }

                @media (max-width: 480px) {
                    .table-responsive-container {
                        border-radius: 16px !important;
                    }
                    td, th {
                        padding: 12px 8px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Reminders;
