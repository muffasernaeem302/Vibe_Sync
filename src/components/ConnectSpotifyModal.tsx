/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Key,
  Shield,
  HelpCircle,
  PlayCircle,
} from 'lucide-react';
import {
  getSpotifyClientId,
  setSpotifyClientId,
  getRedirectUri,
  createAuthorizationUrl,
  setDemoMode,
  clearAuthSession,
} from '../lib/spotify/auth';

interface ConnectSpotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  isDemo: boolean;
  onAuthSuccess: () => void;
}

export const ConnectSpotifyModal: React.FC<ConnectSpotifyModalProps> = ({
  isOpen,
  onClose,
  isConnected,
  isDemo,
  onAuthSuccess,
}) => {
  const [clientId, setClientId] = useState<string>(getSpotifyClientId() || '');
  const [copiedUri, setCopiedUri] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authUrlPreview, setAuthUrlPreview] = useState<string>('');

  // Pre-generate auth URL when Client ID changes so user can also click a direct link
  React.useEffect(() => {
    if (clientId.trim()) {
      createAuthorizationUrl(clientId.trim())
        .then(({ url }) => setAuthUrlPreview(url))
        .catch(() => setAuthUrlPreview(''));
    } else {
      setAuthUrlPreview('');
    }
  }, [clientId]);

  if (!isOpen) return null;

  const redirectUri = getRedirectUri();

  const handleCopyUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const handleConnectSpotify = async () => {
    setErrorMessage(null);
    const cleanedClientId = clientId.trim();
    if (!cleanedClientId) {
      setErrorMessage('Please enter your Spotify Client ID from developer.spotify.com');
      return;
    }

    setSpotifyClientId(cleanedClientId);
    setIsConnecting(true);

    // Open popup window immediately inside user gesture to avoid browser popup blockers
    const popupWidth = 600;
    const popupHeight = 700;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;

    const authWindow = window.open(
      'about:blank',
      'spotify_oauth_popup',
      `width=${popupWidth},height=${popupHeight},top=${top},left=${left},scrollbars=yes,status=1`
    );

    try {
      // Create PKCE authorization URL with fresh challenge
      const { url } = await createAuthorizationUrl(cleanedClientId);
      setAuthUrlPreview(url);

      if (authWindow && !authWindow.closed) {
        authWindow.location.href = url;
      } else {
        // If popup was blocked by browser
        setErrorMessage('Browser blocked the popup window. Click the direct link below to continue.');
      }
    } catch (err: any) {
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }
      setErrorMessage(err.message || 'Failed to generate Spotify login URL.');
    } finally {
      // Reset button state so it's never stuck on "Opening Spotify Login..."
      setIsConnecting(false);
    }
  };

  const handleActivateDemo = () => {
    setDemoMode(true);
    onAuthSuccess();
    onClose();
  };

  const handleDisconnect = () => {
    clearAuthSession();
    onAuthSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1DB954] text-black font-bold">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.52 17.306c-.221.363-.693.479-1.056.257-2.887-1.764-6.522-2.163-10.803-1.185-.411.094-.82-.162-.914-.573-.094-.411.162-.82.573-.914 4.69-1.071 8.706-.615 11.943 1.359.363.222.479.694.257 1.056zm1.47-3.266c-.278.452-.87.595-1.322.317-3.305-2.032-8.344-2.62-12.253-1.433-.51.155-1.05-.136-1.205-.646-.155-.51.136-1.05.646-1.205 4.469-1.357 10.027-.701 13.814 1.644.452.278.595.87.317 1.323zm.129-3.398c-3.963-2.353-10.513-2.57-14.303-1.419-.607.184-1.25-.164-1.434-.771-.184-.607.164-1.25.771-1.434 4.354-1.322 11.583-1.066 16.14 1.641.547.324.726 1.034.402 1.581-.324.547-1.034.726-1.581.402z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-lg text-zinc-100">Connect to Spotify</h3>
              <p className="text-xs text-zinc-400">OAuth 2.0 PKCE with auto-refresh</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current status banner */}
        <div className="my-4 rounded-xl bg-zinc-900/60 border border-zinc-800 p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-[#1DB954]' : isDemo ? 'bg-amber-400' : 'bg-zinc-600'
              }`}
            />
            <span className="text-zinc-300 font-medium">
              {isConnected
                ? 'Spotify Account Connected'
                : isDemo
                ? 'Demo Exploration Mode Active'
                : 'Not Connected'}
            </span>
          </div>

          {(isConnected || isDemo) && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-xs text-rose-400 hover:text-rose-300 underline font-medium"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Client ID input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
              <span>Spotify Client ID</span>
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#1DB954] hover:underline flex items-center gap-1"
              >
                <span>Spotify Developer Dashboard</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </label>
            <div className="relative">
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Paste your Spotify Client ID (e.g. 4a8b...)"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-[#1DB954] focus:outline-none transition-colors"
              />
              <Key className="absolute right-3.5 top-3 h-4 w-4 text-zinc-600" />
            </div>
          </div>

          {/* Redirect URIs copy box */}
          <div className="space-y-2 rounded-xl bg-zinc-900/90 border border-zinc-800 p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200">
                Spotify Redirect URI (Required Setting)
              </label>
              <span className="text-[10px] text-amber-400 font-medium">Must match exactly</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={redirectUri}
                className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs font-mono text-[#1DB954] select-all"
              />
              <button
                type="button"
                onClick={handleCopyUri}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-xs font-bold text-black transition-colors"
                title="Copy Active Redirect URI"
              >
                {copiedUri ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedUri ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300 space-y-1">
              <p className="font-semibold text-amber-200">Fix &quot;redirect_uri: Not matching configuration&quot;:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-zinc-300">
                <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-[#1DB954] underline">Spotify Developer Dashboard</a> and open your app.</li>
                <li>Click <strong>Settings</strong> (top right).</li>
                <li>Under <strong>Redirect URIs</strong>, click <strong>Add</strong> and paste the URL above.</li>
                <li>Scroll to the bottom and click <strong>Save</strong>!</li>
              </ol>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="button"
              onClick={handleConnectSpotify}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1DB954] py-3 text-sm font-bold text-black hover:bg-[#1ed760] transition-colors shadow-lg shadow-[#1DB954]/20"
            >
              <Shield className="h-4 w-4" />
              <span>{isConnecting ? 'Launching Popup...' : 'Connect Spotify Account'}</span>
            </button>

            {/* Direct Link Fallback */}
            {authUrlPreview && (
              <div className="text-center pt-1">
                <a
                  href={authUrlPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#1DB954] hover:underline font-medium"
                >
                  <span>Popup not opening? Click here to open Spotify in a new tab</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-3 text-[11px] text-zinc-500 uppercase tracking-widest">or instant demo</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <button
              type="button"
              onClick={handleActivateDemo}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 transition-colors border border-zinc-700/60"
            >
              <PlayCircle className="h-4 w-4 text-amber-400" />
              <span>Explore Demo Library (No Spotify Account Needed)</span>
            </button>
          </div>
        </div>

        {/* Security & Scopes note */}
        <div className="mt-5 rounded-lg bg-zinc-900/40 p-2.5 border border-zinc-800/40 text-[11px] text-zinc-500 flex items-start gap-2">
          <HelpCircle className="h-3.5 w-3.5 mt-0.5 text-zinc-400 flex-shrink-0" />
          <span>
            Requested scopes: <strong className="text-zinc-400">user-library-read</strong> (liked songs), <strong className="text-zinc-400">playlist-modify-public</strong>, and <strong className="text-zinc-400">playlist-modify-private</strong>. Tokens are stored securely client-side.
          </span>
        </div>
      </div>
    </div>
  );
};
