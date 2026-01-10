import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  
  try {
    root.render(<App />);
    
    // Hide loader once rendering starts
    const loader = document.getElementById('loader-fallback');
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }, 300);
    }
  } catch (err) {
    console.error("Critical Render Error:", err);
    const status = document.getElementById('loader-status');
    if (status) status.innerText = "Fout bij het opstarten van de interface.";
  }
}