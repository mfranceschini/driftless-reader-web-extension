import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WelcomeApp } from './WelcomeApp';
import '@/src/pages/pages.css';
import './welcome.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <WelcomeApp />
    </StrictMode>,
  );
}
