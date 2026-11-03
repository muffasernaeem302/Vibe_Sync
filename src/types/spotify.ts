/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  popularity: number;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  external_urls: {
    spotify: string;
  };
}

export interface SavedTrackItem {
  added_at: string;
  track: SpotifyTrack;
}

export interface SpotifySavedTracksResponse {
  href: string;
  items: SavedTrackItem[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  type: string;
  uri: string;
  track_href: string;
  analysis_url: string;
  duration_ms: number;
  time_signature: number;
}

export interface SpotifyAudioFeaturesResponse {
  audio_features: (SpotifyAudioFeatures | null)[];
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string;
  email?: string;
  images?: SpotifyImage[];
  product?: string;
  country?: string;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  snapshot_id: string;
  images: SpotifyImage[];
  tracks: {
    href: string;
    total: number;
  };
  owner: {
    id: string;
    display_name: string;
  };
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyUserPlaylistsResponse {
  href: string;
  items: SpotifyPlaylist[];
  limit: number;
  next: string | null;
  offset: number;
  total: number;
}

export type MoodCategoryKey = 
  | 'workout_hype'
  | 'sad_late_night'
  | 'happy_upbeat'
  | 'romantic_chill'
  | 'unassigned';

export interface MoodCategoryConfig {
  key: MoodCategoryKey;
  title: string;
  description: string;
  badgeColor: string;
  accentHex: string;
  iconName: string;
  criteriaSummary: string;
  defaultPlaylistName: string;
}

export interface TrackWithAudioFeatures {
  track: SpotifyTrack;
  audioFeatures?: SpotifyAudioFeatures | null;
  assignedMood: MoodCategoryKey;
  manuallyAssigned?: boolean;
}

export interface SyncProgressItem {
  moodKey: MoodCategoryKey;
  moodTitle: string;
  playlistId?: string;
  playlistName: string;
  playlistUrl?: string;
  status: 'idle' | 'checking' | 'creating' | 'updating' | 'success' | 'error';
  isExisting: boolean;
  totalTracks: number;
  syncedTracks: number;
  message?: string;
}

export interface SpotifyAuthTokens {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
  expires_at?: number; // epoch ms
}
