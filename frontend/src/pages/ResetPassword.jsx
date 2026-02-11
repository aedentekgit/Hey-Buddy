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
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                }

                .reset-password-box {
                    width: 100%;
                    max-width: 420px;
                    background: white;
                    border-radius: 16px;
                    padding: 48px 40px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }

                .logo-section {
                    text-align: center;
                    margin-bottom: 32px;
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

                .instruction {
                    text-align: center;
                    font-size: 14px;
                    color: #4a5568;
                    margin-bottom: 28px;
                    line-height: 1.6;
                }

                .reset-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .input-group label {
                    font-size: 14px;
                    font-weight: 600;
                    color: #2d3748;
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
                    padding: 12px 44px 12px 44px;
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

                .hint {
                    font-size: 12px;
                    color: #a0aec0;
                    margin: 0;
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

                .success-message {
                    text-align: center;
                }

                .success-icon {
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    margin: 0 auto 24px;
                }

                .success-message h3 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1a202c;
                    margin: 0 0 12px 0;
                }

                .success-message p {
                    font-size: 14px;
                    color: #4a5568;
                    line-height: 1.6;
                }

                .error-state {
                    text-align: center;
                    padding: 20px;
                }

                .error-state h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #e53e3e;
                    margin: 0 0 12px 0;
                }

                .error-state p {
                    font-size: 14px;
                    color: #4a5568;
                    margin-bottom: 24px;
                }

                .btn-primary {
                    display: inline-block;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    text-decoration: none;
                    border-radius: 10px;
                    font-weight: 600;
                    transition: transform 0.2s;
                }

                .btn-primary:hover {
                    transform: translateY(-1px);
                }

                .footer {
                    text-align: center;
                    margin-top: 24px;
                }

                .back-link {
                    color: #667eea;
                    font-weight: 600;
                    font-size: 14px;
                    text-decoration: none;
                }

                .back-link:hover {
                    text-decoration: underline;
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
                    -webkit-box-shadow: 0 0 0 30px white inset !important;
                    -webkit-text-fill-color: #2d3748 !important;
                }

                @media (max-width: 480px) {
                    .reset-password-box {
                        padding: 36px 28px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ResetPassword;
