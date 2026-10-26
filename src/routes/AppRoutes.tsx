import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import RequireAuth from '../components/RequireAuth';
import RouteLoader from '../components/RouteLoader';

// Everything but the landing page is lazy-loaded — splits the ~800KB single
// bundle into one chunk per route, so a first-time visitor only downloads
// HomePage before they've even picked a tool.
const Products = lazy(() => import('../pages/Products.tsx'));
const ErrorReport = lazy(() => import('../pages/ErrorReport'));
const Login = lazy(() => import('../pages/Login.tsx'));
const Signup = lazy(() => import('../pages/Signup.tsx'));
const AuthCallback = lazy(() => import('../pages/AuthCallback.tsx'));
const AuthConfirm = lazy(() => import('../pages/AuthConfirm.tsx'));
const PageNumberingTool = lazy(() => import('../pages/Tools/PageNumbering'));
const AnnexuresTool = lazy(() => import('../pages/Tools/Annexures'));
const SignaturesTool = lazy(() => import('../pages/Tools/Signatures'));
const BookmarksTool = lazy(() => import('../pages/Tools/Bookmarks'));
const Admin = lazy(() => import('../pages/Admin'));
const Pricing = lazy(() => import('../pages/Pricing'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />

        <Route path="/products" element={<Products />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/prep"
          element={
            <RequireAuth>
              <ErrorReport />
            </RequireAuth>
          }
        />
        <Route
          path="/detect-errors"
          element={
            <RequireAuth>
              <ErrorReport />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/page-numbering"
          element={
            <RequireAuth>
              <PageNumberingTool />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/annexures"
          element={
            <RequireAuth>
              <AnnexuresTool />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/signatures"
          element={
            <RequireAuth>
              <SignaturesTool />
            </RequireAuth>
          }
        />
        <Route
          path="/tools/bookmarks"
          element={
            <RequireAuth>
              <BookmarksTool />
            </RequireAuth>
          }
        />
        {/* Admin dashboard — RequireAuth ensures a session exists; the page
            itself asks the backend whoami and bounces non-admins home. */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
