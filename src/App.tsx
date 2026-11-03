/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import DashboardPage from './app/dashboard/page';
import { exchangeCodeForTokensPKCE, getSpotifyClientId } from './lib/spotify/auth';

export default function App() {
  // Check for OAuth callback code in URL if opened directly
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const codeVerifier = sessionStorage.getItem('vibesync_code_verifier');
    const clientId = getSpotifyClientId();

    if (code && codeVerifier && clientId) {
      // Exchange code directly
      exchangeCodeForTokensPKCE(code, codeVerifier, clientId)
        .then(() => {
          // Clear query params
          window.history.replaceState({}, document.title, window.location.pathname);
          window.location.reload();
        })
        .catch((err) => {
          console.error('Failed to exchange code from query param:', err);
        });
    }
  }, []);

  return <DashboardPage />;
}
