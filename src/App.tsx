import Navbar from './components/Navbar';
import AppRoutes from './routes/AppRoutes';
import FeedbackButton from './components/FeedbackButton';
import { ContentProvider } from './context/ContentContext';
import { AuthProvider } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';
import logger from './utils/logger';

logger.info('Application starting');

export default function App() {
  logger.debug('App mounted');

  return (
    <AuthProvider>
      <ProfileProvider>
        <ContentProvider>
          <Navbar />
          <AppRoutes />
          <FeedbackButton />
        </ContentProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
