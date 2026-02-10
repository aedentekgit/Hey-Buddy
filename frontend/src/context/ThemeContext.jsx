import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') || 'night'); // Default to night for Vision UI
    const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || '#0075ff');

    const colors = {
        primary: accentColor,
        day: {
            bg: '#F8F9FA', // Cleaner, brighter background
            card: '#ffffff', // Pure white cards for clarity
            text: '#1B2559', // Premuim Deep Navy instead of flat grey
            subText: '#8F9BBA', // Modern cool-grey
            border: '#E2E8F0', // Defined borders
            header: 'rgba(255, 255, 255, 0.85)', // Glassy but clear header
            bgImage: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', // Subtle premium gradient
            globeOpacity: '0.1',
            shadow: '0 20px 27px 0 rgba(0, 0, 0, 0.05)' // Soft, premium Vision UI shadow
        },
        night: {
            bg: '#060B28',
            card: 'rgba(6, 11, 40, 0.85)',
            text: '#FFFFFF',
            subText: '#A0AEC0',
            border: 'rgba(255, 255, 255, 0.1)',
            header: 'rgba(6, 11, 40, 0.8)',
            bgImage: 'radial-gradient(at 0% 0%, rgba(0, 117, 255, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.1) 0px, transparent 50%)',
            globeOpacity: '0.4',
            shadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
        }
    };

    const applyTheme = () => {
        const root = document.documentElement;
        let mode = themeMode;

        if (themeMode === 'auto') {
            mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
        }

        const currentTheme = colors[mode];

        // Helper to convert hex to rgb for rgba() usage
        const hexToRgb = (hex) => {
            const bigint = parseInt(hex.replace('#', ''), 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            return `${r}, ${g}, ${b}`;
        };

        root.style.setProperty('--primary-color', accentColor);
        root.style.setProperty('--primary-rgb', hexToRgb(accentColor));
        root.style.setProperty('--bg-color', currentTheme.bg);
        root.style.setProperty('--card-bg', currentTheme.card);
        root.style.setProperty('--text-main', currentTheme.text);
        root.style.setProperty('--text-sub', currentTheme.subText);
        root.style.setProperty('--border-color', currentTheme.border);
        root.style.setProperty('--header-bg', currentTheme.header);
        root.style.setProperty('--bg-image', currentTheme.bgImage);
        root.style.setProperty('--globe-opacity', currentTheme.globeOpacity);
        root.style.setProperty('--card-shadow', currentTheme.shadow);
        root.style.setProperty('--bg-lite', mode === 'night' ? '#0a0f2d' : '#FFFFFF');

        // Dynamic Table Header Styles - Professional Polish
        root.style.setProperty('--th-bg', mode === 'night' ? 'transparent' : 'color-mix(in srgb, var(--primary-color) 6%, #F8F9FA)');
        root.style.setProperty('--th-text', mode === 'night' ? '#A0AEC0' : '#8F9BBA'); // Muted Cool Grey for professional labels
        root.style.setProperty('--th-border', mode === 'night' ? '2px solid var(--border-color)' : 'none'); // Floating capsule look for Day mode
    };

    useEffect(() => {
        applyTheme();
        localStorage.setItem('themeMode', themeMode);
        localStorage.setItem('accentColor', accentColor);
    }, [themeMode, accentColor]);

    // Fetch and apply system settings (Font & Appearance) globally
    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const res = await api.get('/settings');
                if (res.data?.data) {
                    const { general, appearance } = res.data.data;

                    // Apply Font
                    if (general?.fontFamily) {
                        document.documentElement.style.setProperty('--font-family', general.fontFamily);
                    }

                    // Apply Appearance if exists in DB
                    if (appearance) {
                        if (appearance.themeMode) setThemeMode(appearance.themeMode);
                        if (appearance.accentColor) setAccentColor(appearance.accentColor);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch system settings:', error);
            }
        };
        fetchSystemSettings();
    }, []);

    // Handle system theme changes if 'auto' is selected
    useEffect(() => {
        if (themeMode === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme();
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [themeMode]);

    return (
        <ThemeContext.Provider value={{
            themeMode, setThemeMode,
            accentColor, setAccentColor,
            colors
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
