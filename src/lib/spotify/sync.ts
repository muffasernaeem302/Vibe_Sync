/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MoodCategoryKey,
  TrackWithAudioFeatures,
  SpotifyPlaylist,
  SyncProgressItem,
} from '../../types/spotify';
import { MOOD_CATEGORIES } from '../../utils/classifier';
import { SpotifyClient, chunkArray } from './client';

export interface SyncOptions {
  userId: string;
  moodKey: MoodCategoryKey;
  tracks: TrackWithAudioFeatures[];
  customName?: string;
  isPublic?: boolean;
  onProgress?: (item: SyncProgressItem) => void;
}

/**
 * Checks if a playlist already exists in user's library matching name (case-insensitive).
 */
export function findMatchingPlaylist(
  existingPlaylists: SpotifyPlaylist[],
  targetName: string
): SpotifyPlaylist | undefined {
  const normalizedTarget = targetName.trim().toLowerCase();
  return existingPlaylists.find(
    (pl) => pl.name.trim().toLowerCase() === normalizedTarget
  );
}

/**
 * Extracts and deduplicates track URIs from TrackWithAudioFeatures array.
 */
export function extractTrackUris(tracks: TrackWithAudioFeatures[]): string[] {
  const seen = new Set<string>();
  const uris: string[] = [];

  for (const item of tracks) {
    const uri = item.track?.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      uris.push(uri);
    }
  }

  return uris;
}

/**
 * Synchronizes a single mood bucket to Spotify, checking for duplicates and chunking URIs.
 */
export async function syncMoodPlaylist({
  userId,
  moodKey,
  tracks,
  customName,
  isPublic = false,
  onProgress,
}: SyncOptions): Promise<SyncProgressItem> {
  const moodConfig = MOOD_CATEGORIES[moodKey];
  const playlistName = customName || moodConfig.defaultPlaylistName;
  const trackUris = extractTrackUris(tracks);

  const progress: SyncProgressItem = {
    moodKey,
    moodTitle: moodConfig.title,
    playlistName,
    status: 'checking',
    isExisting: false,
    totalTracks: trackUris.length,
    syncedTracks: 0,
    message: 'Checking for existing playlist...',
  };

  onProgress?.(progress);

  try {
    // 1. Fetch existing user playlists to detect duplicates
    const userPlaylists = await SpotifyClient.getUserPlaylists();
    const existingPlaylist = findMatchingPlaylist(userPlaylists, playlistName);

    let targetPlaylistId: string;
    let targetPlaylistUrl: string;

    if (existingPlaylist) {
      progress.isExisting = true;
      progress.status = 'updating';
      progress.playlistId = existingPlaylist.id;
      progress.playlistUrl = existingPlaylist.external_urls?.spotify;
      progress.message = `Found existing playlist "${existingPlaylist.name}". Updating tracks...`;
      onProgress?.(progress);

      targetPlaylistId = existingPlaylist.id;
      targetPlaylistUrl = existingPlaylist.external_urls?.spotify || `https://open.spotify.com/playlist/${existingPlaylist.id}`;
    } else {
      progress.isExisting = false;
      progress.status = 'creating';
      progress.message = `Creating new playlist "${playlistName}"...`;
      onProgress?.(progress);

      const description = `Synchronized by VibeSync: ${moodConfig.description} (${moodConfig.criteriaSummary})`;
      const created = await SpotifyClient.createPlaylist(
        userId,
        playlistName,
        description,
        isPublic
      );

      targetPlaylistId = created.id;
      targetPlaylistUrl = created.external_urls?.spotify || `https://open.spotify.com/playlist/${created.id}`;
      progress.playlistId = created.id;
      progress.playlistUrl = targetPlaylistUrl;
    }

    // 2. Set playlist tracks in chunks of 100
    await SpotifyClient.setPlaylistTracks(
      targetPlaylistId,
      trackUris,
      (synced, total) => {
        progress.syncedTracks = synced;
        progress.message = `Synced ${synced} of ${total} tracks in batches of 100...`;
        onProgress?.(progress);
      }
    );

    progress.status = 'success';
    progress.syncedTracks = trackUris.length;
    progress.playlistUrl = targetPlaylistUrl;
    progress.message = progress.isExisting
      ? `Successfully updated ${trackUris.length} tracks in "${playlistName}"!`
      : `Successfully created "${playlistName}" with ${trackUris.length} tracks!`;

    onProgress?.(progress);
    return progress;
  } catch (error: any) {
    progress.status = 'error';
    progress.message = error?.message || 'Sync failed due to an unexpected error';
    onProgress?.(progress);
    throw error;
  }
}

/**
 * Synchronizes multiple mood categories sequentially with full progress reporting.
 */
export async function syncMultipleMoodPlaylists({
  userId,
  groupedTracks,
  selectedMoods,
  isPublic = false,
  onProgress,
}: {
  userId: string;
  groupedTracks: Record<MoodCategoryKey, TrackWithAudioFeatures[]>;
  selectedMoods: MoodCategoryKey[];
  isPublic?: boolean;
  onProgress?: (key: MoodCategoryKey, item: SyncProgressItem) => void;
}): Promise<Record<MoodCategoryKey, SyncProgressItem>> {
  const results: Partial<Record<MoodCategoryKey, SyncProgressItem>> = {};

  for (const moodKey of selectedMoods) {
    const tracks = groupedTracks[moodKey] || [];
    if (tracks.length === 0) continue;

    try {
      const result = await syncMoodPlaylist({
        userId,
        moodKey,
        tracks,
        isPublic,
        onProgress: (item) => onProgress?.(moodKey, item),
      });
      results[moodKey] = result;
    } catch (err: any) {
      console.error(`Sync error for mood ${moodKey}:`, err);
    }
  }

  return results as Record<MoodCategoryKey, SyncProgressItem>;
}
