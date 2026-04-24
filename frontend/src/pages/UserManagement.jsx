import React, { useState, useEffect } from 'react';
import { 
    Users, UserPlus, Mail, Shield, CheckCircle2, 
    X, AlertCircle, Loader2, Trash2, Search,
    Settings, Filter, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import { usersAPI } from '../api';
import './AdminVendorPortal.css'; // Reuse the professional CSS

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');

    // Invite Form State
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('staff');
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await usersAPI.getAll();
            setUsers(res.data.users);
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail) return toast.error('Please enter an email');

        try {
            setIsInviting(true);
            const res = await usersAPI.invite({ email: inviteEmail, role: inviteRole });
            
            toast.success(`Invitation sent to ${inviteEmail}`);
            if (res.data.inviteLink) {
                console.log('Invite Link:', res.data.inviteLink);
            }

            setIsInviteModalOpen(false);
            setInviteEmail('');
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send invitation');
        } finally {
            setIsInviting(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="admin-portal-layout">
            <Sidebar />

            <main className="ap-main">
                <header className="ap-header">
                    <div className="ap-header-title">
                        <h1>User Team Management</h1>
                        <p>Invite and manage your internal team and staff</p>
                    </div>
                </header>

                <div className="ap-controls" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="flex gap-4 flex-1 max-w-2xl">
                        <div className="ap-search" style={{ flex: 2 }}>
                            <Search size={18} color="var(--text-muted)" />
                            <input 
                                type="text" 
                                placeholder="Search by email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="ap-filter" style={{ flex: 1 }}>
                            <Filter size={18} color="var(--text-muted)" />
                            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                                <option value="all">All Roles</option>
                                <option value="admin">Admin</option>
                                <option value="staff">Staff</option>
                                <option value="vendor">Vendor</option>
                            </select>
                        </div>
                    </div>
                    
                    <button className="btn btn-primary" onClick={() => setIsInviteModalOpen(true)}>
                        <UserPlus size={16} /> Add New User
                    </button>
                </div>

                <div className="ap-table-container shadow-lg border-none">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>Name / Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="text-center p-20"><Loader2 className="animate-spin mx-auto text-primary" size={32} /></td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan="5" className="text-center p-20 text-slate-400 font-medium">No users found.</td></tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user._id}>
                                        <td>
                                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{user.name || user.email.split('@')[0]}</div>
                                            <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{user.email}</small>
                                            <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 800, marginTop: 2 }}>
                                                UID: SG-{user._id?.toString().slice(-4).toUpperCase() || 'NEW'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Shield size={14} className={user.role === 'admin' ? 'text-orange-500' : 'text-slate-400'} />
                                                <span className="capitalize font-semibold text-slate-600">{user.role}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`ap-status-badge ${user.status === 'active' ? 'approved' : 'queued'}`}>
                                                {user.status || 'pending'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="text-slate-500 font-medium">{new Date(user.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="flex justify-end gap-2">
                                                <button className="btn btn-icon btn-ghost"><Settings size={16} /></button>
                                                <button className="btn btn-icon btn-ghost text-red-400"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Invite Modal */}
                {isInviteModalOpen && (
                    <div className="modal-overlay" onClick={() => !isInviting && setIsInviteModalOpen(false)}>
                        <div className="modal shadow-2xl border-none p-0 overflow-hidden" style={{ maxWidth: 500, borderRadius: '32px' }} onClick={e => e.stopPropagation()}>
                            {/* Modal Header */}
                            <div className="bg-orange-500 p-8 text-white relative">
                                <button 
                                    onClick={() => setIsInviteModalOpen(false)}
                                    className="absolute right-6 top-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                                    <UserPlus size={28} />
                                </div>
                                <h2 className="text-2xl font-bold">Invite New Member</h2>
                                <p className="text-white/70 text-sm mt-1">Add internal staff or vendor partners to the team</p>
                            </div>

                            <form onSubmit={handleInvite} className="p-8 space-y-8">
                                <div className="form-group">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                        <input 
                                            type="email" 
                                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all outline-none font-medium"
                                            placeholder="Enter user's email address"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                            disabled={isInviting}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Assign Access Role</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['staff', 'vendor', 'admin'].map((role) => (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setInviteRole(role)}
                                                className={`py-3.5 rounded-2xl border-2 font-bold capitalize transition-all ${
                                                    inviteRole === role 
                                                    ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm' 
                                                    : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-white'
                                                }`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-blue-50/50 p-5 rounded-2xl flex gap-4 border border-blue-100/50">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm flex-shrink-0">
                                        <AlertCircle size={20} />
                                    </div>
                                    <p className="text-[12px] text-blue-800 leading-relaxed font-medium">
                                        The user will receive an automated secure link to set up their profile. Invitations expire in 7 days.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button 
                                        type="button" 
                                        className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                        onClick={() => setIsInviteModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="flex-[2] bg-orange-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-all disabled:opacity-70 active:scale-95" 
                                        disabled={isInviting}
                                    >
                                        {isInviting ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                Send Invitation
                                                <Plus size={20} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
