import { useState } from 'react';
import { MapPin, Eye, EyeOff } from 'lucide-react';
import { SectionTitle } from './shared/sharedComponents';

const GoogleMapsSettings = ({ settings, setSettings }) => {
    const [showKey, setShowKey] = useState(false);
    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <SectionTitle label="Google Maps Setup" icon={MapPin} color="#34A853" />
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Configure your Google Maps API key to enable location-based reminders and live distance calculations.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>API Key</label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: settings?.googleMaps?.enabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: `1px solid ${settings?.googleMaps?.enabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                            cursor: 'pointer'
                        }} onClick={() => setSettings(prev => ({ ...prev, googleMaps: { ...prev.googleMaps, enabled: !prev.googleMaps?.enabled } }))}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: settings?.googleMaps?.enabled ? 'var(--success-color)' : 'var(--text-sub)' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: settings?.googleMaps?.enabled ? 'var(--success-color)' : 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {settings?.googleMaps?.enabled ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '16px' }}>Provide the API key to activate Google Maps services.</p>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={settings?.googleMaps?.apiKey || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, googleMaps: { ...prev.googleMaps, apiKey: e.target.value } }))}
                            placeholder="AIzaSy..."
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                paddingRight: '40px',
                                background: 'var(--bg-lite)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem',
                                outline: 'none',
                                fontFamily: 'monospace'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-sub)',
                                opacity: 0.7,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px'
                            }}>
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default GoogleMapsSettings;