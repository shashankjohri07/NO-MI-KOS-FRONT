import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, AuthResponse } from '../services/authApi';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response: AuthResponse = await authApi.getMe();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
        if (
          window.location.pathname !== '/' &&
          !window.location.pathname.startsWith('/auth/') &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/signup'
        ) {
          navigate('/', { replace: true });
        }
      }
    } catch {
      setUser(null);
      if (
        window.location.pathname !== '/' &&
        !window.location.pathname.startsWith('/auth/') &&
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/signup'
      ) {
        navigate('/', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
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
    <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
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
