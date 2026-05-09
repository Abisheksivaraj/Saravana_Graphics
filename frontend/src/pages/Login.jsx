import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
    Layers, Eye, EyeOff, LogIn, Mail, Lock, Zap, Shield, Sparkles,
    Factory, ShoppingCart, User, RefreshCw, CheckCircle2, ShieldCheck,
    Key, ArrowRight, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/mainlogo.png';
import { authAPI } from '../api';
import './Auth.css';

export default function Login() {
    const [searchParams] = useSearchParams();
    const [portalType, setPortalType] = useState('admin');
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);

    // Captcha State
    const [captcha, setCaptcha] = useState({ q: '', a: null });
    const [userCaptcha, setUserCaptcha] = useState('');

    // Flow States
    const [view, setView] = useState('login'); // 'login', 'forgot', 'otp', 'reset', 'firstLogin'
    const [forgotEmail, setForgotEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newCreds, setNewCreds] = useState({ username: '', password: '', confirm: '' });

    const { login, user: authUser } = useAuthStore();
    const navigate = useNavigate();

    const generateCaptcha = () => {
        const n1 = Math.floor(Math.random() * 10);
        const n2 = Math.floor(Math.random() * 10);
        setCaptcha({ q: `${n1} + ${n2} = ?`, a: n1 + n2 });
        setUserCaptcha('');
    };

    useEffect(() => {
        const type = searchParams.get('type');
        if (type === 'vendor' || type === 'buyer') {
            setPortalType(type);
        } else {
            setPortalType('admin');
        }
        generateCaptcha();
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.identifier || !form.password) return toast.error('All fields required');

        // Vendor/Buyer requirement: Captcha
        if (portalType !== 'admin') {
            if (parseInt(userCaptcha) !== captcha.a) {
                toast.error('Incorrect Captcha answer');
                generateCaptcha();
                return;
            }
        }

        setLoading(true);
        try {
            const user = await login(form.identifier, form.password);
            toast.success('Welcome back!');

            // First Login Logic
            if (user.role === 'vendor' && user.isFirstLogin) {
                setNewCreds({ username: user.username, password: '', confirm: '' });
                setView('firstLogin');
                return;
            }

            redirectUser(user);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
            generateCaptcha();
        } finally { setLoading(false); }
    };

    const redirectUser = (u) => {
        if (u.role === 'vendor') navigate('/vendor-portal');
        else if (u.role === 'buyer') navigate('/buyer/dashboard');
        else navigate('/dashboard');
    };

    const handleUpdateCreds = async (e) => {
        e.preventDefault();
        if (newCreds.password && newCreds.password !== newCreds.confirm) return toast.error('Passwords do not match');

        setLoading(true);
        try {
            await authAPI.updateCredentials({
                username: newCreds.username,
                password: newCreds.password || undefined
            });
            toast.success('Credentials updated!');
            redirectUser(authUser);
        } catch (err) {
            toast.error('Update failed');
        } finally { setLoading(false); }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authAPI.forgotPassword(forgotEmail);
            toast.success('OTP sent to your email');
            setView('otp');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send OTP');
        } finally { setLoading(false); }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authAPI.verifyOtp(forgotEmail, otp);
            setView('reset');
        } catch (err) {
            toast.error('Invalid OTP');
        } finally { setLoading(false); }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (newCreds.password !== newCreds.confirm) return toast.error('Passwords do not match');
        setLoading(true);
        try {
            await authAPI.resetPassword(forgotEmail, otp, newCreds.password);
            toast.success('Password updated! Please login.');
            setView('login');
        } catch (err) {
            toast.error('Reset failed');
        } finally { setLoading(false); }
    };

    const portalConfig = {
        admin: {
            title: <>Pro Level <br />Design Studio.</>,
            subtitle: "The ultimate platform for high-performance label manufacturing.",
            formTitle: "Admin Login",
            showRegister: true
        },
        vendor: {
            title: <>Vendor <br />Supply Chain.</>,
            subtitle: "Manage orders and track dispatch status seamlessly in real-time.",
            formTitle: "Vendor Login",
            showRegister: false
        },
        buyer: {
            title: <>Buyer <br />Dashboard.</>,
            subtitle: "Monitor vendor performance and track order history.",
            formTitle: "Buyer Login",
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
                <div className="auth-hero">
                    <div className="auth-hero-content" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img
                            src={logo}
                            alt="Saravana Graphics"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                padding: '40px'
                            }}
                        />
                    </div>
                </div>

                <div className="auth-form-section">
                    <div className="auth-card-modern">
                        {view === 'login' && (
                            <>
                                <div className="portal-switcher">
                                    {['admin', 'vendor', 'buyer'].map(t => (
                                        <button
                                            key={t}
                                            className={`portal-btn ${portalType === t ? 'active' : ''}`}
                                            onClick={() => {
                                                setPortalType(t);
                                                navigate(`/login?type=${t}`, { replace: true });
                                            }}
                                        >
                                            {t === 'admin' ? <Shield size={16} /> : t === 'vendor' ? <Factory size={16} /> : <ShoppingCart size={16} />}
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                <div className="auth-card-header">
                                    <h2>{currentConfig.formTitle}</h2>
                                    <p>Access your portal with secure credentials</p>
                                </div>

                                <form onSubmit={handleSubmit} className="auth-form-modern">
                                    <div className="form-field">
                                        <label>Username or Email</label>
                                        <div className="input-wrapper">
                                            <Mail className="input-icon" size={18} />
                                            <input
                                                className="auth-input" type="text" placeholder="Identification"
                                                value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-field">
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <label>Password</label>
                                            {portalType !== 'admin' && (
                                                <button type="button" onClick={() => setView('forgot')} className="text-link" style={{ fontSize: '11px', border: 'none', background: 'none' }}>Forgot?</button>
                                            )}
                                        </div>
                                        <div className="input-wrapper">
                                            <Lock className="input-icon" size={18} />
                                            <input
                                                className="auth-input" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                                                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
                                            />
                                            <button type="button" className="pwd-toggle" onClick={() => setShowPwd(!showPwd)}>{showPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                        </div>
                                    </div>

                                    {/* Captcha Section */}
                                    {portalType !== 'admin' && (
                                        <div className="form-field">
                                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                Verification Code
                                                <span style={{ color: '#f97316', fontWeight: 900 }}>{captcha.q}</span>
                                            </label>
                                            <div className="input-wrapper">
                                                <ShieldCheck className="input-icon" size={18} />
                                                <input
                                                    className="auth-input" type="number" placeholder="Enter answer"
                                                    value={userCaptcha} onChange={e => setUserCaptcha(e.target.value)} required
                                                />
                                                <button type="button" className="pwd-toggle" onClick={generateCaptcha}><RefreshCw size={16} /></button>
                                            </div>
                                        </div>
                                    )}

                                    <button type="submit" className="auth-btn" disabled={loading}>
                                        {loading ? <div className="auth-spinner"></div> : <><LogIn size={18} /> Sign In</>}
                                    </button>
                                </form>
                            </>
                        )}

                        {view === 'forgot' && (
                            <div className="onboarding-view">
                                <div className="auth-card-header">
                                    <Key size={32} color="#f97316" style={{ marginBottom: 12 }} />
                                    <h2>Forgot Password</h2>
                                    <p>Enter your registered email to receive an OTP.</p>
                                </div>
                                <form onSubmit={handleForgotPassword} className="auth-form-modern">
                                    <div className="form-field">
                                        <label>Email Address</label>
                                        <div className="input-wrapper">
                                            <Mail className="input-icon" size={18} />
                                            <input
                                                className="auth-input" type="email" placeholder="vendor@example.com"
                                                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="auth-btn" disabled={loading}>
                                        {loading ? 'Sending...' : 'Send OTP'}
                                    </button>
                                    <button type="button" onClick={() => setView('login')} className="auth-btn-ghost">Back to Login</button>
                                </form>
                            </div>
                        )}

                        {view === 'otp' && (
                            <div className="onboarding-view">
                                <div className="auth-card-header">
                                    <ShieldCheck size={32} color="#10b981" style={{ marginBottom: 12 }} />
                                    <h2>Verify OTP</h2>
                                    <p>We've sent a 6-digit code to <b>{forgotEmail}</b></p>
                                </div>
                                <form onSubmit={handleVerifyOtp} className="auth-form-modern">
                                    <div className="form-field">
                                        <div className="input-wrapper">
                                            <Lock className="input-icon" size={18} />
                                            <input
                                                className="auth-input" style={{ textAlign: 'center', letterSpacing: 8, fontWeight: 900, fontSize: 24 }}
                                                maxLength={6} placeholder="000000"
                                                value={otp} onChange={e => setOtp(e.target.value)} required
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="auth-btn" disabled={loading}>Verify & Continue</button>
                                </form>
                            </div>
                        )}

                        {view === 'reset' && (
                            <div className="onboarding-view">
                                <div className="auth-card-header">
                                    <h2>Reset Password</h2>
                                    <p>Choose a strong new password for your account.</p>
                                </div>
                                <form onSubmit={handleResetPassword} className="auth-form-modern">
                                    <div className="form-field">
                                        <label>New Password</label>
                                        <input
                                            className="auth-input" type="password" placeholder="••••••••"
                                            value={newCreds.password} onChange={e => setNewCreds({ ...newCreds, password: e.target.value })} required
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label>Confirm Password</label>
                                        <input
                                            className="auth-input" type="password" placeholder="••••••••"
                                            value={newCreds.confirm} onChange={e => setNewCreds({ ...newCreds, confirm: e.target.value })} required
                                        />
                                    </div>
                                    <button type="submit" className="auth-btn" disabled={loading}>Update Password</button>
                                </form>
                            </div>
                        )}

                        {view === 'firstLogin' && (
                            <div className="onboarding-view">
                                <div className="auth-card-header">
                                    <Shield size={32} color="#f97316" style={{ marginBottom: 12 }} />
                                    <h2>Welcome to SG Portal</h2>
                                    <p>As this is your first login, you may personalize your credentials.</p>
                                </div>
                                <form onSubmit={handleUpdateCreds} className="auth-form-modern">
                                    <div className="form-field">
                                        <label>Custom Username</label>
                                        <div className="input-wrapper">
                                            <User className="input-icon" size={18} />
                                            <input
                                                className="auth-input" value={newCreds.username}
                                                onChange={e => setNewCreds({ ...newCreds, username: e.target.value })} required
                                            />
                                        </div>
                                    </div>
                                    <div className="form-field">
                                        <label>New Password (Optional)</label>
                                        <div className="input-wrapper">
                                            <Lock className="input-icon" size={18} />
                                            <input
                                                className="auth-input" type="password" placeholder="Leave blank to keep current"
                                                value={newCreds.password} onChange={e => setNewCreds({ ...newCreds, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    {newCreds.password && (
                                        <div className="form-field">
                                            <label>Confirm Password</label>
                                            <input
                                                className="auth-input" type="password" placeholder="Confirm new password"
                                                value={newCreds.confirm} onChange={e => setNewCreds({ ...newCreds, confirm: e.target.value })} required
                                            />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button type="button" onClick={() => redirectUser(authUser)} className="auth-btn-ghost" style={{ flex: 1 }}>Skip</button>
                                        <button type="submit" className="auth-btn" style={{ flex: 2 }} disabled={loading}>Save & Continue</button>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
