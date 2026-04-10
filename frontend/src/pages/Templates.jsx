import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Search, Grid, List, ChevronRight, ArrowLeft, Layers, Tag, Clock, Cpu } from 'lucide-react';
import { templatesAPI, designsAPI } from '../api';
import { useDesignStore, SIZE_PRESETS } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import './Templates.css';

const CATEGORIES = [
    { id: 'all', label: 'All Templates' },
    { id: 'price-tag', label: 'Price Tags' },
    { id: 'clothing-tag', label: 'Clothing Tags' },
    { id: 'business-card', label: 'Business Cards' },
    { id: 'shipping-label', label: 'Shipping Labels' },
    { id: 'barcode-label', label: 'Barcode Labels' },
];

export default function Templates() {
    const navigate = useNavigate();
    const { loadDesign, setDesignId } = useDesignStore();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [view, setView] = useState('grid');

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await templatesAPI.getAll({ search, category });
            setTemplates(res.data.templates);
        } catch {
            toast.error('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, [search, category]);

    const handleUseTemplate = async (templateId) => {
        try {
            setLoading(true);
            const res = await templatesAPI.getById(templateId);
            const template = res.data.template;

            // Create a new design from this template
            const designPayload = {
                title: `Copy of ${template.title}`,
                canvasWidth: template.canvasWidth,
                canvasHeight: template.canvasHeight,
                canvasUnit: template.canvasUnit,
                backgroundColor: template.backgroundColor,
                sizePreset: template.category,
                elements: template.elements,
                thumbnail: template.thumbnail,
            };

            const designRes = await designsAPI.create(designPayload);
            loadDesign(designRes.data.design);
            toast.success('Template loaded!');
            navigate(`/editor/${designRes.data.design._id}`);
        } catch (err) {
            toast.error('Failed to load template');
        } finally {
            setLoading(false);
        }
    };

    const { isSidebarCollapsed } = useUIStore();

    return (
        <div className={`templates-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />

            <main className="db-main">
                <div className="db-header">
                    <div className="flex items-center gap-4">
                        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1>Template Library</h1>
                            <p>Start with a professionally designed template</p>
                        </div>
                    </div>
                    <div className="db-header-actions">
                        <div className="db-search">
                            <Search size={16} color="var(--text-muted)" />
                            <input
                                placeholder="Search templates..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="input"
                                style={{ border: 'none', background: 'transparent', paddingLeft: 0 }}
                            />
                        </div>
                    </div>
                </div>

                <div className="templates-filter-bar">
                    <div className="tabs">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                className={`tab ${category === cat.id ? 'active' : ''}`}
                                onClick={() => setCategory(cat.id)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="db-content">
                    {loading ? (
                        <div className="db-loading">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-lg)' }}></div>)}
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="db-empty">
                            <div className="db-empty-icon"><LayoutTemplate size={48} color="var(--text-muted)" /></div>
                            <h3>No templates found</h3>
                            <p>Try a different search or category</p>
                        </div>
                    ) : (
                        <div className="template-grid">
                            {templates.map(t => (
                                <div key={t._id} className="template-card" onClick={() => handleUseTemplate(t._id)}>
                                    <div className="template-thumb">
                                        {t.thumbnail ? (
                                            <img src={t.thumbnail} alt={t.title} />
                                        ) : (
                                            <div className="template-thumb-placeholder" style={{ background: t.backgroundColor || '#ffffff' }}>
                                                <span>✨</span>
                                                <small>{t.canvasWidth}×{t.canvasHeight}px</small>
                                            </div>
                                        )}
                                        <div className="template-card-overlay">
                                            <button className="btn btn-primary">Use Template</button>
                                        </div>
                                    </div>
                                    <div className="template-info">
                                        <div className="template-title">{t.title}</div>
                                        <div className="template-meta">
                                            <span><Tag size={11} /> {SIZE_PRESETS[t.category]?.label || t.category}</span>
                                            <span style={{ marginLeft: 'auto' }}>Free</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
