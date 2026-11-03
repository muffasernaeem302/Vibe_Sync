/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SpotifyTrack,
  SpotifyAudioFeatures,
  SpotifyUserProfile,
  SpotifyPlaylist,
  SpotifySavedTracksResponse,
  SpotifyAudioFeaturesResponse,
  SpotifyUserPlaylistsResponse,
} from '../../types/spotify';
import {
  getValidAccessToken,
  refreshAccessToken,
  isDemoModeActive,
} from './auth';
import { MOCK_LIBRARY } from '../../data/mockTracks';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  status: number;
  retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * Utility to pause execution for a given number of milliseconds.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to split an array into chunks of a given size.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Robust fetch wrapper handling:
 * 1. Automatic 401 token refresh and request replay
 * 2. Exponential backoff with Retry-After header on 429 rate limit
 * 3. Network jitter and retries
 */
export async function spotifyFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) {
    throw new SpotifyApiError('Not authenticated. Please log in with Spotify.', 401);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // 1. Handle HTTP 401 Unauthorized (Expired Token)
    if (response.status === 401 && retryCount < maxRetries) {
      console.warn(`Spotify 401 on ${endpoint}. Attempting automatic token refresh...`);
      try {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          // Replay original request with refreshed token
          return spotifyFetch<T>(endpoint, options, retryCount + 1, maxRetries);
        }
      } catch (refreshErr) {
        throw new SpotifyApiError('Session expired. Please reconnect your Spotify account.', 401);
      }
    }

    // 2. Handle HTTP 429 Too Many Requests (Rate Limits)
    if (response.status === 429 && retryCount < maxRetries) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.pow(2, retryCount) + 1;
      const delayMs = (retryAfterSeconds * 1000) + Math.floor(Math.random() * 500);
      
      console.warn(`Spotify 429 Rate Limit on ${endpoint}. Backing off for ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})...`);
      await wait(delayMs);
      return spotifyFetch<T>(endpoint, options, retryCount + 1, maxRetries);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new SpotifyApiError(
        `Spotify API Error [${response.status}] on ${endpoint}: ${errorBody || response.statusText}`,
        response.status
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error: any) {
    if (error instanceof SpotifyApiError) throw error;

    // Retry transient network errors
    if (retryCount < maxRetries) {
      const backoff = Math.pow(2, retryCount) * 1000;
      await wait(backoff);
      return spotifyFetch<T>(endpoint, options, retryCount + 1, maxRetries);
    }
    throw new SpotifyApiError(error.message || 'Network request failed', 0);
  }
}

/**
 * Spotify API Client Service
 */
