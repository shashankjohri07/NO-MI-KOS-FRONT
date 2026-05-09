import Navbar from './components/Navbar';
import AppRoutes from './routes/AppRoutes';
import { ContentProvider } from './context/ContentContext';
import { AuthProvider } from './context/AuthContext';
import logger from './utils/logger';

logger.info('Application starting');

export default function App() {
  logger.debug('App mounted');

  return (
    <AuthProvider>
      <ContentProvider>
        <Navbar />
        <AppRoutes />
      </ContentProvider>
    </AuthProvider>
  );
}
