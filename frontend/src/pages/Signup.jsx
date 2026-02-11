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
                        <motion.h1
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            Join <span>Buddy AI</span>
                        </motion.h1>
                        <motion.p
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Enter the next dimension of work
                        </motion.p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-grid">
                            <motion.div
                                className="form-group"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <label>Full Name</label>
                                <div className="input-field">
                                    <User size={18} className="field-icon" />
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="John Carter"
                                        required
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                className="form-group"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <label>Phone Number</label>
                                <div className="input-field">
                                    <Phone size={18} className="field-icon" />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="+1 (555) 000"
                                    />
                                </div>
                            </motion.div>
                        </div>

                        <motion.div
                            className="form-group"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <label>Professional Email</label>
                            <div className="input-field">
                                <Mail size={18} className="field-icon" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="name@nexus.ai"
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
                                transition={{ delay: 0.6 }}
                            >
                                <label>Password</label>
                                <div className="input-field">
                                    <Lock size={18} className="field-icon" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="••••••••"
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
                                transition={{ delay: 0.6 }}
                            >
                                <label>Verify</label>
                                <div className="input-field">
                                    <Lock size={18} className="field-icon" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
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
                                <span>OR SIGN UP WITH</span>
                                <div className="line"></div>
                            </div>
                            <div id="google-btn-wrapper"></div>
                        </motion.div>
                    )}

                    {/* Switch Mode */}
                    <motion.div
                        className="mode-switch"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        Already registered? <Link to="/login">Initialize Session</Link>
                    </motion.div>
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
                :root {
                    --brand-primary: #764ba2;
                    --brand-secondary: #667eea;
                    --brand-glow: rgba(118, 75, 162, 0.5);
                    --glass-bg: rgba(255, 255, 255, 0.03);
                    --glass-border: rgba(255, 255, 255, 0.08);
                    --text-primary: #ffffff;
                    --text-secondary: rgba(255, 255, 255, 0.6);
                    --input-bg: rgba(0, 0, 0, 0.2);
                }

                .signup-container {
                    min-height: 100vh;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #060b28;
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Plus Jakarta Sans', sans-serif;
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
                    opacity: 0.4;
                    animation: move 20s infinite alternate;
                }

                .blob-1 {
                    width: 400px;
                    height: 400px;
                    background: var(--brand-primary);
                    top: -100px;
                    left: -100px;
                }

                .blob-2 {
                    width: 350px;
                    height: 350px;
                    background: var(--brand-secondary);
                    bottom: -50px;
                    right: -50px;
                    animation-delay: -5s;
                }

                .blob-3 {
                    width: 300px;
                    height: 300px;
                    background: #4a00e0;
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
                    background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
                    background-size: 32px 32px;
                }

                /* Card Design */
                .signup-card {
                    width: 100%;
                    max-width: 580px;
                    z-index: 10;
                    background: var(--glass-bg);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                    border: 1px solid var(--glass-border);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    position: relative;
                    margin: auto;
                }

                .card-accent {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(90deg, var(--brand-secondary), var(--brand-primary));
                }

                .signup-content {
                    padding: 40px 48px 32px;
                }

                /* Header */
                .header-section {
                    text-align: center;
                    margin-bottom: 24px;
                }

                .logo-wrapper {
                    position: relative;
                    width: 52px;
                    height: 52px;
                    margin: 0 auto 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logo-icon {
                    color: white;
                    z-index: 2;
                }

                .logo-glow {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, var(--brand-secondary), var(--brand-primary));
                    border-radius: 14px;
                    filter: blur(8px);
                    opacity: 0.6;
                    animation: pulse-glow 3s infinite;
                }

                @keyframes pulse-glow {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }

                .header-section h1 {
                    font-size: 24px;
                    font-weight: 800;
                    color: var(--text-primary);
                    margin-bottom: 2px;
                    letter-spacing: -0.5px;
                }

                .header-section h1 span {
                    background: linear-gradient(90deg, var(--brand-secondary), var(--brand-primary));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .header-section p {
                    color: var(--text-secondary);
                    font-size: 13px;
                    font-weight: 500;
                    line-height: 1.4;
                    margin: 0;
                }

                /* Form Layout */
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .form-group label {
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-left: 2px;
                }

                .input-field {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-field::after {
                    content: '';
                    position: absolute;
                    inset: -1px;
                    border-radius: 12px;
                    padding: 1px;
                    background: linear-gradient(90deg, var(--brand-secondary), var(--brand-primary));
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    opacity: 0;
                    transition: opacity 0.3s;
                    pointer-events: none;
                }

                .input-field:focus-within::after {
                    opacity: 1;
                }

                .field-icon {
                    position: absolute;
                    left: 14px;
                    color: var(--text-secondary);
                    pointer-events: none;
                    z-index: 10;
                }

                .auth-form .input-field input {
                    width: 100% !important;
                    padding: 10px 14px 10px 42px !important;
                    background: var(--input-bg) !important;
                    border: 1px solid var(--glass-border) !important;
                    border-radius: var(--radius-md) !important;
                    color: white !important;
                    font-size: 0.85rem !important;
                    outline: none !important;
                    transition: all 0.2s !important;
                    height: 44px !important;
                }

                .auth-form .input-field input:focus {
                    background: rgba(0, 0, 0, 0.4) !important;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
                }

                .visibility-toggle {
                    position: absolute;
                    right: 14px;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    z-index: 10;
                }

                .visibility-toggle:hover {
                    color: white;
                }

                /* Button */
                .btn-submit {
                    width: 100%;
                    padding: 14px;
                    background: var(--primary-color);
                    border: none;
                    border-radius: var(--radius-md);
                    color: white;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    margin-top: 4px;
                    box-shadow: 0 8px 16px -4px var(--brand-glow);
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                }

                .btn-submit::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: 0.5s;
                }

                .btn-submit:hover::before {
                    left: 100%;
                }

                .btn-inner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }

                .btn-submit:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                /* Mode Switch */
                .mode-switch {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 13px;
                    color: var(--text-secondary);
                }

                .mode-switch a {
                    color: var(--brand-secondary);
                    font-weight: 700;
                    text-decoration: none;
                }

                .mode-switch a:hover {
                    color: white;
                    text-decoration: underline;
                }

                /* Footer Badges */
                .card-footer {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 12px 40px;
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    border-top: 1px solid var(--glass-border);
                }

                .badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 10px;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* OAuth */
                .oauth-section {
                    margin-top: 20px;
                }

                .divider {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .divider .line {
                    flex: 1;
                    height: 1px;
                    background: var(--glass-border);
                }

                .divider span {
                    font-size: 10px;
                    font-weight: 800;
                    color: var(--text-secondary);
                    letter-spacing: 0.1em;
                }

                #google-btn-wrapper {
                    display: flex;
                    justify-content: center;
                    filter: grayscale(1) invert(1);
                    opacity: 0.8;
                    transition: 0.3s;
                }

                #google-btn-wrapper:hover {
                    filter: none;
                    opacity: 1;
                }

                /* Mobile Optimization */
                @media (max-width: 600px) {
                    .signup-card {
                        max-width: 100%;
                        border-radius: 20px;
                        margin: 0;
                    }
                    .signup-content {
                        padding: 20px 20px 16px;
                    }
                    .header-section {
                        margin-bottom: 16px;
                    }
                    .logo-wrapper {
                        width: 44px;
                        height: 44px;
                        margin-bottom: 8px;
                    }
                    .header-section h1 {
                        font-size: 22px;
                    }
                    .header-section p {
                        font-size: 12px;
                    }
                    .form-grid {
                        grid-template-columns: 1fr;
                        gap: 8px;
                    }
                    .auth-form {
                        gap: 8px;
                    }
                    .form-group {
                        gap: 4px;
                    }
                    .auth-form .input-field input {
                        height: 42px !important;
                        padding: 8px 12px 8px 38px !important;
                        font-size: 13px !important;
                    }
                    .btn-submit {
                        padding: 12px;
                        margin-top: 4px;
                    }
                    .mode-switch {
                        margin-top: 12px;
                    }
                    .card-footer {
                        padding: 10px 20px;
                        flex-direction: row;
                        justify-content: center;
                        gap: 16px;
                    }
                }

                /* Vertical Fit for short screens */
                @media (max-height: 750px) and (max-width: 600px) {
                    .signup-content {
                        padding-top: 12px;
                    }
                    .header-section {
                        margin-bottom: 8px;
                    }
                    .logo-wrapper {
                        display: none; /* Hide logo on very short screens to save space */
                    }
                    .auth-form {
                        gap: 6px;
                    }
                    .form-group label {
                        font-size: 9px;
                    }
                    .mode-switch {
                        margin-top: 8px;
                    }
                }

                /* Autofill Reset - Forced for Dark Theme */
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus,
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #060b28 inset !important;
                    -webkit-text-fill-color: white !important;
                    caret-color: white !important;
                    transition: background-color 5000s ease-in-out 0s;
                }
            `}</style>
        </div>
    );
};

export default Signup;
