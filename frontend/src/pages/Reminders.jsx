import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, Clock, MapPin, Search, Loader2, Eye, Edit2, Save, X, Plus, Share2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import voiceService from '../services/voiceService';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import SmartReminderDetails from '../components/SmartReminderDetails';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle, ActionButtonStyle
} from '../components/TableStyles';

const Reminders = () => {
    const { user } = useAuth();
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
    const [shareModal, setShareModal] = useState({ isOpen: false, reminder: null, email: '', permissions: 'view', loading: false });

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

    const handleShare = async () => {
        if (!shareModal.email) {
            toast.error("Email is required");
            return;
        }
        setShareModal(prev => ({ ...prev, loading: true }));
        try {
            const res = await voiceService.shareReminder(shareModal.reminder._id, shareModal.email, shareModal.permissions);
            if (res.success) {
                toast.success("Reminder shared successfully");
                setShareModal({ isOpen: false, reminder: null, email: '', permissions: 'view', loading: false });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to share reminder");
        } finally {
            setShareModal(prev => ({ ...prev, loading: false }));
        }
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
        <div style={{ color: 'var(--text-main)' }} className="reminders-page">
            <Toaster position="top-right" />

            <div className="table-container">
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div className="search-box" style={{ ...SearchBoxStyle, marginBottom: 0, flex: 1, minWidth: '200px' }}>
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
                        className="btn btn-primary"
                        onClick={handleCreateClick}
                    >
                        <Plus size={20} />
                        <span className="hide-mobile-text">New Reminder</span><span className="show-mobile-text">New</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '50px', borderRadius: '12px 0 0 12px' }} className="hide-mobile-th">S.No</th>
                                <th style={{ ...ThStyle, textAlign: 'left', minWidth: '200px' }}>Reminder Info</th>
                                <th style={{ ...ThStyle, minWidth: '150px' }}>Schedule</th>
                                <th style={ThStyle} className="hide-on-mobile">Category</th>
                                <th style={{ ...ThStyle, width: '120px', borderRadius: '0 12px 12px 0' }}>Actions</th>
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
                                        whileHover={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }}
                                        style={{ borderBottom: '1px solid var(--border-color)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ ...TdStyle, textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', borderLeft: 'none', padding: '18px 10px' }} className="hide-mobile-td">{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Reminder">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                                                <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: '1.2' }}>{reminder.title}</div>

                                                    {/* Show "Shared by" if it's not the user's own reminder */}
                                                    {reminder.userId && (typeof reminder.userId === 'object' ? reminder.userId._id : reminder.userId) !== user?._id && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                                                            <Users size={12} /> Shared by {typeof reminder.userId === 'object' ? reminder.userId.name : 'someone'}
                                                        </div>
                                                    )}

                                                    {reminder.location && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <MapPin size={12} /> {reminder.location}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Schedule">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={12} color="var(--primary-color)" />
                                                    {formatDate(reminder.date)}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={12} />
                                                    {formatTime(reminder.time)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hide-on-mobile" style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Category">
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
                                        <td style={{ ...TdStyle, borderLeft: 'none' }} className="mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleViewClick(reminder)}
                                                    title="Smart Details"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--primary-color)', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditClick(reminder)}
                                                    title="Edit"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--info-color)', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setShareModal({ isOpen: true, reminder, email: '', permissions: 'view', loading: false })}
                                                    title="Share"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--warning-color)', background: 'rgba(var(--primary-rgb), 0.1)', borderColor: 'rgba(var(--primary-rgb), 0.2)' }}
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(reminder._id)}
                                                    title="Delete"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--danger-color)', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                    <Trash2 size={16} />
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

            <AnimatePresence>
                {shareModal.isOpen && (
                    <div className="modal-backdrop" onClick={() => setShareModal({ isOpen: false, reminder: null, email: '', permissions: 'view', loading: false })}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3 className="modal-title">
                                    <Users size={20} color="var(--primary-color)" style={{ marginRight: '8px' }} />
                                    Share Reminder
                                </h3>
                                <button onClick={() => setShareModal({ isOpen: false, reminder: null, email: '', permissions: 'view', loading: false })} className="modal-close">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', margin: 0 }}>
                                    Share "{shareModal.reminder?.title}" with someone to collaborate.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">User Email</label>
                                    <input
                                        type="email"
                                        placeholder="Enter collaborator email..."
                                        value={shareModal.email}
                                        onChange={(e) => setShareModal({ ...shareModal, email: e.target.value })}
                                        className="input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Permissions</label>
                                    <div className="custom-select-wrapper">
                                        <select
                                            className="input"
                                            value={shareModal.permissions}
                                            onChange={(e) => setShareModal({ ...shareModal, permissions: e.target.value })}
                                        >
                                            <option value="view">View Only</option>
                                            <option value="edit">Can Edit</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    onClick={() => setShareModal({ isOpen: false, reminder: null, email: '', permissions: 'view', loading: false })}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="btn btn-primary"
                                    disabled={shareModal.loading}
                                >
                                    {shareModal.loading ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
                                    Share Invitation
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editModal.isOpen && (
                    <div className="modal-backdrop" onClick={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3 className="modal-title">
                                    {editModal.isCreate ? 'New Reminder' : 'Edit Reminder'}
                                </h3>
                                <button onClick={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })} className="modal-close">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        className="input"
                                        placeholder="Reminder title..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Date</label>
                                        <input
                                            type="date"
                                            value={editForm.date}
                                            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Time</label>
                                        <input
                                            type="time"
                                            value={editForm.time}
                                            onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location (Optional)</label>
                                    <input
                                        type="text"
                                        value={editForm.location}
                                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                        className="input"
                                        placeholder="Add location..."
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    onClick={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="btn btn-primary"
                                >
                                    <Save size={16} /> {editModal.isCreate ? 'Create' : 'Save'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .show-mobile-text { display: none; }
                .show-on-tablet { display: none; }

                @media (max-width: 1024px) {
                    .hide-on-tablet { display: none !important; }
                    .show-on-tablet { display: block; }
                }
                
                @media (max-width: 640px) {
                    .table-wrapper table, 
                    .table-wrapper thead, 
                    .table-wrapper tbody, 
                    .table-wrapper th, 
                    .table-wrapper td, 
                    .table-wrapper tr {
                        display: block;
                    }

                    .table-wrapper thead tr {
                        position: absolute;
                        top: -9999px;
                        left: -9999px;
                    }

                    .mobile-stacked-row {
                        background: linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
                        border: 1px solid rgba(255, 255, 255, 0.05) !important;
                        border-radius: 24px !important;
                        padding: 20px !important;
                        margin-bottom: 24px !important;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
                        backdrop-filter: blur(10px);
                        position: relative;
                        overflow: hidden;
                    }

                    /* Add a subtle highlight accent */
                    .mobile-stacked-row::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 4px;
                        height: 100%;
                        background: var(--primary-color);
                        opacity: 0.5;
                    }

                    .table-wrapper td {
                        border: none !important;
                        padding: 12px 0 !important;
                        position: relative;
                        text-align: left !important;
                        width: 100% !important;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 16px;
                        min-height: auto !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
                    }

                    .table-wrapper td:last-child {
                        border-bottom: none !important;
                    }

                    .table-wrapper td::before {
                        content: attr(data-label);
                        font-size: 0.75rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: var(--text-sub);
                        min-width: 100px;
                        opacity: 0.8;
                    }

                    /* Make the value text aligned to the right */
                    .table-wrapper td > * {
                        text-align: right;
                        flex: 1;
                        display: flex;
                        justify-content: flex-end;
                    }
                    
                    /* Specific adjustment for Reminder Info */
                    .table-wrapper td[data-label="Reminder"] > div {
                        width: 100%;
                    }

                    .hide-mobile-th, .hide-mobile-td {
                        display: none !important;
                    }

                    .hide-on-mobile-custom {
                         display: none !important;
                    }

                    .mobile-actions-cell {
                        margin-top: 8px;
                        padding-top: 20px !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
                        justify-content: center !important;
                        gap: 16px !important;
                    }

                    .mobile-actions-cell::before {
                        display: none; /* Hide label for actions */
                    }
                    
                    /* Custom Button Styles for Mobile Actions */
                    .mobile-actions-cell .btn-icon {
                        width: 42px;
                        height: 42px;
                        border-radius: 12px;
                    }

                    .hide-on-tablet {
                        display: flex !important;
                    }


                    
                    .table-wrapper {
                        padding: 0 4px;
                        overflow-x: visible !important;
                    }

                    /* Ensure text breaks properly */
                    .table-wrapper td div {
                        word-break: break-word;
                    }
                }

                @media (max-width: 768px) {
                    /* We override the .hide-on-mobile class for the icon specifically inside the table on mobile */
                    .table-wrapper .hide-on-mobile {
                        display: flex !important;
                    }
                    
                    .hide-mobile-text { display: none; }
                    .show-mobile-text { display: inline-block; }
                    
                    /* Fix table-container padding to prevent rounded corner clipping */
                    .table-container {
                        padding: 24px 16px !important;
                    }
                    
                    /* Keep search and button in same row, prevent wrapping */
                    .table-container > div:first-child {
                        flex-wrap: nowrap !important;
                        gap: 12px !important;
                    }
                    
                    /* Adjust search box for mobile */
                    .search-box {
                        min-width: 0 !important;
                        flex: 1 !important;
                    }
                    
                    /* Ensure button doesn't shrink */
                    .btn-primary {
                        flex-shrink: 0 !important;
                        white-space: nowrap !important;
                    }
                }

                @media (max-width: 480px) {
                    td, th {
                        padding: 12px 4px !important;
                    }
                    
                    /* Further reduce padding on very small screens */
                    .table-container {
                        padding: 16px 12px !important;
                    }
                    
                    /* Tighter spacing between search and button */
                    .table-container > div:first-child {
                        gap: 8px !important;
                    }
                }
            `}</style>
        </div >
    );
};

export default Reminders;
