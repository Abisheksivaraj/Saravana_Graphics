import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Templates from './pages/Templates';
import RFIDFormat from './pages/RFIDFormat';
import Layout from './pages/Layout';
import VendorLayout from './pages/vendor/VendorLayout';
import DashboardVendor from './pages/vendor/Dashboard';
import CreateOrder from './pages/vendor/CreateOrder';
import ArtworkApproval from './pages/vendor/ArtworkApproval';
import Payments from './pages/vendor/Payments';
import AdminVendorPortal from './pages/AdminVendorPortal';
import AdminVendorManager from './pages/AdminVendorManager';

function ProtectedRoute({ children, allowedRoles }) {
  const { token, user, isLoading } = useAuthStore();
  if (isLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="spinner" style={{ width: 40, height: 40 }}></div>
    </div>
  );
  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'vendor' ? '/vendor-portal' : '/dashboard'} replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { token, user, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (token && user) {
    if (user.role === 'vendor') return <Navigate to="/vendor-portal" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  const { init } = useAuthStore();
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', fontFamily: 'Inter, sans-serif', fontSize: '14px' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Shared Dashboard (Admin/User) */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'user']}><Dashboard /></ProtectedRoute>} />
        <Route path="/editor" element={<ProtectedRoute allowedRoles={['admin', 'user']}><Editor /></ProtectedRoute>} />
        <Route path="/editor/:id" element={<ProtectedRoute allowedRoles={['admin', 'user']}><Editor /></ProtectedRoute>} />
        <Route path="/templates" element={<ProtectedRoute allowedRoles={['admin', 'user']}><Templates /></ProtectedRoute>} />
        <Route path="/rfid-format" element={<ProtectedRoute allowedRoles={['admin', 'user']}><RFIDFormat /></ProtectedRoute>} />
        <Route path="/layout" element={<ProtectedRoute allowedRoles={['admin', 'user']}><Layout /></ProtectedRoute>} />

        {/* Vendor Portal Routes */}
        <Route path="/vendor-portal" element={<ProtectedRoute allowedRoles={['vendor']}><VendorLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardVendor />} />
          <Route path="create" element={<CreateOrder />} />
          <Route path="artwork" element={<ArtworkApproval />} />
          <Route path="payments" element={<Payments />} />
        </Route>
        <Route path="/admin/vendor-portal" element={<ProtectedRoute allowedRoles={['admin']}><AdminVendorPortal /></ProtectedRoute>} />
        <Route path="/admin/vendors" element={<ProtectedRoute allowedRoles={['admin']}><AdminVendorManager /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
