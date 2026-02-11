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
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                }

                .forgot-password-box {
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

                .forgot-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
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
                    margin-bottom: 28px;
                }

                .success-message strong {
                    color: #667eea;
                    font-weight: 600;
                }

                .footer {
                    text-align: center;
                    margin-top: 24px;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #667eea;
                    font-weight: 600;
                    font-size: 14px;
                    text-decoration: none;
                    transition: gap 0.2s;
                }

                .back-link:hover {
                    gap: 12px;
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
                    .forgot-password-box {
                        padding: 36px 28px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ForgotPassword;
