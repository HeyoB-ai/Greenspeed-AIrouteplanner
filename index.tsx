import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
    console.log("MedRoute: React applicatie gestart.");
  } catch (err) {
    console.error("Kritieke fout tijdens renderen:", err);
    const status = document.getElementById('loader-status');
    if (status) status.innerText = "Fout bij opstarten. Zie console.";
  }
} else {
  console.error("Root element niet gevonden.");
}