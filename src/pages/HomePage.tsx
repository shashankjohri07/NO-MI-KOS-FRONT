import Hero from '../components/Hero';
import Products from './Products';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Landing.css';

const STEPS = [
  {
    num: '01',
    icon: '📄',
    title: 'Upload your PDFs',
    desc: 'Drop your main document and annexure files. We accept multiple volumes — merge them in any order.',
  },
  {
    num: '02',
    icon: '⚙️',
    title: 'Choose what you need',
    desc: 'Page numbers, annexure labels, signatures, bookmarks — pick the tools you need. Preview before processing.',
  },
  {
    num: '03',
    icon: '✓',
    title: 'Download & file',
    desc: 'One click processes everything. Download your court-ready PDF — numbered, signed, bookmarked.',
  },
];

const STATS = [
  { value: '5+', label: 'Filing tools', sub: 'Page numbering, annexures, signatures, bookmarks, index' },
  { value: '< 30s', label: 'Processing time', sub: 'Even for 200+ page documents with annexures' },
  { value: '0', label: 'Files stored', sub: 'Processed in memory, never saved on our servers' },
  { value: '24/7', label: 'Available', sub: 'No office hours — file prep anytime, anywhere' },
];

const PAIN_POINTS = [
  { before: 'Manual page numbering', after: 'Auto-numbered in one pass' },
  { before: 'Annexure labels by hand', after: 'A-1, A-2… stamped automatically' },
  { before: 'Pasting signatures in editor', after: 'Smart placement, background removed' },
  { before: 'Bookmarks? What bookmarks?', after: 'Auto-detected, one-click apply' },
  { before: 'Multiple tools, multiple passes', after: 'Everything in one Document Prep flow' },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <Hero />

      {/* ── How it works ── */}
      <section className="land__section land__section--light" id="how-it-works">
        <div className="land__container">
          <p className="land__eyebrow">How it works</p>
          <h2 className="land__heading">Three steps. One filing-ready PDF.</h2>

          <div className="land__steps">
            {STEPS.map((s) => (
              <div key={s.num} className="land__step">
                <span className="land__step-num">{s.num}</span>
                <span className="land__step-icon">{s.icon}</span>
                <h3 className="land__step-title">{s.title}</h3>
                <p className="land__step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="land__section land__section--dark">
        <div className="land__container">
          <p className="land__eyebrow land__eyebrow--gold">The difference</p>
          <h2 className="land__heading land__heading--light">Before Nomikos vs. After</h2>

          <div className="land__compare">
            <div className="land__compare-col land__compare-col--before">
              <h3 className="land__compare-label">Without Nomikos</h3>
              {PAIN_POINTS.map((p, i) => (
                <div key={i} className="land__compare-row">
                  <span className="land__compare-icon">✗</span>
                  <span>{p.before}</span>
                </div>
              ))}
            </div>
            <div className="land__compare-col land__compare-col--after">
              <h3 className="land__compare-label">With Nomikos</h3>
              {PAIN_POINTS.map((p, i) => (
                <div key={i} className="land__compare-row">
                  <span className="land__compare-icon land__compare-icon--yes">✓</span>
                  <span>{p.after}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tools suite ── */}
      <Products />

      {/* ── Stats ── */}
      <section className="land__section land__section--light">
        <div className="land__container">
          <p className="land__eyebrow">By the numbers</p>
          <h2 className="land__heading">Built for real court filings</h2>

          <div className="land__stats">
            {STATS.map((s) => (
              <div key={s.label} className="land__stat">
                <span className="land__stat-value">{s.value}</span>
                <span className="land__stat-label">{s.label}</span>
                <span className="land__stat-sub">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="land__section land__section--cta">
        <div className="land__container land__cta-inner">
          <h2 className="land__cta-heading">
            Stop losing hours to<br />
            <em>defective filings.</em>
          </h2>
          <p className="land__cta-sub">
            Join advocates and firms across India who prep their court filings in minutes, not hours.
          </p>
          <div className="hero__actions">
            {user ? (
              <Link to="/products" className="btn btn--primary btn--lg">
                Open Dashboard →
              </Link>
            ) : (
              <Link to="/login" className="btn btn--primary btn--lg">
                Get Started Free →
              </Link>
            )}
            <Link to="/pricing" className="btn btn--ghost">
              View Pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land__footer">
        <div className="land__container land__footer-inner">
          <div className="land__footer-brand">
            <span className="land__footer-logo">Nomikos<span className="land__footer-dot">.</span></span>
            <p className="land__footer-tagline">India's Court Filing Intelligence Platform</p>
          </div>
          <div className="land__footer-links">
            <Link to="/products">Products</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/login">Login</Link>
          </div>
          <p className="land__footer-copy">&copy; {new Date().getFullYear()} Nomikos. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
