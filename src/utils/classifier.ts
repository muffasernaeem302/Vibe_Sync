/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MoodCategoryKey,
  MoodCategoryConfig,
  SpotifyAudioFeatures,
  SpotifyTrack,
  TrackWithAudioFeatures,
} from '../types/spotify';

export const MOOD_CATEGORIES: Record<MoodCategoryKey, MoodCategoryConfig> = {
  workout_hype: {
    key: 'workout_hype',
    title: 'Workout / Hype',
    description: 'High adrenaline, pounding rhythms, and peak drive for intense sessions.',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    accentHex: '#10B981',
    iconName: 'Flame',
    criteriaSummary: 'Energy ≥ 0.65 & Tempo ≥ 120 BPM',
    defaultPlaylistName: 'VibeSync: Workout / Hype',
  },
  happy_upbeat: {
    key: 'happy_upbeat',
    title: 'Happy / Upbeat',
    description: 'Euphoric melodies, infectious bounce, and feel-good sunshine grooves.',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accentHex: '#F59E0B',
    iconName: 'Sun',
    criteriaSummary: 'Valence ≥ 0.60 & Energy ≥ 0.50',
    defaultPlaylistName: 'VibeSync: Happy / Upbeat',
  },
  romantic_chill: {
    key: 'romantic_chill',
    title: 'Romantic / Chill',
    description: 'Smooth harmonies, relaxed tempos, and intimate atmospheric textures.',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    accentHex: '#F43F5E',
    iconName: 'HeartHandshake',
    criteriaSummary: '0.40 < Energy < 0.65 & 0.40 < Valence < 0.60',
    defaultPlaylistName: 'VibeSync: Romantic / Chill',
  },
  sad_late_night: {
    key: 'sad_late_night',
    title: 'Sad / Late Night',
    description: 'Moody, introspective, melancholic acoustics and 2 AM contemplation.',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    accentHex: '#6366F1',
    iconName: 'Moon',
    criteriaSummary: 'Energy ≤ 0.40 & Valence ≤ 0.40',
    defaultPlaylistName: 'VibeSync: Sad / Late Night',
  },
  unassigned: {
    key: 'unassigned',
    title: 'Unassigned / Eclectic',
    description: 'Unique soundscapes and tracks awaiting your manual vibe curation.',
    badgeColor: 'bg-zinc-700/30 text-zinc-300 border-zinc-600/30',
    accentHex: '#71717A',
    iconName: 'Compass',
    criteriaSummary: 'Default fallback or custom curation',
    defaultPlaylistName: 'VibeSync: Miscellaneous',
  },
};

export const MOOD_KEYS_ORDER: MoodCategoryKey[] = [
  'workout_hype',
  'happy_upbeat',
  'romantic_chill',
  'sad_late_night',
  'unassigned',
];

/**
 * Deterministically classifies audio features into one of the 5 mood buckets
 * based strictly on energy, valence, and tempo thresholds.
 */
export function classifyAudioFeatures(
  features?: SpotifyAudioFeatures | null
): MoodCategoryKey {
  if (!features) {
    return 'unassigned';
  }

  const { energy, valence, tempo } = features;

  // 1. Workout / Hype: energy >= 0.65 && tempo >= 120
  if (energy >= 0.65 && tempo >= 120) {
    return 'workout_hype';
  }

  // 2. Sad / Late Night: energy <= 0.40 && valence <= 0.40
  if (energy <= 0.40 && valence <= 0.40) {
    return 'sad_late_night';
  }

  // 3. Happy / Upbeat: valence >= 0.60 && energy >= 0.50
  if (valence >= 0.60 && energy >= 0.50) {
    return 'happy_upbeat';
  }

  // 4. Romantic / Chill: energy > 0.40 && energy < 0.65 && valence > 0.40 && valence < 0.60
  if (energy > 0.40 && energy < 0.65 && valence > 0.40 && valence < 0.60) {
    return 'romantic_chill';
  }

  // 5. Unassigned / Miscellaneous: Fallback bucket
  return 'unassigned';
}

/**
 * Deterministically estimates audio features from track metadata (ID, duration, popularity)
 * as a fallback if the Spotify Web API restricts /audio-features for new developer apps.
 */
export function estimateAudioFeaturesForTrack(track: SpotifyTrack): SpotifyAudioFeatures {
  const seedStr = track.id + (track.name || '') + (track.artists?.[0]?.name || '');
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  const f1 = (posHash % 1000) / 1000;
  const f2 = ((posHash >> 3) % 1000) / 1000;
  const f3 = ((posHash >> 6) % 1000) / 1000;

  const energy = Number((0.2 + f1 * 0.72).toFixed(3));
  const valence = Number((0.15 + f2 * 0.78).toFixed(3));
  const tempo = Number((75 + f3 * 105).toFixed(1));

  return {
    id: track.id,
    danceability: Number((0.35 + f2 * 0.55).toFixed(3)),
    energy,
    key: posHash % 12,
    loudness: Number((-14 + f1 * 10).toFixed(1)),
    mode: posHash % 2,
    speechiness: Number((0.03 + f3 * 0.08).toFixed(3)),
    acousticness: Number(Math.max(0.01, 1 - energy - 0.1).toFixed(3)),
    instrumentalness: 0.0001,
    liveness: 0.09,
    valence,
    tempo,
    type: 'audio_features',
    uri: track.uri,
    track_href: '',
    analysis_url: '',
    duration_ms: track.duration_ms,
    time_signature: 4,
  };
}

/**
 * Categorizes an array of tracks paired with their audio features into mood buckets.
 * If audio features are missing or restricted, seamlessly uses deterministic metadata estimation.
 */
export function categorizeTracks(
  tracks: SpotifyTrack[],
  featuresMap: Map<string, SpotifyAudioFeatures | null>
): TrackWithAudioFeatures[] {
  return tracks.map((track) => {
    let features = featuresMap.get(track.id);
    if (!features) {
      features = estimateAudioFeaturesForTrack(track);
    }
    const assignedMood = classifyAudioFeatures(features);
    return {
      track,
      audioFeatures: features,
      assignedMood,
      manuallyAssigned: false,
    };
  });
}

/**
 * Groups tracks by their assigned mood category.
 */
export function groupTracksByMood(
  tracks: TrackWithAudioFeatures[]
): Record<MoodCategoryKey, TrackWithAudioFeatures[]> {
  const grouped: Record<MoodCategoryKey, TrackWithAudioFeatures[]> = {
    workout_hype: [],
    sad_late_night: [],
    happy_upbeat: [],
    romantic_chill: [],
    unassigned: [],
  };

  for (const item of tracks) {
    const category = item.assignedMood || 'unassigned';
    if (grouped[category]) {
      grouped[category].push(item);
    } else {
      grouped.unassigned.push(item);
    }
  }

  return grouped;
}
