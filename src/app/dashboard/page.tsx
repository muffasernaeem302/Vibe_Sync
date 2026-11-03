/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Zap,
  Smile,
  Activity,
  Layers,
  Filter,
  Info,
  CheckCircle2,
  FolderSync,
  Play,
  Flame,
  Sun,
  HeartHandshake,
  Moon,
  Compass,
} from 'lucide-react';
import {
  TrackWithAudioFeatures,
  MoodCategoryKey,
  SpotifyUserProfile,
  SyncProgressItem,
} from '../../types/spotify';
import {
  MOOD_CATEGORIES,
  MOOD_KEYS_ORDER,
  categorizeTracks,
  groupTracksByMood,
} from '../../utils/classifier';
import { SpotifyClient } from '../../lib/spotify/client';
import { syncMoodPlaylist, syncMultipleMoodPlaylists } from '../../lib/spotify/sync';
import {
  getStoredTokens,
  isDemoModeActive,
  setDemoMode,
  exchangeCodeForTokensPKCE,
  getSpotifyClientId,
} from '../../lib/spotify/auth';
import { Navbar } from '../../components/Navbar';
import { MoodColumn } from '../../components/MoodColumn';
import { SyncModal } from '../../components/SyncModal';
import { ConnectSpotifyModal } from '../../components/ConnectSpotifyModal';

