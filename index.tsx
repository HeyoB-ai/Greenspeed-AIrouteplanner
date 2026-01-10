import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const init = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(<App />);
    
    // Verwijder loader
    const loader = document.getElementById('loader-fallback');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }, 500);
    }
  } catch (err) {
    console.error("Render Error:", err);
    const status = document.getElementById('loader-status');
    if (status) status.innerText = "Systeemfout bij laden.";
  }
};

// Start de app zodra het document klaar is
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
