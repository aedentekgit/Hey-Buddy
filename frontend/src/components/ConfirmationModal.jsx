import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "danger" // danger, primary, warning
}) => {
    if (!isOpen) return null;

    const colors = {
        danger: {
            primary: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.1)',
            shadow: 'rgba(239, 68, 68, 0.2)'
        },
        primary: {
            primary: 'var(--primary-color)',
            bg: 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
            shadow: 'color-mix(in srgb, var(--primary-color) 20%, transparent)'
        },
        warning: {
            primary: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.1)',
            shadow: 'rgba(245, 158, 11, 0.2)'
        }
    };

    const activeColor = colors[type] || colors.primary;

    return (
        <AnimatePresence>
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(8px)'
                    }}
                />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '400px',
                        background: 'var(--card-bg)',
                        borderRadius: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden'
                    }}
                >
                    <div style={{ padding: '24px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: activeColor.bg,
                                color: activeColor.primary,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <AlertCircle size={24} />
                            </div>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: 'var(--text-main)'
                            }}>{title}</h3>
                        </div>

                        <p style={{
                            margin: 0,
                            color: 'var(--text-sub)',
                            fontSize: '0.95rem',
                            lineHeight: '1.6'
                        }}>
                            {message}
                        </p>

                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            marginTop: '24px'
                        }}>
                            <button
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-color)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: activeColor.primary,
                                    color: 'white',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: `0 4px 12px ${activeColor.shadow}`
                                }}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ConfirmationModal;
