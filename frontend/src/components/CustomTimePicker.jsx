import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

const CustomTimePicker = ({ value, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Initial parse of the value (HH:mm)
    const initialTime = value || "09:00";
    const [hour, setHour] = useState(parseInt(initialTime.split(':')[0]));
    const [minute, setMinute] = useState(parseInt(initialTime.split(':')[1]));

    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleHourChange = (delta) => {
        let newHour = hour + delta;
        if (newHour < 0) newHour = 23;
        if (newHour > 23) newHour = 0;
        setHour(newHour);
        updateValue(newHour, minute);
    };

    const handleMinuteChange = (delta) => {
        let newMin = minute + delta;
        if (newMin < 0) newMin = 59;
        if (newMin > 59) newMin = 0;
        setMinute(newMin);
        updateValue(hour, newMin);
    };

    const toggleAMPM = () => {
        let newHour = hour;
        if (ampm === 'AM') {
            newHour += 12;
            if (newHour >= 24) newHour -= 24;
        } else {
            newHour -= 12;
            if (newHour < 0) newHour += 24;
        }
        setHour(newHour);
        updateValue(newHour, minute);
    };

    const updateValue = (h, m) => {
        const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        onChange(formatted);
    };

    return (
        <div className="custom-time-picker" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
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
                    <Clock size={18} color="var(--primary-color)" />
                    <span style={{ fontWeight: '600' }}>
                        {displayHour.toString().padStart(2, '0')}:{minute.toString().padStart(2, '0')} {ampm}
                    </span>
                </div>
                <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '16px',
                            padding: '20px',
                            zIndex: 100,
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '15px'
                        }}
                    >
                        {/* Hour Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => handleHourChange(1)} style={colButtonStyle}><ChevronUp size={20} /></button>
                            <div style={timeValueStyle}>{displayHour.toString().padStart(2, '0')}</div>
                            <button onClick={() => handleHourChange(-1)} style={colButtonStyle}><ChevronDown size={20} /></button>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: 'bold' }}>HOUR</div>
                        </div>

                        <div style={{ alignSelf: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginTop: '-20px' }}>:</div>

                        {/* Minute Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => handleMinuteChange(5)} style={colButtonStyle}><ChevronUp size={20} /></button>
                            <div style={timeValueStyle}>{minute.toString().padStart(2, '0')}</div>
                            <button onClick={() => handleMinuteChange(-5)} style={colButtonStyle}><ChevronDown size={20} /></button>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: 'bold' }}>MIN</div>
                        </div>

                        {/* AM/PM Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
                            <div
                                onClick={toggleAMPM}
                                style={{
                                    ...timeValueStyle,
                                    fontSize: '1rem',
                                    height: '40px',
                                    width: '50px',
                                    cursor: 'pointer',
                                    background: 'var(--primary-glow)',
                                    color: 'var(--primary-color)',
                                    marginTop: '36px'
                                }}
                            >
                                {ampm}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: 'bold' }}>PERIOD</div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const colButtonStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--text-sub)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const timeValueStyle = {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-main)',
    width: '45px',
    height: '45px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-lite)',
    borderRadius: '8px'
};

export default CustomTimePicker;
