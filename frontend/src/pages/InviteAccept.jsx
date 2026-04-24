import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    User, Mail, Lock, CheckCircle2, 
    ArrowRight, Loader2, ShieldCheck,
    Building2, Phone, UserCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import logo from '../assets/logo.png';

import { usersAPI } from '../api';

export default function InviteAccept() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(true);
    const [invitation, setInvitation] = useState(null);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        password: '',
        confirmPassword: '',
        phone: '',
        company: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const verify = async () => {
            try {
                setVerifying(true);
                const res = await usersAPI.verifyInvite(token);
                setInvitation(res.data);
            } catch (err) {
                toast.error(err.response?.data?.message || 'Invalid or expired invitation');
                // navigate('/login');
            } finally {
                setVerifying(false);
                setLoading(false);
            }
        };
        if (token) verify();
    }, [token]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return toast.error('Passwords do not match');
        }

        try {
            setSubmitting(true);
            await usersAPI.completeInvite({
                token,
                ...formData
            });
            
            toast.success('Account created successfully!');
            navigate('/login');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to complete registration');
        } finally {
            setSubmitting(false);
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6">
                    <Loader2 className="animate-spin text-primary" size={32} />
                </div>
                <h1 className="text-xl font-bold text-slate-800">Verifying Invitation</h1>
                <p className="text-slate-500 mt-2">Checking secure invitation token...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 py-20">
            <div className="mb-10 text-center">
                <img src={logo} alt="Saravana Graphics" className="h-14 mx-auto mb-4" />
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                    <ShieldCheck size={14} />
                    Secure Invitation
                </div>
            </div>

            <div className="w-full max-w-xl bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Welcome Side */}
                    <div className="bg-primary p-10 text-white flex flex-col justify-center">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                            <UserCheck size={28} />
                        </div>
                        <h2 className="text-3xl font-bold leading-tight">Welcome to the Team</h2>
                        <p className="text-white/70 mt-4 leading-relaxed">
                            You've been invited as a <span className="text-white font-bold underline capitalize">{invitation?.role}</span>. 
                            Complete your profile to access the dashboard.
                        </p>
                        
                        <div className="mt-8 space-y-4">
                            <div className="flex items-center gap-3 text-white/80 text-sm">
                                <CheckCircle2 size={16} className="text-white" />
                                <span>Collaborative Design</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/80 text-sm">
                                <CheckCircle2 size={16} className="text-white" />
                                <span>Excel Data Processing</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/80 text-sm">
                                <CheckCircle2 size={16} className="text-white" />
                                <span>Instant PDF Export</span>
                            </div>
                        </div>
                    </div>

                    {/* Form Side */}
                    <div className="p-10">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-sm font-medium flex items-center gap-3">
                                    <Mail size={16} />
                                    {invitation?.email}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input 
                                        type="text" 
                                        name="name"
                                        placeholder="Enter your name"
                                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-sm"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                        <input 
                                            type="tel" 
                                            name="phone"
                                            className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-sm"
                                            value={formData.phone}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Company</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                        <input 
                                            type="text" 
                                            name="company"
                                            className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-sm"
                                            value={formData.company}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Create Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input 
                                            type="password" 
                                            name="password"
                                            placeholder="••••••••"
                                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-sm"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input 
                                            type="password" 
                                            name="confirmPassword"
                                            placeholder="••••••••"
                                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none font-medium text-sm"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all disabled:opacity-70 active:scale-95 mt-4"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Finishing Setup...
                                    </>
                                ) : (
                                    <>
                                        Complete Registration
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <p className="mt-8 text-slate-400 text-sm">
                Already have an account? <button onClick={() => navigate('/login')} className="text-primary font-bold hover:underline">Log in here</button>
            </p>
        </div>
    );
}
