import { useState } from 'react';
import { Bell, Globe, ShieldCheck, Smartphone, CheckCircle2, FileJson, Upload, Copy, AlertTriangle, Send } from 'lucide-react';
import { SectionTitle, InputGroup } from './shared/sharedComponents';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';
import { requestNotificationPermission } from '../../../services/notificationService';

const NotificationSettings = ({ settings, setSettings }) => {
    const [subTab, setSubTab] = useState('web');

    const tabs = [
        { id: 'web', label: 'Project Credentials', icon: Globe },
        { id: 'backend', label: 'Cloud Messaging (FCM)', icon: ShieldCheck },
        { id: 'mobile', label: 'Mobile Reference', icon: Smartphone }
    ];

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div className="admin-section-header">
                <SectionTitle label="Notification Setup" icon={Bell} color="#FF6F00" />
                <p>
                    Configure Firebase Cloud Messaging (FCM) to deliver real-time push notifications across web and mobile platforms.
                </p>
            </div>

            <div className="admin-sub-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSubTab(tab.id)}
                        className={`admin-sub-tab-btn ${subTab === tab.id ? 'active' : ''}`}
                    >
                        {tab.icon && <tab.icon size={16} />}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {subTab === 'web' && (
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px' }}>Firebase Client SDK Configuration</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <InputGroup
                                    label="Public Vapid Key (Web Push)"
                                    value={settings.notification.firebasePublicVapidKey}
                                    onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebasePublicVapidKey: v } })}
                                    placeholder="Enter Vapid Key Pair"
                                />
                            </div>
                            <InputGroup label="API Key" type="password" value={settings.notification.firebaseApiKey} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseApiKey: v } })} />
                            <InputGroup label="Auth Domain" value={settings.notification.firebaseAuthDomain} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseAuthDomain: v } })} />
                            <InputGroup label="Project ID" value={settings.notification.firebaseProjectId} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseProjectId: v } })} />
                            <InputGroup label="Storage Bucket" value={settings.notification.firebaseStorageBucket} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseStorageBucket: v } })} />
                            <InputGroup label="Message Sender ID" value={settings.notification.firebaseMessageSenderId} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseMessageSenderId: v } })} />
                            <InputGroup label="App ID" value={settings.notification.firebaseAppId} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseAppId: v } })} />
                        </div>
                    </div>
                )}

                {subTab === 'backend' && (
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Service Account Authorization</h4>
                            {settings.notification.serviceAccountJson && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'color-mix(in srgb, var(--success-color) 15%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--success-color) 30%, transparent)' }}>
                                    <CheckCircle2 size={14} color="var(--success-color)" />
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--success-color)', textTransform: 'uppercase' }}>Key Uploaded</span>
                                </div>
                            )}
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '24px', lineHeight: '1.6' }}>
                            Upload your <code>service-account.json</code> to allow the backend server to securely dispatch push notifications.
                        </p>

                        <div style={{
                            padding: '30px',
                            background: 'var(--card-bg)',
                            borderRadius: '20px',
                            border: '2px dashed var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '16px'
                        }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-lite)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileJson size={28} color="var(--primary-color)" />
                            </div>
                            <div>
                                <h5 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{settings.notification.serviceAccountJson ? 'JSON Key is Active' : 'Upload Service Account Key'}</h5>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)', margin: 0 }}>{settings.notification.serviceAccountJson ? 'Your server is authorized to send FBM notifications.' : 'Required for server-side push messaging.'}</p>
                            </div>
                            <label style={{
                                padding: '10px 24px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <Upload size={16} />
                                {settings.notification.serviceAccountJson ? 'Replace JSON File' : 'Select JSON File'}
                                <input
                                    type="file"
                                    hidden
                                    accept=".json"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const formData = new FormData();
                                        formData.append('serviceAccountJson', file);
                                        const loadToast = toast.loading('Uploading JSON...');
                                        try {
                                            const res = await api.put('/settings', formData, {
                                                headers: { 'Content-Type': 'multipart/form-data' }
                                            });
                                            if (res.data.success) {
                                                setSettings(prev => ({ ...prev, notification: { ...prev.notification, ...res.data.data.notification } }));
                                                toast.success('Service Account JSON uploaded', { id: loadToast });
                                            }
                                        } catch (error) { toast.error('Upload failed', { id: loadToast }); }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}

                {subTab === 'mobile' && (
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Smartphone size={18} color="var(--primary-color)" /> Platform Identifiers
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <InputGroup label="Android Package Name" value={settings.notification.androidPackageName || ''} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, androidPackageName: v } })} placeholder="com.company.app" />
                            <InputGroup label="iOS Bundle ID" value={settings.notification.iosBundleId || ''} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, iosBundleId: v } })} placeholder="com.company.app" />
                        </div>
                    </div>
                )}

                {/* Testing Section */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Connectivity Diagnostics</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>Perform a loopback test to ensure your FCM credentials and network connection are valid.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={async () => {
                                    const loadToast = toast.loading('Generating token...');
                                    const token = await requestNotificationPermission();
                                    if (token) {
                                        navigator.clipboard.writeText(token);
                                        toast.success('Token copied! Use it in the test below.', { id: loadToast });
                                    } else {
                                        toast.error('Permission denied.', { id: loadToast });
                                    }
                                }}
                                style={{
                                    padding: '10px 18px',
                                    borderRadius: '12px',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Copy size={16} /> Get My Token
                            </button>
                            {subTab !== 'backend' && !settings.notification.serviceAccountJson && (
                                <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255, 171, 0, 0.1)', borderRadius: '10px', border: '1px solid rgba(255, 171, 0, 0.2)' }}>
                                    <AlertTriangle size={14} color="#ffab00" />
                                    <span style={{ fontSize: '0.75rem', color: '#ffab00', fontWeight: '700' }}>Missing Service Key</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!settings.notification.serviceAccountJson) {
                                        toast.error('Please upload Service Account JSON in the Cloud Messaging tab first.');
                                        setSubTab('backend');
                                        return;
                                    }
                                    const token = prompt("Enter Firebase Token (or paste your copied token):");
                                    if (!token) return;
                                    const loadToast = toast.loading('Sending test...');
                                    try {
                                        await api.post('/settings/test-notification', { token, title: 'Buddy Test', body: 'Push notifications working! 🚀' });
                                        toast.success('Notification sent!', { id: loadToast });
                                    } catch (error) {
                                        const errMsg = error.response?.data?.message || 'Test failed';
                                        toast.error(errMsg, { id: loadToast });
                                    }
                                }}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '12px',
                                    background: 'var(--primary-color)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Send size={16} /> Test Connection
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default NotificationSettings;
