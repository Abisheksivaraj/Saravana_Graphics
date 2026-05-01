import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Layers, Eye, EyeOff, LogIn, Mail, Lock, Zap, Shield, Sparkles, Factory, ShoppingCart, User } from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';
import './Auth.css';

export default function Login() {
    const [searchParams] = useSearchParams();
    const [portalType, setPortalType] = useState('admin'); // 'admin', 'vendor', 'buyer'
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        const type = searchParams.get('type');
        if (type === 'vendor' || type === 'buyer') {
            setPortalType(type);
        } else {
            setPortalType('admin');
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.identifier || !form.password) return toast.error('All fields required');
        setLoading(true);
        try {
            const user = await login(form.identifier, form.password);
            toast.success('Welcome back!');
            if (user.role === 'vendor') {
                navigate('/vendor-portal');
            } else if (user.role === 'buyer') {
                navigate('/buyer/dashboard');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally { setLoading(false); }
    };

    const portalConfig = {
        admin: {
            title: <>Pro Level <br />Design Studio.</>,
            subtitle: "The ultimate platform for high-performance label manufacturing and cloud-based design coordination.",
            features: [
                { icon: <Zap size={18} color="#7c3aed" />, text: "Real-time Sync" },
                { icon: <Shield size={18} color="#c026d3" />, text: "Secure Access" },
                { icon: <Sparkles size={18} color="#39A3DD" />, text: "AI Workflows" },
                { icon: <Layers size={18} color="#10b981" />, text: "Auto Layouts" },
            ],
            formTitle: "Welcome Back",
            formSubtitle: "Enter your credentials to access your studio",
            showRegister: true
        },
        vendor: {
            title: <>Vendor <br />Supply Chain.</>,
            subtitle: "Manage your orders, upload layout proofs, and track dispatch status seamlessly in real-time.",
            features: [
                { icon: <Layers size={18} color="#7c3aed" />, text: "Upload Proofs" },
                { icon: <Zap size={18} color="#10b981" />, text: "Track Dispatch" },
                { icon: <Shield size={18} color="#c026d3" />, text: "View Approvals" },
                { icon: <Lock size={18} color="#39A3DD" />, text: "Secure Portal" },
            ],
            formTitle: "Vendor Login",
            formSubtitle: "Enter your credentials to access your supply portal",
            showRegister: false
        },
        buyer: {
            title: <>Buyer <br />Dashboard.</>,
            subtitle: "Monitor vendor performance, track order history, and ensure seamless quality control.",
            features: [
                { icon: <Eye size={18} color="#39A3DD" />, text: "Track Vendors" },
                { icon: <Layers size={18} color="#c026d3" />, text: "Order History" },
                { icon: <Shield size={18} color="#10b981" />, text: "Quality Control" },
                { icon: <Zap size={18} color="#7c3aed" />, text: "Real-time Sync" },
            ],
            formTitle: "Buyer Login",
            formSubtitle: "Enter your credentials to access your dashboard",
            showRegister: false
        }
    };

    const currentConfig = portalConfig[portalType];

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
                            {currentConfig.title}
                        </h1>
                        <p className="auth-hero-subtitle">
                            {currentConfig.subtitle}
                        </p>

                        <div className="auth-features">
                            {currentConfig.features.map((feat, idx) => (
                                <div key={idx} className="feature-item">
                                    {feat.icon}
                                    <span>{feat.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="auth-form-section">
                    <div className="auth-card-modern">
                        <div className="auth-card-header">
                            <h2>{currentConfig.formTitle}</h2>
                            <p>{currentConfig.formSubtitle}</p>
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

                        {currentConfig.showRegister && (
                            <div className="auth-switch" style={{ marginTop: '24px' }}>
                                Don't have an account? <Link to="/register">Join the Studio</Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