export default function DashboardPage() {
  const [tracks, setTracks] = useState<TrackWithAudioFeatures[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<{ message: string; fetched: number; total: number }>({
    message: 'Initializing VibeSync...',
    fetched: 0,
    total: 0,
  });
  const [userProfile, setUserProfile] = useState<SpotifyUserProfile | null>(null);

  // Modals & UI controls
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncItems, setSyncItems] = useState<SyncProgressItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncCompleted, setIsSyncCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<MoodCategoryKey | 'all'>('all');

  const tokens = getStoredTokens();
  const isConnected = Boolean(tokens?.access_token && !isDemoModeActive());
  const isDemo = isDemoModeActive();

  /**
   * Loads tracks and audio features from Spotify API or Demo Library
   */
  const loadLibraryData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch user profile
      const profile = await SpotifyClient.getCurrentUser();
      setUserProfile(profile);

      // 2. Fetch liked tracks with pagination
      const likedTracks = await SpotifyClient.getLikedTracks(200, (p) => {
        setLoadProgress({
          message: p.message,
          fetched: p.fetched,
          total: p.total,
        });
      });

      // 3. Parallel batch fetching of audio features
      setLoadProgress({
        message: 'Analyzing audio features with parallel batching (chunks of 100)...',
        fetched: 0,
        total: likedTracks.length,
      });

      const trackIds = likedTracks.map((t) => t.id);
      const featuresMap = await SpotifyClient.getAudioFeaturesForTracks(trackIds, (p) => {
        setLoadProgress({
          message: `Extracted audio features for ${p.processed} of ${p.total} tracks...`,
          fetched: p.processed,
          total: p.total,
        });
      });

      // 4. Deterministic categorization
      const categorized = categorizeTracks(likedTracks, featuresMap);
      setTracks(categorized);
    } catch (err: any) {
      console.error('Failed to load library data:', err);
      // If unauthorized and not in demo mode, activate demo mode so app is immediately interactive
      if (!isDemoModeActive()) {
        setDemoMode(true);
        // Retry in demo mode
        const profile = await SpotifyClient.getCurrentUser();
        setUserProfile(profile);
        const likedTracks = await SpotifyClient.getLikedTracks(200);
        const trackIds = likedTracks.map((t) => t.id);
        const featuresMap = await SpotifyClient.getAudioFeaturesForTracks(trackIds);
        setTracks(categorizeTracks(likedTracks, featuresMap));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    // If user has not connected and demo is not set, default to demo mode for initial experience
    if (!tokens?.access_token && !isDemoModeActive()) {
      setDemoMode(true);
    }
    loadLibraryData();
  }, [loadLibraryData]);

  // Listen for OAuth postMessage from popup
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { code, error } = event.data;

        if (error) {
          console.error('Spotify login error from popup:', error);
          setIsLoading(false);
          return;
        }

        if (code) {
          try {
            setIsLoading(true);
            setLoadProgress({
              message: 'Connecting to Spotify and securing access tokens...',
              fetched: 50,
              total: 100,
            });
            const codeVerifier = sessionStorage.getItem('vibesync_code_verifier') || '';
            const clientId = getSpotifyClientId();
            await exchangeCodeForTokensPKCE(code, codeVerifier, clientId);
            setConnectModalOpen(false);
            await loadLibraryData();
          } catch (err: any) {
            console.error('Failed to exchange Spotify authorization code:', err);
            setIsLoading(false);
          }
        } else {
          setConnectModalOpen(false);
          await loadLibraryData();
        }
      }
    };
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [loadLibraryData]);

  /**
   * Manually reassign a track to a new mood column
   */
  const handleMoveMood = (trackId: string, newMood: MoodCategoryKey) => {
    setTracks((prev) =>
      prev.map((item) => {
        if (item.track.id === trackId) {
          return {
            ...item,
            assignedMood: newMood,
            manuallyAssigned: true,
          };
        }
        return item;
      })
    );
  };

  /**
   * Filter tracks by search query
   */
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase().trim();
    return tracks.filter(
      (item) =>
        item.track.name.toLowerCase().includes(q) ||
        item.track.artists?.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [tracks, searchQuery]);

  /**
   * Group tracks by mood category
   */
  const groupedTracks = useMemo(() => {
    return groupTracksByMood(filteredTracks);
  }, [filteredTracks]);

  /**
   * Computes overall average audio features
   */
  const stats = useMemo(() => {
    const total = tracks.length;
    if (total === 0) return { avgEnergy: 0, avgValence: 0, avgTempo: 0 };

    let sumEnergy = 0;
    let sumValence = 0;
    let sumTempo = 0;
    let validFeatures = 0;

    for (const item of tracks) {
      if (item.audioFeatures) {
        sumEnergy += item.audioFeatures.energy;
        sumValence += item.audioFeatures.valence;
        sumTempo += item.audioFeatures.tempo;
        validFeatures++;
      }
    }

    return {
      avgEnergy: validFeatures ? Math.round((sumEnergy / validFeatures) * 100) : 0,
      avgValence: validFeatures ? Math.round((sumValence / validFeatures) * 100) : 0,
      avgTempo: validFeatures ? Math.round(sumTempo / validFeatures) : 0,
    };
  }, [tracks]);

  /**
   * Sync a single mood column
   */
  const handleSyncColumn = async (moodKey: MoodCategoryKey) => {
    const columnTracks = groupedTracks[moodKey];
    if (!columnTracks || columnTracks.length === 0) return;

    setIsSyncing(true);
    setIsSyncCompleted(false);
    setSyncModalOpen(true);

    const initialItem: SyncProgressItem = {
      moodKey,
      moodTitle: MOOD_CATEGORIES[moodKey].title,
      playlistName: MOOD_CATEGORIES[moodKey].defaultPlaylistName,
      status: 'checking',
      isExisting: false,
      totalTracks: columnTracks.length,
      syncedTracks: 0,
      message: 'Checking for existing playlist...',
    };
    setSyncItems([initialItem]);

    try {
      const result = await syncMoodPlaylist({
        userId: userProfile?.id || 'me',
        moodKey,
        tracks: columnTracks,
        onProgress: (progress) => {
          setSyncItems([progress]);
        },
      });
      setSyncItems([result]);
      setIsSyncCompleted(true);
    } catch (err: any) {
      console.error('Column sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Sync all mood columns sequentially
   */
  const handleSyncAll = async () => {
    const activeMoods = MOOD_KEYS_ORDER.filter(
      (key) => groupedTracks[key] && groupedTracks[key].length > 0
    );

    if (activeMoods.length === 0) return;

    setIsSyncing(true);
    setIsSyncCompleted(false);
    setSyncModalOpen(true);

    const initialProgress = activeMoods.map((key) => ({
      moodKey: key,
      moodTitle: MOOD_CATEGORIES[key].title,
      playlistName: MOOD_CATEGORIES[key].defaultPlaylistName,
      status: 'idle' as const,
      isExisting: false,
      totalTracks: groupedTracks[key].length,
      syncedTracks: 0,
      message: 'Queued for sync...',
    }));
    setSyncItems(initialProgress);

    try {
      await syncMultipleMoodPlaylists({
        userId: userProfile?.id || 'me',
        groupedTracks,
        selectedMoods: activeMoods,
        onProgress: (key, updatedItem) => {
          setSyncItems((prev) =>
            prev.map((item) => (item.moodKey === key ? updatedItem : item))
          );
        },
      });
      setIsSyncCompleted(true);
    } catch (err: any) {
      console.error('Sync all error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-[#1DB954] selection:text-black">
      {/* Sticky Navbar */}
      <Navbar
        userProfile={userProfile}
        isConnected={isConnected}
        isDemo={isDemo}
        totalTracks={tracks.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenConnectModal={() => setConnectModalOpen(true)}
        onSyncAll={handleSyncAll}
        onRefreshData={loadLibraryData}
        isLoading={isLoading}
        isSyncing={isSyncing}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-6 sm:px-6 max-w-[1920px] mx-auto w-full flex flex-col gap-6">
        {/* Top Summary Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 backdrop-blur-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1DB954]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1DB954] border border-[#1DB954]/30">
                  <Sparkles className="h-3 w-3" />
                  Deterministic Vibe Engine
                </span>
                {isDemo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/30">
                    Curated Demo Library Active
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                Spotify Liked Tracks Mood Matrix
              </h1>
              <p className="text-xs text-zinc-400 max-w-2xl">
                Parallel chunked audio-features analysis categorizes songs into 5 distinct psychological vibes. Reassign songs by dragging or using the move menu, then sync directly to Spotify with smart duplicate protection.
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                  <Layers className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Total Tracks</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">{tracks.length}</div>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Avg Energy</span>
                </div>
                <div className="text-xl font-bold text-amber-400 mt-1">{stats.avgEnergy}%</div>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                  <Smile className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Avg Valence</span>
                </div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{stats.avgValence}%</div>
              </div>

              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Avg Tempo</span>
                </div>
                <div className="text-xl font-bold text-cyan-400 mt-1">{stats.avgTempo} BPM</div>
              </div>
            </div>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1 mr-1">
              <Filter className="h-3.5 w-3.5 text-zinc-500" />
              Focus Column:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMoodFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedMoodFilter === 'all'
                  ? 'bg-zinc-200 text-black font-semibold'
                  : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              All Columns ({tracks.length})
            </button>
            {MOOD_KEYS_ORDER.map((key) => {
              const cfg = MOOD_CATEGORIES[key];
              const count = groupedTracks[key]?.length || 0;
              const isSelected = selectedMoodFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedMoodFilter(key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-zinc-200 text-black font-semibold'
                      : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {cfg.title} ({count})
                </button>
              );
            })}
          </div>
        </section>

        {/* Loading Progress State */}
        {isLoading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1DB954]/20 text-[#1DB954] animate-pulse">
              <FolderSync className="h-6 w-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-zinc-100">
                Fetching &amp; Analyzing Liked Tracks
              </h3>
              <p className="text-xs text-zinc-400">{loadProgress.message}</p>
            </div>
            {loadProgress.total > 0 && (
              <div className="max-w-md mx-auto w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#1DB954] h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((loadProgress.fetched / loadProgress.total) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Mood Columns Board (Horizontal scrollable board) */}
        {!isLoading && (
          <div className="flex-1 flex gap-4 overflow-x-auto pb-6 pt-1">
            {MOOD_KEYS_ORDER.filter(
              (key) => selectedMoodFilter === 'all' || selectedMoodFilter === key
            ).map((key) => (
              <MoodColumn
                key={key}
                moodKey={key}
                tracks={groupedTracks[key] || []}
                onMoveMood={handleMoveMood}
                onSyncColumn={handleSyncColumn}
                isSyncing={isSyncing}
              />
            ))}
          </div>
        )}
      </main>

      {/* Sync Execution Modal */}
      <SyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        items={syncItems}
        isCompleted={isSyncCompleted}
      />

      {/* Connect Spotify / Credentials Modal */}
      <ConnectSpotifyModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        isConnected={isConnected}
        isDemo={isDemo}
        onAuthSuccess={loadLibraryData}
      />
    </div>
  );
}
