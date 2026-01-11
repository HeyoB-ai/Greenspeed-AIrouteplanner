import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Zorg ervoor dat process.env.API_KEY altijd een valide waarde heeft voor de SDK
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'MISSING_KEY')
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});