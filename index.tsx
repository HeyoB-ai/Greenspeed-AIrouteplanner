import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Onmiddellijk proberen de loader te verbergen zodra het script start
const hideLoader = () => {
  const loader = document.getElementById('loader-fallback');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 400);
  }
};

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
    hideLoader();
    console.log("MedRoute: Succesvol gemount.");
  } catch (err) {
    console.error("Mount fout:", err);
    // Bij een fout tonen we tenminste iets op het scherm
    container.innerHTML = `<div style="padding: 20px; color: red;">Kritieke fout bij het laden van de app. Controleer de console.</div>`;
  }
}