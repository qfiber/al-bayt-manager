#!/usr/bin/env node
/**
 * Build-time prerendering for public pages.
 *
 * After `vite build`, this script:
 * 1. Starts a local static server from dist/
 * 2. Visits each public route with Puppeteer
 * 3. Captures the rendered HTML
 * 4. Saves to dist/prerendered/<route>.html
 *
 * Nginx serves these to bots (Googlebot, Bingbot, AI crawlers).
 */

import { createServer } from 'http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const OUT_DIR = join(DIST_DIR, 'prerendered');
const PORT = 4173;

const ROUTES = [
  '/',
  '/pricing',
  '/faq',
  '/contact',
  '/privacy-policy',
  '/terms',
  '/login',
  '/register',
];

// Simple static file server for dist/
function startServer() {
  const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  };

  const server = createServer((req, res) => {
    let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

    // SPA fallback
    if (!existsSync(filePath) || !extname(filePath)) {
      filePath = join(DIST_DIR, 'index.html');
    }

    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

async function prerender() {
  console.log('Starting prerender...');

  if (!existsSync(DIST_DIR)) {
    console.error('dist/ not found. Run "npm run build" first.');
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const server = await startServer();
  console.log(`Static server on port ${PORT}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const route of ROUTES) {
    const url = `http://localhost:${PORT}${route}`;
    console.log(`  Rendering ${route}...`);

    const page = await browser.newPage();

    // Block API calls — we only want the static shell
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const reqUrl = req.url();
      if (reqUrl.includes('/api/') && !reqUrl.includes('/api/settings/public') && !reqUrl.includes('/api/subscriptions/plans')) {
        req.abort();
      } else {
        req.continue();
      }
    });

    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });

      // Wait a bit for React to finish rendering
      await page.waitForTimeout(1000);

      const html = await page.content();

      // Clean filename
      const fileName = route === '/' ? 'index.html' : `${route.slice(1).replace(/\//g, '-')}.html`;
      const outPath = join(OUT_DIR, fileName);

      writeFileSync(outPath, html, 'utf-8');
      console.log(`    → ${fileName} (${(html.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
    }

    await page.close();
  }

  await browser.close();
  server.close();

  console.log(`\nPrerendered ${ROUTES.length} pages to dist/prerendered/`);
}

prerender().catch(console.error);
