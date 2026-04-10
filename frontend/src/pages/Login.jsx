import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Layers, Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import './Auth.css';

export default function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
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
            } else if (user.role === 'admin') {
                navigate('/dashboard');
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
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="auth-logo-icon"><Layers size={22} color="white" /></div>
                    <span>Saravana<b>Graphics</b></span>
                </div>
                <h1 className="auth-title">Welcome Back</h1>
                <p className="auth-subtitle">Sign in to your design studio</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="input-group">
                        <label>Username or Email</label>
                        <input className="input" type="text" placeholder="Enter identifier" value={form.identifier}
                            onChange={e => setForm({ ...form, identifier: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label>Password</label>
                        <div className="input-with-icon">
                            <input className="input" type={showPwd ? 'text' : 'password'} placeholder="Enter password" value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })} />
                            <button type="button" className="input-icon-btn" onClick={() => setShowPwd(!showPwd)}>
                                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                        {loading ? <div className="spinner"></div> : <><LogIn size={18} /> Sign In</>}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Don't have an account? <Link to="/register">Create one</Link></p>
                </div>
            </div>
        </div>
    );
}
