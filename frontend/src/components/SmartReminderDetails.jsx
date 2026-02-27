import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin, Clock, AlertCircle, CheckCircle2, XCircle, Bell, MessageSquare, Mail,
    ChevronDown, ChevronUp, BellRing, Navigation, Activity, CalendarDays,
    Users, Plus, Trash2, Smartphone, Zap, ShieldAlert, Car, Share2, Edit2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import GlobalSlideOver from './GlobalSlideOver';
import { formatTime, formatDate, formatTimeForInput } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import GoogleMapPicker from './GoogleMapPicker';
import CustomTimePicker from './CustomTimePicker';
import CustomDurationPicker from './CustomDurationPicker';

const DetailCard = ({ title, children, className = '' }) => (
    <div className={`detail-card ${className}`} style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '20px',
    }}>
        {title && (
            <h4 style={{
                margin: '0 0 20px 0',
                fontSize: '0.9rem',
                fontWeight: '700',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                {title}
            </h4>
        )}
        {children}
    </div>
);

const ToggleSwitch = ({ checked, onChange }) => (
    <div
        onClick={() => onChange(!checked)}
        style={{
            width: '44px',
            height: '24px',
            background: checked ? 'var(--primary-color)' : 'var(--bg-lite)',
            borderRadius: 'var(--radius-lg)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.1s ease',
            border: `1px solid ${checked ? 'var(--primary-color)' : 'var(--border-color)'}`
        }}
    >
        <div style={{
            width: '18px',
            height: '18px',
            background: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: checked ? '22px' : '2px',
            transition: 'all 0.1s ease'
        }} />
    </div>
);

const SmartReminderDetails = ({ reminder, onClose, onUpdate, initialEditMode = false, isOpen = true }) => {
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(initialEditMode);

    // Cached reminder for exit animation
    const [cachedReminder, setCachedReminder] = useState(reminder);

    // Local state for interactive elements
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [coordinates, setCoordinates] = useState({ lat: null, lng: null });

    const [bufferTime, setBufferTime] = useState(15);
    const [geofenceRadius, setGeofenceRadius] = useState(500);
    const [alerts, setAlerts] = useState({ push: true, sms: false, email: false });
    const [priority, setPriority] = useState('medium');
    const [backupContacts, setBackupContacts] = useState([]);
    const [escalationTime, setEscalationTime] = useState(0);
    const [smartFeatures, setSmartFeatures] = useState({
        earlyWarning: false,
        trafficAware: false,
        itemExitGuards: false
    });

    useEffect(() => {
        if (reminder) {
            setCachedReminder(reminder);
            setTitle(reminder.title || '');
            setDate(reminder.date ? new Date(reminder.date).toISOString().split('T')[0] : '');
            setTime(formatTimeForInput(reminder.time) || '');
            setLocation(reminder.location || '');
            setCoordinates(reminder.coordinates || { lat: null, lng: null });
            setBufferTime(reminder.bufferTime || 15);
            setGeofenceRadius(reminder.geofenceRadius || 500);
            setAlerts(reminder.alerts || { push: true, sms: false, email: false });
            setPriority(reminder.priority || 'medium');
            setBackupContacts(reminder.backupContacts || []);
            setEscalationTime(reminder.escalationTime || 0);
            setSmartFeatures(reminder.smartFeatures || {
                earlyWarning: false,
                trafficAware: false,
                itemExitGuards: false
            });
            setIsEditing(initialEditMode);
        }
    }, [reminder, initialEditMode]);

    const activeReminder = reminder || cachedReminder;

    const [travelStats, setTravelStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        const fetchTravelStats = async () => {
            if (!activeReminder?._id || !activeReminder?.coordinates?.lat) return;
            try {
                setLoadingStats(true);
                const res = await api.get(`/reminders/${activeReminder._id}/travel-stats`);
                if (res.data.success) {
                    setTravelStats(res.data.data);
                }
            } catch (err) {
                console.error("Failed to fetch travel stats", err);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchTravelStats();
    }, [activeReminder?._id, coordinates]);

    if (!activeReminder) return null;

    const handleSave = async () => {
        try {
            const updatedData = {
                title,
                date,
                time,
                location,
                coordinates,
                bufferTime,
                geofenceRadius,
                alerts,
                priority,
                backupContacts,
                escalationTime,
                smartFeatures
            };
            await api.put(`/voice/${activeReminder._id}`, updatedData);
            toast.success("Settings updated");
            onUpdate();
        } catch (err) {
            toast.error("Failed to update settings");
        }
    };

    const handleAction = async (action) => {
        try {
            let status = 'pending';
            if (action === 'complete') status = 'completed';
            if (action === 'snooze') status = 'snoozed';
            if (action === 'reschedule') {
                toast("Rescheduling feature coming soon!");
                return;
            }

            await api.put(`/voice/${activeReminder._id}`, { status });
            toast.success(`Reminder ${status}`);
            onUpdate();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <GlobalSlideOver
            isOpen={isOpen}
            onClose={onClose}
            zIndex={2000}
            statusBadge={{
                label: 'On Track',
                bg: 'color-mix(in srgb, var(--success-color) 10%, transparent)',
                color: 'var(--success-color)'
            }}
            actionButton={{
                label: isEditing ? 'Cancel' : 'Edit Settings',
                icon: isEditing ? null : <Edit2 size={16} />,
                onClick: () => setIsEditing(!isEditing),
                variant: isEditing ? 'danger' : 'primary'
            }}
        >
            <div className="smart-reminder-details-container" style={{ paddingBottom: '24px' }}>


                {isEditing ? (
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{
                            width: '100%',
                            fontSize: '1.8rem',
                            fontWeight: '800',
                            background: 'var(--bg-lite)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-main)',
                            padding: '12px',
                            marginBottom: '16px',
                            outline: 'none'
                        }}
                    />
                ) : (
                    <h1 style={{ fontSize: '1.8rem', fontWeight: '800', lineHeight: '1.2', marginBottom: '8px', color: 'var(--text-main)' }}>
                        {title}
                    </h1>
                )}

                {/* Meta Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', color: 'var(--text-sub)', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ padding: '8px', background: 'var(--bg-lite)', borderRadius: '10px' }}><MapPin size={18} color="var(--primary-color)" /></div>
                        <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontWeight: '700', color: 'var(--text-main)' }}>Location</span>
                            {isEditing ? (
                                <input
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Add location..."
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-lite)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        padding: '8px',
                                        marginTop: '4px',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            ) : (
                                location || 'No location set'
                            )}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ padding: '8px', background: 'var(--bg-lite)', borderRadius: '10px' }}><Clock size={18} color="var(--primary-color)" /></div>
                        <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontWeight: '700', color: 'var(--text-main)' }}>Schedule</span>
                            {isEditing ? (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'var(--bg-lite)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px',
                                            color: 'var(--text-main)',
                                            padding: '8px',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                    <CustomTimePicker
                                        value={time}
                                        onChange={(newTime) => setTime(newTime)}
                                    />
                                </div>
                            ) : (
                                <>Time: {formatTime(time, user?.timeFormat) || '--:--'} • {formatDate(date, user?.dateFormat) || 'No date set'}</>
                            )}
                        </div>
                    </div>
                </div>

                {/* Time Settings */}
                <DetailCard title={<><Clock size={20} /> Time Settings</>}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
                            <span>Safety Buffer Time</span>
                            <span style={{ color: 'var(--primary-color)' }}>{bufferTime}m</span>
                        </label>
                        <CustomDurationPicker
                            value={bufferTime}
                            onChange={(val) => isEditing && setBufferTime(val)}
                            min={0}
                            max={120}
                            step={5}
                        />
                    </div>

                    <div style={{
                        background: 'linear-gradient(135deg, rgba(0, 117, 255, 0.1), rgba(139, 92, 246, 0.1))',
                        padding: '16px',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <Clock size={24} color="var(--primary-color)" />
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-sub)' }}>Adjusted Notification Time</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-glow)' }}>
                                {activeReminder.time ? (() => {
                                    try {
                                        // Use formatTimeForInput to ensure we have a standard HH:mm (24h) string
                                        const time24 = formatTimeForInput(activeReminder.time);
                                        const [h, m] = time24.split(':').map(Number);

                                        // Create a date object to handle math accurately
                                        const dateObj = new Date();
                                        dateObj.setHours(h, m, 0, 0);

                                        // Subtract buffer
                                        dateObj.setMinutes(dateObj.getMinutes() - bufferTime);

                                        // Format back for display
                                        return formatTime(dateObj, user?.timeFormat);
                                    } catch (err) {
                                        console.error("Time math error:", err);
                                        return '--:--';
                                    }
                                })() : '--:--'}
                            </div>
                        </div>
                    </div>
                </DetailCard>

                {/* Location Settings */}
                <DetailCard title={<><Navigation size={20} /> Location Settings</>}>
                    {location && (!coordinates?.lat || !coordinates?.lng) && !isEditing && (
                        <div style={{
                            marginBottom: '12px',
                            padding: '10px 14px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            border: '1px solid rgba(245, 158, 11, 0.2)'
                        }}>
                            <AlertCircle size={18} color="#f59e0b" />
                            <span style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: '600' }}>
                                Destination not plotted. Enter Edit mode to set coordinates.
                            </span>
                        </div>
                    )}
                    <GoogleMapPicker
                        location={location}
                        setLocation={setLocation}
                        coordinates={coordinates}
                        setCoordinates={setCoordinates}
                        isEditing={isEditing}
                        radius={geofenceRadius}
                        userLocation={user?.currentLocation || { lat: 9.9252, lng: 78.1198 }} // Fallback to Madurai coords if missing
                    />

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
                            <span>Geofence Radius</span>
                            <span style={{ color: 'var(--primary-color)' }}>{geofenceRadius}m</span>
                        </label>
                        <input
                            type="range"
                            min="100"
                            max="2000"
                            step="100"
                            value={geofenceRadius}
                            disabled={!isEditing}
                            onChange={(e) => setGeofenceRadius(parseInt(e.target.value))}
                            style={{
                                width: '100%',
                                accentColor: 'var(--primary-color)',
                                opacity: !isEditing ? 0.5 : 1,
                                cursor: !isEditing ? 'not-allowed' : 'pointer'
                            }}
                        />
                    </div>

                    {travelStats && (
                        <div style={{
                            marginTop: '4px',
                            padding: '16px',
                            background: 'var(--bg-lite)',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                                    <Activity size={14} /> Current Distance
                                </div>
                                <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                                    {(travelStats.distance / 1000).toFixed(2)} km
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                                    <Car size={14} /> Est. Travel Time
                                </div>
                                <div style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                                    {Math.round(travelStats.durationInTraffic / 60)} mins
                                </div>
                            </div>
                        </div>
                    )}
                </DetailCard>

                {/* Family Backup Section */}
                <DetailCard title={<><Users size={20} /> Family Backup</>}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '16px' }}>
                        Select backup contacts who will be notified if you don't respond
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {backupContacts.length === 0 ? (
                            <div style={{
                                padding: '32px',
                                background: 'var(--bg-lite)',
                                border: '1px dashed var(--border-color)',
                                borderRadius: '16px',
                                textAlign: 'center',
                                color: 'var(--text-sub)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <Smartphone size={24} style={{ opacity: 0.5 }} />
                                <span style={{ fontSize: '0.85rem' }}>No backup contacts added</span>
                            </div>
                        ) : (
                            backupContacts.map((contact, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'var(--bg-lite)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                            {contact.name[0]}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{contact.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{contact.phone}</div>
                                        </div>
                                    </div>
                                    {isEditing && (
                                        <button
                                            onClick={() => setBackupContacts(backupContacts.filter((_, i) => i !== idx))}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}

                        {isEditing && (
                            <button
                                onClick={() => {
                                    const name = prompt("Enter contact name:");
                                    const phone = prompt("Enter contact phone:");
                                    if (name && phone) {
                                        setBackupContacts([...backupContacts, { name, phone }]);
                                    }
                                }}
                                className="btn-outline"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    padding: '12px',
                                    background: 'var(--bg-lite)',
                                    fontSize: '0.9rem',
                                    color: 'var(--text-main)',
                                    borderStyle: 'solid'
                                }}
                            >
                                <Plus size={16} /> Add Backup Contact
                            </button>
                        )}
                    </div>

                    <div style={{ marginTop: '24px' }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginBottom: '12px' }}>
                            Escalation Timeline
                        </label>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginBottom: '16px' }}>
                            When should backup contacts be notified?
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                                { val: 0, label: 'Immediately', sub: 'Notify contacts right away' },
                                { val: 15, label: '15 Minutes', sub: 'Wait 15 minutes before notifying' },
                                { val: 30, label: '30 Minutes', sub: 'Wait 30 minutes before notifying' }
                            ].map((opt) => (
                                <div
                                    key={opt.val}
                                    onClick={() => isEditing && setEscalationTime(opt.val)}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '16px',
                                        background: escalationTime === opt.val ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'var(--bg-lite)',
                                        border: `1px solid ${escalationTime === opt.val ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                        cursor: isEditing ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s ease',
                                        opacity: !isEditing && escalationTime !== opt.val ? 0.4 : 1
                                    }}
                                >
                                    <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: `2px solid ${escalationTime === opt.val ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {escalationTime === opt.val && (
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary-color)' }} />
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: escalationTime === opt.val ? 'var(--primary-glow)' : 'var(--text-main)' }}>{opt.label}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{opt.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DetailCard>

                {/* Sharing & Collaboration Section */}
                {activeReminder.sharedWith && activeReminder.sharedWith.length > 0 && (
                    <DetailCard title={<><Share2 size={20} /> Sharing & Collaboration</>}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {activeReminder.sharedWith.map((share, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'var(--bg-lite)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '12px',
                                            background: 'var(--primary-glow)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: 'bold',
                                            fontSize: '0.9rem',
                                            boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.3)'
                                        }}>
                                            {share.user?.name ? share.user.name[0].toUpperCase() : 'U'}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>{share.user?.name || 'Unknown User'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{share.user?.email}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            padding: '4px 10px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            borderRadius: '8px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            color: 'var(--primary-color)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            {share.permissions || 'view'}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await api.delete(`/reminders/${activeReminder._id}/unshare/${share.user._id}`);
                                                    toast.success('User removed from shared list');
                                                    onUpdate();
                                                } catch (err) {
                                                    toast.error('Failed to remove user');
                                                }
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--danger-color)',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DetailCard>
                )}

                {/* Smart Features Section */}
                <DetailCard title={<><Zap size={20} /> Smart Features</>}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '20px' }}>
                        Enable AI-powered features to enhance your reminders
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Early Warning System */}
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '10px', background: 'color-mix(in srgb, var(--danger-color) 10%, transparent)', borderRadius: '12px', color: 'var(--danger-color)' }}>
                                <ShieldAlert size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Early Warning System
                                        <span style={{ background: 'var(--primary-color)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', fontWeight: '800' }}>AI</span>
                                    </span>
                                    <ToggleSwitch
                                        checked={smartFeatures.earlyWarning}
                                        onChange={(v) => isEditing && setSmartFeatures({ ...smartFeatures, earlyWarning: v })}
                                    />
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.4' }}>
                                    Get proactive alerts when you're at risk of being late based on your current location and traffic conditions
                                </p>
                            </div>
                        </div>

                        <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.5 }} />

                        {/* Traffic-Aware ETA */}
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                                <Car size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Traffic-Aware ETA
                                        <span style={{ background: 'var(--success-color)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', fontWeight: '800' }}>LIVE</span>
                                    </span>
                                    <ToggleSwitch
                                        checked={smartFeatures.trafficAware}
                                        onChange={(v) => isEditing && setSmartFeatures({ ...smartFeatures, trafficAware: v })}
                                    />
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.4' }}>
                                    Automatically adjust reminder times based on real-time traffic data and route conditions
                                </p>
                            </div>
                        </div>

                        <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.5 }} />

                        {/* Item Exit Guards */}
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
                                <Smartphone size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Item Exit Guards
                                        <span style={{ background: '#6366f1', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '6px', fontWeight: '800' }}>NEW</span>
                                    </span>
                                    <ToggleSwitch
                                        checked={smartFeatures.itemExitGuards}
                                        onChange={(v) => isEditing && setSmartFeatures({ ...smartFeatures, itemExitGuards: v })}
                                    />
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.4' }}>
                                    Get reminded about items you need to bring when leaving a location (e.g., wallet, keys, documents)
                                </p>
                            </div>
                        </div>

                        <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.5 }} />

                        {/* Push Notifications */}
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{ padding: '10px', background: 'rgba(0, 117, 255, 0.1)', borderRadius: '12px', color: 'var(--primary-color)' }}>
                                <Bell size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        Push Notifications
                                    </span>
                                    <ToggleSwitch
                                        checked={alerts.push}
                                        onChange={(v) => isEditing && setAlerts({ ...alerts, push: v })}
                                    />
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.4' }}>
                                    Receive alerts on your device
                                </p>
                            </div>
                        </div>
                    </div>
                </DetailCard>




                {/* Save Button */}
                {isEditing && (
                    <div style={{ position: 'sticky', bottom: '24px', zIndex: 10, padding: '0 4px', marginBottom: '32px' }}>
                        <button
                            onClick={async () => {
                                await handleSave();
                                setIsEditing(false);
                            }}
                            className="btn-primary"
                            style={{
                                width: '100%',
                                padding: '16px',
                                borderRadius: '16px',
                                fontSize: '1rem',
                                fontWeight: '800',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 30px rgba(165, 180, 252, 0.4)',
                                background: 'var(--button-gradient)',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Save Settings
                        </button>
                    </div>
                )}



                {/* Timeline */}
                <div style={{ paddingLeft: '24px' }}>
                    <h4 style={{ margin: '0 0 24px 0', fontSize: '1.1rem', fontWeight: '700' }}>Timeline</h4>
                    <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {activeReminder.timeline?.length > 0 ? activeReminder.timeline.map((item, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'absolute',
                                    left: '-31px',
                                    top: '0',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-color)',
                                    border: '2px solid var(--primary-color)'
                                }} />
                                <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{item.action}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{formatDate(item.timestamp, user?.dateFormat)} {formatTime(new Date(item.timestamp).getHours() + ':' + new Date(item.timestamp).getMinutes(), user?.timeFormat)}</div>
                            </div>
                        )) : (
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'absolute',
                                    left: '-31px',
                                    top: '0',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: 'var(--primary-color)',
                                }} />
                                <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>Reminder Created</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{formatDate(activeReminder.createdAt, user?.dateFormat)} {formatTime(new Date(activeReminder.createdAt).getHours() + ':' + new Date(activeReminder.createdAt).getMinutes(), user?.timeFormat)}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ height: '100px' }}></div>
            </div>

            {/* Mobile Responsive Styles */}
            <style>{`
                @media (max-width: 767px) {
                    .smart-reminder-details-panel {
                        max-width: 100% !important;
                        border-left: none !important;
                    }

                    .smart-reminder-details-container {
                        padding: 16px !important;
                    }

                    .smart-reminder-details-container h1 {
                        font-size: 1.4rem !important;
                        margin-bottom: 16px !important;
                    }

                    .detail-card {
                        padding: 16px !important;
                        border-radius: 16px !important;
                        margin-bottom: 16px !important;
                    }

                    .detail-card h4 {
                        font-size: 0.95rem !important;
                        margin-bottom: 16px !important;
                    }

                    .detail-card p {
                        font-size: 0.8rem !important;
                    }

                    /* Adjust grid layouts for mobile */
                    div[style*="grid-template-columns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }

                    /* Meta info sections */
                    .smart-reminder-details-container > div[style*="display: flex"][style*="flex-direction: column"] {
                        gap: 8px !important;
                    }

                    /* Reduce header margin */
                    .smart-reminder-details-container > div[style*="display: flex"][style*="justify-content: space-between"]:first-of-type {
                        margin-bottom: 20px !important;
                    }

                    /* Quick actions buttons */
                    button[class*="btn"] {
                        padding: 12px !important;
                        font-size: 0.85rem !important;
                    }

                    /* Map preview height */
                    div[style*="height: 180px"] {
                        height: 140px !important;
                    }
                }

                @media (max-width: 480px) {
                    .smart-reminder-details-container {
                        padding: 12px !important;
                    }

                    .smart-reminder-details-container h1 {
                        font-size: 1.2rem !important;
                        line-height: 1.3 !important;
                    }

                    .detail-card {
                        padding: 12px !important;
                        border-radius: 12px !important;
                    }

                    .detail-card h4 {
                        font-size: 0.85rem !important;
                        gap: 6px !important;
                    }

                    .detail-card h4 svg {
                        width: 16px !important;
                        height: 16px !important;
                    }

                    /* Smaller icon sizes on mobile */
                    .detail-card svg {
                        width: 16px !important;
                        height: 16px !important;
                    }

                    /* Close button */
                    button[style*="background: none"] svg {
                        width: 24px !important;
                        height: 24px !important;
                    }

                    /* Status badge */
                    div[style*="padding: 6px 16px"] {
                        padding: 4px 12px !important;
                        font-size: 0.75rem !important;
                    }

                    /* Meta info icons */
                    div[style*="padding: 8px"][style*="background: var(--bg-lite)"] {
                        padding: 6px !important;
                    }

                    div[style*="padding: 8px"][style*="background: var(--bg-lite)"] svg {
                        width: 14px !important;
                        height: 14px !important;
                    }

                    /* Quick action buttons */
                    button[class*="btn"] {
                        padding: 10px !important;
                        font-size: 0.75rem !important;
                        gap: 6px !important;
                    }

                    button[class*="btn"] svg {
                        width: 18px !important;
                        height: 18px !important;
                    }

                    /* Save button */
                    button[class*="btn-primary"] {
                        padding: 14px !important;
                        font-size: 0.9rem !important;
                    }

                    /* Map preview */
                    div[style*="height: 180px"], div[style*="height: 140px"] {
                        height: 120px !important;
                    }

                    /* Timeline section */
                    div[style*="paddingLeft: 24px"] {
                        padding-left: 12px !important;
                    }

                    div[style*="paddingLeft: 24px"] h4 {
                        font-size: 0.9rem !important;
                        margin-bottom: 16px !important;
                    }
                }
            `}</style>
        </GlobalSlideOver>
    );
};

export default SmartReminderDetails;
