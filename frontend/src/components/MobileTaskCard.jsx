import React from 'react';
import { Clock, MapPin, HelpCircle, Car, AlertTriangle, Users, Edit2, Trash2 } from 'lucide-react';

const TaskCard = ({
    title,
    status,
    variant,
    time,
    location,
    distance,
    eta,
    onEdit,
    onDelete,
    onView,
    onShare
}) => {
    const isGreen = variant === 'green';
    const isDanger = variant === 'danger';

    const styles = {
        container: {
            backgroundColor: isGreen ? '#effaf6' : isDanger ? '#ffe4e6' : '#fff9f0',
            borderColor: isGreen ? '#ace0d6' : isDanger ? '#fecdd3' : '#fee2a0',
        },
        header: {
            backgroundColor: isGreen ? '#effaf6' : isDanger ? '#ffe4e6' : '#fff9f0',
        },
        iconBg: {
            backgroundColor: isGreen ? '#caece1' : isDanger ? '#fecdd3' : '#fbe7c6',
        },
        iconColor: {
            color: isGreen ? '#88b5a8' : isDanger ? '#e11d48' : '#d6b08a',
        },
        badge: {
            backgroundColor: isGreen ? '#059669' : isDanger ? '#e11d48' : '#ea580c',
        },
    };

    return (
        <div style={{
            borderRadius: '18px',
            border: '1.5px solid',
            ...styles.container,
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            fontFamily: 'sans-serif',
            marginBottom: '16px',
            overflow: 'hidden'
        }}>
            {/* Header Section */}
            <div style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                ...styles.header,
                position: 'relative'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                    ...styles.iconBg
                }}>
                    <HelpCircle size={20} style={{ ...styles.iconColor }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px', flex: 1 }}>
                    <h2 style={{
                        fontSize: '17px',
                        fontWeight: 'bold',
                        color: '#1e293b',
                        lineHeight: '1.2',
                        margin: 0
                    }}>
                        {title}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '2px 10px',
                            borderRadius: '9999px',
                            color: 'white',
                            ...styles.badge,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {status}
                        </span>
                        {isDanger && (
                            <span style={{ color: '#e11d48', fontWeight: 'bold', fontSize: '18px' }}>!</span>
                        )}
                    </div>
                </div>

                {/* Edit/Delete Actions added strictly for functionality */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                        <Trash2 size={16} color="#ef4444" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ backgroundColor: 'white', borderTopLeftRadius: '18px', borderTopRightRadius: '18px' }}>
                {/* Time and Location Details */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
                        <Clock size={18} strokeWidth={1.8} />
                        <span style={{ fontSize: '15px', fontWeight: 500 }}>{time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
                        <MapPin size={18} fill="currentColor" stroke="none" />
                        <span style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '-0.01em' }}>
                            {location}
                        </span>
                    </div>
                </div>

                {/* Stats Box (Distance & ETA) */}
                {distance && eta && (
                    <div style={{ padding: '0 16px 16px' }}>
                        <div style={{
                            backgroundColor: '#eff6ff',
                            borderRadius: '14px',
                            padding: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            border: '1px solid #dbeafe'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <HelpCircle size={14} color="#94a3b8" style={{ marginBottom: '2px' }} />
                                <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distance</span>
                                <span style={{ color: '#1e293b', fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>{distance}</span>
                            </div>

                            <div style={{ width: '1px', height: '32px', backgroundColor: '#cbd5e1', margin: '0 8px' }} />

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Car size={16} color="#3b82f6" fill="currentColor" style={{ marginBottom: '2px' }} />
                                <span style={{ color: '#64748b', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ETA</span>
                                <span style={{ color: '#1e293b', fontSize: '16px', fontWeight: 'bold', marginTop: '2px' }}>{eta}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: '#f1f5f9', width: '100%' }} />

                {/* Action Buttons */}
                <div style={{ padding: '16px', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onView && onView(); }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: '#fff7ed',
                            border: '1px solid #fed7aa',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            color: '#c2410c',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}>
                        <AlertTriangle size={14} fill="currentColor" color="#ea580c" strokeWidth={2.5} />
                        Early Warning
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onShare && onShare(); }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            color: '#1d4ed8',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}>
                        <Users size={14} fill="currentColor" color="#2563eb" />
                        Family Backup
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskCard;
