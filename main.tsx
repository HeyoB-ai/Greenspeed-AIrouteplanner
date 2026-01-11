import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Verwijder de loader-overlay zodra de app is geladen
  const removeLoader = () => {
    const loader = document.getElementById('loader-fallback');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.transition = 'opacity 0.4s ease';
      // Verwijder het element uit de DOM na de fade-out
      setTimeout(() => {
        if (loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      }, 400);
    }
  };

  // We wachten heel even tot React klaar is met de eerste render
  if (document.readyState === 'complete') {
    setTimeout(removeLoader, 300);
  } else {
    window.addEventListener('load', () => setTimeout(removeLoader, 300));
  }
}