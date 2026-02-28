import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (token) {
                try {
                    const res = await api.get('/auth/me');
                    const userData = res.data.data;

                    if (userData && userData.webAccess === false) {
                        console.warn('Web access restricted for this role. Logging out.');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        setUser(null);
                        return;
                    }

                    // Sync Timezone
                    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    if (userData && (!userData.timezone || userData.timezone !== browserTimezone)) {
                        console.log('[Auth] Syncing timezone:', browserTimezone);
                        api.put('/users/profile', { timezone: browserTimezone }).catch(console.error);
                    }

                    setUser(userData);
                    localStorage.setItem('user', JSON.stringify(userData));
                } catch (error) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } else if (storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    if (parsedUser.isGuest) {
                        setUser(parsedUser);
                    }
                } catch (e) {
                    localStorage.removeItem('user');
                }
            }
            setLoading(false);
        };
        checkUser();
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        if (res.data.success) {
            localStorage.setItem('token', res.data.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.data));

            // Sync Timezone on Login
            const userData = res.data.data;
            const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (userData && (!userData.timezone || userData.timezone !== browserTimezone)) {
                api.put('/users/profile', { timezone: browserTimezone }).catch(console.error);
            }

            setUser(userData);
            return { success: true };
        }
        return { success: false, message: res.data.message };
    };

    const signup = async (userData) => {
        const res = await api.post('/auth/signup', userData);
        if (res.data.success) {
            localStorage.setItem('token', res.data.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.data));
            setUser(res.data.data);
            return { success: true };
        }
        return { success: false, message: res.data.message };
    };

    const googleLogin = async (idToken) => {
        const res = await api.post('/auth/google-login', { idToken });
        if (res.data.success) {
            localStorage.setItem('token', res.data.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.data));
            setUser(res.data.data);
            return { success: true };
        }
        return { success: false, message: res.data.message };
    };

    const continueAsGuest = async () => {
        try {
            const res = await api.post('/auth/guest-login');
            if (res.data.success) {
                const guestData = res.data.data;
                setUser(guestData);
                localStorage.setItem('user', JSON.stringify(guestData));
                return { success: true };
            }
        } catch (error) {
            console.error('[Auth] Guest login failed:', error);
        }
        return { success: false, message: 'Failed to start guest session' };
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const refreshUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const res = await api.get('/auth/me');
                const userData = res.data.data;

                if (userData && userData.webAccess === false) {
                    localStorage.removeItem('token');
                    setUser(null);
                    return null;
                }

                setUser(userData);
                return userData;
            } catch (error) {
                console.error("Refresh user error:", error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, googleLogin, logout, refreshUser, continueAsGuest }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
