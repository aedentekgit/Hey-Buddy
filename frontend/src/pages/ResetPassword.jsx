import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';
import { Lock, Loader2, Bot, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token, password });
            setResetSuccess(true);
            toast.success('Password reset successful!');
            setTimeout(() => navigate('/login'), 3000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="reset-password-container">
                <div className="reset-password-box">
                    <div className="error-state">
                        <h2>Invalid Reset Link</h2>
                        <p>This password reset link is invalid or has expired.</p>
                        <Link to="/forgot-password" className="btn-primary">
                            Request New Link
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="reset-password-container">
            <Toaster position="top-center" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="reset-password-box"
            >
                {/* Logo */}
                <div className="logo-section">
                    <div className="logo">
                        <Bot size={32} />
                    </div>
                    <h1>Hey Buddy</h1>
                    <p>{resetSuccess ? 'Password updated!' : 'Create new password'}</p>
                </div>

                {resetSuccess ? (
                    <div className="success-message">
                        <div className="success-icon">
                            <CheckCircle size={48} />
                        </div>
                        <h3>Success!</h3>
                        <p>
                            Your password has been reset successfully.
                            Redirecting to login...
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="instruction">
                            Please enter your new password below.
                        </p>

                        <form onSubmit={handleSubmit} className="reset-form">
                            <div className="input-group">
                                <label>New Password</label>
                                <div className="input-wrapper">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="toggle-btn"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <p className="hint">Must be at least 8 characters</p>
                            </div>

                            <div className="input-group">
                                <label>Confirm Password</label>
                                <div className="input-wrapper">
                                    <Lock size={18} className="input-icon" />
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="toggle-btn"
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="submit-button">
                                {loading ? (
                                    <>
                                        <Loader2 className="spin" size={18} />
                                        Resetting...
                                    </>
                                ) : (
                                    'Reset Password'
                                )}
                            </button>
                        </form>

                        <div className="footer">
                            <Link to="/login" className="back-link">
                                Back to Login
                            </Link>
                        </div>
                    </>
                )}
            </motion.div>

            <style>{`
                .reset-password-container {
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

                .reset-password-box {
                    width: 100%;
                    max-width: 440px;
                    z-index: 10;
                    background: var(--card-bg);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: var(--card-shadow);
                    position: relative;
                    padding: 24px 32px 20px;
                    transition: all 0.3s ease;
                }

                .logo-section {
                    text-align: center;
                    margin-bottom: 16px;
                }

                .logo {
                    width: 52px;
                    height: 52px;
                    background: var(--primary-color);
                    background-image: var(--primary-gradient);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    margin: 0 auto 8px;
                }

                .logo-section h1 {
                    font-size: 24px;
                    font-weight: 800;
                    color: var(--text-main);
                    margin: 0 0 4px 0;
                    letter-spacing: -0.5px;
                }

                .logo-section p {
                    font-size: 14px;
                    color: var(--text-sub);
                    font-weight: 500;
                    margin: 0;
                }

                .instruction {
                    text-align: center;
                    font-size: 14px;
                    color: var(--text-sub);
                    margin-bottom: 16px;
                    line-height: 1.6;
                    font-weight: 500;
                }

                .reset-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .input-group label {
                    font-size: 11px;
                    font-weight: 800;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .input-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .input-icon {
                    position: absolute;
                    left: 14px;
                    color: var(--text-sub);
                    pointer-events: none;
                }

                .input-wrapper input {
                    width: 100%;
                    padding: 10px 44px 10px 42px;
                    background: var(--bg-lite);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 0.95rem;
                    color: var(--text-main);
                    font-weight: 500;
                    outline: none;
                    transition: all 0.2s;
                    height: 44px;
                }

                .input-wrapper input:focus {
                    background: var(--card-bg);
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 10%, transparent);
                }

                .toggle-btn {
                    position: absolute;
                    right: 14px;
                    background: none;
                    border: none;
                    color: var(--text-sub);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    transition: color 0.2s;
                }

                .toggle-btn:hover {
                    color: var(--text-main);
                }

                .hint {
                    font-size: 11px;
                    color: var(--text-sub);
                    margin: 0;
                    font-weight: 500;
                    opacity: 0.8;
                }

                .submit-button {
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
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    margin-top: 8px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 8px 20px -6px color-mix(in srgb, var(--primary-color) 40%, transparent);
                }

                .submit-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 25px -8px color-mix(in srgb, var(--primary-color) 50%, transparent);
                }

                .submit-button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .success-message {
                    text-align: center;
                }

                .success-icon {
                    width: 80px;
                    height: 80px;
                    background: #10B981;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    margin: 0 auto 24px;
                }

                .success-message h3 {
                    font-size: 22px;
                    font-weight: 800;
                    color: var(--text-main);
                    margin: 0 0 12px 0;
                    letter-spacing: -0.5px;
                }

                .success-message p {
                    font-size: 14px;
                    color: var(--text-sub);
                    line-height: 1.6;
                    font-weight: 500;
                }

                .error-state {
                    text-align: center;
                    padding: 20px;
                }

                .error-state h2 {
                    font-size: 22px;
                    font-weight: 800;
                    color: #EF4444;
                    margin: 0 0 12px 0;
                    letter-spacing: -0.5px;
                }

                .error-state p {
                    font-size: 14px;
                    color: var(--text-sub);
                    margin-bottom: 24px;
                    font-weight: 500;
                }

                .btn-primary {
                    display: inline-block;
                    padding: 14px 28px;
                    background: var(--primary-color);
                    background-image: var(--primary-gradient);
                    color: white;
                    text-decoration: none;
                    border-radius: 14px;
                    font-weight: 700;
                    box-shadow: 0 8px 20px -6px color-mix(in srgb, var(--primary-color) 40%, transparent);
                    transition: all 0.3s ease;
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 25px -8px color-mix(in srgb, var(--primary-color) 50%, transparent);
                }

                .footer {
                    text-align: center;
                    margin-top: 24px;
                }

                .back-link {
                    color: var(--primary-color);
                    font-weight: 700;
                    font-size: 14px;
                    text-decoration: none;
                    transition: all 0.2s;
                }

                .back-link:hover {
                    text-decoration: underline;
                    opacity: 0.8;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus {
                    -webkit-box-shadow: 0 0 0 1000px var(--bg-lite) inset !important;
                    -webkit-text-fill-color: var(--text-main) !important;
                }

                @media (max-width: 480px) {
                    .reset-password-box {
                        padding: 36px 24px;
                        max-width: 100%;
                        border-radius: 20px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ResetPassword;
