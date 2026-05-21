import { ShieldCheck, Globe, Zap } from 'lucide-react';
import { SectionTitle, InputGroup } from './shared/sharedComponents';

const GoogleAuthSettings = ({ settings, setSettings }) => {
    const handleUpdate = (field, value) => {
        const cleanValue = typeof value === 'string' ? value.trim() : value;
        setSettings({
            ...settings,
            googleAuth: {
                ...settings.googleAuth,
                [field]: cleanValue
            }
        });
    };

    const isEnabled = settings.googleAuth.enabled;

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <SectionTitle label="Google Authentication" icon={ShieldCheck} color="var(--primary-color)" />
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '600px' }}>
                        Configure Google OAuth credentials to enable secure, unified sign-in across your Web, Android, and iOS applications.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isEnabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                    padding: '8px 18px',
                    borderRadius: '20px',
                    border: `1px solid ${isEnabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }} onClick={() => handleUpdate('enabled', !isEnabled)}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isEnabled ? 'var(--success-color)' : 'var(--text-sub)'
                    }} />
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        color: isEnabled ? 'var(--success-color)' : 'var(--text-sub)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {isEnabled ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Web Configuration Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex' }}>
                            <Globe size={18} color="var(--primary-color)" />
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Web Configuration</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <InputGroup
                            label="Web Client ID"
                            value={settings.googleAuth.webClientId}
                            onChange={v => handleUpdate('webClientId', v)}
                            placeholder="Enter Google Web Client ID"
                        />
                        <InputGroup
                            label="Web Client Secret"
                            type="password"
                            value={settings.googleAuth.webClientSecret}
                            onChange={v => handleUpdate('webClientSecret', v)}
                            placeholder="Enter Google Web Client Secret"
                        />
                    </div>
                </div>

                {/* Mobile Platforms Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex' }}>
                            <Zap size={18} color="var(--primary-color)" />
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Mobile Platforms</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <InputGroup
                            label="Android Client ID"
                            value={settings.googleAuth.androidClientId}
                            onChange={v => handleUpdate('androidClientId', v)}
                            placeholder="Android Client ID from Console"
                        />
                        <InputGroup
                            label="iOS Client ID"
                            value={settings.googleAuth.iosClientId}
                            onChange={v => handleUpdate('iosClientId', v)}
                            placeholder="iOS Client ID from Console"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default GoogleAuthSettings;
