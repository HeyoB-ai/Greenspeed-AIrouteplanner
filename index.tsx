import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
    
    // Gebruik requestAnimationFrame om te wachten tot React de eerste render-cyclus start
    requestAnimationFrame(() => {
      const loader = document.getElementById('loader-fallback');
      if (loader) {
        // Geef het 100ms extra ademruimte om echt te renderen
        setTimeout(() => {
          loader.style.opacity = '0';
          setTimeout(() => {
            loader.style.display = 'none';
          }, 500);
        }, 100);
      }
    });

    console.log("MedRoute: Succesvol geladen op React 18.3.1");
  } catch (err) {
    console.error("Kritieke fout bij opstarten:", err);
    container.innerHTML = `<div style="padding: 2rem; color: #ef4444; font-family: sans-serif;">
      <h1 style="font-weight: 800;">Oeps! Er ging iets mis.</h1>
      <p>De applicatie kon niet worden gestart. Zie de console voor details.</p>
    </div>`;
  }
}