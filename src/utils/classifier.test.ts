/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAudioFeatures } from './classifier';
import { SpotifyAudioFeatures } from '../types/spotify';

function createMockFeatures(partial: Partial<SpotifyAudioFeatures>): SpotifyAudioFeatures {
  return {
    id: 'mock-id',
    danceability: 0.5,
    energy: 0.5,
    key: 0,
    loudness: -5,
    mode: 1,
    speechiness: 0.05,
    acousticness: 0.2,
    instrumentalness: 0.0,
    liveness: 0.1,
    valence: 0.5,
    tempo: 100,
    type: 'audio_features',
    uri: 'spotify:track:mock-id',
    track_href: 'https://api.spotify.com/v1/tracks/mock-id',
    analysis_url: 'https://api.spotify.com/v1/audio-analysis/mock-id',
    duration_ms: 200000,
    time_signature: 4,
    ...partial,
  };
}

test('classifyAudioFeatures handles null or undefined features as unassigned', () => {
  assert.equal(classifyAudioFeatures(null), 'unassigned');
  assert.equal(classifyAudioFeatures(undefined), 'unassigned');
});

test('classifyAudioFeatures identifies Workout / Hype (energy >= 0.65 && tempo >= 120)', () => {
  const hype1 = createMockFeatures({ energy: 0.85, tempo: 130, valence: 0.5 });
  assert.equal(classifyAudioFeatures(hype1), 'workout_hype');

  const boundaryHype = createMockFeatures({ energy: 0.65, tempo: 120, valence: 0.3 });
  assert.equal(classifyAudioFeatures(boundaryHype), 'workout_hype');
});

test('classifyAudioFeatures identifies Sad / Late Night (energy <= 0.40 && valence <= 0.40)', () => {
  const sad1 = createMockFeatures({ energy: 0.25, valence: 0.20, tempo: 80 });
  assert.equal(classifyAudioFeatures(sad1), 'sad_late_night');

  const boundarySad = createMockFeatures({ energy: 0.40, valence: 0.40, tempo: 95 });
  assert.equal(classifyAudioFeatures(boundarySad), 'sad_late_night');
});

test('classifyAudioFeatures identifies Happy / Upbeat (valence >= 0.60 && energy >= 0.50)', () => {
  const happy1 = createMockFeatures({ valence: 0.85, energy: 0.60, tempo: 110 });
  assert.equal(classifyAudioFeatures(happy1), 'happy_upbeat');

  const boundaryHappy = createMockFeatures({ valence: 0.60, energy: 0.50, tempo: 105 });
  assert.equal(classifyAudioFeatures(boundaryHappy), 'happy_upbeat');
});

test('classifyAudioFeatures identifies Romantic / Chill (energy > 0.40 && energy < 0.65 && valence > 0.40 && valence < 0.60)', () => {
  const chill1 = createMockFeatures({ energy: 0.52, valence: 0.48, tempo: 92 });
  assert.equal(classifyAudioFeatures(chill1), 'romantic_chill');

  const chill2 = createMockFeatures({ energy: 0.45, valence: 0.55, tempo: 108 });
  assert.equal(classifyAudioFeatures(chill2), 'romantic_chill');
});

test('classifyAudioFeatures falls back to unassigned for values outside primary bounds', () => {
  // High energy but low tempo (< 120) and not happy (valence < 0.60)
  const misc = createMockFeatures({ energy: 0.75, tempo: 95, valence: 0.35 });
  assert.equal(classifyAudioFeatures(misc), 'unassigned');
});
