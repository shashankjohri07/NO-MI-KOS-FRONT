import { useNavLinks } from '../context/ContentContext';
import '../styles/Footer.css';

export default function Footer() {
  const navLinks = useNavLinks();

  return (
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
            <a href="#">Privacy Policy</a>
          </li>
        </ul>
      </nav>

      <p className="footer__copy">© 2025 Nomikos. All rights reserved.</p>
    </footer>
  );
}
