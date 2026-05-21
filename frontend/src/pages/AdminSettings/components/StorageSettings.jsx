import { useState } from 'react';
import { Database, HardDrive, Cloud, Globe, ShieldCheck } from 'lucide-react';
import { SectionTitle, InputGroup, LabelStyle } from './shared/sharedComponents';

const StorageSettings = ({ settings, setSettings }) => {
    const [subTab, setSubTab] = useState('local');

    const tabs = [
        { id: 'local', label: 'Local (VPS)', icon: HardDrive },
        { id: 'cloudinary', label: 'Cloudinary', icon: Cloud },
        { id: 'gcs', label: 'Google Cloud', icon: Globe }
    ];

    const isActive = (provider) => settings.storage.activeProvider === provider;

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div className="admin-section-header">
                <SectionTitle label="Storage Configuration" icon={Database} color="var(--primary-color)" />
                <p>Select your preferred file storage provider. Active provider handles all user uploads and system assets.</p>
            </div>

            <div className="admin-sub-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSubTab(tab.id)}
                        className={`admin-sub-tab-btn ${subTab === tab.id ? 'active' : ''}`}
                    >
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                        {isActive(tab.id) && (
                            <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: subTab === tab.id ? 'white' : '#10b981',
                            }} />
                        )}
                    </button>
                ))}
            </div>

            {/* Config Content */}
            <div style={{ padding: '32px', border: '1px solid var(--border-color)', borderRadius: '24px', background: 'var(--bg-lite)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: '800' }}>
                            {tabs.find(t => t.id === subTab)?.label} Settings
                        </h3>
                        {isActive(subTab) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>Active Provider</span>
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: '6px 0 0' }}>Method Configured (Inactive)</p>
                        )}
                    </div>

                    {!isActive(subTab) && (
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, storage: { ...settings.storage, activeProvider: subTab } })}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '50px',
                                background: 'transparent',
                                border: '1.5px solid var(--primary-color)',
                                color: 'var(--primary-color)',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--primary-color)';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--primary-color)';
                            }}
                        >
                            Activate Provider
                        </button>
                    )}
                    {isActive(subTab) && (
                        <div style={{
                            padding: '8px 20px',
                            borderRadius: '50px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <ShieldCheck size={16} /> Primary
                        </div>
                    )}
                </div>

                {subTab === 'local' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: 0 }}>
                            Stored on the local file system of your VPS. Ideal for high performance and low latency.
                        </p>
                        <InputGroup
                            label="Local Storage Directory"
                            value={settings.storage.local.uploadPath}
                            onChange={v => setSettings({ ...settings, storage: { ...settings.storage, local: { ...settings.storage.local, uploadPath: v } } })}
                            placeholder="e.g., uploads/"
                            icon={HardDrive}
                        />
                    </div>
                )}

                {subTab === 'cloudinary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: 0 }}>
                            Professional media management and CDN delivery.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            <InputGroup
                                label="Cloud Name"
                                value={settings.storage.cloudinary.cloudName}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, cloudinary: { ...settings.storage.cloudinary, cloudName: v } } })}
                            />
                            <InputGroup
                                label="API Key"
                                value={settings.storage.cloudinary.apiKey}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, cloudinary: { ...settings.storage.cloudinary, apiKey: v } } })}
                            />
                            <InputGroup
                                label="API Secret"
                                type="password"
                                value={settings.storage.cloudinary.apiSecret}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, cloudinary: { ...settings.storage.cloudinary, apiSecret: v } } })}
                            />
                        </div>
                    </div>
                )}

                {subTab === 'gcs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: 0 }}>
                            Enterprise-grade object storage with global scalability.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            <InputGroup
                                label="Bucket Name"
                                value={settings.storage.gcs.bucketName}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, gcs: { ...settings.storage.gcs, bucketName: v } } })}
                            />
                            <InputGroup
                                label="Project ID"
                                value={settings.storage.gcs.projectId}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, gcs: { ...settings.storage.gcs, projectId: v } } })}
                            />
                        </div>

                        <div style={{ marginTop: '1rem', padding: '24px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px dotted var(--border-color)' }}>
                            <label style={{ ...LabelStyle, marginBottom: '12px', display: 'block' }}>Service Account Key (.json)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    {settings.storage.gcs.serviceAccountKey ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', fontWeight: '750' }}>
                                            <ShieldCheck size={20} /> Key Uploaded Successfully
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>No key file uploaded. Required for GCS access.</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('gcs-key-upload').click()}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: '800',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {settings.storage.gcs.serviceAccountKey ? 'Update Key' : 'Upload Key'}
                                </button>
                                <input
                                    id="gcs-key-upload"
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                try {
                                                    const json = JSON.parse(event.target.result);
                                                    setSettings({ ...settings, storage: { ...settings.storage, gcs: { ...settings.storage.gcs, serviceAccountKey: json } } });
                                                } catch (err) {
                                                    alert('Invalid JSON file');
                                                }
                                            };
                                            reader.readAsText(file);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

            </div >
        </section >
    );
};

export default StorageSettings;
