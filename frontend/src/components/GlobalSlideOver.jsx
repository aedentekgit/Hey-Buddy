import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2 } from 'lucide-react';

const GlobalSlideOver = ({
    isOpen,
    onClose,
    title,
    actionButton, // { label: string, onClick: func, icon: ReactNode, variant: 'primary' | 'danger' | 'outline' }
    statusBadge, // { label: string, color: string }
    children,
    width = '480px',
    zIndex = 2000
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.3)',
                            zIndex: zIndex - 1,
                            backdropFilter: 'blur(2px)'
                        }}
                    />

                    {/* Slide Over Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="global-slide-over"
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            width: '100%',
                            maxWidth: width,
                            height: '100vh',
                            background: 'var(--bg-color)',
                            borderLeft: '1px solid var(--border-color)',
                            zIndex: zIndex,
                            overflowY: 'auto',
                            boxShadow: '-10px 0 40px rgba(0,0,0,0.1)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <button
                                        onClick={onClose}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-sub)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            padding: '4px',
                                            borderRadius: '50%',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-lite)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                        <X size={28} />
                                    </button>

                                    {actionButton && (
                                        <button
                                            onClick={actionButton.onClick}
                                            style={{
                                                background: actionButton.variant === 'danger' ? 'color-mix(in srgb, var(--danger-color) 10%, transparent)' : 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
                                                border: `1px solid ${actionButton.variant === 'danger' ? 'color-mix(in srgb, var(--danger-color) 20%, transparent)' : 'color-mix(in srgb, var(--primary-color) 20%, transparent)'}`,
                                                color: actionButton.variant === 'danger' ? 'var(--danger-color)' : 'var(--primary-color)',
                                                padding: '8px 16px',
                                                borderRadius: '12px',
                                                fontSize: '0.85rem',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {actionButton.icon}
                                            {actionButton.label}
                                        </button>
                                    )}
                                </div>

                                {statusBadge && (
                                    <div style={{
                                        padding: '6px 16px',
                                        background: statusBadge.bg || 'color-mix(in srgb, var(--success-color) 10%, transparent)',
                                        color: statusBadge.color || 'var(--success-color)',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        fontWeight: '700'
                                    }}>
                                        {statusBadge.label}
                                    </div>
                                )}
                            </div>

                            {/* Title */}
                            {title && (
                                <h1 style={{
                                    fontSize: '1.8rem',
                                    fontWeight: '800',
                                    lineHeight: '1.2',
                                    marginBottom: '24px',
                                    color: 'var(--text-main)',
                                    paddingLeft: '4px'
                                }}>
                                    {title}
                                </h1>
                            )}

                            {/* Content */}
                            <div style={{ flex: 1 }}>
                                {children}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default GlobalSlideOver;
