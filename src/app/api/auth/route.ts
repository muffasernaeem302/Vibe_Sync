/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from 'express';
import { SPOTIFY_AUTH_ENDPOINT, SPOTIFY_TOKEN_ENDPOINT, SPOTIFY_SCOPES } from '../../../lib/spotify/auth';

/**
 * Helper to construct the dynamic redirect URI based on APP_URL or request headers
 */
export function getBackendRedirectUri(req: Request): string {
  if (process.env.APP_URL) {
    const baseUrl = process.env.APP_URL.replace(/\/$/, '');
    return `${baseUrl}/auth/callback`;
  }
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  return `${protocol}://${host}/auth/callback`;
}

/**
 * GET /api/auth/url
 * Returns the Spotify OAuth authorization URL
 */
export async function handleGetAuthUrl(req: Request, res: Response) {
  const clientId = (req.query.client_id as string) || process.env.CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || '';
  const redirectUri = (req.query.redirect_uri as string) || getBackendRedirectUri(req);
  const state = (req.query.state as string) || Math.random().toString(36).substring(7);
  const codeChallenge = req.query.code_challenge as string;

  if (!clientId) {
    return res.status(400).json({
      error: 'Missing client_id',
      message: 'Please provide a Spotify Client ID or configure CLIENT_ID environment variable.',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: 'true',
  });

  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  const url = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
  return res.json({ url, redirect_uri: redirectUri, state });
}

/**
 * POST /api/auth/token
 * Exchanges authorization code for tokens
 */
export async function handleTokenExchange(req: Request, res: Response) {
  const { code, code_verifier, client_id, redirect_uri } = req.body;
  const effectiveClientId = client_id || process.env.CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const effectiveClientSecret = process.env.CLIENT_SECRET;
  const effectiveRedirectUri = redirect_uri || getBackendRedirectUri(req);

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: effectiveRedirectUri,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (effectiveClientSecret && effectiveClientId) {
    // Basic Auth header for confidential client
    const credentials = Buffer.from(`${effectiveClientId}:${effectiveClientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (code_verifier && effectiveClientId) {
    // PKCE authorization code exchange
    bodyParams.set('client_id', effectiveClientId);
    bodyParams.set('code_verifier', code_verifier);
  } else if (effectiveClientId) {
    bodyParams.set('client_id', effectiveClientId);
  }

  try {
    const spotifyRes = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    const data = await spotifyRes.json();

    if (!spotifyRes.ok) {
      return res.status(spotifyRes.status).json(data);
    }

    // Set cookie if needed for cross-origin iframe support
    res.cookie('spotify_access_token', data.access_token, {
      secure: true,
      sameSite: 'none',
      httpOnly: false,
      maxAge: (data.expires_in || 3600) * 1000,
    });

    return res.json(data);
  } catch (error: any) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Failed to exchange token', details: error.message });
  }
}

/**
 * POST /api/auth/refresh
 * Refreshes an access token using refresh_token
 */
export async function handleRefreshToken(req: Request, res: Response) {
  const { refresh_token, client_id } = req.body;
  const effectiveClientId = client_id || process.env.CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const effectiveClientSecret = process.env.CLIENT_SECRET;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (effectiveClientSecret && effectiveClientId) {
    const credentials = Buffer.from(`${effectiveClientId}:${effectiveClientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else if (effectiveClientId) {
    bodyParams.set('client_id', effectiveClientId);
  }

  try {
    const spotifyRes = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    });

    const data = await spotifyRes.json();

    if (!spotifyRes.ok) {
      return res.status(spotifyRes.status).json(data);
    }

    return res.json(data);
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Failed to refresh token', details: error.message });
  }
}

/**
 * Handler for /auth/callback and /api/auth/callback
 * Generates popup response for cross-origin iframe according to oauth-integration guidelines
 */
export function handleCallbackHtml(req: Request, res: Response) {
  const { code, state, error } = req.query;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>VibeSync Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
      padding: 24px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(29, 185, 84, 0.2);
      border-top-color: #1DB954;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
    p { color: #a1a1aa; font-size: 14px; max-width: 320px; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Connecting to VibeSync...</h2>
  <p id="msg">Authenticating with Spotify and closing window...</p>
  <script>
    (function() {
      const code = ${JSON.stringify(code || '')};
      const state = ${JSON.stringify(state || '')};
      const err = ${JSON.stringify(error || '')};

      const payload = {
        type: 'OAUTH_AUTH_SUCCESS',
        code: code,
        state: state,
        error: err
      };

      if (window.opener) {
        window.opener.postMessage(payload, '*');
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        // Direct window fallback: redirect to main app
        const targetUrl = '/?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state);
        window.location.href = targetUrl;
      }
    })();
  </script>
</body>
</html>
`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
