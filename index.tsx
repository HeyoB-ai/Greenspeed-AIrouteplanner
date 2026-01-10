import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log("React Render Initiated");
  } catch (err) {
    console.error("Mounting error:", err);
  }
} else {
  console.error("Root element not found");
}