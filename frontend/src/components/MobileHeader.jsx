import React, { useState, useEffect } from 'react';
import { MapPin, Search, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { config as envConfig } from '../config/env';

const MobileHeader = () => {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [userAddress, setUserAddress] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const branding = settings?.general || {};

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const baseUrl = envConfig.API_URL;
                    const token = localStorage.getItem('token');

                    const res = await fetch(`${baseUrl}/users/reverse-geocode?lat=${latitude}&lon=${longitude}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const result = await res.json();

                    if (result.success) {
                        const data = result.data;
                        const city = data.address.city || data.address.town || data.address.village;
                        const state = data.address.state || data.address.country;
                        setUserAddress(`${city}, ${state}`);
                    }
                } catch (e) {
                    console.error("Geocoding failed:", e);
                    setUserAddress("Unknown Location");
                }
            }, () => {
                setUserAddress("Location Disabled");
            });
        } else {
            setUserAddress("N/A");
        }
    }, []);

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        window.dispatchEvent(new CustomEvent('buddy-search', { detail: val }));
    };

    const getProfileImageUrl = () => {
        if (!user?.profilePicture) return null;
        if (user.profilePicture.startsWith('http')) return user.profilePicture;
        const baseUrl = envConfig.API_URL;
        const rootUrl = baseUrl.replace('/api', '');
        const cleanRoot = rootUrl.endsWith('/') ? rootUrl.slice(0, -1) : rootUrl;
        const cleanPath = user.profilePicture.startsWith('/') ? user.profilePicture : `/${user.profilePicture}`;
        return `${cleanRoot}${cleanPath}`;
    };

    return (
        <div className="mobile-header-global" style={{
            padding: isSearchVisible ? '12px 16px 4px 16px' : '12px 16px 0 16px',
            background: 'var(--header-bg)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-family)',
            transition: 'all 0.3s ease',
            position: 'sticky',
            top: 0,
            zIndex: 1001,
            borderBottom: '1px solid var(--border-color)'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: isSearchVisible ? '10px' : '8px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* App Logo / Avatar */}
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'var(--primary-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        boxShadow: 'var(--card-shadow)',
                        overflow: 'hidden',
                        position: 'relative',
                        border: '2px solid var(--card-bg)'
                    }}>
                        {branding.logo ? (
                            <img
                                src={branding.logo.startsWith('http') ? branding.logo : `${envConfig.BACKEND_URL}${branding.logo}`}
                                alt="Logo"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        ) : getProfileImageUrl() ? (
                            <img
                                src={getProfileImageUrl()}
                                alt="User"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <ShieldCheck size={20} color="#FFFFFF" />
                        )}
                    </div>

                    {/* User Info / App Name */}
                    {!isSearchVisible && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{
                                fontSize: '0.95rem',
                                fontWeight: '800',
                                color: 'var(--text-main)',
                                lineHeight: '1.2',
                                letterSpacing: '-0.3px'
                            }}>
                                {branding.companyName || user?.name?.split(' ')[0] || 'Buddy'}
                            </div>
                            <div style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-sub)',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                opacity: 0.8
                            }}>
                                <MapPin size={10} style={{ color: 'var(--primary-color)' }} />
                                {userAddress || 'Locating...'}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => {
                            const newState = !isSearchVisible;
                            setIsSearchVisible(newState);
                            if (!newState) {
                                setSearchQuery('');
                                window.dispatchEvent(new CustomEvent('buddy-search', { detail: '' }));
                            }
                        }}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isSearchVisible ? 'var(--primary-color)' : 'var(--bg-lite)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isSearchVisible ? 'white' : 'var(--text-main)',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        {isSearchVisible ? <X size={18} /> : <Search size={18} />}
                    </button>
                </div>
            </div>

            {isSearchVisible && (
                <div style={{
                    position: 'relative',
                    marginBottom: '10px',
                    animation: 'headerSearchIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                    <input
                        autoFocus
                        type="text"
                        placeholder="Ask anything..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 36px',
                            borderRadius: '10px',
                            background: 'var(--bg-lite)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            outline: 'none',
                            transition: 'all 0.2s'
                        }}
                    />
                </div>
            )}

            <style>{`
                @keyframes headerSearchIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (min-width: 768px) {
                    .mobile-header-global {
                        display: none;
                    }
                }
                
                .mobile-header-global button:active {
                    transform: scale(0.92);
                }
            `}</style>
        </div>
    );
};

export default MobileHeader;
