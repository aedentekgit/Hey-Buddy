import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast, Toaster } from 'react-hot-toast';
import { Lock, Mail, Loader2, Bot, User, Phone, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signup, googleLogin } = useAuth();
    const { publicSettings } = useSettings();
    const navigate = useNavigate();

    useEffect(() => {
        const clientId = publicSettings?.googleAuth?.webClientId;

        if (publicSettings?.googleAuth?.enabled && clientId && window.google) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response) => {
                    setLoading(true);
                    try {
                        await googleLogin(response.credential);
                        toast.success('Welcome to Buddy AI!');
                        navigate('/admin/dashboard');
                    } catch (error) {
                        console.error("Google Login Error:", error);
                        toast.error(error.response?.data?.message || 'Google signup failed');
                    } finally {
                        setLoading(false);
                    }
                },
                use_fedcm_for_prompt: false
            });

            const btnWrapper = document.getElementById('google-btn-wrapper');
            if (btnWrapper) {
                btnWrapper.innerHTML = '';
                window.google.accounts.id.renderButton(
                    btnWrapper,
                    {
                        theme: 'outline',
                        size: 'large',
                        width: btnWrapper.offsetWidth,
                        text: 'signup_with',
                        shape: 'pill'
                    }
                );
            }
        }
    }, [publicSettings, googleLogin, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            return toast.error("Passwords do not match");
        }

        setLoading(true);
        try {
            await signup({
                name: formData.name,
                email: formData.email,
                password: formData.password,
                phone: formData.phone
            });
            toast.success('Account created successfully!');
            navigate('/admin/dashboard');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-container">
            <Toaster position="top-center" />

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
                className="signup-card"
            >
                {/* Visual Accent */}
                <div className="card-accent"></div>

                <div className="signup-content">
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
                            <Link to="/login" className="toggle-item">Sign In</Link>
                            <Link to="/signup" className="toggle-item active">Create Account</Link>
                        </motion.div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-grid">
                            <motion.div
                                className="form-group"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <div className="input-field">
                                    <User size={18} className="field-icon" />
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Full Name"
                                        required
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                className="form-group"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <div className="input-field">
                                    <Phone size={18} className="field-icon" />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="Phone Number"
                                    />
                                </div>
                            </motion.div>
                        </div>

                        <motion.div
                            className="form-group"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="input-field">
                                <Mail size={18} className="field-icon" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Professional Email"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </motion.div>

                        <div className="form-grid">
                            <motion.div
                                className="form-group"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <div className="input-field">
                                    <Lock size={18} className="field-icon" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Create Password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="visibility-toggle"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </motion.div>

                            <motion.div
                                className="form-group"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <div className="input-field">
                                    <Lock size={18} className="field-icon" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Confirm Password"
                                        required
                                    />
                                </div>
                            </motion.div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="btn-submit"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.7 }}
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
                                        <span>Provisioning...</span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="static"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="btn-inner"
                                    >
                                        <span>Create Account</span>
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
                            transition={{ delay: 0.75 }}
                        >
                            <div className="divider">
                                <div className="line"></div>
                                <span>SOCIAL AUTH</span>
                                <div className="line"></div>
                            </div>

                            <div className="social-grid">
                                <button type="button" className="social-btn">
                                    <svg viewBox="0 0 24 24" width="20" height="20">
                                        <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.273 0 3.191 2.691 1.145 6.655L5.266 9.765z" />
                                        <path fill="#34A853" d="M16.04 18.013c-1.09.696-2.415 1.132-4.04 1.132-2.909 0-5.385-1.936-6.266-4.527L1.614 17.73A11.907 11.907 0 0 0 12 24c3.12 0 6.012-1.026 8.324-2.775l-4.284-3.212z" />
                                        <path fill="#4285F4" d="M23.955 12.136c0-.827-.066-1.636-.201-2.42H12v4.59h6.702a5.732 5.732 0 0 1-2.484 3.76l4.284 3.21c2.503-2.308 3.953-5.705 3.953-9.14z" />
                                        <path fill="#FBBC05" d="M5.734 14.618A6.87 6.87 0 0 1 5.318 12c0-.918.155-1.801.432-2.618L1.614 6.638C.59 8.682 0 11 0 12c0 1 .59 3.318 1.614 5.362l4.12-3.144z" />
                                    </svg>
                                    <span>Google</span>
                                </button>
                                <button type="button" className="social-btn">
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
                        Identity Verified
                    </div>
                    <div className="badge">
                        <Sparkles size={14} />
                        AI Ready
                    </div>
                </div>
            </motion.div>

            <style>{`
                .signup-container {
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

                /* Card Design */
                .signup-card {
                    width: 100%;
                    max-width: 580px;
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

                .signup-content {
                    padding: 24px 32px 20px;
                }

                /* Header */
                .header-section {
                    text-align: center;
                    margin-bottom: 12px;
                }

                .logo-wrapper {
                    position: relative;
                    width: 48px;
                    height: 48px;
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
                    border-radius: 14px;
                    filter: blur(15px);
                    opacity: 0.2;
                    animation: pulse-glow 3s infinite;
                }

                @keyframes pulse-glow {
                    0%, 100% { transform: scale(1); opacity: 0.15; }
                    50% { transform: scale(1.1); opacity: 0.25; }
                }

                .header-section h1 {
                    font-size: 22px;
                    font-weight: 800;
                    color: var(--text-main);
                    margin-bottom: 20px;
                    letter-spacing: -0.5px;
                }

                .auth-toggle {
                    background: var(--bg-lite);
                    padding: 4px;
                    border-radius: 100px;
                    display: flex;
                    gap: 4px;
                    max-width: 320px;
                    margin: 0 auto;
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
                    color: #1e293b;
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
                    font-size: 13px;
                    font-weight: 500;
                    line-height: 1.4;
                    margin: 0;
                }

                /* Form Layout */
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .form-group label {
                    font-size: 10px;
                    font-weight: 800;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-left: 2px;
                }

                .input-field {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .field-icon {
                    position: absolute;
                    left: 14px;
                    color: var(--text-sub);
                    pointer-events: none;
                    z-index: 10;
                    scale: 0.9;
                }

                .auth-form .input-field input {
                    width: 100% !important;
                    padding: 8px 14px 8px 40px !important;
                    background: var(--bg-lite) !important;
                    border: 1px solid var(--border-color) !important;
                    border-radius: 10px !important;
                    color: var(--text-main) !important;
                    font-size: 0.85rem !important;
                    font-weight: 500 !important;
                    outline: none !important;
                    transition: all 0.2s !important;
                    height: 42px !important;
                }

                .auth-form .input-field input:focus {
                    background: var(--card-bg) !important;
                    border-color: var(--primary-color) !important;
                    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 10%, transparent) !important;
                }

                .visibility-toggle {
                    position: absolute;
                    right: 14px;
                    background: none;
                    border: none;
                    color: var(--text-sub);
                    cursor: pointer;
                    z-index: 10;
                    display: flex;
                    align-items: center;
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

                /* Mode Switch */
                .mode-switch {
                    text-align: center;
                    margin-top: 16px;
                    font-size: 13px;
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
                    padding: 10px 32px;
                    display: flex;
                    justify-content: center;
                    gap: 16px;
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

                .social-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .social-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    padding: 10px;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    color: var(--text-main);
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .social-btn:hover {
                    background: var(--bg-lite);
                    border-color: var(--primary-color);
                    transform: translateY(-1px);
                }

                .social-btn svg, .social-btn img {
                    flex-shrink: 0;
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
                }

                #google-btn-wrapper {
                    display: flex;
                    justify-content: center;
                    transition: 0.3s;
                }

                /* Mobile Optimization */
                @media (max-width: 600px) {
                    .signup-card {
                        max-width: 100%;
                        border-radius: 20px;
                    }
                    .signup-content {
                        padding: 24px 20px 20px;
                    }
                    .form-grid {
                        grid-template-columns: 1fr;
                        gap: 8px;
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

export default Signup;
