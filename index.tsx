import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const mountApp = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Verwijder loader pas als React echt "landt"
    requestAnimationFrame(() => {
      setTimeout(() => {
        const loader = document.getElementById('loader-fallback');
        if (loader) {
          loader.style.opacity = '0';
          setTimeout(() => { loader.style.display = 'none'; }, 500);
        }
      }, 200);
    });

    console.log("MedRoute v2.1: React 18.3.1 stabiel.");
  } catch (err) {
    console.error("Mount error:", err);
    container.innerHTML = `<div style="padding:20px; color:red;">Kritieke fout: ${err.message}</div>`;
  }
};

// Start de app
mountApp();