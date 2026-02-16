import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const ThemeContext = createContext();

const dayTheme = {
    bg: '#F1F5F9', // Slightly deeper grey for better card depth
    card: '#FFFFFF',
    text: '#0F172A', // Deep navy for sharper text
    subText: '#64748B', // Muted slate for subtext
    border: '#CBD5E1', // Defined borders
    header: 'rgba(255, 255, 255, 0.8)',
    sidebar: '#FFFFFF',
    sidebarText: '#475569',
    sidebarActive: '#2563EB',
    toastBg: '#1E293B',
    toastText: '#FFFFFF',
    shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    bgImage: 'radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.08) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(94, 234, 212, 0.05) 0px, transparent 50%)'
};

const nightTheme = {
    bg: '#020617', // Deeper, more premium navy black
    card: '#0F172A',
    text: '#F8FAFC',
    subText: '#94A3B8',
    border: 'rgba(255, 255, 255, 0.08)',
    header: 'rgba(2, 6, 23, 0.8)',
    sidebar: '#0F172A',
    sidebarText: '#94A3B8',
    sidebarActive: '#3B82F6',
    toastBg: '#F8FAFC',
    toastText: '#020617',
    shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
    bgImage: 'radial-gradient(at 0% 0%, rgba(0, 117, 255, 0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.05) 0px, transparent 50%)'
};

export const ThemeProvider = ({ children }) => {
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'auto');
    const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || '#2563EB');

    const hexToRgb = (hex) => {
        const bigint = parseInt(hex.replace('#', ''), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `${r}, ${g}, ${b}`;
    };

    const applyTheme = (mode, color) => {
        const root = document.documentElement;
        const currentTheme = mode === 'night' ? nightTheme : dayTheme;

        root.style.setProperty('--primary-color', color);
        root.style.setProperty('--primary-rgb', hexToRgb(color));
        root.style.setProperty('--bg-color', currentTheme.bg);
        root.style.setProperty('--bg-rgb', mode === 'night' ? '15, 23, 42' : '248, 250, 252');
        root.style.setProperty('--card-bg', currentTheme.card);
        root.style.setProperty('--text-main', currentTheme.text);
        root.style.setProperty('--text-sub', currentTheme.subText);
        root.style.setProperty('--border-color', currentTheme.border);
        root.style.setProperty('--border-hover', mode === 'night' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)');
        root.style.setProperty('--header-bg', currentTheme.header);
        root.style.setProperty('--sidebar-bg', currentTheme.sidebar);
        root.style.setProperty('--sidebar-text', currentTheme.sidebarText);
        root.style.setProperty('--sidebar-active', color);
        root.style.setProperty('--toast-bg', currentTheme.toastBg);
        root.style.setProperty('--toast-text', currentTheme.toastText);
        root.style.setProperty('--card-shadow', currentTheme.shadow);
        root.style.setProperty('--bg-image', currentTheme.bgImage);
        root.style.setProperty('--bg-lite', mode === 'night' ? 'rgba(255, 255, 255, 0.03)' : '#F1F5F9');
        root.style.setProperty('--bg-secondary', mode === 'night' ? '#1E293B' : '#E2E8F0');
        root.style.setProperty('--bg-tertiary', mode === 'night' ? '#334155' : '#CBD5E1');
        root.style.setProperty('--glass-bg', mode === 'night' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)');

        // Refined High-End Gradients
        root.style.setProperty('--primary-gradient', `linear-gradient(135deg, var(--primary-color) 0%, color-mix(in srgb, var(--primary-color), ${mode === 'night' ? '#FFF 15%' : '#000 15%'}) 100%)`);
        root.style.setProperty('--button-gradient', 'linear-gradient(135deg, var(--primary-color) 0%, color-mix(in srgb, var(--primary-color), #000 20%) 100%)');

        // Semantic Colors - Enterprise Palette
        root.style.setProperty('--success-color', '#10B981');
        root.style.setProperty('--warning-color', '#F59E0B');
        root.style.setProperty('--danger-color', '#EF4444');
        root.style.setProperty('--secondary-color', '#6366F1');

        // Precision Layout - Industrial Grade
        root.style.setProperty('--radius-sm', '6px');
        root.style.setProperty('--radius-md', '8px');
        root.style.setProperty('--radius-lg', '12px');

        // Professional Tabular Styles - Dynamic with Theme
        root.style.setProperty('--th-bg', 'var(--primary-color)');
        root.style.setProperty('--th-text', '#FFFFFF');
        root.style.setProperty('--td-border', mode === 'night' ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0');
        root.style.setProperty('--row-hover', mode === 'night' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(var(--primary-rgb), 0.02)');
    };

    useEffect(() => {
        let mode = themeMode;
        if (themeMode === 'auto') {
            mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
        }
        applyTheme(mode, accentColor);
        localStorage.setItem('themeMode', themeMode);
        localStorage.setItem('accentColor', accentColor);
    }, [themeMode, accentColor]);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const res = await api.get('/settings/public');
                if (res.data?.data) {
                    const { general, appearance } = res.data.data;
                    if (general?.fontFamily) {
                        document.documentElement.style.setProperty('--font-family', general.fontFamily);
                    }
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

    useEffect(() => {
        if (themeMode === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => {
                const mode = mediaQuery.matches ? 'night' : 'day';
                applyTheme(mode, accentColor);
            };
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [themeMode, accentColor]);

    return (
        <ThemeContext.Provider value={{
            themeMode, setThemeMode,
            accentColor, setAccentColor,
            dayTheme, nightTheme
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
