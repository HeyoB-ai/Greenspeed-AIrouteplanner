import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("MedRoute: Initialiseren van applicatie...");

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("MedRoute Fout: Kon het 'root' element niet vinden.");
    return;
  }

  try {
    console.log("MedRoute: Bezig met mounten van React boom...");
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("MedRoute: Applicatie succesvol geladen.");
  } catch (error) {
    console.error("MedRoute Runtime Error:", error);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: #1e293b; font-family: sans-serif; text-align: center; max-width: 500px; margin: 0 auto;">
        <div style="background: #fee2e2; padding: 24px; border-radius: 20px; border: 1px solid #ef4444;">
          <h2 style="color: #ef4444; margin-top: 0;">Oeps! Laden mislukt</h2>
          <p style="margin-bottom: 20px; font-size: 14px; color: #7f1d1d;">${error instanceof Error ? error.message : "Er is een onbekende fout opgetreden."}</p>
          <button onclick="location.reload()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; width: 100%;">
            Probeer opnieuw
          </button>
        </div>
      </div>
    `;
  }
};

// Start de app zodra de DOM klaar is
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
