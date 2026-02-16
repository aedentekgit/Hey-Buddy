import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, Clock, MapPin, Search, Loader2, Eye, Edit2, Save, X, Plus, Share2, Users } from 'lucide-react';
import api from '../services/api';
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
import MobileTaskCard from '../components/MobileTaskCard';
import GlobalSlideOver from '../components/GlobalSlideOver';

const Reminders = () => {
    const { user } = useAuth();
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [isDetailsEditing, setIsDetailsEditing] = useState(false);
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
        const delay = searchTerm === '' ? 0 : 500;
        const timeoutId = setTimeout(() => {
            fetchReminders(1);
        }, delay);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    useEffect(() => {
        const handleGlobalSearch = (e) => {
            setSearchTerm(e.detail);
        };
        window.addEventListener('buddy-search', handleGlobalSearch);
        return () => window.removeEventListener('buddy-search', handleGlobalSearch);
    }, []);

    // Listen for background updates (e.g. from Voice Assistant)
    useEffect(() => {
        const handleUpdate = () => {
            console.log("🔄 Background update detected, refreshing reminders...");
            fetchReminders(pagination.currentPage);
        };
        window.addEventListener('buddy-data-updated', handleUpdate);
        return () => window.removeEventListener('buddy-data-updated', handleUpdate);
    }, [pagination.currentPage, pagination.limit]);

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
        setIsDetailsEditing(false);
        setSelectedReminder(reminder);
    };

    const handleEditClick = (reminder) => {
        setIsDetailsEditing(true);
        setSelectedReminder(reminder);
    };

    const handleCreateClick = () => {
        setEditForm({ title: '', date: '', time: '', location: '', alerts: { push: true, sms: false, email: false } });
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
                <div className="search-management-header">
                    <div className="buddy-search-box hide-on-mobile">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search reminders..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="btn btn-primary mobile-fab"
                            onClick={handleCreateClick}
                            style={{ borderRadius: 'var(--radius-md)' }}
                        >
                            <Plus size={20} />
                            <span className="hide-mobile-text">New Reminder</span><span className="show-mobile-text">New</span>
                        </button>
                    </div>
                </div>

                <div className="table-wrapper desktop-table-view">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '64px', textAlign: 'center' }} className="buddy-th hide-mobile-th">S.NO</th>
                                <th style={{ textAlign: 'center', minWidth: '200px' }} className="buddy-th">Reminder Info</th>
                                <th style={{ minWidth: '150px' }} className="buddy-th">Schedule</th>
                                <th className="buddy-th hide-on-mobile">Category</th>
                                <th style={{ width: '120px' }} className="buddy-th">Actions</th>
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
                                        whileHover={{ backgroundColor: 'var(--row-hover)' }}
                                        style={{ borderBottom: '1px solid var(--border-color)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', borderLeft: 'none', padding: '18px 10px' }} className="buddy-td hide-mobile-td">{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Reminder" className="buddy-td">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>

                                                <div style={{ textAlign: 'center', minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: '1.2' }}>{reminder.title}</div>

                                                    {/* Show "Shared by" if it's not the user's own reminder */}
                                                    {reminder.userId && (typeof reminder.userId === 'object' ? reminder.userId._id : reminder.userId) !== user?._id && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: '500' }}>
                                                            <Users size={12} /> Shared by {typeof reminder.userId === 'object' ? reminder.userId.name : 'someone'}
                                                        </div>
                                                    )}

                                                    {reminder.location && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                            <MapPin size={12} /> {reminder.location}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Schedule" className="buddy-td">
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <Calendar size={12} color="var(--primary-color)" />
                                                    {formatDate(reminder.date)}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                    <Clock size={12} />
                                                    {formatTime(reminder.time)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="buddy-td hide-on-mobile" style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Category">
                                            <span className={`badge-pill ${reminder.intent === 'task' ? 'badge-primary' : 'badge-success'}`}>
                                                {reminder.intent || 'General'}
                                            </span>
                                        </td>
                                        <td style={{ borderLeft: 'none' }} className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleViewClick(reminder)}
                                                    title="Smart Details"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--primary-color)', background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--primary-color) 20%, transparent)' }}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditClick(reminder)}
                                                    title="Edit"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--success-color)', background: 'color-mix(in srgb, var(--success-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--success-color) 20%, transparent)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setShareModal({ isOpen: true, reminder, email: '', permissions: 'view', loading: false })}
                                                    title="Share"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--secondary-color)', background: 'color-mix(in srgb, var(--secondary-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--secondary-color) 20%, transparent)' }}
                                                >
                                                    <Share2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(reminder._id)}
                                                    title="Delete"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--danger-color)', background: 'color-mix(in srgb, var(--danger-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger-color) 20%, transparent)' }}
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

                <div className="mobile-card-view" style={{ marginTop: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
                            <Loader2 className="animate-spin" color="#10b981" size={32} />
                        </div>
                    ) : filteredReminders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                            No reminders found. Create one to get started!
                        </div>
                    ) : (
                        filteredReminders.map((reminder) => {
                            const { isOverdue, timeDiff } = (() => {
                                if (!reminder.date) return { isOverdue: false, timeDiff: '' };
                                const reminderDate = new Date(reminder.date);
                                if (reminder.time && reminder.time.includes(':')) {
                                    const [h, m] = reminder.time.split(':');
                                    reminderDate.setHours(parseInt(h), parseInt(m));
                                } else {
                                    reminderDate.setHours(23, 59); // End of day if no time
                                }
                                const now = new Date();
                                const diffMs = now - reminderDate;
                                const isOver = diffMs > 0;

                                let diffStr = '';
                                if (isOver) {
                                    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                                    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                    if (diffHrs > 24) diffStr = `${Math.floor(diffHrs / 24)} days overdue`;
                                    else if (diffHrs > 0) diffStr = `${diffHrs} hours overdue`;
                                    else diffStr = `${diffMins} mins overdue`;
                                }
                                return { isOverdue: isOver, timeDiff: diffStr };
                            })();

                            const isTask = reminder.intent === 'task';
                            const variant = isOverdue ? 'danger' : (isTask ? 'orange' : 'green');
                            const status = isOverdue ? 'Risk Alert' : (isTask ? 'PENDING' : 'ON TRACK');
                            const timeLabel = isOverdue
                                ? `Due ${formatDate(reminder.date)} (${timeDiff})`
                                : formatTime(reminder.time);

                            return (
                                <MobileTaskCard
                                    key={reminder._id}
                                    title={reminder.title}
                                    status={status}
                                    variant={variant}
                                    time={timeLabel}
                                    location={reminder.location || 'No Location Set'}
                                    distance={reminder.distance}
                                    eta={reminder.eta}
                                    onDelete={() => handleDeleteClick(reminder._id)}
                                    onEdit={() => handleEditClick(reminder)}
                                    onView={() => handleViewClick(reminder)}
                                    onShare={() => setShareModal({ isOpen: true, reminder, email: '', permissions: 'view', loading: false })}
                                />
                            );
                        })
                    )}
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

            <SmartReminderDetails
                reminder={selectedReminder}
                initialEditMode={isDetailsEditing}
                isOpen={!!selectedReminder}
                onClose={() => {
                    setSelectedReminder(null);
                    setIsDetailsEditing(false);
                }}
                onUpdate={() => {
                    fetchReminders();
                    // Keep the panel open, just refresh data
                    // If we want to close: setSelectedReminder(null);
                }}
            />

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

            <GlobalSlideOver
                isOpen={editModal.isOpen && editModal.isCreate}
                onClose={() => setEditModal({ isOpen: false, reminder: null, isCreate: false })}
                title="New Reminder"
                actionButton={{
                    label: 'Create Reminder',
                    icon: <Save size={18} />,
                    onClick: handleSubmit
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="detail-card" style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '24px',
                    }}>
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Title</label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                className="input"
                                placeholder="What should I remind you about?"
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-lite)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-main)',
                                    padding: '12px',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group" style={{ width: '100%' }}>
                                <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Date</label>
                                <input
                                    type="date"
                                    value={editForm.date}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    className="input"
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-lite)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-main)',
                                        padding: '12px',
                                        fontSize: '1rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div className="form-group" style={{ width: '100%' }}>
                                <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Time</label>
                                <input
                                    type="time"
                                    value={editForm.time}
                                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                    className="input"
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-lite)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'var(--text-main)',
                                        padding: '12px',
                                        fontSize: '1rem',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Location (Optional)</label>
                            <input
                                type="text"
                                value={editForm.location}
                                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                                className="input"
                                placeholder="Add a location..."
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-lite)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-main)',
                                    padding: '12px',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>
                                <span>Enable Browser Push Notification?</span>
                                <div
                                    onClick={() => setEditForm(prev => ({ ...prev, alerts: { ...prev.alerts, push: !prev.alerts?.push } }))}
                                    style={{
                                        width: '40px',
                                        height: '20px',
                                        background: editForm.alerts?.push ? 'var(--primary-color)' : 'var(--bg-lite)',
                                        borderRadius: '20px',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: '0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        background: 'white',
                                        borderRadius: '50%',
                                        position: 'absolute',
                                        top: '2px',
                                        left: editForm.alerts?.push ? '22px' : '2px',
                                        transition: '0.2s'
                                    }} />
                                </div>
                            </label>
                        </div>
                        {user?.googleRefreshToken && (
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>
                                    <span>Sync to Google Calendar?</span>
                                    <div
                                        onClick={() => setEditForm(prev => ({ ...prev, syncToGoogle: !prev.syncToGoogle }))}
                                        className={`buddy-switch ${editForm.syncToGoogle ? 'buddy-switch-active' : ''}`}
                                        style={{ background: !editForm.syncToGoogle ? 'var(--bg-lite)' : '' }}
                                    >
                                        <div
                                            className="buddy-switch-knob"
                                            style={{ left: editForm.syncToGoogle ? '22px' : '2px' }}
                                        />
                                    </div>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </GlobalSlideOver>

        </div>
    );
};

export default Reminders;
