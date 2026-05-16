import { useState, useEffect } from 'react';
import {
    MapPin, Plus, Trash2,
    Search, Loader2, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import locationReminderService from '../services/locationReminderService';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import GlobalSlideOver from '../components/GlobalSlideOver';
import SmartReminderDetails from '../components/SmartReminderDetails';
import MobileTaskCard from '../components/MobileTaskCard';
import GoogleMapPicker from '../components/GoogleMapPicker';
import CustomTimePicker from '../components/CustomTimePicker';
import { ThStyle, TableElementStyle } from '../styles/tableStyles';
import { useAuth } from '../context/AuthContext';

const LocationReminders = () => {
    const { user } = useAuth();
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pagination, setPagination] = useState({
        total: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 10
    });

    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [selectedReminder, setSelectedReminder] = useState(null);
    const [isDetailsEditing, setIsDetailsEditing] = useState(false);

    const [editModal, setEditModal] = useState({ isOpen: false, isCreate: true });
    const [editForm, setEditForm] = useState({
        title: '',
        location: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        warningLevel: 'medium',
        coordinates: { lat: null, lng: null },
        alerts: { push: true, email: true, notifyFamily: false, notifyEmergency: false }
    });

    useEffect(() => {
        fetchReminders(1);
    }, [searchTerm]);

    const fetchReminders = async (page = 1) => {
        try {
            setLoading(true);
            const res = await locationReminderService.getAll(page, pagination.limit, searchTerm);
            if (res.success) {
                setReminders(res.data);
                if (res.pagination) {
                    setPagination(res.pagination);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load location reminders");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClick = () => {
        setEditForm({
            title: '',
            location: '',
            date: new Date().toISOString().split('T')[0],
            time: '10:00 AM',
            warningLevel: 'medium',
            coordinates: { lat: null, lng: null },
            alerts: { push: true, email: true, notifyFamily: false, notifyEmergency: false }
        });
        setEditModal({ isOpen: true, isCreate: true });
    };

    const handleEditClick = (reminder) => {
        setSelectedReminder(reminder);
        setIsDetailsEditing(true);
    };

    const handleViewClick = (reminder) => {
        setSelectedReminder(reminder);
        setIsDetailsEditing(false);
    };

    const handleCreateSubmit = async () => {
        if (!editForm.title || !editForm.location) {
            toast.error("Title and Location are required");
            return;
        }

        try {
            const res = await locationReminderService.create(editForm);
            if (res.success) {
                toast.success("Location reminder created");
                setEditModal({ isOpen: false, isCreate: true });
                fetchReminders(1);
            }
        } catch (err) {
            toast.error("Failed to create reminder");
        }
    };

    const handleDelete = async () => {
        try {
            const res = await locationReminderService.delete(deleteModal.id);
            if (res.success) {
                toast.success("Reminder deleted");
                fetchReminders(pagination.currentPage);
                setDeleteModal({ isOpen: false, id: null });
            }
        } catch (err) {
            toast.error("Failed to delete reminder");
        }
    };

    return (
        <div style={{ color: 'var(--text-main)' }} className="reminders-page">
            <div className="table-container">
                <div className="search-management-header">
                    <div className="buddy-search-box hide-on-mobile">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search location reminders..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="create-btn mobile-fab"
                            onClick={handleCreateClick}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-md)',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={20} />
                            <span className="hide-on-mobile">New Reminder</span>
                        </button>
                    </div>
                </div>

                <div className="buddy-table-wrapper hide-on-mobile">
                    <table style={TableElementStyle} className="buddy-table">
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, borderLeft: 'none' }} className="buddy-th">S.NO</th>
                                <th style={{ ...ThStyle, borderLeft: 'none', borderRight: 'none' }} className="buddy-th">LOCATION REMINDER</th>
                                <th style={{ ...ThStyle, borderLeft: 'none', borderRight: 'none' }} className="buddy-th">SCHEDULE</th>
                                <th style={{ ...ThStyle, borderLeft: 'none', borderRight: 'none' }} className="buddy-th">STATUS</th>
                                <th style={{ ...ThStyle, borderLeft: 'none', borderRight: 'none' }} className="buddy-th">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--primary-color)' }} size={40} />
                                        <p style={{ marginTop: '16px', color: 'var(--text-sub)' }}>Loading reminders...</p>
                                    </td>
                                </tr>
                            ) : reminders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <div style={{ opacity: 0.5, marginBottom: '16px' }}>
                                            <MapPin size={48} style={{ margin: '0 auto' }} />
                                        </div>
                                        <p style={{ color: 'var(--text-sub)', fontWeight: '600' }}>No location reminders found</p>
                                    </td>
                                </tr>
                            ) : (
                                reminders.map((reminder, index) => (
                                    <motion.tr
                                        key={reminder._id}
                                        whileHover={{ backgroundColor: 'var(--row-hover)' }}
                                        style={{ borderBottom: '1px solid var(--border-color)' }}
                                    >
                                        <td style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem' }} className="buddy-td">
                                            {((pagination?.currentPage || 1) - 1) * (pagination?.limit || 10) + index + 1}
                                        </td>
                                        <td className="buddy-td">
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{reminder.title}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
                                                    <MapPin size={12} /> {reminder.location}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="buddy-td">
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.85rem' }}>
                                                <span style={{ fontWeight: '600' }}>{reminder.date || 'TBD'}</span>
                                                <span style={{ color: 'var(--text-sub)' }}>{reminder.time || 'Anytime'}</span>
                                            </div>
                                        </td>
                                        <td className="buddy-td">
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.7rem',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                background: reminder.status === 'risk_alert' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                color: reminder.status === 'risk_alert' ? '#ef4444' : '#10b981'
                                            }}>
                                                {reminder.status?.replace('_', ' ') || 'ON TRACK'}
                                            </span>
                                        </td>
                                        <td className="buddy-td" style={{ textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleViewClick(reminder)}
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--primary-color)', background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--primary-color) 20%, transparent)' }}
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal({ isOpen: true, id: reminder._id })}
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--danger-color)', background: 'color-mix(in srgb, var(--danger-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger-color) 20%, transparent)' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="mobile-card-view" style={{ marginTop: '16px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}><Loader2 className="animate-spin" size={32} style={{ color: 'var(--primary-color)' }} /></div>
                    ) : reminders.map((reminder) => (
                        <MobileTaskCard
                            key={reminder._id}
                            title={reminder.title}
                            subtitle={reminder.location}
                            date={reminder.date}
                            time={reminder.time}
                            type="location"
                            status={reminder.status}
                            onView={() => handleViewClick(reminder)}
                            onDelete={() => setDeleteModal({ isOpen: true, id: reminder._id })}
                        />
                    ))}
                </div>

                <Pagination
                    pagination={pagination}
                    onPageChange={(page) => fetchReminders(page)}
                />
            </div>

            {/* Create Reminder SlideOver */}
            <GlobalSlideOver
                isOpen={editModal.isOpen}
                onClose={() => setEditModal({ isOpen: false, isCreate: true })}
                title="New Location Reminder"
                actionButton={{
                    label: 'Create Reminder',
                    onClick: handleCreateSubmit
                }}
            >
                <div style={{ padding: '0 4px' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Reminder Title</label>
                        <input
                            required
                            className="buddy-input"
                            placeholder="e.g. Pickup son from school"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'var(--bg-lite)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-main)'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Location</label>
                        <GoogleMapPicker
                            location={editForm.location}
                            setLocation={(loc) => setEditForm({ ...editForm, location: loc })}
                            coordinates={editForm.coordinates}
                            setCoordinates={(coords) => setEditForm({ ...editForm, coordinates: coords })}
                            isEditing={true}
                            radius={500}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Date</label>
                            <input
                                type="date"
                                className="buddy-input"
                                value={editForm.date}
                                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'var(--bg-lite)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>
                        <CustomTimePicker
                            label="Time"
                            value={editForm.time}
                            onChange={(time) => setEditForm({ ...editForm, time })}
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>Safety Options</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.9rem' }}>Notify Family Backup?</span>
                                <input
                                    type="checkbox"
                                    checked={editForm.alerts.notifyFamily}
                                    onChange={(e) => setEditForm({ ...editForm, alerts: { ...editForm.alerts, notifyFamily: e.target.checked } })}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.9rem' }}>Emergency Broadcast?</span>
                                <input
                                    type="checkbox"
                                    checked={editForm.alerts.notifyEmergency}
                                    onChange={(e) => setEditForm({ ...editForm, alerts: { ...editForm.alerts, notifyEmergency: e.target.checked } })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </GlobalSlideOver>

            {/* Details & Edit View */}
            <SmartReminderDetails
                reminder={selectedReminder}
                isOpen={!!selectedReminder}
                onClose={() => setSelectedReminder(null)}
                onUpdate={() => {
                    fetchReminders(pagination.currentPage);
                    setSelectedReminder(null);
                }}
                initialEditMode={isDetailsEditing}
            />

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Reminder"
                message="Are you sure you want to delete this location reminder?"
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
};

export default LocationReminders;
