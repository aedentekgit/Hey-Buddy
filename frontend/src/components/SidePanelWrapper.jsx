import React from 'react';
import { motion } from 'framer-motion';
import { XCircle } from 'lucide-react';

const SidePanelWrapper = ({ children, onClose, title }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', pointerEvents: 'auto' }}
        />
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="hide-scrollbar"
            style={{
                width: '100%',
                maxWidth: '480px',
                height: '100%',
                background: 'var(--bg-color)',
                borderLeft: '1px solid var(--border-color)',
                boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
                position: 'relative',
                zIndex: 2001,
                overflowY: 'auto',
                pointerEvents: 'auto',
                padding: '24px'
            }}
        >
            <div style={{ paddingBottom: '80px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                        <XCircle size={24} />
                    </button>
                    {title && <h2 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h2>}
                </div>
                {children}
            </div>
        </motion.div>
    </div>
);

export default SidePanelWrapper;
