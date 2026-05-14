import { Link } from 'react-router-dom';
import '../styles/Hero.css';

export default function Hero() {
  return (
    <section className="hero hero--solo">
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
    </section>
  );
}
