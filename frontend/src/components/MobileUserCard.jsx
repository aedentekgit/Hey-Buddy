import React from 'react';
import { User, Eye, Edit2, Trash2, Mail } from 'lucide-react';

const MobileUserCard = ({
    user,
    onView,
    onEdit,
    onDelete
}) => {
    // Green Theme (Users - matching the "On Track/Safe" vibe used in Reminders/Docs)
    // Green Theme (Users - matching the "On Track/Safe" vibe used in Reminders/Docs)
    const styles = {
        container: { backgroundColor: '#effaf6', borderColor: '#ace0d6' },
        header: { backgroundColor: '#effaf6' },
        iconBg: { backgroundColor: '#caece1' },
        iconColor: { color: '#88b5a8' },
        badge: {
            backgroundColor: user.role === 'admin' ? '#059669' : '#64748b', // Green for Admin, Slate for User
            color: '#white'
        },
        button1: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' }, // Green Filled
        button2: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }, // Blue Filled (Match Family Backup)
        badgeText: user.role === 'admin' ? '#ffffff' : '#f8fafc'
    };

    const title = user.name || (user.email === 'admin@example.com' ? 'System Administrator' : 'Pending Name');
    const subTitle = `ID: ${user._id?.slice(-8).toUpperCase()}`;

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
                {/* Icon Box */}
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
                    <User size={20} style={{ ...styles.iconColor }} />
                </div>

                {/* Title & Subtitle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px', flex: 1, minWidth: 0 }}>
                    <h2 style={{
                        fontSize: '15px',
                        fontWeight: 'bold',
                        color: '#1e293b',
                        lineHeight: '1.3',
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {title}
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {subTitle}
                        </div>
                    </div>

                    {/* Role Badge */}
                    <span style={{
                        marginTop: '6px',
                        fontSize: '9px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: styles.badge.backgroundColor,
                        color: styles.badgeText,
                        alignSelf: 'flex-start',
                        display: 'inline-block'
                    }}>
                        {user.role || 'USER'}
                    </span>
                </div>

                {/* Delete Action (Top Right) */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {/* No delete button on top right to avoid accidental deletes, users are critical entities. Kept consistent with request "do same thing", but maybe safer to keep actions at bottom. Adding here for consistency with other cards. */}
                    {/* Actually, user requested "do the same thing", so I will add the trash icon top right as per Reminder/Memory card style */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                        <Trash2 size={16} color="#ef4444" />
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div style={{ backgroundColor: 'white', borderTopLeftRadius: '18px', borderTopRightRadius: '18px' }}>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                        {user.email}
                    </div>
                </div>

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
                            backgroundColor: styles.button1.bg,
                            border: `1px solid ${styles.button1.border}`,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            color: styles.button1.text,
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}>
                        <Eye size={16} />
                        View
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: styles.button2.bg,
                            border: `1px solid ${styles.button2.border}`,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            color: styles.button2.text,
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}>
                        <Edit2 size={15} />
                        Edit
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileUserCard;
