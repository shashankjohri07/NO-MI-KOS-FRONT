import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { profileApi, type UserProfile } from '../services/profileApi';
import ProfileModal from '../components/ProfileModal';

/**
 * Loads the signed-in user's profile (username + avatar) and owns the profile
 * editor modal. On first login — no profile saved and not previously skipped —
 * the modal opens by itself as a friendly "set up your profile" touch.
 */

const SKIP_KEY = 'nomikos-profile-setup-skipped';

interface ProfileContextType {
  profile: UserProfile | null;
  openEditor: () => void;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [firstTime, setFirstTime] = useState(false);

  const refresh = async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await profileApi.get());
    } catch {
      /* network/auth hiccup — keep whatever we had */
    }
  };

  // On login: load the profile; if none exists, invite the user to create one
  // (once — "skip" is remembered so we never nag).
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await profileApi.get();
        if (cancelled) return;
        setProfile(p);
        if (!p && !localStorage.getItem(SKIP_KEY)) {
          setFirstTime(true);
          setModalOpen(true);
        }
      } catch {
        /* backend unreachable — don't prompt */
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const openEditor = () => {
    setFirstTime(false);
    setModalOpen(true);
  };

  const close = (skipped: boolean) => {
    setModalOpen(false);
    if (skipped && firstTime) localStorage.setItem(SKIP_KEY, '1');
  };

  return (
    <ProfileContext.Provider value={{ profile, openEditor, refresh }}>
      {children}
      {modalOpen && user && (
        <ProfileModal
          firstTime={firstTime}
          initial={profile}
          email={user.email}
          onClose={() => close(true)}
          onSaved={(p) => { setProfile(p); close(false); }}
        />
      )}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (ctx === undefined) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
