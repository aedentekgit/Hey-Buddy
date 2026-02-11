import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { Lock, Mail, Loader2, Bot, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login, googleLogin } = useAuth();
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
                        toast.success('Welcome back!');
                        navigate('/admin/dashboard');
                    } catch (error) {
                        console.error("Google Login Error:", error);
                        toast.error(error.response?.data?.message || 'Google login failed');
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
                        text: 'continue_with'
                    }
                );
            }
        }
    }, [publicSettings, googleLogin, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast.success('Welcome back!');
            navigate('/admin/dashboard');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <Toaster position="top-center" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="login-box"
            >
                {/* Logo */}
                <div className="logo-section">
                    <div className="logo">
                        <Bot size={32} />
                    </div>
                    <h1>Hey Buddy</h1>
                    <p>Welcome back</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <label>Email</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <div className="label-row">
                            <label>Password</label>
                            <Link to="/forgot-password" className="forgot-link">
                                Forgot password?
                            </Link>
                        </div>
                        <div className="input-wrapper">
                            <Lock size={18} className="input-icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="toggle-btn"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="submit-button">
                        {loading ? (
                            <>
                                <Loader2 className="spin" size={18} />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Google Login */}
                {publicSettings?.googleAuth?.enabled && (
                    <>
                        <div className="divider">
                            <span>or</span>
                        </div>
                        <div id="google-btn-wrapper"></div>
                    </>
                )}

                {/* Footer */}
                <div className="footer">
                    Don't have an account?{' '}
                    <Link to="/signup" className="signup-link">
                        Sign up
                    </Link>
                </div>
            </motion.div>

            <style>{`
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                }

                .login-box {
                    width: 100%;
                    max-width: 420px;
                    background: white;
                    border-radius: 16px;
                    padding: 48px 40px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }

                .logo-section {
                    text-align: center;
                    margin-bottom: 40px;
                }

                .logo {
                    width: 56px;
                    height: 56px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    margin: 0 auto 16px;
                }

                .logo-section h1 {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1a202c;
                    margin: 0 0 8px 0;
                }

                .logo-section p {
                    font-size: 14px;
                    color: #718096;
                    margin: 0;
                }

                .login-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .label-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .input-group label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #2d3748;
                }

                .forgot-link {
                    font-size: 13px;
                    font-weight: 600;
                    color: #667eea;
                    text-decoration: none;
                }

                .forgot-link:hover {
                    text-decoration: underline;
                }

                .input-wrapper {
                    position: relative;
                }

                .input-icon {
                    position: absolute;
                    left: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #a0aec0;
                    pointer-events: none;
                }

                .input-wrapper input {
                    width: 100%;
                    padding: 12px 14px 12px 44px;
                    border: 2px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 14px;
                    color: #2d3748;
                    outline: none;
                    transition: all 0.2s;
                    background: white;
                }

                .input-wrapper input:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .input-wrapper input::placeholder {
                    color: #cbd5e0;
                }

                .toggle-btn {
                    position: absolute;
                    right: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #a0aec0;
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                }

                .toggle-btn:hover {
                    color: #667eea;
                }

                .submit-button {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 10px;
                    font-size: 15px;
                    font-weight: 600;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-top: 8px;
                    transition: transform 0.2s, box-shadow 0.2s;
                }

                .submit-button:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
                }

                .submit-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .divider {
                    position: relative;
                    text-align: center;
                    margin: 24px 0;
                }

                .divider::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 50%;
                    height: 1px;
                    background: #e2e8f0;
                }

                .divider span {
                    position: relative;
                    display: inline-block;
                    padding: 0 12px;
                    background: white;
                    font-size: 13px;
                    color: #a0aec0;
                    font-weight: 500;
                }

                #google-btn-wrapper {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                }

                .footer {
                    text-align: center;
                    margin-top: 28px;
                    font-size: 14px;
                    color: #718096;
                }

                .signup-link {
                    color: #667eea;
                    font-weight: 600;
                    text-decoration: none;
                }

                .signup-link:hover {
                    text-decoration: underline;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Autofill Styles */
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus {
                    -webkit-box-shadow: 0 0 0 30px white inset !important;
                    -webkit-text-fill-color: #2d3748 !important;
                }

                @media (max-width: 480px) {
                    .login-box {
                        padding: 36px 28px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Login;
