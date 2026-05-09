import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import UserOptions from '../pages/UserOptions.tsx';
import ErrorReport from '../pages/ErrorReport.tsx';
import Login from '../pages/Login.tsx';
import Signup from '../pages/Signup.tsx';
import AuthCallback from '../pages/AuthCallback.tsx';
import AuthConfirm from '../pages/AuthConfirm.tsx';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<AuthConfirm />} />
      <Route path="/options" element={<UserOptions />} />
      <Route path="/detect-errors" element={<ErrorReport />} />
    </Routes>
  );
};

export default AppRoutes;
