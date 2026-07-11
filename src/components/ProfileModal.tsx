import { useRef, useState } from 'react';
import { profileApi, resizeToAvatar, type UserProfile } from '../services/profileApi';
import '../styles/ProfileModal.css';

interface ProfileModalProps {
  firstTime: boolean;
  initial: UserProfile | null;
  email: string;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}

export default function ProfileModal({ firstTime, initial, email, onClose, onSaved }: ProfileModalProps) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [avatar, setAvatar] = useState<string | null>(initial?.avatar ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      setAvatar(await resizeToAvatar(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  };

  const save = async () => {
    const name = username.trim();
    if (!name) {
      setError('Please enter a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const p = await profileApi.save({ username: name, avatar });
      onSaved(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const initialLetter = (username.trim() || email)[0]?.toUpperCase() ?? '?';

  return (
    <div className="pfm__overlay" onClick={onClose}>
      <div className="pfm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="pfm__close" onClick={onClose} aria-label="Close">×</button>

        <h2 className="pfm__title">{firstTime ? 'Welcome to Nomikos 👋' : 'Your profile'}</h2>
        <p className="pfm__subtitle">
          {firstTime
            ? 'Set a display name and photo — it makes your workspace feel like yours.'
            : 'Update your display name or photo anytime.'}
        </p>

        <div className="pfm__avatar-row">
          <button
            type="button"
            className="pfm__avatar"
            onClick={() => fileRef.current?.click()}
            title="Choose a photo"
          >
            {avatar ? (
              <img src={avatar} alt="Profile" className="pfm__avatar-img" />
            ) : (
              <span className="pfm__avatar-letter">{initialLetter}</span>
            )}
            <span className="pfm__avatar-edit">📷</span>
          </button>
          <div className="pfm__avatar-actions">
            <button type="button" className="pfm__link" onClick={() => fileRef.current?.click()}>
              {avatar ? 'Change photo' : 'Add a photo'}
            </button>
            {avatar && (
              <button type="button" className="pfm__link pfm__link--muted" onClick={() => setAvatar(null)}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="pfm__file"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
        </div>

        <label className="pfm__label" htmlFor="pfm-name">Display name</label>
        <input
          id="pfm-name"
          className="pfm__input"
          value={username}
          maxLength={50}
          placeholder="e.g. Adv. Shashank Johri"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
        />
        <p className="pfm__hint">Signed in as {email}</p>

        {error && <p className="pfm__error">{error}</p>}

        <div className="pfm__actions">
          <button className="pfm__btn pfm__btn--primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          <button className="pfm__btn pfm__btn--ghost" disabled={busy} onClick={onClose}>
            {firstTime ? 'Maybe later' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
