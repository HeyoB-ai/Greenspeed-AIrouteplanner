import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const startApp = () => {
  const container = document.getElementById('root');
  if (!container) return;

  try {
    const root = createRoot(container);
    root.render(<App />);
    console.log("MedRoute: React render aangeroepen.");
  } catch (err) {
    console.error("Render error:", err);
  }
};

// Zorg dat we pas renderen als de DOM er is en de scripts geladen zijn
if (document.readyState === 'complete') {
  startApp();
} else {
  window.addEventListener('load', startApp);
}