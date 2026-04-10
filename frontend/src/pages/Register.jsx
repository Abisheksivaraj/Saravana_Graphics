import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Layers, Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import './Auth.css';

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
            <div className="auth-card" style={{ maxWidth: 440 }}>
                <div className="auth-logo">
                    <div className="auth-logo-icon"><Layers size={22} color="white" /></div>
                    <span>Saravana<b>Graphics</b></span>
                </div>
                <h1 className="auth-title">Create Account</h1>
                <p className="auth-subtitle">Start designing labels for free</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label>Full Name</label>
                        <input className="input" type="text" placeholder="John Doe" value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label>Email Address</label>
                        <input className="input" type="email" placeholder="you@example.com" value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="auth-row">
                        <div className="input-group">
                            <label>Password</label>
                            <div className="input-with-icon">
                                <input className="input" type={showPwd ? 'text' : 'password'} placeholder="Min. 6 chars" value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })} />
                                <button type="button" className="input-icon-btn" onClick={() => setShowPwd(!showPwd)}>
                                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Confirm Password</label>
                            <input className="input" type="password" placeholder="Repeat password" value={form.confirm}
                                onChange={e => setForm({ ...form, confirm: e.target.value })} />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                        {loading ? <div className="spinner"></div> : <><UserPlus size={18} /> Create Account</>}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in</Link></p>
                </div>
            </div>
        </div>
    );
}
