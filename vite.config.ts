import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works in the browser and inside Capacitor.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? 'dev'),
  },
});
