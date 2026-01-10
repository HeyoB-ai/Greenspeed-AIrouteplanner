import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("MedRoute: Systeem start...");

const init = () => {
  const container = document.getElementById('root');
  const loader = document.getElementById('loader-fallback');

  if (container) {
    try {
      const root = createRoot(container);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      
      console.log("MedRoute: React succesvol gekoppeld.");
      
      // Verberg de loader zodra React begint te renderen
      if (loader) {
        // We gebruiken een kleine timeout om te zorgen dat de browser tijd heeft voor de eerste paint
        setTimeout(() => {
          loader.style.opacity = '0';
          setTimeout(() => {
            loader.style.display = 'none';
          }, 500);
        }, 200);
      }
    } catch (error) {
      console.error("MedRoute Kritieke Fout bij renderen:", error);
      if (loader) loader.style.display = 'none';
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; font-family: sans-serif; background: white; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <h1 style="color: #ef4444; margin-bottom: 0.5rem;">Opstartfout</h1>
          <p style="color: #64748b; margin-bottom: 1.5rem;">De applicatie kon niet worden geladen door een module-conflict.</p>
          <div style="background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; text-align: left; font-size: 11px; max-width: 90%; overflow: auto; border: 1px solid #e2e8f0; font-family: monospace;">
            ${String(error)}
          </div>
          <button onclick="location.reload()" style="margin-top: 2rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; cursor: pointer; font-weight: bold;">Pagina Verversen</button>
        </div>
      `;
    }
  }
};

// Start de initialisatie
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
