import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, Tag, BarChart2, CreditCard, Truck, Shirt, ChevronRight, Zap, Shield, Download } from 'lucide-react';
import './Landing.css';

const features = [
    { icon: <Tag size={24} />, title: 'Price Tags', desc: 'Design retail price tags with MRP, barcode & product info' },
    { icon: <Shirt size={24} />, title: 'Clothing Labels', desc: 'Create garment tags with size, material & care instructions' },
    { icon: <BarChart2 size={24} />, title: 'Barcodes & QR', desc: 'Generate CODE128, EAN, QR codes automatically' },
    { icon: <CreditCard size={24} />, title: 'Business Cards', desc: 'Professional business card designs in any style' },
    { icon: <Truck size={24} />, title: 'Shipping Labels', desc: 'Shipping & logistics labels with custom info' },
    { icon: <Layers size={24} />, title: 'Custom Sizes', desc: 'Design at any size — mm, cm, inches or pixels' },
];

const sizes = [
    { name: 'Price Tag', dims: '5cm × 7.5cm', color: '#6c63ff' },
    { name: 'Business Card', dims: '8.5cm × 5.4cm', color: '#ff6584' },
    { name: 'Shipping Label', dims: '10cm × 7.5cm', color: '#22c55e' },
    { name: 'Clothing Tag', dims: '4.5cm × 9cm', color: '#f59e0b' },
    { name: 'Barcode Label', dims: '7.5cm × 3.8cm', color: '#06b6d4' },
    { name: 'Custom', dims: 'Any size', color: '#8b5cf6' },
];

export default function Landing() {
    return (
        <div className="landing">
            {/* Navbar */}
            <nav className="landing-nav">
                <div className="landing-nav-inner">
                    <div className="landing-logo">
                        <div className="landing-logo-icon"><Layers size={22} color="white" /></div>
                        <span>Saravana<b>Graphics</b></span>
                    </div>
                    <div className="landing-nav-links">
                        <a href="#features">Features</a>
                        <a href="#sizes">Sizes</a>
                    </div>
                    <div className="landing-nav-actions">
                        <Link to="/login" className="btn btn-ghost">Sign In</Link>
                        <Link to="/register" className="btn btn-primary">Get Started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="hero-bg-orbs">
                    <div className="orb orb-1"></div>
                    <div className="orb orb-2"></div>
                    <div className="orb orb-3"></div>
                </div>
                <div className="hero-content">
                    <div className="hero-badge"><Zap size={14} /> Professional Label Design Studio</div>
                    <h1 className="hero-title">
                        Design Labels &<br />
                        <span className="hero-gradient">Cards Like a Pro</span>
                    </h1>
                    <p className="hero-desc">
                        The all-in-one label designer combining Bartender's printing power with CorelDraw's design freedom.
                        Create price tags, barcodes, QR codes, business cards and more.
                    </p>
                    <div className="hero-actions">
                        <Link to="/register" className="btn btn-primary btn-lg">
                            Start Designing Free <ChevronRight size={18} />
                        </Link>
                        <Link to="/login" className="btn btn-secondary btn-lg">Sign In</Link>
                    </div>
                    <div className="hero-stats">
                        <div className="hero-stat"><span>10+</span>Label Types</div>
                        <div className="hero-stat-sep"></div>
                        <div className="hero-stat"><span>6</span>Size Presets</div>
                        <div className="hero-stat-sep"></div>
                        <div className="hero-stat"><span>∞</span>Custom Sizes</div>
                    </div>
                </div>
                {/* Mock canvas preview */}
                <div className="hero-preview">
                    <div className="preview-card">
                        <div className="preview-toolbar">
                            <div className="preview-dot red"></div>
                            <div className="preview-dot yellow"></div>
                            <div className="preview-dot green"></div>
                            <span>Label Designer</span>
                        </div>
                        <div className="preview-canvas">
                            <div className="preview-label">
                                <div className="preview-label-stripe"></div>
                                <div className="preview-label-price">₹599.00</div>
                                <div className="preview-label-size">Size: M | 92 cm</div>
                                <div className="preview-label-bars">
                                    {Array(12).fill(0).map((_, i) => <div key={i} className="bar" style={{ height: 20 + (i % 3) * 10 }}></div>)}
                                </div>
                                <div className="preview-label-num">8 9051 3411 803</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="landing-features" id="features">
                <div className="section-inner">
                    <div className="section-header">
                        <span className="section-badge"><Shield size={14} /> Built for Professionals</span>
                        <h2>Everything You Need</h2>
                        <p>Powerful tools for every label and card design use case</p>
                    </div>
                    <div className="features-grid">
                        {features.map((f, i) => (
                            <div key={i} className="feature-card">
                                <div className="feature-icon">{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Sizes */}
            <section className="landing-sizes" id="sizes">
                <div className="section-inner">
                    <div className="section-header">
                        <span className="section-badge"><Download size={14} /> Print Ready</span>
                        <h2>Every Size Supported</h2>
                        <p>From tiny barcode labels to full A4 pages — we've got you covered</p>
                    </div>
                    <div className="sizes-grid">
                        {sizes.map((s, i) => (
                            <div key={i} className="size-chip" style={{ '--chip-color': s.color }}>
                                <div className="size-chip-dot"></div>
                                <div>
                                    <div className="size-chip-name">{s.name}</div>
                                    <div className="size-chip-dims">{s.dims}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="landing-cta">
                <div className="cta-inner">
                    <h2>Ready to Design?</h2>
                    <p>Join thousands of designers creating stunning labels every day</p>
                    <Link to="/register" className="btn btn-primary btn-lg">
                        Create Free Account <ChevronRight size={18} />
                    </Link>
                </div>
            </section>

            <footer className="landing-footer">
                <div className="footer-inner">
                    <div className="landing-logo">
                        <div className="landing-logo-icon"><Layers size={18} color="white" /></div>
                        <span>Saravana<b>Graphics</b></span>
                    </div>
                    <p>© 2026 Saravana Graphics. Professional Label & Card Designer.</p>
                </div>
            </footer>
        </div>
    );
}
