import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(<App />);
  
  // Verwijder de loader zodra React begint met renderen
  const loader = document.getElementById('loader-fallback');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }, 300);
  }
}