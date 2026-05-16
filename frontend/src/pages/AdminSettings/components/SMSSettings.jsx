import { useState } from 'react';
import { MessageSquare, Zap, ChevronDown, Send } from 'lucide-react';
import { TestSection, InputGroup, SectionTitle } from './shared/sharedComponents';
import { toast } from 'react-hot-toast';
import api from '../../../services/api';

const SMSSettings = ({ settings, setSettings, testPhone, setTestPhone }) => {
    const [activeTab, setActiveTab] = useState(settings.sms?.activeGateway || 'twilio');
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const mainTabs = [
        { id: 'twilio', label: 'Twilio' },
        { id: 'nexmo', label: 'Vonage / Nexmo' },
        { id: 'clickatell', label: 'Clickatell' }
    ];

    const moreGateways = [
        { id: 'msg91', label: 'Msg91' },
        { id: 'twofactor', label: '2Factor' },
        { id: 'bulksms', label: 'BulkSMS' },
        { id: 'bulksmsbd', label: 'BulkSMS BD' },
        { id: 'telesign', label: 'Telesign' }
    ];

    const gateways = settings.sms?.gateways || {};
    const currentConfig = gateways[activeTab] || {};

    const handleUpdate = (field, value) => {
        const updatedGateways = { ...gateways, [activeTab]: { ...currentConfig, [field]: value } };
        const updatedActive = field === 'enabled' && value === true ? activeTab : settings.sms.activeGateway;
        setSettings({ ...settings, sms: { ...settings.sms, gateways: updatedGateways, activeGateway: updatedActive } });
    };

    const isActiveGateway = settings.sms.activeGateway === activeTab;

    const renderFields = () => {
        const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' };
        switch (activeTab) {
            case 'msg91':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Msg91 Auth Key" value={currentConfig?.authKey || ''} onChange={v => handleUpdate('authKey', v)} />
                        <InputGroup label="Sender ID" value={currentConfig?.senderId || ''} onChange={v => handleUpdate('senderId', v)} />
                        <InputGroup label="Template ID" value={currentConfig?.templateId || ''} onChange={v => handleUpdate('templateId', v)} />
                        <InputGroup label="Variable Name" value={currentConfig?.templateVariable || ''} onChange={v => handleUpdate('templateVariable', v)} placeholder="OTP" />
                    </div>
                );
            case 'twilio':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Account SID" value={currentConfig?.accountSid || ''} onChange={v => handleUpdate('accountSid', v)} />
                        <InputGroup label="Auth Token" type="password" value={currentConfig?.authToken || ''} onChange={v => handleUpdate('authToken', v)} />
                        <InputGroup label="Service Number" value={currentConfig?.fromPhone || ''} onChange={v => handleUpdate('fromPhone', v)} />
                    </div>
                );
            case 'nexmo':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="API Key" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />
                        <InputGroup label="API Secret" type="password" value={currentConfig?.apiSecret || ''} onChange={v => handleUpdate('apiSecret', v)} />
                        <InputGroup label="Sender Label" value={currentConfig?.from || ''} onChange={v => handleUpdate('from', v)} />
                    </div>
                );
            case 'bulksms':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Portal Username" value={currentConfig?.username || ''} onChange={v => handleUpdate('username', v)} />
                        <InputGroup label="Portal Password" type="password" value={currentConfig?.password || ''} onChange={v => handleUpdate('password', v)} />
                    </div>
                );
            case 'bulksmsbd':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="API Access Token" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />
                        <InputGroup label="Approved Sender ID" value={currentConfig?.senderId || ''} onChange={v => handleUpdate('senderId', v)} />
                    </div>
                );
            case 'telesign':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Customer ID" value={currentConfig?.customerId || ''} onChange={v => handleUpdate('customerId', v)} />
                        <InputGroup label="API Access Key" type="password" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />
                    </div>
                );
            default:
                return <InputGroup label="Gateway API Key" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />;
        }
    };

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div className="admin-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                    <SectionTitle label="SMS Gateway Setup" icon={MessageSquare} color="#34D399" />
                    <p>Configure your preferred SMS provider to handle automated notifications and verification codes.</p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isActiveGateway ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: `1px solid ${isActiveGateway ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                    cursor: 'pointer'
                }} onClick={() => handleUpdate('enabled', !isActiveGateway)}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActiveGateway ? 'var(--success-color)' : 'var(--text-sub)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: isActiveGateway ? 'var(--success-color)' : 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isActiveGateway ? 'Active Gateway' : 'Set as Primary'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Gateway Provider</h4>
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                More Providers <ChevronDown size={14} />
                            </button>
                            {dropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '8px',
                                    background: 'var(--card-bg)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                    zIndex: 100,
                                    minWidth: '180px',
                                    overflow: 'hidden'
                                }}>
                                    {moreGateways.map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => { setActiveTab(tab.id); setDropdownOpen(false); }}
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: 'none',
                                                background: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
                                                color: activeTab === tab.id ? 'white' : 'var(--text-main)',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="admin-sub-tabs">
                        {mainTabs.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`admin-sub-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Zap size={18} color="var(--primary-color)" /> API Credentials
                    </h4>
                    {renderFields()}
                </div>

                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Connection Diagnostics</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>Send a test SMS to verify credentials and connectivity.</p>
                    </div>
                    <TestSection
                        value={testPhone}
                        onChange={setTestPhone}
                        placeholder="+1234567890"
                        icon={Send}
                        onTest={async () => {
                            const loadToast = toast.loading('Sending test SMS...');
                            try {
                                await api.post('/settings/test-sms', { gateway: activeTab, config: currentConfig, testPhone });
                                toast.success('Test message sent!', { id: loadToast });
                            } catch (error) { toast.error('SMS test failed', { id: loadToast }); }
                        }}
                        btnColor="var(--primary-color)"
                    />
                </div>
            </div>
        </section>
    );
};

export default SMSSettings;
