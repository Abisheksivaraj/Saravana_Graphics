import React, { useState } from 'react';
import { History, ChevronDown, ChevronUp, ExternalLink, FileSearch, RefreshCw, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { BASE_URL } from '../api';

export default function FileHistory({ layoutHistory = [], revisedArtworkHistory = [], reviewHistory = [], readOnly = false }) {
    const [showLayout, setShowLayout] = useState(false);
    const [showRevised, setShowRevised] = useState(false);
    const [showReview, setShowReview] = useState(false);

    const formatDate = (date) =>
        new Date(date).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

    const HistorySection = ({ title, icon: Icon, color, items, open, onToggle }) => (
        <div style={{
            border: `1px solid ${color}22`,
            borderRadius: '12px',
            background: `${color}08`,
            marginBottom: '10px',
            overflow: 'hidden'
        }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '12px 16px',
                    border: 'none', background: 'transparent', cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={16} color={color} />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{title}</span>
                    <span style={{
                        background: color, color: 'white',
                        borderRadius: '10px', padding: '2px 8px',
                        fontSize: '11px', fontWeight: 800
                    }}>{items.length}</span>
                </div>
                {open ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
            </button>

            {open && (
                <div style={{ borderTop: `1px solid ${color}22` }}>
                    {items.length === 0 ? (
                        <p style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                            No uploads recorded yet.
                        </p>
                    ) : (
                        [...items].reverse().map((entry, idx) => (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 16px',
                                borderBottom: idx < items.length - 1 ? `1px solid ${color}15` : 'none',
                                background: idx === 0 ? `${color}10` : 'white'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '8px',
                                        background: idx === 0 ? color : '#f1f5f9',
                                        color: idx === 0 ? 'white' : '#64748b',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px', fontWeight: 800, flexShrink: 0
                                    }}>
                                        v{entry.version}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                            {idx === 0 ? '✦ Latest' : `Version ${entry.version}`}
                                            {entry.uploadedBy && (
                                                <span style={{ color: '#64748b', fontWeight: 400 }}> · by {entry.uploadedBy}</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                            {formatDate(entry.uploadedAt)}
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href={`${BASE_URL}/${entry.fileUrl}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '6px 12px', borderRadius: '8px',
                                        background: idx === 0 ? color : '#f1f5f9',
                                        color: idx === 0 ? 'white' : '#475569',
                                        fontSize: '12px', fontWeight: 700,
                                        textDecoration: 'none', flexShrink: 0
                                    }}
                                >
                                    <ExternalLink size={12} /> View
                                </a>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );

    const ReviewSection = () => {
        const color = '#f59e0b';
        return (
            <div style={{ border: `1px solid ${color}22`, borderRadius: '12px', background: `${color}08`, marginBottom: '10px', overflow: 'hidden' }}>
                <button
                    onClick={() => setShowReview(v => !v)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <MessageSquare size={16} color={color} />
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>Approval/Rejection History</span>
                        <span style={{ background: color, color: 'white', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 800 }}>{reviewHistory.length}</span>
                    </div>
                    {showReview ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </button>

                {showReview && (
                    <div style={{ borderTop: `1px solid ${color}22` }}>
                        {reviewHistory.length === 0 ? (
                            <p style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8', margin: 0 }}>No reviews recorded yet.</p>
                        ) : (
                            [...reviewHistory].reverse().map((entry, idx) => (
                                <div key={idx} style={{ padding: '12px 16px', borderBottom: idx < reviewHistory.length - 1 ? `1px solid ${color}15` : 'none', background: idx === 0 ? `${color}10` : 'white' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <div style={{ marginTop: '2px' }}>
                                            {entry.status === 'Artwork Approved' ? <CheckCircle2 size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 700, color: entry.status === 'Artwork Approved' ? '#10b981' : '#ef4444' }}>
                                                    {entry.status}
                                                    {entry.reviewedBy && <span style={{ color: '#64748b', fontWeight: 400 }}> · by {entry.reviewedBy}</span>}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{formatDate(entry.reviewedAt)}</div>
                                            </div>
                                            {entry.remarks ? (
                                                <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                    {entry.remarks}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>No remarks provided.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (layoutHistory.length === 0 && revisedArtworkHistory.length === 0 && reviewHistory.length === 0) return null;

    return (
        <div style={{ marginTop: '16px' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '12px'
            }}>
                <History size={14} color="#64748b" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    File Upload History
                </span>
            </div>
            {layoutHistory.length > 0 && (
                <HistorySection
                    title="Layout Proof History"
                    icon={FileSearch}
                    color="#3b82f6"
                    items={layoutHistory}
                    open={showLayout}
                    onToggle={() => setShowLayout(v => !v)}
                />
            )}
            {revisedArtworkHistory.length > 0 && (
                <HistorySection
                    title="Revised Artwork History"
                    icon={RefreshCw}
                    color="#8b5cf6"
                    items={revisedArtworkHistory}
                    open={showRevised}
                    onToggle={() => setShowRevised(v => !v)}
                />
            )}
            {reviewHistory.length > 0 && <ReviewSection />}
        </div>
    );
}
