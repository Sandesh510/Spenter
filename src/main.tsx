import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyFontSize } from './lib/prefs';

applyFontSize();
import './styles/tokens.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/app.css';

if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
  const { installMockApi } = await import('./dev/mockApi');
  installMockApi();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
