import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  
  // Render de app
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Verwijder de loader zodra de JS geladen is
  const removeLoader = () => {
    const loader = document.getElementById('loader-fallback');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.transition = 'opacity 0.5s ease';
      setTimeout(() => loader.remove(), 500);
    }
  };

  // Direct proberen te verwijderen, React render is snel
  if (document.readyState === 'complete') {
    removeLoader();
  } else {
    window.addEventListener('load', removeLoader);
  }
}