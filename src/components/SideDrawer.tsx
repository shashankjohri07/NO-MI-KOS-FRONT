import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import '../styles/SideDrawer.css';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideDrawer({ isOpen, onClose }: SideDrawerProps) {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { profile, openEditor } = useProfile();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const handleAuthClick = () => {
    onClose();
    navigate('/login');
  };

  const initial = (profile?.username || user?.email || '?')[0]?.toUpperCase();

  return (
    <>
      <div
        className={`side-drawer__overlay ${isOpen ? 'side-drawer__overlay--open' : ''}`}
        onClick={onClose}
      />
      <div className={`side-drawer ${isOpen ? 'side-drawer--open' : ''}`}>
        <button className="side-drawer__close" onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="side-drawer__content">
          {user ? (
            <>
              {/* Profile header — avatar + name, click to edit. */}
              <button className="side-drawer__profile" onClick={() => { onClose(); openEditor(); }}>
                <span className="side-drawer__avatar">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="" className="side-drawer__avatar-img" />
                  ) : (
                    <span className="side-drawer__avatar-letter">{initial}</span>
                  )}
                </span>
                <span className="side-drawer__profile-text">
                  <span className="side-drawer__profile-name">
                    {profile?.username || 'Set up your profile'}
                  </span>
                  <span className="side-drawer__profile-email">{user.email}</span>
                </span>
                <span className="side-drawer__profile-edit">✎</span>
              </button>

              {/* Admin-only workspace switch — normal users never see this. */}
              {isAdmin && (
                <button
                  className="side-drawer__btn side-drawer__btn--admin"
                  onClick={() => { onClose(); navigate('/admin'); }}
                >
                  ◆ Admin Workspace
                </button>
              )}
              <button className="side-drawer__btn" onClick={() => { onClose(); navigate('/pricing'); }}>
                Plans &amp; Pricing
              </button>
              <button className="side-drawer__btn side-drawer__btn--logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="side-drawer__btn side-drawer__btn--primary" onClick={handleAuthClick}>
                LOGIN/SIGNUP
              </button>
              <button className="side-drawer__btn" onClick={() => { onClose(); navigate('/pricing'); }}>
                Plans &amp; Pricing
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
