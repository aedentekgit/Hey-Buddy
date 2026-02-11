import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { Lock, Mail, Loader2, Bot, User, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: ''
    });
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

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

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="signup-box"
            >
                {/* Logo */}
                <div className="logo-section">
                    <div className="logo">
                        <Bot size={32} />
                    </div>
                    <h1>Join Hey Buddy</h1>
                    <p>Create your account</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="signup-form">
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Full Name</label>
                            <div className="input-wrapper">
                                <User size={18} className="input-icon" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter your name"
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Phone Number</label>
                            <div className="input-wrapper">
                                <Phone size={18} className="input-icon" />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="Enter phone number"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Email</label>
                        <div className="input-wrapper">
                            <Mail size={18} className="input-icon" />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter your email"
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="input-group">
                            <label>Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Create password"
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Confirm Password</label>
                            <div className="input-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Confirm password"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="submit-button">
                        {loading ? (
                            <>
                                <Loader2 className="spin" size={18} />
                                Creating account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="footer">
                    Already have an account?{' '}
                    <Link to="/login" className="login-link">
                        Sign in
                    </Link>
                </div>
            </motion.div>

            <style>{`
                .signup-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 24px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                }

                .signup-box {
                    width: 100%;
                    max-width: 540px;
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

                .signup-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
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

                .footer {
                    text-align: center;
                    margin-top: 28px;
                    font-size: 14px;
                    color: #718096;
                }

                .login-link {
                    color: #667eea;
                    font-weight: 600;
                    text-decoration: none;
                }

                .login-link:hover {
                    text-decoration: underline;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 600px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                    .signup-box {
                        padding: 36px 24px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Signup;
