import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("MedRoute: Systeem start...");

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("MedRoute: React succesvol gekoppeld.");
  } catch (error) {
    console.error("MedRoute Kritieke Fout:", error);
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
        <h1 style="color: #ef4444;">Fout bij opstarten</h1>
        <p style="color: #64748b;">De applicatie kon niet worden geïnitialiseerd.</p>
        <pre style="background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; text-align: left; font-size: 12px; margin-top: 1rem;">${String(error)}</pre>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #2563eb; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Probeer Opnieuw</button>
      </div>
    `;
  }
} else {
  console.error("MedRoute: Kon de root container niet vinden.");
}
