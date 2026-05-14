import React from 'react';
import { 
    FileSpreadsheet, FileSearch, CheckCircle2, FileText, 
    CreditCard, Package, Truck, Calendar, MessageSquare, AlertCircle, Trash2
} from 'lucide-react';
import './OrderWorkflow.css';
import FileHistory from './FileHistory';
import { BASE_URL } from '../api';

const STAGES = [
    { id: 'uploaded', label: 'Excel Uploaded', icon: FileSpreadsheet, color: '#6366f1' },
    { id: 'layout', label: 'Layout Ready', icon: FileSearch, color: '#3b82f6' },
    { id: 'artwork', label: 'Artwork Approved', icon: CheckCircle2, color: '#10b981' },
    { id: 'invoice', label: 'Performa Invoice', icon: FileText, color: '#f59e0b' },
    { id: 'payment', label: 'Payment Proof', icon: CreditCard, color: '#ec4899' },
    { id: 'production', label: 'In Production', icon: Package, color: '#8b5cf6' },
    { id: 'delivery', label: 'Delivered', icon: Truck, color: '#14b8a6' }
];

export default function OrderWorkflow({ currentStatus, order, onAction }) {
    // Logic to determine which stage is "active" or "completed"
    const getStageIndex = (status) => {
        const s = status.toLowerCase();
        if (s.includes('excel')) return 0;
        if (s.includes('layout')) return 1;
        if (s.includes('artwork approved')) return 2;
        if (s.includes('artwork rejected') || s.includes('revised artwork uploaded')) return 1;
        if (s.includes('performa')) return 3;
        if (s.includes('payment')) return 4;
        if (s.includes('production')) return 5;
        if (s.includes('delivered') || s.includes('completed')) return 6;
        return 0;
    };

    const currentIndex = getStageIndex(currentStatus);

    return (
        <div className="order-workflow-container">
            <div className="ow-timeline">
                {STAGES.map((stage, index) => {
                    const Icon = stage.icon;
                    const isCompleted = index < currentIndex || (index === 6 && currentStatus === 'Delivered');
                    const isActive = index === currentIndex && currentStatus !== 'Delivered';
                    const isRejected = stage.id === 'layout' && currentStatus === 'Artwork Rejected';

                    return (
                        <React.Fragment key={stage.id}>
                            <div className={`ow-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isRejected ? 'rejected' : ''}`}>
                                <div className="ow-icon-wrap" style={{ '--accent': stage.color }}>
                                    <Icon size={18} />
                                    {(isCompleted || (index === 6 && currentStatus === 'Delivered')) && (
                                        <div className="ow-check">
                                            <CheckCircle2 size={12} fill="#10b981" color="white" />
                                        </div>
                                    )}
                                </div>
                                <span className="ow-label">{stage.label}</span>
                            </div>
                            {index < STAGES.length - 1 && (
                                <div className={`ow-connector ${index < currentIndex ? 'completed' : ''}`}></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            <div className="ow-details-panel">
                <div className="ow-info">
                    <div className="ow-status-badge" data-status={currentStatus.replace(/\s+/g, '-').toLowerCase()}>
                        {currentStatus}
                    </div>
                    {order.productionDate && (
                        <div className="ow-date-tag">
                            <Calendar size={14} />
                            Commitment: {new Date(order.productionDate).toLocaleDateString()}
                        </div>
                    )}
                </div>

                <div className="ow-actions">
                    <button className="ow-btn chat" onClick={() => onAction('chat')}>
                        <MessageSquare size={16} /> Chat
                    </button>

                    <button className="ow-btn delete" onClick={() => onAction('delete')} style={{ color: '#ef4444' }}>
                        <Trash2 size={16} /> Delete
                    </button>
                    
                    {(currentStatus === 'Layout Uploaded' || currentStatus === 'Revised Artwork Uploaded') && (
                        <button className="ow-btn primary" onClick={() => onAction('review')}>
                            {currentStatus === 'Revised Artwork Uploaded' ? 'Review Revised Artwork' : 'Review Layout'}
                        </button>
                    )}

                    {currentStatus === 'Artwork Rejected' && (
                        <button className="ow-btn warning" onClick={() => onAction('revised')}>
                            Upload Revised Artwork
                        </button>
                    )}

                    {currentStatus === 'Artwork Approved' && (
                        <div className="ow-pending-msg">
                            <AlertCircle size={14} /> Waiting for Performa Invoice
                        </div>
                    )}

                    {currentStatus === 'Performa Invoice Uploaded' && (
                        <button className="ow-btn success" onClick={() => onAction('approve-performa')}>
                            Approve Performa Invoice
                        </button>
                    )}

                    {currentStatus === 'Performa Invoice Approved' && (
                        <button className="ow-btn primary" onClick={() => onAction('payment')}>
                            Upload Payment Proof
                        </button>
                    )}

                    {currentStatus === 'Production' && (
                        <button className="ow-btn success" onClick={() => onAction('delivered')}>
                            Confirm Delivery
                        </button>
                    )}

                    {(currentStatus === 'Delivered' || currentStatus === 'Completed') && (
                        <div className="ow-delivery-details" style={{ width: '100%', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px' }}>
                            <div className="ow-pending-msg text-emerald-600" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                                <CheckCircle2 size={18} /> Order Delivered
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                {order.deliveryDate && (
                                    <div className="ow-date-tag" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #d1fae5' }}>
                                        <Calendar size={14} /> 
                                        <span>Delivered: {new Date(order.deliveryDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {order.deliveryProofUrl && (
                                    <button 
                                        className="ow-btn success" 
                                        style={{ fontSize: '0.8rem', padding: '8px 16px', width: 'fit-content' }}
                                        onClick={() => window.open(`${BASE_URL}/${order.deliveryProofUrl.replace(/\\/g, '/')}`, '_blank')}
                                    >
                                        <FileText size={16} /> View POD / Proof
                                    </button>
                                )}
                            </div>

                            {order.deliveryRemarks && (
                                <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.04em' }}>Delivery Remarks</div>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>{order.deliveryRemarks}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {((order.layoutHistory?.length > 0) || (order.revisedArtworkHistory?.length > 0) || (order.reviewHistory?.length > 0)) && (
                <div style={{ marginTop: '16px' }}>
                    <FileHistory
                        layoutHistory={order.layoutHistory || []}
                        revisedArtworkHistory={order.revisedArtworkHistory || []}
                        reviewHistory={order.reviewHistory || []}
                    />
                </div>
            )}
        </div>
    );
}
