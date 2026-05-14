import { Link } from 'react-router-dom';
import '../styles/Hero.css';

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__left">
        <p className="hero__eyebrow">India's Court Filing Intelligence Platform</p>

        <h1 className="hero__heading">
          File Right.
          <em>First Time.</em>
        </h1>

        <div className="hero__actions">
          <Link to="/login" className="btn btn--primary">
            Login/Signup →
          </Link>
          <a href="#suite" className="btn btn--ghost">
            Explore Products
          </a>
        </div>
      </div>

      <div className="hero__right">
        <p className="hero__right-label">The stakes</p>

        <div className="hero__pitch">
          <p className="hero__pitch-num">
            12<span>–</span>15
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

        <span className="hero__deco" aria-hidden="true">
          §
        </span>
      </div>
    </section>
  );
}
