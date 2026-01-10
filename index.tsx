import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Verwijder loader na render
  const removeLoader = () => {
    const loader = document.getElementById('loader-fallback');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 400);
    }
  };

  if (document.readyState === 'complete') {
    setTimeout(removeLoader, 500);
  } else {
    window.addEventListener('load', () => setTimeout(removeLoader, 500));
  }
}