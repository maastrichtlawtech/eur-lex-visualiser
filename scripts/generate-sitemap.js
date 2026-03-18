import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper to get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getBundledLaws } from '../src/utils/lawRouting.js';

const DOMAIN = 'https://legalviz.eu';

const LAWS = getBundledLaws().filter((law) => law.shownInUi !== false);

function generateSitemap() {
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Home
  sitemap += `<url><loc>${DOMAIN}/</loc></url>\n`;

  // Laws
  for (const law of LAWS) {
    // Law main page
    sitemap += `  <url><loc>${DOMAIN}/${law.slug}</loc></url>\n`;

    // Articles
    if (law.articles) {
      for (let i = 1; i <= law.articles; i++) {
        sitemap += `  <url><loc>${DOMAIN}/${law.slug}/article/${i}</loc></url>\n`;
      }
    }

    // Recitals
    if (law.recitals) {
      for (let i = 1; i <= law.recitals; i++) {
        sitemap += `  <url><loc>${DOMAIN}/${law.slug}/recital/${i}</loc></url>\n`;
      }
    }
  }

  sitemap += '</urlset>';

  const outputPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, sitemap);
  console.log(`Sitemap generated at ${outputPath} with ${LAWS.length} laws.`);
}

generateSitemap();