export const SpotifyClient = {
  /**
   * Fetches current authenticated user's profile
   */
  async getCurrentUser(): Promise<SpotifyUserProfile> {
    if (isDemoModeActive()) {
      return {
        id: 'vibesync_demo_user',
        display_name: 'Demo Curator',
        email: 'demo@vibesync.app',
        images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop', width: 200, height: 200 }],
        product: 'premium',
        country: 'US',
        uri: 'spotify:user:vibesync_demo_user',
        external_urls: { spotify: '#' },
      };
    }
    return spotifyFetch<SpotifyUserProfile>('/me');
  },

  /**
   * Fetches all liked tracks using pagination loops.
   * Chunks requests in limits of 50 up to maxTracks (defaults to 250).
   */
  async getLikedTracks(
    maxTracks: number = 250,
    onProgress?: (progress: { fetched: number; total: number; message: string }) => void
  ): Promise<SpotifyTrack[]> {
    if (isDemoModeActive()) {
      // Simulate network pagination and progress in demo mode
      const total = MOCK_LIBRARY.length;
      onProgress?.({ fetched: 0, total, message: 'Fetching saved tracks from Spotify library...' });
      await wait(250);
      onProgress?.({ fetched: total, total, message: `Loaded ${total} saved tracks` });
      return MOCK_LIBRARY.map((item) => item.track);
    }

    const pageSize = 50;
    let offset = 0;
    const tracks: SpotifyTrack[] = [];
    let totalAvailable = Infinity;

    onProgress?.({ fetched: 0, total: 0, message: 'Connecting to Spotify library...' });

    while (tracks.length < maxTracks && offset < totalAvailable) {
      const limit = Math.min(pageSize, maxTracks - tracks.length);
      const endpoint = `/me/tracks?limit=${limit}&offset=${offset}`;

      const data = await spotifyFetch<SpotifySavedTracksResponse>(endpoint);
      totalAvailable = data.total;

      const validTracks = data.items
        .map((item) => item.track)
        .filter((track): track is SpotifyTrack => Boolean(track && track.id));

      tracks.push(...validTracks);
      offset += data.items.length;

      onProgress?.({
        fetched: tracks.length,
        total: Math.min(totalAvailable, maxTracks),
        message: `Fetched ${tracks.length} of ${Math.min(totalAvailable, maxTracks)} liked tracks...`,
      });

      if (!data.next || data.items.length === 0) {
        break;
      }
    }

    return tracks;
  },

  /**
   * Fetches audio features for track IDs in parallel batches of 100.
   */
  async getAudioFeaturesForTracks(
    trackIds: string[],
    onProgress?: (progress: { processed: number; total: number }) => void
  ): Promise<Map<string, SpotifyAudioFeatures | null>> {
    const featuresMap = new Map<string, SpotifyAudioFeatures | null>();

    if (isDemoModeActive()) {
      for (const item of MOCK_LIBRARY) {
        featuresMap.set(item.track.id, item.features);
      }
      onProgress?.({ processed: trackIds.length, total: trackIds.length });
      return featuresMap;
    }

    // Spotify GET /v1/audio-features?ids= accepts max 100 IDs
    const batches = chunkArray(trackIds, 100);
    let processedCount = 0;

    // Parallel batch fetching with Promise.all
    const batchPromises = batches.map(async (batch, index) => {
      const idsParam = batch.join(',');
      try {
        const response = await spotifyFetch<SpotifyAudioFeaturesResponse>(
          `/audio-features?ids=${encodeURIComponent(idsParam)}`
        );

        if (response && Array.isArray(response.audio_features)) {
          response.audio_features.forEach((feature, idx) => {
            const trackId = batch[idx];
            if (trackId) {
              featuresMap.set(trackId, feature);
            }
          });
        }
      } catch (err) {
        console.error(`Error fetching audio features batch ${index + 1}:`, err);
        // Mark missing tracks as null so classifier gracefully handles them
        batch.forEach((id) => {
          if (!featuresMap.has(id)) featuresMap.set(id, null);
        });
      } finally {
        processedCount += batch.length;
        onProgress?.({
          processed: Math.min(processedCount, trackIds.length),
          total: trackIds.length,
        });
      }
    });

    await Promise.all(batchPromises);
    return featuresMap;
  },

  /**
   * Fetches user's current playlists with pagination to check for duplicates
   */
  async getUserPlaylists(limit: number = 50): Promise<SpotifyPlaylist[]> {
    if (isDemoModeActive()) {
      return [
        {
          id: 'mock-existing-workout',
          name: 'VibeSync: Workout / Hype',
          description: 'Synchronized with VibeSync',
          public: false,
          collaborative: false,
          snapshot_id: 'snap1',
          images: [{ url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200&h=200&fit=crop', width: 200, height: 200 }],
          tracks: { href: '', total: 8 },
          owner: { id: 'vibesync_demo_user', display_name: 'Demo Curator' },
          uri: 'spotify:playlist:mock-existing-workout',
          external_urls: { spotify: '#' },
        },
      ];
    }

    const playlists: SpotifyPlaylist[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && playlists.length < 200) {
      const data = await spotifyFetch<SpotifyUserPlaylistsResponse>(
        `/me/playlists?limit=${limit}&offset=${offset}`
      );

      playlists.push(...data.items);
      offset += data.items.length;
      hasMore = Boolean(data.next && data.items.length > 0);
    }

    return playlists;
  },

  /**
   * Creates a new playlist for the user
   */
  async createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPublic: boolean = false
  ): Promise<SpotifyPlaylist> {
    if (isDemoModeActive()) {
      const newId = `mock-pl-${Date.now()}`;
      return {
        id: newId,
        name,
        description,
        public: isPublic,
        collaborative: false,
        snapshot_id: 'snap-created',
        images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop', width: 200, height: 200 }],
        tracks: { href: '', total: 0 },
        owner: { id: userId, display_name: 'Curator' },
        uri: `spotify:playlist:${newId}`,
        external_urls: { spotify: 'https://open.spotify.com' },
      };
    }

    return spotifyFetch<SpotifyPlaylist>(`/users/${encodeURIComponent(userId)}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: isPublic,
      }),
    });
  },

  /**
   * Updates playlist details (description / name)
   */
  async updatePlaylistDetails(playlistId: string, name: string, description: string): Promise<void> {
    if (isDemoModeActive()) return;
    await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
  },

  /**
   * Replaces playlist tracks or appends in chunks of 100 URIs
   */
  async setPlaylistTracks(
    playlistId: string,
    trackUris: string[],
    onProgress?: (added: number, total: number) => void
  ): Promise<void> {
    if (isDemoModeActive()) {
      await wait(350);
      onProgress?.(trackUris.length, trackUris.length);
      return;
    }

    // Spotify API limit: Max 100 track URIs per request
    const uriChunks = chunkArray(trackUris, 100);

    if (uriChunks.length === 0) {
      // Empty playlist
      await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [] }),
      });
      return;
    }

    // 1. Replace with first chunk
    const firstChunk = uriChunks[0];
    await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({ uris: firstChunk }),
    });

    let count = firstChunk.length;
    onProgress?.(count, trackUris.length);

    // 2. Append subsequent chunks of 100
    for (let i = 1; i < uriChunks.length; i++) {
      const chunk = uriChunks[i];
      await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: chunk }),
      });
      count += chunk.length;
      onProgress?.(count, trackUris.length);
    }
  },
};
