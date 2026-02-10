import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const res = await api.get('/auth/me');
                    setUser(res.data.data);
                } catch (error) {
                    localStorage.removeItem('token');
                    setUser(null);
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
            setUser(res.data.data);
            return { success: true };
        }
        return { success: false, message: res.data.message };
    };

    const signup = async (name, email, password) => {
        const res = await api.post('/auth/signup', { name, email, password });
        if (res.data.success) {
            localStorage.setItem('token', res.data.data.token);
            setUser(res.data.data);
            return { success: true };
        }
        return { success: false, message: res.data.message };
    };

    const googleLogin = async (idToken) => {
        const res = await api.post('/auth/google-login', { idToken });
        if (res.data.success) {
            localStorage.setItem('token', res.data.data.token);
            setUser(res.data.data);
            return { success: true };
        }
        return { success: false, message: res.data.message };
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const refreshUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const res = await api.get('/auth/me');
                setUser(res.data.data);
                return res.data.data;
            } catch (error) {
                console.error("Refresh user error:", error);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, googleLogin, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
