/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatchingPlaylist, extractTrackUris } from './sync';
import { chunkArray } from './client';
import { SpotifyPlaylist, TrackWithAudioFeatures } from '../../types/spotify';

test('findMatchingPlaylist detects existing playlists case-insensitively', () => {
  const existing: SpotifyPlaylist[] = [
    {
      id: 'pl-1',
      name: 'VibeSync: Workout / Hype',
      description: null,
      public: false,
      collaborative: false,
      snapshot_id: '1',
      images: [],
      tracks: { href: '', total: 5 },
      owner: { id: 'u1', display_name: 'User 1' },
      uri: 'spotify:playlist:pl-1',
      external_urls: { spotify: '' },
    },
    {
      id: 'pl-2',
      name: 'Daily Mix 1',
      description: null,
      public: false,
      collaborative: false,
      snapshot_id: '1',
      images: [],
      tracks: { href: '', total: 50 },
      owner: { id: 'u1', display_name: 'User 1' },
      uri: 'spotify:playlist:pl-2',
      external_urls: { spotify: '' },
    },
  ];

  // Exact match
  const found1 = findMatchingPlaylist(existing, 'VibeSync: Workout / Hype');
  assert.equal(found1?.id, 'pl-1');

  // Case-insensitive match with extra spaces
  const found2 = findMatchingPlaylist(existing, '  vibesync: workout / hype  ');
  assert.equal(found2?.id, 'pl-1');

  // Non-matching
  const notFound = findMatchingPlaylist(existing, 'VibeSync: Happy / Upbeat');
  assert.equal(notFound, undefined);
});

test('extractTrackUris deduplicates and filters invalid URIs', () => {
  const mockTrackItems: TrackWithAudioFeatures[] = [
    {
      track: {
        id: '1',
        name: 'Track 1',
        uri: 'spotify:track:1',
        duration_ms: 1000,
        preview_url: null,
        popularity: 50,
        artists: [],
        album: { id: 'a1', name: 'Alb', release_date: '2020', uri: '', images: [], external_urls: { spotify: '' } },
        external_urls: { spotify: '' },
      },
      assignedMood: 'workout_hype',
    },
    {
      track: {
        id: '1-duplicate',
        name: 'Track 1 Dupe',
        uri: 'spotify:track:1', // duplicate URI
        duration_ms: 1000,
        preview_url: null,
        popularity: 50,
        artists: [],
        album: { id: 'a1', name: 'Alb', release_date: '2020', uri: '', images: [], external_urls: { spotify: '' } },
        external_urls: { spotify: '' },
      },
      assignedMood: 'workout_hype',
    },
    {
      track: {
        id: '2',
        name: 'Track 2',
        uri: 'spotify:track:2',
        duration_ms: 2000,
        preview_url: null,
        popularity: 60,
        artists: [],
        album: { id: 'a1', name: 'Alb', release_date: '2020', uri: '', images: [], external_urls: { spotify: '' } },
        external_urls: { spotify: '' },
      },
      assignedMood: 'workout_hype',
    },
  ];

  const uris = extractTrackUris(mockTrackItems);
  assert.deepEqual(uris, ['spotify:track:1', 'spotify:track:2']);
});

test('chunkArray splits arrays strictly into chunks of at most max size', () => {
  const items = Array.from({ length: 250 }, (_, i) => `item-${i}`);
  const chunks = chunkArray(items, 100);

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 100);
  assert.equal(chunks[1].length, 100);
  assert.equal(chunks[2].length, 50);
});
