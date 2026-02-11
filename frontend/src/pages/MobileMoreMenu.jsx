import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, BarChart2, ShoppingBag, Contact, Lightbulb,
    Presentation, Smartphone, Settings, HelpCircle,
    GitBranch, ScanLine, Eye, Calendar, BookOpen, Cpu, ShieldCheck, User, MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileMoreMenu = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [userAddress, setUserAddress] = React.useState('');

    React.useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Simple reverse geocoding or just coordinates for now if no API key
                    // Ideally call backend wrapper, but for now we format nicely
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await res.json();
                    const city = data.address.city || data.address.town || data.address.village;
                    const state = data.address.state || data.address.country;
                    setUserAddress(`${city}, ${state}`);
                } catch (e) {
                    setUserAddress("Unknown Location");
                }
            }, () => {
                setUserAddress("Location Disabled");
            });
        } else {
            setUserAddress("N/A");
        }
    }, []);

    // Actual Project Pages
    const allMenuItems = [
        { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
        { id: 'vision', label: 'Buddy Vision', icon: Eye, path: '/admin/vision' },
        { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, path: '/admin/knowledge' },
        { id: 'automations', label: 'Automations', icon: Cpu, path: '/admin/automations' },
        { id: 'calendar', label: 'Calendar', icon: Calendar, path: '/admin/calendar' },
        { id: 'management', label: 'Management', icon: ShieldCheck, path: '/admin/management' },
        { id: 'roles', label: 'Roles', icon: ShieldCheck, path: '/admin/roles' },
        { id: 'settings', label: 'System Settings', icon: Settings, path: '/admin/settings' },
        { id: 'profile', label: 'My Settings', icon: User, path: '/user/settings' },
    ];

    // Filter items based on user permissions
    const menuItems = allMenuItems.filter(item => {
        if (item.id === 'profile') return true;

        if (user?.role === 'user' && ['settings', 'roles', 'management', 'users'].includes(item.id)) return false;

        return user?.allowedPages?.includes(item.id);
    });

    const handleItemClick = (path) => {
        navigate(path);
    };

    return (
        <div style={{
            padding: '24px 20px',
            background: 'var(--bg-color)',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-family)',
            overflowX: 'hidden'
        }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Avatar Only */}
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, var(--primary-color), #000)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '700',
                        fontSize: '1.2rem',
                        border: '2px solid var(--border-color)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}>
                        {user?.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
                    </div>

                    {/* User Info */}
                    <div>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            color: 'var(--text-main)',
                            lineHeight: '1.2',
                            letterSpacing: '0.01em'
                        }}>
                            {user?.name?.split(' ')[0].toUpperCase() || 'USER'}
                        </div>
                        <div style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-sub)',
                            fontWeight: '600',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <MapPin size={12} />
                            {userAddress || 'Locating...'}
                        </div>
                    </div>
                </div>


            </div>

            {/* Decorative Line */}
            <div style={{
                height: '2px',
                background: 'linear-gradient(to right, var(--primary-color), transparent)',
                marginBottom: '28px',
                marginTop: '-12px',
                opacity: 0.5,
                borderRadius: '2px'
            }}></div>

            {/* Grid Layout - Responsive */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px'
            }}>
                {menuItems.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => handleItemClick(item.path)}
                        style={{
                            background: 'var(--card-bg)',
                            borderRadius: '20px',
                            padding: '20px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '14px',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            aspectRatio: '1/1',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        className="menu-card"
                    >
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-color)',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <item.icon size={26} strokeWidth={2} />
                        </div>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            color: 'var(--text-sub)',
                            textAlign: 'center',
                            lineHeight: '1.2'
                        }}>
                            {item.label}
                        </span>
                    </div>
                ))}
            </div>

            <style>{`
                .hover-glow:active {
                    transform: scale(0.95);
                    background: var(--primary-glow);
                }
                .menu-card:active {
                    transform: scale(0.96);
                    border-color: var(--primary-color);
                    background: color-mix(in srgb, var(--primary-color) 10%, var(--card-bg));
                }
                @media (max-width: 380px) {
                    .menu-card {
                        padding: 16px 8px;
                    }
                }
                /* Ensure 3 columns generally, but maybe 2 on VERY small screens if needed, though 350px+ fits 3 usually */
                @media (max-width: 340px) {
                     div[style*="display: grid"] {
                        grid-template-columns: repeat(2, 1fr) !important;
                     }
                }
            `}</style>
        </div>
    );
};

export default MobileMoreMenu;
