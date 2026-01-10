import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("MedRoute: Starten van applicatie-initialisatie...");

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("MedRoute Fout: 'root' element niet gevonden.");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("MedRoute: React boom succesvol gerenderd.");
  } catch (error) {
    console.error("MedRoute Kritieke Fout:", error);
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h2 style="color: #ef4444;">Applicatie Fout</h2>
        <p>Er is een probleem opgetreden bij het laden van de modules.</p>
        <pre style="background: #f1f5f9; padding: 10px; border-radius: 8px; font-size: 12px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
        <button onclick="location.reload()" style="background: #2563eb; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;">Opnieuw proberen</button>
      </div>
    `;
  }
};

// Start de app
if (document.readyState === 'complete') {
  mountApp();
} else {
  window.addEventListener('load', mountApp);
}
