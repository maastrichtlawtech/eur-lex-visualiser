import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  base: '/eur-lex-visualiser',
  plugins: [react(), tailwind()]
});