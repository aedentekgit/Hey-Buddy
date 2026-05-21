import { useState } from 'react';
import { Calendar, Copy, ExternalLink, ShieldCheck, FileJson, Upload } from 'lucide-react';
import { SectionTitle, InputGroup } from './shared/sharedComponents';
import { toast } from 'react-hot-toast';
import { config as envConfig } from '../../../config/env';

const GoogleCalendarSettings = ({ settings, setSettings, user }) => {
    const [subTab, setSubTab] = useState('accounts');

    const mainTabs = [
        { id: 'accounts', label: 'Manage Accounts' },
        { id: 'config', label: 'App Setup Guide' }
    ];

    const currentConfig = settings.googleCalendar || {};

    const handleUpdate = (field, value) => {
        setSettings(prev => ({
            ...prev,
            googleCalendar: { ...prev.googleCalendar, [field]: value }
        }));
    };

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div className="admin-section-header">
                <SectionTitle label="Google Calendar Setup" icon={Calendar} color="#4285F4" />
                <p>Configure your Google Calendar API credentials to enable synchronization and voice-based calendar management.</p>
            </div>

            <div className="admin-sub-tabs">
                {mainTabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSubTab(tab.id)}
                        className={`admin-sub-tab-btn ${subTab === tab.id ? 'active' : ''}`}
                    >
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
            {subTab === 'accounts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Credentials Card */}
                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>API Credentials</h3>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: currentConfig.enabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    border: `1px solid ${currentConfig.enabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                                    cursor: 'pointer'
                                }} onClick={() => handleUpdate('enabled', !currentConfig.enabled)}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: currentConfig.enabled ? 'var(--success-color)' : 'var(--text-sub)'
                                    }} />
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: '800',
                                        color: currentConfig.enabled ? 'var(--success-color)' : 'var(--text-sub)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {currentConfig.enabled ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <InputGroup
                                    label="Client ID"
                                    value={currentConfig.clientId || ''}
                                    onChange={v => handleUpdate('clientId', v)}
                                    placeholder="Enter Google Client ID"
                                />
                                <InputGroup
                                    label="Client Secret"
                                    type="password"
                                    value={currentConfig.clientSecret || ''}
                                    onChange={v => handleUpdate('clientSecret', v)}
                                    placeholder="Enter Google Client Secret"
                                />
                            </div>
                        </div>

                        {/* Integration Card */}
                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Endpoint Configuration</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '20px' }}>This URI must be added to your Google Cloud Console authorized redirect URIs.</p>

                            <InputGroup
                                label="Redirect URI"
                                value={currentConfig.redirectUri || `${envConfig.API_URL}/voice/google/callback`}
                                onChange={v => handleUpdate('redirectUri', v)}
                            />
                            <div style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: 'var(--card-bg)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <code style={{ fontSize: '0.75rem', color: 'var(--primary-color)', flex: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                    {envConfig.API_URL}/voice/google/callback
                                </code>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${envConfig.API_URL}/voice/google/callback`);
                                        toast.success('URI Copied!');
                                    }}
                                    style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', display: 'flex' }}
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Testing Tools Card */}
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px' }}>Testing & Verification</h3>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${currentConfig.clientId}&redirect_uri=${encodeURIComponent(currentConfig.redirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent`;
                                    window.open(url, '_blank');
                                    toast('Redirecting to Verification...', { icon: '🔍' });
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <ExternalLink size={16} />
                                Verify Connection
                            </button>
                            <button
                                type="button"
                                onClick={() => window.open('https://console.cloud.google.com/apis/dashboard', '_blank')}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <ShieldCheck size={16} color="#4285F4" />
                                Google Cloud Console
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'config' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: '800', marginBottom: '1.5rem' }}>Step-by-Step Setup Guide</h3>
                        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px' }}>
                            <ol style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginLeft: '1.25rem', lineHeight: '1.8' }}>
                                <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#4285F4', fontWeight: '600' }}>Google Cloud Console</a>.</li>
                                <li>Create a new project or select an existing one.</li>
                                <li>Enable **Google Calendar API** in Library.</li>
                                <li>Go to **Credentials** and create **OAuth client ID**.</li>
                                <li>Select **Web application** type.</li>
                                <li>Add the Redirect URI from the Accounts tab.</li>
                                <li>Download the **JSON credentials** or copy the **ID** and **Secret**.</li>
                            </ol>
                        </div>
                    </div>

                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileJson size={18} color="#4285F4" />
                                Quick Import
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                Upload <code>client_secret_xxxx.json</code> to automatically fill credentials.
                            </p>
                        </div>
                        <label style={{
                            padding: '12px 24px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.2s ease'
                        }}>
                            <Upload size={18} />
                            Upload JSON File
                            <input
                                type="file"
                                hidden
                                accept=".json"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const json = JSON.parse(event.target.result);
                                            const client = json.web || json.installed;
                                            if (client) {
                                                handleUpdate('clientId', client.client_id);
                                                handleUpdate('clientSecret', client.client_secret);
                                                toast.success('Credentials imported successfully!');
                                            } else {
                                                toast.error('JSON format not recognized');
                                            }
                                        } catch (err) {
                                            toast.error('Invalid JSON file');
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                            />
                        </label>
                    </div>
                </div>
            )}
        </section>
    );
};

export default GoogleCalendarSettings;
