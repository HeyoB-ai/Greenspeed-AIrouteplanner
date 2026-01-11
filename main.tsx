
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // Verwijder de loader zodra React begint met renderen
    const removeLoader = () => {
      // Gebruik casting naar HTMLElement om toegang te krijgen tot .style
      const loader = document.getElementById('loader-fallback') as HTMLElement | null;
      if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.5s ease';
        setTimeout(() => loader.remove(), 500);
      }
    };

    // Gebruik requestAnimationFrame om te zorgen dat de browser de eerste paint heeft gedaan
    requestAnimationFrame(() => {
      setTimeout(removeLoader, 200);
    });
  } catch (error) {
    console.error("Fout bij het laden van de MedRoute applicatie:", error);
    // Gebruik casting naar HTMLElement voor querySelector resultaat
    const loaderText = document.querySelector('#loader-fallback p') as HTMLElement | null;
    if (loaderText) {
      loaderText.textContent = "Er is een fout opgetreden bij het starten. Controleer de console.";
      loaderText.style.color = "#ef4444";
    }
  }
}
