import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/authApi';
import '../styles/Login.css';

export default function AuthConfirm() {
  const navigate = useNavigate();
  const handledRef = useRef(false);

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const handleConfirmation = async () => {
      const urlParams = new URLSearchParams(window.location.search);

      const tokenHash = urlParams.get('token_hash');
      const type = urlParams.get('type');
      const error = urlParams.get('error');

      if (error) {
        setStatus('error');
        setMessage('Email confirmation failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!tokenHash) {
        setStatus('error');
        setMessage('No confirmation token received. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        const response = await authApi.confirmEmail({
          token_hash: tokenHash,
          type: type || 'signup',
        });

        if (response.success) {
          setStatus('success');
          setMessage('Email confirmed. Redirecting...');

          window.history.replaceState({}, document.title, window.location.pathname);

          setTimeout(() => navigate('/'), 1500);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.error ||
          'Failed to confirm email. Please try again.'
        );

        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleConfirmation();
  }, [navigate]);

  return (
    <div className="auth">
      <div className="auth__container">
        <header className="auth__header">
          <h1 className="auth__title">
            {status === 'processing' && 'Confirming Email'}
            {status === 'success' && 'Email Confirmed'}
            {status === 'error' && 'Confirmation Failed'}
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