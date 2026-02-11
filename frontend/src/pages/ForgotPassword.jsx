import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast, Toaster } from 'react-hot-toast';
import { Mail, Loader2, Bot, ArrowLeft, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/api';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setEmailSent(true);
            toast.success('Password reset link sent to your email!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send reset link');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-password-container">
            <Toaster position="top-center" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="forgot-password-box"
            >
                {/* Logo */}
                <div className="logo-section">
                    <div className="logo">
                        <Bot size={32} />
                    </div>
                    <h1>Hey Buddy</h1>
                    <p>{emailSent ? 'Check your email' : 'Reset your password'}</p>
                </div>

                {emailSent ? (
                    <div className="success-message">
                        <div className="success-icon">
                            <CheckCircle size={48} />
                        </div>
                        <h3>Email Sent!</h3>
                        <p>
                            We've sent a password reset link to <strong>{email}</strong>.
                            Please check your inbox and follow the instructions.
                        </p>
                        <Link to="/login" className="back-link">
                            <ArrowLeft size={18} />
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="instruction">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>

                        <form onSubmit={handleSubmit} className="forgot-form">
                            <div className="input-group">
                                <label>Email Address</label>
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

                            <button type="submit" disabled={loading} className="submit-button">
                                {loading ? (
                                    <>
                                        <Loader2 className="spin" size={18} />
                                        Sending...
                                    </>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>
                        </form>

                        <div className="footer">
                            <Link to="/login" className="back-link">
                                <ArrowLeft size={16} />
                                Back to Login
                            </Link>
                        </div>
                    </>
                )}
            </motion.div>

            <style>{`
                .forgot-password-container {
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

                .forgot-password-box {
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

                .forgot-form {
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
                    padding: 10px 14px 10px 40px;
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

                .input-wrapper input::placeholder {
                    color: var(--text-sub);
                    opacity: 0.5;
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
                    margin-bottom: 28px;
                }

                .success-message strong {
                    color: var(--primary-color);
                    font-weight: 700;
                }

                .footer {
                    text-align: center;
                    margin-top: 24px;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
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
                    .forgot-password-box {
                        padding: 36px 24px;
                        max-width: 100%;
                        border-radius: 20px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ForgotPassword;
