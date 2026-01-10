import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Render catch:", err);
    const status = document.getElementById('loader-status');
    if (status) {
      status.style.color = '#ef4444';
      status.innerText = "Fout bij laden van de interface.";
    }
  }
}