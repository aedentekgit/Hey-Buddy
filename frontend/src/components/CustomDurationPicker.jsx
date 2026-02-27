import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, ChevronUp, ChevronDown } from 'lucide-react';

const CustomDurationPicker = ({ value, onChange, label, min = 0, max = 120, step = 5 }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (delta) => {
        let newValue = value + delta;
        if (newValue < min) newValue = max;
        if (newValue > max) newValue = min;
        onChange(newValue);
    };

    return (
        <div className="custom-duration-picker" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {label && <label className="form-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600' }}>{label}</label>}

            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-lite)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    color: 'var(--text-main)',
                    fontSize: '1rem'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Timer size={18} color="var(--primary-color)" />
                    <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                        {value} minutes
                    </span>
                </div>
                <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            padding: '24px',
                            zIndex: 100,
                            boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(15px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '15px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                            <button onClick={() => handleChange(-step)} style={colButtonStyle}><ChevronDown size={28} /></button>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--primary-color)', letterSpacing: '-0.05em' }}>
                                    {value}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                    MINUTES
                                </div>
                            </div>

                            <button onClick={() => handleChange(step)} style={colButtonStyle}><ChevronUp size={28} /></button>
                        </div>

                        <div style={{ width: '100%', height: '1px', background: 'var(--border-color)', margin: '10px 0' }} />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', width: '100%' }}>
                            {[0, 5, 10, 15, 30, 45, 60, 90].map(val => (
                                <div
                                    key={val}
                                    onClick={() => { onChange(val); setIsOpen(false); }}
                                    style={{
                                        padding: '8px',
                                        textAlign: 'center',
                                        borderRadius: '8px',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        background: value === val ? 'var(--primary-color)' : 'var(--bg-lite)',
                                        color: value === val ? 'white' : 'var(--text-sub)',
                                        transition: '0.2s'
                                    }}
                                >
                                    {val}m
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const colButtonStyle = {
    background: 'var(--bg-lite)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    cursor: 'pointer',
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: '0.2s'
};

export default CustomDurationPicker;
