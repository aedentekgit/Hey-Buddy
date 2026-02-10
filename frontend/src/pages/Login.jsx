import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { Lock, Mail, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';

const Login = () => {
    const [email, setEmail] = useState('admin@example.com');
    const [password, setPassword] = useState('adminpassword123');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login, googleLogin } = useAuth();
    const { publicSettings } = useSettings();
    const navigate = useNavigate();

    useEffect(() => {
        const clientId = publicSettings?.googleAuth?.webClientId;

        if (publicSettings?.googleAuth?.enabled && clientId && window.google) {
            console.log("Rendering Google Button with:", clientId);

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: async (response) => {
                    setLoading(true);
                    try {
                        console.log("Google Response:", response);
                        await googleLogin(response.credential);
                        toast.success('Login successful with Google!');
                        navigate('/admin/dashboard');
                    } catch (error) {
                        console.error("Google Login Error:", error);
                        toast.error('Google login failed');
                    } finally {
                        setLoading(false);
                    }
                },
                use_fedcm_for_prompt: false
            });

            // Render the official Google Button
            const btnWrapper = document.getElementById('google-btn-wrapper');
            if (btnWrapper) {
                window.google.accounts.id.renderButton(
                    btnWrapper,
                    { theme: 'outline', size: 'large', type: 'standard', width: '100%' }  // customization attributes
                );
            }
        }
    }, [publicSettings, googleLogin, navigate]);

    // Cleanup old handleGoogleLogin as the button handles it now
    const handleGoogleLogin = () => {
        // Fallback or explicit prompt if needed
        if (window.google) window.google.accounts.id.prompt();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast.success('Login successful!');
            navigate('/admin/dashboard');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <Toaster position="top-right" />

            {/* Glowing cosmic elements */}
            <div className="glow-orb orb-blue" />
            <div className="glow-orb orb-purple" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, cubicBezier: [0.22, 1, 0.36, 1] }}
                className="login-card"
            >
                <div className="brand-logo-container">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="brand-icon"
                    >
                        <ShieldCheck size={28} />
                    </motion.div>
                    <h1 className="brand-title">VISION UI PRO</h1>
                    <p className="brand-subtitle">Secure Access Terminal</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <div className="input-wrapper">
                            <Mail size={16} className="field-icon" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="login-input"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Secure Password</label>
                        <div className="input-wrapper">
                            <Lock size={16} className="field-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="login-input"
                                style={{ paddingRight: '48px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="toggle-password-btn"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.01, translateY: -1 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="submit-btn"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In Now'}
                    </motion.button>
                </form>

                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="divider">
                        <div className="divider-line" />
                        <span className="divider-text">Or continue with</span>
                        <div className="divider-line" />
                    </div>

                    <div className="social-grid">
                        <div id="google-btn-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>

                        <button
                            type="button"
                            className="social-btn"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M12.152 6.896c-.548 0-1.411-.516-2.473-.516-1.357 0-2.714.805-3.407 2.015-1.403 2.434-.355 6.04 1.007 8.007.661.955 1.448 2.031 2.48 1.99 1.0-.041 1.381-.645 2.593-.645s1.554.645 2.613.603c1.082-.02 1.77-.975 2.427-1.95.762-1.114 1.074-2.19 1.095-2.247-.021-.01-2.1-.806-2.121-3.193-.018-1.995 1.64-2.954 1.713-2.996-.931-1.358-2.366-1.51-2.871-1.543-1.062-.082-2 0-2.55 0Zm2.3-3.664c.465-.563.778-1.344.693-2.126-.67.027-1.482.449-1.962 1.012-.432.497-.81 1.298-.705 2.062.748.058 1.51-.386 1.974-.948Z" />
                            </svg>
                            Apple
                        </button>
                    </div>
                </div>

                <div className="footer-text">
                    <p>
                        Don't have an account?{' '}
                        <Link to="/signup" className="footer-link">
                            Sign Up
                        </Link>
                    </p>
                </div>
            </motion.div>

            <style>{`
                .login-page {
                    height: 100vh;
                    background: #040717;
                    background-image: 
                        radial-gradient(circle at 0% 0%, rgba(0, 117, 255, 0.12) 0%, transparent 45%),
                        radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.12) 0%, transparent 45%),
                        radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 0%, rgba(4, 7, 23, 0.5) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
                }
                
                .glow-orb {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(100px);
                    z-index: 0;
                    pointer-events: none;
                }
                .orb-blue { top: 15%; right: 10%; width: 400px; height: 400px; background: rgba(0, 117, 255, 0.05); }
                .orb-purple { bottom: 15%; left: 10%; width: 350px; height: 350px; background: rgba(139, 92, 246, 0.05); }

                .login-card {
                    width: 100%;
                    max-width: 440px;
                    background: linear-gradient(180deg, rgba(22, 28, 45, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%);
                    padding: 40px;
                    border-radius: 24px;
                    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 117, 255, 0.1);
                    position: relative;
                    z-index: 1;
                    backdrop-filter: blur(20px);
                }

                .brand-logo-container {
                     text-align: center; margin-bottom: 32px;
                }
                .brand-icon {
                    width: 56px; height: 56px;
                    background: linear-gradient(135deg, #0075ff 0%, #005bc4 100%);
                    border-radius: 16px;
                    display: flex; align-items: center; justify-content: center;
                    color: white; margin: 0 auto 16px;
                    box-shadow: 0 8px 16px rgba(0, 117, 255, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .brand-title { font-size: 1.5rem; fontWeight: 800; color: white; margin-bottom: 6px; letter-spacing: -0.025em; }
                .brand-subtitle { color: rgba(255, 255, 255, 0.45); fontWeight: 600; fontSize: 0.85rem; letter-spacing: 0.01em; }

                .form-group { display: flex; flexDirection: column; gap: 8px; }
                .form-label { font-size: 0.7rem; fontWeight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-left: 4px; }
                
                .input-wrapper { position: relative; }
                .field-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); z-index: 2; transition: color 0.3s; }
                
                .login-input {
                    width: 100%;
                    padding: 14px 16px 14px 48px;
                    border-radius: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(15, 23, 42, 0.5);
                    outline: none;
                    font-size: 0.85rem;
                    transition: all 0.3s;
                    color: white;
                    fontWeight: 500;
                }
                .login-input:focus {
                     border-color: rgba(0, 117, 255, 1);
                     background: rgba(15, 23, 42, 0.8);
                     box-shadow: 0 0 0 4px rgba(0, 117, 255, 0.1);
                }
                .login-input:focus + .toggle-password-btn {
                     color: white;
                }

                .input-wrapper:focus-within .field-icon {
                    color: #0075ff;
                }

                .toggle-password-btn {
                    position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
                    background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.4);
                    display: flex; align-items: center; justify-content: center; padding: 0; z-index: 2;
                    transition: color 0.2s;
                }
                .toggle-password-btn:hover { color: rgba(255,255,255,0.8); }

                .submit-btn {
                    width: 100%; padding: 14px;
                    background: linear-gradient(90deg, #0075ff 0%, #00d1ff 100%);
                    color: white; border: none; border-radius: 16px;
                    font-size: 0.9rem; fontWeight: 700; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    margin-top: 8px;
                    box-shadow: 0 10px 20px -5px rgba(0, 117, 255, 0.4);
                    transition: all 0.3s;
                }
                .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(0, 117, 255, 0.6); }
                .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

                .divider { display: flex; align-items: center; margin: 24px 0 20px; gap: 16px; }
                .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
                .divider-text { font-size: 0.75rem; fontWeight: 700; color: rgba(255,255,255,0.25); text-transform: uppercase; letter-spacing: 0.05em; }

                .social-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .social-btn {
                    width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
                    padding: 12px; background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px;
                    color: white; font-size: 0.8rem; fontWeight: 700; cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .social-btn:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.2); transform: translateY(-1px); }

                .footer-text { margin-top: 28px; text-align: center; }
                .footer-text p { font-size: 0.9rem; color: rgba(255,255,255,0.4); }
                .footer-link { color: #0075ff; fontWeight: 700; text-decoration: none; margin-left: 4px; transition: color 0.2s; }
                .footer-link:hover { color: #60a5fa; text-decoration: underline; }

                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                ::placeholder { color: rgba(255, 255, 255, 0.3); }

                input:-webkit-autofill,
                input:-webkit-autofill:hover, 
                input:-webkit-autofill:focus, 
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 30px #0f172a inset !important;
                    -webkit-text-fill-color: white !important;
                    transition: background-color 5000s ease-in-out 0s;
                    caret-color: white;
                }

                @media (max-width: 480px) {
                    .login-card { padding: 32px 20px; }
                    .login-page { padding: 16px; }
                    .orb-blue, .orb-purple { width: 250px; height: 250px; opacity: 0.7; }
                }
            `}</style>
        </div>
    );
};

export default Login;
