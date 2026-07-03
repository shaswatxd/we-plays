import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear it yet so we don't break Electron while building
    rollupOptions: {
      input: 'index.html'
    }
  }
});
