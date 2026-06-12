import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Feedback.css';

export default function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), email: user?.email ?? null }),
      });
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setMessage(''); }, 2000);
    } catch { /* silent — feedback is best-effort */ }
    setBusy(false);
  };

  return (
    <div className="fb">
      {open && (
        <div className="fb__panel">
          {sent ? (
            <p className="fb__thanks">Thanks for the feedback!</p>
          ) : (
            <>
              <div className="fb__header">
                <span className="fb__title">Give feedback</span>
                <button className="fb__close" type="button" onClick={() => setOpen(false)}>✕</button>
              </div>
              <textarea
                className="fb__textarea"
                placeholder="What's on your mind? A bug, a suggestion, anything."
                value={message}
                rows={4}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) submit(); }}
              />
              <button
                className="fb__submit"
                type="button"
                disabled={busy || !message.trim()}
                onClick={submit}
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </div>
      )}
      <button
        className={`fb__trigger${open ? ' fb__trigger--open' : ''}`}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Give feedback"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </div>
  );
}
