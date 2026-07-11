import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import Products from '../pages/Products.tsx';
import UserOptions from '../pages/UserOptions.tsx';
import ErrorReport from '../pages/ErrorReport';
import Login from '../pages/Login.tsx';
import Signup from '../pages/Signup.tsx';
import AuthCallback from '../pages/AuthCallback.tsx';
import AuthConfirm from '../pages/AuthConfirm.tsx';
import PageNumberingTool from '../pages/Tools/PageNumbering';
import AnnexuresTool from '../pages/Tools/Annexures';
import SignaturesTool from '../pages/Tools/Signatures';
import BookmarksTool from '../pages/Tools/Bookmarks';
import IndexGeneratorTool from '../pages/Tools/IndexGenerator';
import Admin from '../pages/Admin';
import Pricing from '../pages/Pricing';
import RequireAuth from '../components/RequireAuth';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />

      <Route path="/products" element={<Products />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route
        path="/options"
        element={
          <RequireAuth>
            <UserOptions />
          </RequireAuth>
        }
      />
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
      <Route
        path="/tools/index-generator"
        element={
          <RequireAuth>
            <IndexGeneratorTool />
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
  );
};

export default AppRoutes;
