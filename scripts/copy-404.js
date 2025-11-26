// Script to copy index.html to 404.html for GitHub Pages SPA routing
// This allows client-side routing to work on GitHub Pages
import { copyFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = join(__dirname, '..', 'dist');

try {
  copyFileSync(join(distPath, 'index.html'), join(distPath, '404.html'));
  console.log('✓ Copied index.html to 404.html for GitHub Pages SPA routing');
} catch (error) {
  console.error('Error copying index.html to 404.html:', error);
  process.exit(1);
}

