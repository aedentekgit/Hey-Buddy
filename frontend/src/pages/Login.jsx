import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Lock, Mail, Loader2, Bot, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login, googleLogin } = useAuth();
    const { publicSettings, refreshSettings } = useSettings();
    const navigate = useNavigate();

    useEffect(() => {
        const clientId = publicSettings?.googleAuth?.webClientId;
        if (!publicSettings?.googleAuth?.enabled || !clientId || !window.google) return;

        // Initialize OAuth2 Code Client for Server-Side Refresh Token support
        const client = window.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: 'openid email profile https://www.googleapis.com/auth/calendar',
            ux_mode: 'popup',
            callback: async (response) => {
                if (response.code) {
                    setLoading(true);
                    try {
                        // Send the serverAuthCode to the backend
                        // The backend is now configured to exchange this for both user info and refresh token
                        await googleLogin(null, response.code);
                        refreshSettings();
                        toast.success('Welcome back! Calendar synced.');
                        navigate('/admin/dashboard');
                    } catch (error) {
                        console.error("Google Login Error:", error);
                        toast.error(error.response?.data?.message || 'Google login failed');
                    } finally {
                        setLoading(false);
                    }
                }
            },
        });

        // Set the global handler for our custom button
        window.handleGoogleLoginCode = () => client.requestCode();

    }, [publicSettings, googleLogin, navigate]);



    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            refreshSettings();
            toast.success('Welcome back!');
            navigate('/admin/dashboard');
        } catch (error) {
            if (!error.response) {
                toast.error('Cannot connect to the server. Please try again later.');
            } else {
                toast.error(error.response?.data?.message || 'Invalid credentials');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Animated Background Elements */}
            <div className="bg-blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>
            <div className="bg-grid"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="login-card"
            >
                {/* Visual Accent */}
                <div className="card-accent"></div>

                <div className="login-content">
                    {/* Header */}
                    <div className="header-section">
                        <motion.div
                            initial={{ rotate: -20, scale: 0.8 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ type: "spring", damping: 12 }}
                            className="logo-wrapper"
                        >
                            <Bot size={40} className="logo-icon" />
                            <div className="logo-glow"></div>
                        </motion.div>
                        {/* Auth Toggle */}
                        <motion.div
                            className="auth-toggle"
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Link to="/login" className="toggle-item active">Sign In</Link>
                            <Link to="/signup" className="toggle-item">Create Account</Link>
                        </motion.div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <motion.div
                            className="form-group"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="input-field">
                                <Mail size={18} className="field-icon" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Professional Email"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </motion.div>

                        <motion.div
                            className="form-group"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="input-field">
                                <Lock size={18} className="field-icon" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Secure Password"
                                    required
                                    autoComplete="current-password"
                                    style={{ paddingRight: '120px !important' }}
                                />
                                <div className="field-actions">
                                    <Link to="/forgot-password" style={{ whiteSpace: 'nowrap' }}>Forgot?</Link>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="visibility-toggle"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="btn-submit"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="btn-inner"
                                    >
                                        <Loader2 className="spin" size={20} />
                                        <span>Authenticating...</span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="static"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="btn-inner"
                                    >
                                        <span>Initialize Session</span>
                                        <ArrowRight size={20} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    </form>

                    {/* OAuth Section */}
                    {publicSettings?.googleAuth?.enabled && (
                        <motion.div
                            className="oauth-section"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.7 }}
                        >
                            <div className="divider">
                                <div className="line"></div>
                                <span>SOCIAL AUTH</span>
                                <div className="line"></div>
                            </div>

                            <div className="social-grid">
                                <button
                                    type="button"
                                    onClick={() => window.handleGoogleLoginCode && window.handleGoogleLoginCode()}
                                    className="social-btn google-custom-btn"
                                >
                                    <svg width="18" height="18" viewBox="0 0 18 18">
                                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                                        <path d="M3.964 10.711a5.41 5.41 0 0 1 0-3.422V4.957H.957a8.998 8.998 0 0 0 0 8.086l3.007-2.332z" fill="#FBBC05" />
                                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.957L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
                                    </svg>
                                    <span>Sign up with Google</span>
                                </button>

                                <button type="button" className="social-btn apple-btn">
                                    <svg viewBox="0 0 384 512" width="18" height="18" fill="currentColor">
                                        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                                    </svg>
                                    <span>Apple</span>
                                </button>
                            </div>
                        </motion.div>
                    )}


                </div>

                {/* Footer Badges */}
                <div className="card-footer">
                    <div className="badge">
                        <ShieldCheck size={14} />
                        Enterprise Secure
                    </div>
                    <div className="badge">
                        <Sparkles size={14} />
                        Next-Gen AI
                    </div>
                </div>
            </motion.div>

            <style>{`
                .login-container {
                    min-height: 100vh;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-color);
                    background-image: var(--bg-image);
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                    font-family: var(--font-family);
                    transition: all 0.3s ease;
                }

                /* Animated Background */
                .bg-blobs {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    filter: blur(80px);
                }

                .blob {
                    position: absolute;
                    border-radius: 50%;
                    opacity: 0.15;
                    animation: move 20s infinite alternate;
                }

                .blob-1 {
                    width: 400px;
                    height: 400px;
                    background: var(--primary-color);
                    top: -100px;
                    left: -100px;
                }

                .blob-2 {
                    width: 350px;
                    height: 350px;
                    background: #6366F1;
                    bottom: -50px;
                    right: -50px;
                    animation-delay: -5s;
                }

                .blob-3 {
                    width: 300px;
                    height: 300px;
                    background: var(--primary-color);
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    animation-delay: -10s;
                }

                @keyframes move {
                    from { transform: translate(0, 0) scale(1); }
                    to { transform: translate(50px, 50px) scale(1.1); }
                }

                .bg-grid {
                    position: absolute;
                    inset: 0;
                    z-index: 2;
                    background-image: radial-gradient(circle at 1px 1px, var(--border-color) 1px, transparent 0);
                    background-size: 32px 32px;
                    opacity: 0.5;
                }

                .login-card {
                    width: 100%;
                    max-width: 500px;
                    z-index: 10;
                    background: var(--card-bg);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: var(--card-shadow);
                    position: relative;
                    margin: auto;
                    transition: all 0.3s ease;
                }

                .card-accent {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: var(--primary-gradient);
                }

                .login-content {
                    padding: 24px 32px 20px;
                }

                /* Header */
                .header-section {
                    text-align: center;
                    margin-bottom: 16px;
                }

                .logo-wrapper {
                    position: relative;
                    width: 52px;
                    height: 52px;
                    margin: 0 auto 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logo-icon {
                    color: var(--primary-color);
                    z-index: 2;
                }

                .logo-glow {
                    position: absolute;
                    inset: 0;
                    background: var(--primary-color);
                    border-radius: 8px;
                    filter: blur(15px);
                    opacity: 0.2;
                    animation: pulse-glow 3s infinite;
                }

                @keyframes pulse-glow {
                    0%, 100% { transform: scale(1); opacity: 0.15; }
                    50% { transform: scale(1.1); opacity: 0.25; }
                }

                .header-section h1 {
                    font-size: 24px;
                    font-weight: 800;
                    color: var(--text-main);
                    margin-bottom: 20px;
                    letter-spacing: -1px;
                }

                .auth-toggle {
                    background: var(--bg-lite);
                    padding: 4px;
                    border-radius: 100px;
                    display: flex;
                    gap: 4px;
                    max-width: 320px;
                    margin: 8px auto 24px;
                    border: 1px solid var(--border-color);
                }

                .toggle-item {
                    flex: 1;
                    padding: 10px 20px;
                    border-radius: 100px;
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--text-sub);
                    text-decoration: none;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: center;
                    white-space: nowrap;
                }

                .toggle-item.active {
                    background: var(--card-bg);
                    color: var(--text-main);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                }

                .toggle-item:not(.active):hover {
                    color: var(--text-main);
                    background: color-mix(in srgb, var(--primary-color) 5%, transparent);
                }

                .header-section h1 span {
                    background: var(--primary-gradient);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .header-section p {
                    color: var(--text-sub);
                    font-size: 14px;
                    font-weight: 500;
                    max-width: 250px;
                    margin: 0 auto;
                    line-height: 1.4;
                }

                /* Form Elements */
                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .form-group label {
                    font-size: 11px;
                    font-weight: 800;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-left: 2px;
                }

                .label-with-link {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .label-with-link a {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--primary-color);
                    text-decoration: none;
                    transition: all 0.2s;
                }

                .label-with-link a:hover {
                    opacity: 0.8;
                    text-decoration: underline;
                }

                .input-field {
                    position: relative;
                    display: flex;
                    align-items: center;
                    width: 100%;
                }

                .field-icon {
                    position: absolute;
                    left: 16px;
                    color: var(--text-sub);
                    pointer-events: none;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .auth-form .input-field input {
                    width: 100% !important;
                    padding: 10px 16px 10px 44px !important;
                    background: var(--bg-lite) !important;
                    border: 1px solid var(--border-color) !important;
                    border-radius: 8px !important;
                    color: var(--text-main) !important;
                    font-size: 0.95rem !important;
                    font-weight: 500 !important;
                    outline: none !important;
                    transition: all 0.2s !important;
                    height: 44px !important;
                }

                .auth-form .input-field input:focus {
                    background: var(--card-bg) !important;
                    border-color: var(--primary-color) !important;
                    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 10%, transparent) !important;
                }

                .field-actions {
                    position: absolute;
                    right: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 10;
                }

                .field-actions a {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--primary-color);
                    text-decoration: none;
                }

                .field-actions a:hover {
                    text-decoration: underline;
                }

                .visibility-toggle {
                    background: none;
                    border: none;
                    color: var(--text-sub);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 4px;
                }

                .visibility-toggle:hover {
                    color: var(--text-main);
                }

                /* Button */
                .btn-submit {
                    width: 100%;
                    padding: 12px;
                    background: var(--primary-color);
                    background-image: var(--primary-gradient);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    margin-top: 6px;
                    box-shadow: 0 8px 20px -6px color-mix(in srgb, var(--primary-color) 40%, transparent);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }

                .btn-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 25px -8px color-mix(in srgb, var(--primary-color) 50%, transparent);
                }

                .btn-submit:active {
                    transform: translateY(0);
                }

                .btn-inner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }

                .btn-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    transform: none;
                }

                /* OAuth */
                .oauth-section {
                    margin-top: 16px;
                }

                .divider {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .divider .line {
                    flex: 1;
                    height: 1px;
                    background: var(--border-color);
                }

                 .divider span {
                    font-size: 10px;
                    font-weight: 800;
                    color: var(--text-sub);
                    letter-spacing: 0.1em;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    white-space: nowrap;
                }

                .social-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    width: 100%;
                    justify-content: center;
                }

                .google-btn-container, .apple-btn {
                    flex: 1;
                    min-width: 200px; /* Minimal width to avoid text clipping */
                    max-width: 100%;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .google-btn-container {
                    transition: all 0.3s;
                }

                .social-btn {
                    flex: 1;
                    min-width: 200px;
                    height: 44px;
                    border-radius: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .google-custom-btn {
                    background: white;
                    border: 1px solid #dadce0;
                    color: #3e444a;
                }

                .google-custom-btn:hover {
                    background: #f7f8f8;
                    border-color: #d2dce0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                .google-custom-btn svg {
                    color: #4285F4;
                }



                .apple-btn {
                    background: white !important;
                    border: 1px solid #dadce0 !important;
                    color: #3c4043 !important;
                }

                .apple-btn:hover {
                    background: #f7f8f8 !important;
                    border-color: #d2dce0 !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                .apple-btn svg {
                    flex-shrink: 0;
                    color: #000;
                }

                /* Mode Switch */
                .mode-switch {
                    text-align: center;
                    margin-top: 16px;
                    font-size: 14px;
                    color: var(--text-sub);
                    font-weight: 500;
                }

                .mode-switch a {
                    color: var(--primary-color);
                    font-weight: 700;
                    text-decoration: none;
                }

                .mode-switch a:hover {
                    text-decoration: underline;
                }

                /* Footer Badges */
                .card-footer {
                    background: color-mix(in srgb, var(--bg-color) 5%, transparent);
                    padding: 12px 32px;
                    display: flex;
                    justify-content: center;
                    gap: 24px;
                    border-top: 1px solid var(--border-color);
                }

                .badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                /* Mobile Optimization */
                @media (max-width: 480px) {
                    .login-card {
                        border-radius: 12px;
                        max-width: 100%;
                    }
                    .login-content {
                        padding: 24px 20px 20px;
                    }
                    .auth-form .input-field input {
                        height: 44px !important;
                    }
                    .social-grid {
                        gap: 8px;
                    }
                    .social-btn {
                        font-size: 13px;
                        padding: 8px;
                        gap: 8px;
                    }
                    .card-footer {
                        gap: 16px;
                        padding: 12px 20px;
                    }
                    .badge {
                        font-size: 10px;
                    }
                }

                /* Autofill Reset - Dynamic with Theme */
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus,
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px var(--bg-lite) inset !important;
                    -webkit-text-fill-color: var(--text-main) !important;
                    caret-color: var(--text-main) !important;
                    transition: background-color 5000s ease-in-out 0s;
                }
            `}</style>
        </div>
    );
};

export default Login;
