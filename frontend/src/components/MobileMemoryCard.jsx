import React from 'react';
import { Brain, FileText, Calendar, Edit2, Trash2, Eye } from 'lucide-react';

const MobileMemoryCard = ({
    item,
    onView,
    onEdit,
    onDelete
}) => {
    const isMemory = item.type === 'memory';

    // Style Variants
    // Memory = Purple theme
    // Document = Green theme (matching the user's green task card style, or blue for docs)
    // Let's go with Green for Documents to match the "On Track" or "Safe" vibe, or Blue for "Information".
    // User asked for "no mismatch style". The provided screenshots showed Green for "Call" (a reminder).
    // I will use Purple for Memories and Soft Blue for Documents to distinguish them but keep the same *style*.

    // Purple Theme (Memories)
    const purpleStyles = {
        container: { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }, // purple-100, purple-300
        header: { backgroundColor: '#f3e8ff' },
        iconBg: { backgroundColor: '#e9d5ff' }, // purple-200
        iconColor: { color: '#9333ea' }, // purple-600
        badge: { backgroundColor: '#9333ea' },
        button1: { bg: '#faf5ff', border: '#e9d5ff', text: '#9333ea' }, // Purple Filled
        button2: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' }  // Blue Filled
    };

    // Green Theme (Documents)
    const greenStyles = {
        container: { backgroundColor: '#effaf6', borderColor: '#ace0d6' },
        header: { backgroundColor: '#effaf6' },
        iconBg: { backgroundColor: '#caece1' },
        iconColor: { color: '#88b5a8' },
        badge: { backgroundColor: '#059669' },
        button1: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a' }, // Green Filled
        button2: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' } // Blue Filled
    };

    const styles = isMemory ? purpleStyles : greenStyles;

    // Format Date
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const title = isMemory
        ? item.content
        : (item.fileName || 'Medical Document');

    const subTitle = isMemory
        ? formatDate(item.createdAt)
        : (item.extractedData?.patientName || 'No Patient Name');

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
                    {isMemory ? (
                        <Brain size={20} style={{ ...styles.iconColor }} />
                    ) : (
                        <FileText size={20} style={{ ...styles.iconColor }} />
                    )}
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
                        WebkitLineClamp: isMemory ? 2 : 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                    }}>
                        {title}
                    </h2>

                    {/* Subtitle / Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start' }}>
                        {!isMemory && (
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
                        )}
                        <div style={{
                            fontSize: '11px',
                            fontWeight: '500',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <Calendar size={10} /> {formatDate(item.createdAt)}
                        </div>
                    </div>
                </div>

                {/* Delete Action (Top Right) */}
                <div style={{ display: 'flex', gap: '8px' }}>
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

                {/* For Documents: Show extra file info if available, or just padding */}
                {/* For Memories: Maybe show more text if truncating in header? */}
                {/* Replicating TaskCard structure: It uses this space for Time/Location */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {!isMemory && item.extractedData?.doctorName && (
                        <div style={{ fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '600', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Doctor:</span>
                            {item.extractedData.doctorName}
                        </div>
                    )}

                    {/* Preview Text for long memories? or just keep it clean */}
                    {isMemory && item.content.length > 80 && (
                        <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                            {item.content.substring(0, 120)}...
                        </p>
                    )}
                    {!isMemory && !item.extractedData?.doctorName && (
                        <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Tap view to see document details
                        </div>
                    )}
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

export default MobileMemoryCard;
