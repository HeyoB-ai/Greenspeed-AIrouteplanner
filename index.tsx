import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Fout: Kon het 'root' element niet vinden in de DOM.");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Runtime error tijdens het mounten van de app:", error);
    rootElement.innerHTML = `
      <div style="padding: 40px; color: #1e293b; font-family: sans-serif; text-align: center;">
        <h2 style="color: #ef4444;">MedRoute kon niet worden geladen</h2>
        <p style="margin-bottom: 20px;">${error instanceof Error ? error.message : "Onbekende fout"}</p>
        <button onclick="location.reload()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold;">
          Probeer opnieuw
        </button>
      </div>
    `;
  }
};

// Zorg ervoor dat de DOM geladen is voordat we mounten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
