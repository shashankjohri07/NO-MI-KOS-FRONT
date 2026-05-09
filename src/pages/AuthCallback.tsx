import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import '../styles/Login.css';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const hasExchangedRef = useRef(false);

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    if (hasExchangedRef.current) return;
    hasExchangedRef.current = true;

    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        setStatus('error');
        setMessage('Authentication failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        const response = await authApi.exchangeCode(code);

        if (response.success) {
          setStatus('success');
          setMessage('Successfully signed in! Redirecting...');

          window.history.replaceState({}, document.title, window.location.pathname);

          await checkAuth();
          setTimeout(() => navigate('/detect-errors'), 1500);
        } else {
          setStatus('error');
          setMessage(response.error || 'Failed to complete sign in. Please try again.');
          setTimeout(() => navigate('/login'), 3000);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.error ||
          'Failed to complete sign in. Please try again.'
        );
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="auth">
      <div className="auth__container">
        <header className="auth__header">
          <h1 className="auth__title">
            {status === 'processing' && 'Signing In'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Authentication Failed'}
          </h1>
          <p className="auth__subtitle">{message}</p>
        </header>

        {status === 'processing' && (
          <div className="auth__loading">
            <div className="auth__spinner" />
          </div>
        )}

        {status === 'error' && (
          <button
            type="button"
            className="auth__btn auth__btn--primary"
            onClick={() => navigate('/login')}
            style={{ width: '100%' }}
          >
            Back to Login
          </button>
        )}
      </div>
    </div>
  );
}
