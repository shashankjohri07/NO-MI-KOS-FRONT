import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage.tsx';
import UserOptions from '../pages/UserOptions.tsx';
import ErrorReport from '../pages/ErrorReport.tsx';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/options" element={<UserOptions />} />
      <Route path="/detect-errors" element={<ErrorReport />} />
    </Routes>
  );
};

export default AppRoutes;
