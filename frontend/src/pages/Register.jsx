import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Layers, Eye, EyeOff, UserPlus, User, Mail, Lock, Zap, Shield, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import './Auth.css';
import logo from '../assets/logo.png';

export default function Register() {
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name || !form.email || !form.password) return toast.error('All fields required');
        if (form.password !== form.confirm) return toast.error('Passwords do not match');
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
        setLoading(true);
        try {
            await register(form.name, form.email, form.password);
            toast.success('Account created! Welcome!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed');
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
                            Start Your <br />Design Journey.
                        </h1>
                        <p className="auth-hero-subtitle">
                            Join thousands of professionals creating beautiful, functional labels with our cloud-native design tools.
                        </p>

                        <div className="auth-features">
                            <div className="feature-item">
                                <Zap size={18} color="#7c3aed" />
                                <span>Fast Setup</span>
                            </div>
                            <div className="feature-item">
                                <Shield size={18} color="#c026d3" />
                                <span>Enterprise Grade</span>
                            </div>
                            <div className="feature-item">
                                <Sparkles size={18} color="#39A3DD" />                                
                                <span>Modern Assets</span>
                            </div>
                            <div className="feature-item">
                                <Layers size={18} color="#10b981" />
                                <span>Cloud Ready</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="auth-form-section">
                    <div className="auth-card-modern">
                        <div className="auth-card-header">
                            <h2>Join the Studio</h2>
                            <p>Create your free designer account today</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form-modern">
                            <div className="form-field">
                                <label>Full Name</label>
                                <div className="input-wrapper">
                                    <User className="input-icon" size={18} />
                                    <input 
                                        className="auth-input" 
                                        type="text" 
                                        placeholder="John Carter" 
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })} 
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label>Email Address</label>
                                <div className="input-wrapper">
                                    <Mail className="input-icon" size={18} />
                                    <input 
                                        className="auth-input" 
                                        type="email" 
                                        placeholder="carter@studio.com" 
                                        value={form.email}
                                        onChange={e => setForm({ ...form, email: e.target.value })} 
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                                <div className="form-field">
                                    <label>Confirm</label>
                                    <div className="input-wrapper">
                                        <Lock className="input-icon" size={18} />
                                        <input 
                                            className="auth-input" 
                                            type="password" 
                                            placeholder="••••••••" 
                                            value={form.confirm}
                                            onChange={e => setForm({ ...form, confirm: e.target.value })} 
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="auth-btn" disabled={loading}>
                                {loading ? <div className="auth-spinner"></div> : <><UserPlus size={18} /> Create Account</>}
                            </button>
                        </form>

                        <div className="auth-switch" style={{ marginTop: '24px' }}>
                            Already have an account? <Link to="/login">Sign In</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
