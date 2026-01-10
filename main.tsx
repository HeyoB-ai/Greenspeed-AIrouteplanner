import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  // Verwijder loader na hydration
  const loader = document.getElementById('loader-fallback');
  if (loader) {
    loader.style.display = 'none';
  }
}