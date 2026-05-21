import { useRef } from 'react';
import { Image, Upload, Trash2, Smartphone, Palette, ShieldCheck, RefreshCw, Mail } from 'lucide-react';
import { SectionTitle, InputGroup, LabelStyle } from './shared/sharedComponents';
import CustomSelect from '../../../components/CustomSelect';
import { getImageUrl } from '../../../utils/imageUrl';

const MobileAppSettings = ({ settings, setSettings, handleAssetUpload, handleRemoveAsset }) => {
    const mobileLogoInputRef = useRef(null);
    const splashIconInputRef = useRef(null);

    const handleUpdate = (field, value) => {
        setSettings({
            ...settings,
            mobileApp: { ...settings.mobileApp, [field]: value }
        });
    };

    const AssetUploadBox = ({ label, value, onRemove, inputRef, fieldForUpload, hint }) => (
        <div style={{ flex: 1, minWidth: '240px' }}>
            <label style={{ ...LabelStyle, marginBottom: '12px' }}>{label}</label>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '16px',
                background: 'var(--card-bg)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                transition: 'all 0.3s ease'
            }}>
                <div
                    onClick={() => inputRef.current?.click()}
                    style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '14px',
                        background: 'var(--bg-lite)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s',
                        flexShrink: 0
                    }}>
                    {value ? (
                        <img
                            src={getImageUrl(value)}
                            alt={label}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <Image color="var(--text-sub)" size={20} style={{ opacity: 0.5 }} />
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-sub)', fontWeight: '800' }}>SVG/PNG/GIF</span>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Upload size={14} />
                            Upload
                        </button>
                        {value && (
                            <button
                                type="button"
                                onClick={onRemove}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    background: 'transparent',
                                    color: 'var(--danger-color)',
                                    border: '1px solid var(--danger-color)',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    {hint && <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: '500' }}>{hint}</span>}
                    <input
                        ref={inputRef}
                        type="file"
                        hidden
                        onChange={(e) => handleAssetUpload(e, fieldForUpload)}
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <SectionTitle label="Mobile App Branding" icon={Smartphone} color="var(--primary-color)" />
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Customize the appearance and identity of your mobile application for Android and iOS platforms.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Branding & Visuals Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Palette size={18} color="var(--primary-color)" /> Visual Identity
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                        <AssetUploadBox
                            label="App Icon"
                            value={settings.mobileApp.appLogo}
                            onRemove={() => handleRemoveAsset('appLogo')}
                            inputRef={mobileLogoInputRef}
                            fieldForUpload="mobileLogo"
                            hint="Recommended: 1024x1024 px PNG/SVG/GIF"
                        />
                        <AssetUploadBox
                            label="Splash Screen Icon"
                            value={settings.mobileApp.splashIcon}
                            onRemove={() => handleRemoveAsset('splashIcon')}
                            inputRef={splashIconInputRef}
                            fieldForUpload="splashIcon"
                            hint="Recommended: 512x512 px Optimized"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ ...LabelStyle, marginBottom: '8px' }}>Theme Primary Color</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--card-bg)', padding: '10px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                                <div
                                    onClick={() => document.getElementById('mobilePrimaryColorPicker').click()}
                                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: settings.mobileApp.primaryColor || '#0075ff', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                />
                                <input
                                    type="text"
                                    value={settings.mobileApp.primaryColor?.toUpperCase()}
                                    onChange={(e) => handleUpdate('primaryColor', e.target.value)}
                                    style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700', fontFamily: 'monospace', flex: 1, border: 'none', background: 'transparent', outline: 'none' }}
                                />
                                <input id="mobilePrimaryColorPicker" type="color" value={settings.mobileApp.primaryColor || '#0075ff'} onChange={e => handleUpdate('primaryColor', e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ ...LabelStyle, marginBottom: '8px' }}>Theme Secondary Color</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--card-bg)', padding: '10px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                                <div
                                    onClick={() => document.getElementById('mobileSecondaryColorPicker').click()}
                                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: settings.mobileApp.secondaryColor || '#ffffff', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                />
                                <input
                                    type="text"
                                    value={settings.mobileApp.secondaryColor?.toUpperCase()}
                                    onChange={(e) => handleUpdate('secondaryColor', e.target.value)}
                                    style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700', fontFamily: 'monospace', flex: 1, border: 'none', background: 'transparent', outline: 'none' }}
                                />
                                <input id="mobileSecondaryColorPicker" type="color" value={settings.mobileApp.secondaryColor || '#ffffff'} onChange={e => handleUpdate('secondaryColor', e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* Basic Info & Versioning */}
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Smartphone size={18} color="var(--primary-color)" /> General Information
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <InputGroup
                                label="App Name"
                                value={settings.mobileApp.appName}
                                onChange={v => handleUpdate('appName', v)}
                                placeholder="e.g. Buddy AI"
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <InputGroup
                                    label="Build Version"
                                    value={settings.mobileApp.appVersion}
                                    onChange={v => handleUpdate('appVersion', v)}
                                    placeholder="1.0.0"
                                />
                                <InputGroup
                                    label="Latest Release"
                                    value={settings.mobileApp.latestAppVersion}
                                    onChange={v => handleUpdate('latestAppVersion', v)}
                                    placeholder="1.0.1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Platform Identification */}
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ShieldCheck size={18} color="var(--primary-color)" /> Platform IDs
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <InputGroup
                                label="Android Package Name"
                                value={settings.mobileApp.androidPackageName}
                                onChange={v => handleUpdate('androidPackageName', v)}
                                placeholder="com.company.app"
                            />
                            <InputGroup
                                label="iOS Bundle Identifier"
                                value={settings.mobileApp.iosBundleId}
                                onChange={v => handleUpdate('iosBundleId', v)}
                                placeholder="com.company.app"
                            />
                        </div>
                    </div>
                </div>

                {/* Updates & Distribution Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <RefreshCw size={18} color="var(--primary-color)" /> Distribution & Updates
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        <InputGroup
                            label="APK Download / Update URL"
                            value={settings.mobileApp.updateUrl}
                            onChange={v => handleUpdate('updateUrl', v)}
                            placeholder="https://example.com/builds/app.apk"
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ ...LabelStyle, marginBottom: 0 }}>Update Enforcement</label>
                            <CustomSelect
                                value={settings.mobileApp.mandatoryUpdate ? 'true' : 'false'}
                                onChange={e => handleUpdate('mandatoryUpdate', e.target.value === 'true')}
                                options={[
                                    { value: 'false', label: 'Optional Update (User Choice)' },
                                    { value: 'true', label: 'Mandatory Update (Blocking)' }
                                ]}
                            />
                        </div>
                    </div>
                </div>
                {/* Support Information Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Mail size={18} color="var(--primary-color)" /> Support Information
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        <InputGroup
                            label="Mobile Support Email"
                            value={settings.mobileApp.supportEmail}
                            onChange={v => handleUpdate('supportEmail', v)}
                            placeholder="app-support@company.com"
                            icon={Mail}
                        />
                        <InputGroup
                            label="Mobile Support Phone"
                            value={settings.mobileApp.supportPhone}
                            onChange={v => handleUpdate('supportPhone', v)}
                            placeholder="+1 234 567 890"
                            icon={Smartphone}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default MobileAppSettings;
