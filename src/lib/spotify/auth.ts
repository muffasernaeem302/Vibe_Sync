/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpotifyAuthTokens, SpotifyUserProfile } from '../../types/spotify';

export const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

export const SPOTIFY_SCOPES = [
  'user-library-read',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
].join(' ');

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'vibesync_access_token',
  REFRESH_TOKEN: 'vibesync_refresh_token',
  EXPIRES_AT: 'vibesync_expires_at',
  TOKEN_TYPE: 'vibesync_token_type',
  CODE_VERIFIER: 'vibesync_code_verifier',
  STATE: 'vibesync_auth_state',
  USER_PROFILE: 'vibesync_user_profile',
  DEMO_MODE: 'vibesync_demo_mode',
  CUSTOM_CLIENT_ID: 'vibesync_custom_client_id',
};

/**
 * Generates a random alphanumeric string for PKCE code verifier and CSRF state.
 */
export function generateRandomString(length: number = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const values = new Uint8Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
      text += possible[values[i] % possible.length];
    }
    return text;
  }
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Generates SHA-256 hash formatted as Base64URL for PKCE challenge.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Retrieves the stored Spotify Client ID if configured by the user or env.
 */
export function getSpotifyClientId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CLIENT_ID);
    if (saved && saved.trim()) return saved.trim();
  }
  // Optional client-side default if provided via Vite env or known app ID
  const envId = (import.meta as any).env?.VITE_SPOTIFY_CLIENT_ID;
  if (envId && typeof envId === 'string' && envId.trim()) {
    return envId.trim();
  }
  // Fallback to user's registered Spotify App ID
  return '9b66c314521b46c0a8d07b309878c6d8';
}

/**
 * Saves a custom Spotify Client ID.
 */
export function setSpotifyClientId(clientId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CLIENT_ID, clientId.trim());
  }
}

/**
 * Gets the OAuth redirect URI for Spotify.
 */
export function getRedirectUri(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return 'http://localhost:3000/auth/callback';
}

/**
 * Builds the Spotify Authorization URL for PKCE OAuth 2.0 flow.
 */
export async function createAuthorizationUrl(customClientId?: string): Promise<{ url: string; codeVerifier: string; state: string }> {
  const clientId = customClientId || getSpotifyClientId();
  if (!clientId) {
    throw new Error('Spotify Client ID is required for authentication.');
  }

  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(32);
  const redirectUri = getRedirectUri();

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
    sessionStorage.setItem(STORAGE_KEYS.STATE, state);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: SPOTIFY_SCOPES,
    show_dialog: 'true',
  });

  return {
    url: `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`,
    codeVerifier,
    state,
  };
}

/**
 * Exchanges authorization code for tokens using PKCE.
 */
export async function exchangeCodeForTokensPKCE(
  code: string,
  codeVerifier: string,
  clientId: string
): Promise<SpotifyAuthTokens> {
  const redirectUri = getRedirectUri();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  // 1. Try direct PKCE request
  try {
    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (response.ok) {
      const data = await response.json();
      const tokens: SpotifyAuthTokens = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        scope: data.scope,
        expires_in: data.expires_in,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
      };

      saveTokens(tokens);
      return tokens;
    }
  } catch (directErr) {
    console.warn('Direct PKCE exchange failed, falling back to server route:', directErr);
  }

  // 2. Fallback to server route /api/auth/token
  const backendRes = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      client_id: clientId,
      redirect_uri: redirectUri,
    }),
  });

  if (!backendRes.ok) {
    const errorData = await backendRes.json().catch(() => ({}));
    throw new Error(errorData.error_description || errorData.error || `Token exchange failed: ${backendRes.status}`);
  }

  const data = await backendRes.json();
  const tokens: SpotifyAuthTokens = {
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  saveTokens(tokens);
  return tokens;
}

/**
 * Saves tokens in localStorage and cookies (with SameSite=None; Secure for iframe).
 */
