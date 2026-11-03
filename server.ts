/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleGetAuthUrl,
  handleTokenExchange,
  handleRefreshToken,
  handleCallbackHtml,
  getBackendRedirectUri,
} from './src/app/api/auth/route.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Backend API Routes for Spotify OAuth
app.get('/api/auth/url', handleGetAuthUrl);
app.post('/api/auth/token', handleTokenExchange);
app.post('/api/auth/refresh', handleRefreshToken);

// Handle callback routes (with and without trailing slashes)
app.get(['/auth/callback', '/auth/callback/', '/api/auth/callback'], handleCallbackHtml);

// API info endpoint
app.get('/api/info', (req, res) => {
  const redirectUri = getBackendRedirectUri(req);
  res.json({
    app: 'VibeSync',
    status: 'online',
    redirectUri,
    hasServerClientId: Boolean(process.env.CLIENT_ID),
    hasServerClientSecret: Boolean(process.env.CLIENT_SECRET),
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VibeSync] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[VibeSync] Failed to start server:', err);
  process.exit(1);
});
