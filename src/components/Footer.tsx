import { useState } from 'react';
import { useNavLinks } from '../context/ContentContext';
import '../styles/Footer.css';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navLinks = useNavLinks();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  return (
    <>
      {/* ── CTA Section ── */}
      <section className="cta" id="access">
        <div className="cta__glow" aria-hidden="true" />

        <p className="cta__label">Early Access</p>
        <h2 className="cta__title">
          Be among the first
          <br />
          to file without fear
        </h2>
        <p className="cta__sub">
          We're onboarding a limited cohort of legal professionals for early access.
          <br />
          Join now and help shape the platform that changes how India files.
        </p>

        {submitted ? (
          <div className="cta__success">
            <span className="cta__success-icon">✓</span>
            You're on the list — we'll be in touch soon.
          </div>
        ) : (
          <form className="cta__form" onSubmit={handleSubmit}>
            <input
              type="email"
              className="cta__input"
              placeholder="Your professional email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="cta__submit">
              Get Access
            </button>
          </form>
        )}

        <p className="cta__disclaimer">
          No spam. No obligations. Early access is free for the first 100 users.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer__brand">
          <p className="footer__name">Nomikos</p>
          <p className="footer__tagline">Filing Intelligence</p>
        </div>

        <nav className="footer__nav" aria-label="Footer navigation">
          <ul>
            {navLinks.map(({ label, href }) => (
              <li key={href}>
                <a href={href}>{label}</a>
              </li>
            ))}
            <li>
              <a href="#access">Early Access</a>
            </li>
            <li>
              <a href="#">Privacy Policy</a>
            </li>
          </ul>
        </nav>

        <p className="footer__copy">© 2025 Nomikos. All rights reserved.</p>
      </footer>
    </>
  );
}
