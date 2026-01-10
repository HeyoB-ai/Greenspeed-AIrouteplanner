import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');
const loader = document.getElementById('loader-fallback');

if (container) {
  const root = createRoot(container);
  root.render(<App />);

  // Verwijder loader zodra React de thread overneemt
  setTimeout(() => {
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
  }, 300);
}