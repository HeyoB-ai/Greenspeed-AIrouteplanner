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
      const loader = document.getElementById('loader-fallback') as HTMLElement | null;
      if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.5s ease';
        setTimeout(() => loader.remove(), 500);
      }
    };

    // Wacht tot de browser klaar is met de eerste render-cyclus
    if (document.readyState === 'complete') {
      setTimeout(removeLoader, 300);
    } else {
      window.addEventListener('load', () => setTimeout(removeLoader, 300));
    }
    
    // Extra safety: ook via requestAnimationFrame
    requestAnimationFrame(() => {
      setTimeout(removeLoader, 1000); // Fail-safe na 1 seconde
    });

  } catch (error) {
    console.error("Fout bij het laden van de MedRoute applicatie:", error);
    const loaderText = document.querySelector('#loader-fallback p') as HTMLElement | null;
    if (loaderText) {
      loaderText.textContent = "Er is een fout opgetreden bij het starten. Controleer de console.";
      loaderText.style.color = "#ef4444";
    }
  }
}