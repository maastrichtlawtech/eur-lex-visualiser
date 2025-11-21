import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  base: '/eur-lex-visualiser',
  plugins: [react(), tailwind()],
  server: {
    // Suppress the base URL warning
    strictPort: false,
  },
});