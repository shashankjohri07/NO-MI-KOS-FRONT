import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNavLinks } from '../context/ContentContext';
import { useAuth } from '../context/AuthContext';
import SideDrawer from './SideDrawer';
import '../styles/Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const navLinks = useNavLinks();
  const { loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <Link to="/" className="navbar__logo">
          Nomikos<span className="navbar__logo-dot">.</span>
        </Link>

        <ul className={`navbar__links ${menuOpen ? 'navbar__links--open' : ''}`}>
          {navLinks.map(({ label, href }) => (
            <li key={href}>
              <a href={href} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="navbar__user-section">
          {!loading && (
            <button
              className="navbar__user-btn"
              onClick={() => setUserDrawerOpen(true)}
              aria-label="User menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </button>
          )}
        </div>

        <button
          className={`navbar__burger ${menuOpen ? 'navbar__burger--open' : ''}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <SideDrawer isOpen={userDrawerOpen} onClose={() => setUserDrawerOpen(false)} />
    </>
  );
}
