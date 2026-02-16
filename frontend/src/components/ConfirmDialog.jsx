import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmDialog.css';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', cancelText = 'Cancel', type = 'danger' }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="confirm-dialog-overlay" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="confirm-dialog"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="dialog-close" onClick={onClose}>
                        <X size={20} />
                    </button>

                    <div className="dialog-icon">
                        <AlertTriangle size={32} />
                    </div>

                    <h2 className="dialog-title">{title}</h2>
                    <p className="dialog-message">{message}</p>

                    <div className="dialog-actions">
                        <button className="btn-cancel" onClick={onClose}>
                            {cancelText}
                        </button>
                        <button
                            className={`btn-confirm ${type}`}
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ConfirmDialog;
