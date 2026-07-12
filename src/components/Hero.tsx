import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Hero.css';

export default function Hero() {
  const { user } = useAuth();

  return (
    <section className="hero">
      <div className="hero__left">
        <p className="hero__eyebrow">India's Court Filing Intelligence Platform</p>

        <h1 className="hero__heading">
          File Right.
          <em>First Time.</em>
        </h1>

        <p className="hero__sub">
          Page numbering, annexures, signatures, bookmarks — everything your filing needs,
          processed in one pass. No more rejection slips.
        </p>

        <div className="hero__actions">
          {user ? (
            <Link to="/options" className="btn btn--primary">
              Open Dashboard →
            </Link>
          ) : (
            <Link to="/login" className="btn btn--primary">
              Get Started Free →
            </Link>
          )}
          <a href="#how-it-works" className="btn btn--ghost">
            How it works ↓
          </a>
        </div>

        <div className="hero__trust">
          <span className="hero__trust-item">✓ No signup needed to explore</span>
          <span className="hero__trust-item">✓ Files never stored</span>
          <span className="hero__trust-item">✓ Free tier available</span>
        </div>
      </div>

      <div className="hero__right">
        <div className="hero__pitch">
          <p className="hero__pitch-num">
            7<span>–</span>8
          </p>
          <p className="hero__pitch-unit">hours</p>
          <p className="hero__pitch-body">
            lost per <em>defective filing</em>.
            <br />
            Multiplied across every matter,
            <br />
            every month, every bench.
          </p>
        </div>
      </div>
    </section>
  );
}
