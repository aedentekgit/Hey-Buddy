import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const LabelStyle = {
    display: 'block',
    color: 'var(--text-sub)',
    fontSize: '0.8rem',
    fontWeight: '700',
    marginBottom: '0.6rem',
    letterSpacing: '0.02em',
};

export const InputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-lite)',
    color: 'var(--text-main)',
    fontSize: '0.85rem',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.1s ease',
    fontFamily: 'inherit'
};

export const AddButtonStyle = {
    padding: '8px',
    background: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-sub)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.1s',
    fontSize: '0.8rem'
};

export const SectionTitle = ({ label, icon: Icon, color }) => (
    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }} className="section-title-container">
        <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--bg-lite)',
            border: '1px solid var(--border-color)',
            color: color || 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            flexShrink: 0
        }}>
            <Icon size={20} />
        </div>
        <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em', lineBreak: 'anywhere' }}>{label}</h3>
        </div>
    </div>
);

export const InputGroup = ({ label, value, onChange, type = 'text', placeholder = '', required = false }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <label style={LabelStyle}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
            {type === 'textarea' ? (
                <textarea
                    style={{ ...InputStyle, minHeight: '80px', fontFamily: 'inherit' }}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    autoComplete="off"
                />
            ) : (
                <div style={{ position: 'relative' }}>
                    <input
                        type={inputType}
                        style={{ ...InputStyle, paddingRight: isPassword ? '40px' : '0.875rem' }}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={placeholder}
                        required={required}
                        autoComplete="new-password"
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-sub)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px'
                            }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export const TestSection = ({ title, description, value, onChange, placeholder, onTest, icon: Icon, btnColor }) => (
    <section style={{ height: 'fit-content', background: 'var(--bg-color)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
        <h4 style={{ margin: '0 0 0.4rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{title}</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-sub)' }}>{description}</p>
        <div style={{ marginBottom: '0.75rem' }}>
            <input style={{ ...InputStyle, background: 'var(--card-bg)' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        </div>
        <button type="button" onClick={onTest} style={{ ...AddButtonStyle, width: '100%', background: btnColor, color: 'white', border: 'none', padding: '0.5rem' }}>
            <Icon size={14} /> Test Now
        </button>
    </section>
);