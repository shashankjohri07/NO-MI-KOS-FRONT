import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, AuthResponse } from '../services/authApi';
import { adminApi } from '../services/adminApi';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pure state — RequireAuth handles route gating/redirects. Keeping
  // navigation out of here avoids races between this on-mount check and
  // the route-level guard. Identity comes from the auth service (getMe);
  // the admin flag comes from our own backend (whoami) — both run in
  // parallel and a whoami failure simply means "not an admin".
  const checkAuth = async () => {
    try {
      const [meRes, whoRes] = await Promise.allSettled([authApi.getMe(), adminApi.whoami()]);
      const me: AuthResponse | null = meRes.status === 'fulfilled' ? meRes.value : null;
      if (me?.success && me.data?.user) {
        setUser(me.data.user);
      } else {
        setUser(null);
      }
      setIsAdmin(whoRes.status === 'fulfilled' && whoRes.value.isAdmin === true);
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setIsAdmin(false);
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => {
    const path = window.location.pathname;
    if (
      path.startsWith('/auth/') ||
      path === '/login' ||
      path === '/signup'
    ) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
