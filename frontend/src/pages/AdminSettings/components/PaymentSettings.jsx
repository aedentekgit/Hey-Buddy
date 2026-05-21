import { useState } from 'react';
import { CreditCard, ShieldCheck, Zap } from 'lucide-react';
import { SectionTitle, InputGroup } from './shared/sharedComponents';

const PaymentSettings = ({ settings, setSettings }) => {
    const [activeGatewayName, setActiveGatewayName] = useState('Stripe');

    // Helper to get index of active gateway
    const activeIndex = settings.paymentGateways.findIndex(g => g.name === activeGatewayName);
    const activeGateway = settings.paymentGateways[activeIndex] || settings.paymentGateways[0];

    const getIcon = (name) => {
        switch (name) {
            case 'Stripe': return ShieldCheck;
            case 'PayPal': return CreditCard;
            case 'Razorpay': return Zap;
            default: return CreditCard;
        }
    };

    const getColor = (name) => {
        switch (name) {
            case 'Stripe': return '#6366f1';
            case 'PayPal': return '#0070ba';
            case 'Razorpay': return '#2b3bca';
            default: return 'var(--primary-color)';
        }
    };

    const ActiveIcon = getIcon(activeGateway.name);

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div className="admin-section-header">
                <SectionTitle label="Payment Gateways" icon={CreditCard} color="var(--primary-color)" />
                <p>Configure secure checkout options for your platform. Enable multiple gateways to provide flexible payment methods to your customers.</p>
            </div>

            <div className="admin-sub-tabs">
                {settings.paymentGateways.map(gateway => {
                    const Icon = getIcon(gateway.name);
                    return (
                        <button
                            key={gateway.name}
                            type="button"
                            onClick={() => setActiveGatewayName(gateway.name)}
                            className={`admin-sub-tab-btn ${activeGatewayName === gateway.name ? 'active' : ''}`}
                        >
                            <Icon size={18} />
                            <span>{gateway.name}</span>
                            {gateway.enabled && (
                                <div style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: activeGatewayName === gateway.name ? 'white' : '#10b981',
                                }} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Gateway Configuration Body */}
            <div style={{ padding: '32px', border: '1px solid var(--border-color)', borderRadius: '24px', background: 'var(--bg-lite)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ActiveIcon size={24} color={getColor(activeGateway.name)} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: '800' }}>
                                {activeGateway.name} Integration
                            </h3>
                            {activeGateway.enabled ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>Active & Ready</span>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: '6px 0 0' }}>Configuration Pending (Disabled)</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const ng = [...settings.paymentGateways];
                            ng[activeIndex].enabled = !ng[activeIndex].enabled;
                            setSettings({ ...settings, paymentGateways: ng });
                        }}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '50px',
                            background: activeGateway.enabled ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            color: activeGateway.enabled ? '#ef4444' : 'var(--primary-color)',
                            border: activeGateway.enabled ? '1.5px solid rgba(239, 68, 68, 0.2)' : '1.5px solid var(--primary-color)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {activeGateway.enabled ? 'Disable Gateway' : 'Enable Gateway'}
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ padding: '16px 20px', background: 'color-mix(in srgb, var(--primary-color) 5%, transparent)', borderLeft: '4px solid var(--primary-color)', borderRadius: '8px' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.6', fontWeight: '500' }}>
                                {activeGateway.name === 'Razorpay' ?
                                    'Scale your business in India with India\'s most reliable payment gateway. Supports UPI, All major cards, Netbanking, and Wallets.' :
                                    activeGateway.name === 'Stripe' ?
                                        'Accept payments globally with Stripe\'s unified API. Supports high-converting checkout experiences, Apple Pay, Google Pay, and localized methods.' :
                                        'Connect with over 400 million active users worldwide. Trusted online payment processing with built-in fraud protection.'}
                            </p>
                        </div>
                    </div>

                    <InputGroup
                        label={activeGateway.name === 'PayPal' ? 'Client ID' : 'Public / API Key'}
                        value={activeGateway.apiKey}
                        onChange={v => {
                            const ng = [...settings.paymentGateways];
                            ng[activeIndex].apiKey = v;
                            setSettings({ ...settings, paymentGateways: ng });
                        }}
                        placeholder={`Enter your ${activeGateway.name} production key`}
                    />
                    <InputGroup
                        label={activeGateway.name === 'PayPal' ? 'Secret Key' : 'Secret / Private Key'}
                        type="password"
                        value={activeGateway.apiSecret}
                        onChange={v => {
                            const ng = [...settings.paymentGateways];
                            ng[activeIndex].apiSecret = v;
                            setSettings({ ...settings, paymentGateways: ng });
                        }}
                        placeholder={`Enter your ${activeGateway.name} secret key`}
                    />
                </div>
            </div>
        </section>
    );
};

export default PaymentSettings;
