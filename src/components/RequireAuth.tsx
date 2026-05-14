import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactNode;
}

/**
 * Route gate. While the auth check is in flight, renders a no-op placeholder
 * so the wrapped route doesn't flash. If unauthenticated, redirects to
 * /login and stashes the intended destination so the user lands back here
 * after signing in.
 */
export default function RequireAuth({ children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="auth-loading" aria-hidden="true" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