export function saveTokens(tokens: SpotifyAuthTokens): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
  }
  const expiresAt = tokens.expires_at || (Date.now() + (tokens.expires_in * 1000));
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
  localStorage.setItem(STORAGE_KEYS.TOKEN_TYPE, tokens.token_type || 'Bearer');
  localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);

  // Set secure cross-origin cookie for iframe compatibility
  try {
    const maxAge = tokens.expires_in || 3600;
    document.cookie = `spotify_access_token=${encodeURIComponent(tokens.access_token)}; path=/; max-age=${maxAge}; SameSite=None; Secure`;
  } catch {
    // Non-fatal if document.cookie is restricted
  }
}

/**
 * Retrieves current tokens from local storage.
 */
export function getStoredTokens(): Partial<SpotifyAuthTokens> | null {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  const tokenType = localStorage.getItem(STORAGE_KEYS.TOKEN_TYPE) || 'Bearer';

  if (!accessToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    expires_at: expiresAtStr ? parseInt(expiresAtStr, 10) : undefined,
    token_type: tokenType,
    expires_in: expiresAtStr ? Math.max(0, Math.floor((parseInt(expiresAtStr, 10) - Date.now()) / 1000)) : 3600,
    scope: SPOTIFY_SCOPES,
  };
}

/**
 * Checks if the stored access token is expired or within 60s of expiring.
 */
export function isTokenExpiringSoon(tokens?: Partial<SpotifyAuthTokens> | null): boolean {
  const currentTokens = tokens || getStoredTokens();
  if (!currentTokens || !currentTokens.access_token) return true;
  if (!currentTokens.expires_at) return false;
  // Expiring within 60 seconds
  return Date.now() >= currentTokens.expires_at - 60000;
}

/**
 * Refreshes an expired access token using the refresh_token.
 */
export async function refreshAccessToken(): Promise<string> {
  const stored = getStoredTokens();
  if (!stored || !stored.refresh_token) {
    throw new Error('No refresh token available. User must re-authenticate.');
  }

  const clientId = getSpotifyClientId();

  // Try server-side refresh route first if backend is running
  try {
    const backendRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: stored.refresh_token, client_id: clientId }),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.access_token) {
        const updatedTokens: SpotifyAuthTokens = {
          access_token: data.access_token,
          token_type: data.token_type || 'Bearer',
          expires_in: data.expires_in || 3600,
          refresh_token: data.refresh_token || stored.refresh_token,
          expires_at: Date.now() + ((data.expires_in || 3600) * 1000),
          scope: data.scope || SPOTIFY_SCOPES,
        };
        saveTokens(updatedTokens);
        return updatedTokens.access_token;
      }
    }
  } catch (backendErr) {
    console.warn('Backend refresh failed, trying direct PKCE refresh:', backendErr);
  }

  // Direct PKCE refresh against Spotify token endpoint
  if (!clientId) {
    throw new Error('Spotify Client ID required to refresh token.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: stored.refresh_token,
    client_id: clientId,
  });

  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    clearAuthSession();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const updatedTokens: SpotifyAuthTokens = {
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    refresh_token: data.refresh_token || stored.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    scope: data.scope || SPOTIFY_SCOPES,
  };

  saveTokens(updatedTokens);
  return updatedTokens.access_token;
}

/**
 * Returns a valid access token, auto-refreshing if expired or near expiry.
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (isDemoModeActive()) {
    return 'demo_access_token_vibesync';
  }

  const stored = getStoredTokens();
  if (!stored || !stored.access_token) {
    return null;
  }

  if (isTokenExpiringSoon(stored)) {
    if (stored.refresh_token) {
      try {
        return await refreshAccessToken();
      } catch (err) {
        console.error('Auto-refresh token error:', err);
        return null;
      }
    }
    return null;
  }

  return stored.access_token;
}

/**
 * Clears all authentication state.
 */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_TYPE);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
  sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEYS.STATE);

  try {
    document.cookie = 'spotify_access_token=; path=/; max-age=0; SameSite=None; Secure';
  } catch {
    // Ignore cookie clearing error
  }
}

/**
 * Demo Mode helpers
 */
export function isDemoModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.DEMO_MODE) === 'true';
}

export function setDemoMode(active: boolean): void {
  if (typeof window === 'undefined') return;
  if (active) {
    localStorage.setItem(STORAGE_KEYS.DEMO_MODE, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEYS.DEMO_MODE);
  }
}
