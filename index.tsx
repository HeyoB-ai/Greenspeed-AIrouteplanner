import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("MedRoute: Bootstrapping...");

const container = document.getElementById('root');
const loader = document.getElementById('loader-fallback');

const hideLoader = () => {
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 500);
  }
};

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Verberg de zandloper direct zodra React begint
    hideLoader();
    console.log("MedRoute: React Rendered.");
  } catch (error) {
    console.error("MedRoute: Render Error", error);
    hideLoader();
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h2 style="color: red;">Systeemfout bij opstarten</h2>
        <p>Er is een conflict in de bibliotheken gevonden.</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">Opnieuw proberen</button>
      </div>
    `;
  }
}