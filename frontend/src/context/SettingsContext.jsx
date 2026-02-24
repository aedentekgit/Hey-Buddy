import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { config as envConfig } from '../config/env';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    const [publicSettings, setPublicSettings] = useState(null);

    const fetchSettings = async () => {
        try {
            const res = await api.get('/settings');
            if (res.data.success) {
                setSettings(res.data.data);
                updateDocumentBranding(res.data.data);
            }
        } catch (error) {
            // If not logged in, we expect this to fail.
            // We should have fetched public settings anyway.
        } finally {
            setLoading(false);
        }
    };

    const fetchPublicSettings = async () => {
        try {
            const res = await api.get('/settings/public');
            if (res.data.success) {
                setPublicSettings(res.data.data);
                // Even without login, update branding if available
                updateDocumentBranding(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch public settings:', error);
        }
    };

    const getCircularFavicon = (url) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Use a standard favicon size (64x64 or 128x128)
                const size = 128;
                canvas.width = size;
                canvas.height = size;

                // Smooth out corners with clipping
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                // Fill with white or transparent if desired? 
                // Usually user wants it trimmed, so no fill.

                // Draw image centered and scaled
                const scale = Math.min(size / img.width, size / img.height);
                const x = (size / 2) - (img.width / 2) * scale;
                const y = (size / 2) - (img.height / 2) * scale;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(url);
            img.src = url;
        });
    };

    const updateDocumentBranding = async (data) => {
        if (!data || !data.general) return;

        const { companyName, logo } = data.general;
        const backendUrl = (envConfig.BACKEND_URL || '').replace(/\/$/, '');
        const logoPath = (logo || '').replace(/^\//, '');
        const fullLogoUrl = logo ? `${backendUrl}/${logoPath}` : null;

        // Helper to set meta tag
        const setMetaTag = (property, content) => {
            let meta = document.querySelector(`meta[property='${property}']`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('property', property);
                document.getElementsByTagName('head')[0].appendChild(meta);
            }
            meta.setAttribute('content', content);
        };

        // Update title
        if (companyName) {
            document.title = companyName;
            setMetaTag('og:title', companyName);
            setMetaTag('og:site_name', companyName);
        }

        // Update Favicon & OG Image
        if (fullLogoUrl) {
            // Generate circular version
            const circularLogo = await getCircularFavicon(fullLogoUrl);

            // Favicon
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = circularLogo;

            // OG Image
            setMetaTag('og:image', fullLogoUrl);
        }
    };

    useEffect(() => {
        fetchPublicSettings();
        fetchSettings();
    }, []);

    const refreshSettings = () => {
        fetchSettings();
    };

    return (
        <SettingsContext.Provider value={{ settings, publicSettings, loading, refreshSettings, fetchPublicSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
