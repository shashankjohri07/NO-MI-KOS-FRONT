import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { subscribeForUpdates } from '../services/adminApi';
import '../styles/Login.css';

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const response = await authApi.signup({ email, password });
    if (response.success) {
      // New customer -> event-updates list (fire-and-forget; never blocks signup).
      subscribeForUpdates(email);
      setMessage('Account Created Successfully');
      setTimeout(() => navigate('/login'), 3000);
    } else {
      setError(response.error || 'Signup failed. Please try again.');
    }
    setLoading(false);
  };

  const handleGoogleLogin = () => {
    authApi.initiateGoogleOAuth();
  };

  return (
    <div className="auth">
      <div className="auth__container">
        <header className="auth__header">
          <h1 className="auth__title">Create Account</h1>
          <p className="auth__subtitle">Get started with Nomikos</p>
        </header>

        {error && (
          <div className="auth__error">
            {error}
          </div>
        )}

        {message && (
          <div className="auth__success">
            {message}
          </div>
        )}

        <button
          type="button"
          className="auth__google-btn"
          onClick={handleGoogleLogin}
        >
          <svg className="auth__google-icon" width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth__divider">
          <span>or</span>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          <div className="auth__input-wrapper">
            <label className="auth__input-label" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="auth__input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth__input-wrapper">
            <label className="auth__input-label" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="auth__input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="auth__input-wrapper">
            <label className="auth__input-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              className="auth__input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="auth__btn auth__btn--primary"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth__redirect">
          Already have an account?{' '}
          <Link to="/login" className="auth__link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
