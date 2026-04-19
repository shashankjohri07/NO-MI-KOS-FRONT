import { useHeroStats } from '../context/ContentContext';
import '../styles/Hero.css';

export default function Hero() {
  const heroStats = useHeroStats();

  return (
    <section className="hero">
      {/* ── Left: headline + CTAs ── */}
      <div className="hero__left">
        <p className="hero__eyebrow">India's Court Filing Intelligence Platform</p>

        <h1 className="hero__heading">
          File Right.
          <em>First Time.</em>
        </h1>

        <p className="hero__sub">
          The AI layer between your draft and the court registry. Built for every forum. Every
          bench. Zero defects.
        </p>

        <div className="hero__actions">
          <a href="#access" className="btn btn--primary">
            Login/Signup →
          </a>
          <a href="#suite" className="btn btn--ghost">
            Explore Products
          </a>
        </div>
      </div>

      {/* ── Right: dark stats panel ── */}
      <div className="hero__right">
        <p className="hero__right-label">The scale of the problem</p>

        <div className="hero__stats">
          {heroStats.map(({ num, label }) => (
            <div className="hero__stat" key={num}>
              <span className="hero__stat-num">{num}</span>
              <span className="hero__stat-label">{label}</span>
            </div>
          ))}
        </div>

        <span className="hero__deco" aria-hidden="true">
          §
        </span>
      </div>
    </section>
  );
}
