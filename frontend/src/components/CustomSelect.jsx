import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CustomSelect = ({ value, onChange, options, placeholder = 'Select...', style = {}, disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [disabled]);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        if (disabled) return;
        // Create a synthetic event object to match the native select onChange signature (optional but helpful for easy swapping)
        const syntheticEvent = {
            target: { value: optionValue }
        };
        onChange(syntheticEvent);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                opacity: disabled ? 0.7 : 1,
                pointerEvents: disabled ? 'none' : 'auto',
                ...style
            }}
        >
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    border: '1.5px solid',
                    borderColor: isOpen ? 'var(--primary-color)' : 'var(--border-color)',
                    background: 'var(--bg-color)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                }}
            >
                <span style={{ color: selectedOption ? 'var(--text-main)' : 'var(--text-sub)' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown
                    size={16}
                    style={{
                        color: 'var(--text-sub)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                    }}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 5 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            width: '100%',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            zIndex: 50,
                            maxHeight: '250px',
                            overflowY: 'auto'
                        }}
                    >
                        {options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                style={{
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    color: value === option.value ? 'var(--primary-color)' : 'var(--text-main)',
                                    background: value === option.value ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'transparent',
                                    fontWeight: value === option.value ? '600' : '400',
                                    fontSize: '0.9rem',
                                    borderBottom: '1px solid var(--border-color)'
                                }}
                                onMouseEnter={(e) => {
                                    if (value !== option.value) e.currentTarget.style.background = 'var(--bg-color)';
                                }}
                                onMouseLeave={(e) => {
                                    if (value !== option.value) e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {option.label}
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomSelect;
