import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Layers, Eye, EyeOff, LogIn, Mail, Lock, Zap, Shield, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Auth.css';

export default function Login() {
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.identifier || !form.password) return toast.error('All fields required');
        setLoading(true);
        try {
            const user = await login(form.identifier, form.password);
            toast.success('Welcome back!');
            if (user.role === 'vendor') {
                navigate('/vendor-portal');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            <div className="auth-bg">
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
            </div>

            <div className="auth-container">
                {/* Left Side: Hero */}
                <div className="auth-hero">
                    <div className="auth-hero-content">
                        <div className="auth-hero-logo">
                            <img src={logo} alt="Saravana Graphics" style={{ height: 100, width: 'auto' }} />
                        </div>
                        <h1 className="auth-hero-title">
                            Pro Level <br />Design Studio.
                        </h1>
                        <p className="auth-hero-subtitle">
                            The ultimate platform for high-performance label manufacturing and cloud-based design coordination.
                        </p>

                        <div className="auth-features">
                            <div className="feature-item">
                                <Zap size={18} color="#7c3aed" />
                                <span>Real-time Sync</span>
                            </div>
                            <div className="feature-item">
                                <Shield size={18} color="#c026d3" />
                                <span>Secure Access</span>
                            </div>
                            <div className="feature-item">
                                <Sparkles size={18} color="#39A3DD" />                                
                                <span>AI Workflows</span>
                            </div>
                            <div className="feature-item">
                                <Layers size={18} color="#10b981" />
                                <span>Auto Layouts</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="auth-form-section">
                    <div className="auth-card-modern">
                        <div className="auth-card-header">
                            <h2>Welcome Back</h2>
                            <p>Enter your credentials to access your studio</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form-modern">
                            <div className="form-field">
                                <label>Username or Email</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" size={18} />
                                    <input 
                                        className="auth-input" 
                                        type="text" 
                                        placeholder="Identification" 
                                        value={form.identifier}
                                        onChange={e => setForm({ ...form, identifier: e.target.value })} 
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label>Password</label>
                                <div className="input-wrapper">
                                    <Lock className="input-icon" size={18} />
                                    <input 
                                        className="auth-input" 
                                        type={showPwd ? 'text' : 'password'} 
                                        placeholder="••••••••" 
                                        value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })} 
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        className="pwd-toggle" 
                                        onClick={() => setShowPwd(!showPwd)}
                                    >
                                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="auth-btn" disabled={loading}>
                                {loading ? <div className="auth-spinner"></div> : <><LogIn size={18} /> Sign In</>}
                            </button>
                        </form>

                        <div className="auth-switch" style={{ marginTop: '24px' }}>
                            Don't have an account? <Link to="/register">Join the Studio</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
