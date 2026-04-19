import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import logger from './utils/logger';

window.onerror = (message, source, lineno, colno, error) => {
  logger.error('Global error caught', { message, source, lineno, colno, stack: error?.stack });
  return false;
};

window.onunhandledrejection = (event) => {
  logger.error('Unhandled promise rejection', { reason: event.reason });
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
