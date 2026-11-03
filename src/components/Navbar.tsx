/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Sparkles,
  RefreshCw,
  FolderSync,
  SlidersHorizontal,
  Search,
  CheckCircle,
  Radio,
} from 'lucide-react';
import { SpotifyUserProfile } from '../types/spotify';

interface NavbarProps {
  userProfile: SpotifyUserProfile | null;
  isConnected: boolean;
  isDemo: boolean;
  totalTracks: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenConnectModal: () => void;
  onSyncAll: () => void;
  onRefreshData: () => void;
  isLoading: boolean;
  isSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  userProfile,
  isConnected,
  isDemo,
  totalTracks,
  searchQuery,
  onSearchChange,
  onOpenConnectModal,
  onSyncAll,
  onRefreshData,
  isLoading,
  isSyncing,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1DB954] to-emerald-600 shadow-lg shadow-[#1DB954]/25">
            <Radio className="h-5 w-5 text-black font-extrabold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">VibeSync</span>
              <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 border border-zinc-700/50">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Deterministic Audio-Feature Mood Categorizer
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search songs or artists..."
            className="w-full rounded-xl bg-zinc-900/90 border border-zinc-800/80 pl-9 pr-3.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-[#1DB954] focus:outline-none transition-colors"
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
        </div>

        {/* Right Actions & Status */}
        <div className="flex items-center gap-2.5">
          {/* Refresh Liked Tracks Button */}
          <button
            type="button"
            onClick={onRefreshData}
            disabled={isLoading || isSyncing}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-all disabled:opacity-50"
            title="Refetch Liked Tracks & Audio Features"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#1DB954]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Sync All Playlists Button */}
          <button
            type="button"
            onClick={onSyncAll}
            disabled={isSyncing || totalTracks === 0}
            className="flex items-center gap-1.5 rounded-xl bg-[#1DB954] px-4 py-2 text-xs font-bold text-black hover:bg-[#1ed760] transition-all shadow-md shadow-[#1DB954]/20 disabled:opacity-50"
            title="Synchronize all mood playlists to Spotify with duplicate prevention"
          >
            <FolderSync className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All to Spotify'}</span>
          </button>

          {/* User Profile / Connect Button */}
          <button
            type="button"
            onClick={onOpenConnectModal}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
              isConnected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : isDemo
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-white'
            }`}
          >
            {userProfile?.images?.[0]?.url ? (
              <img
                src={userProfile.images[0].url}
                alt={userProfile.display_name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <SlidersHorizontal className="h-3.5 w-3.5" />
            )}
            <span className="max-w-[100px] truncate">
              {isConnected
                ? userProfile?.display_name || 'Connected'
                : isDemo
                ? 'Demo Mode'
                : 'Connect'}
            </span>
            {isConnected && <CheckCircle className="h-3 w-3 text-[#1DB954]" />}
          </button>
        </div>
      </div>
    </header>
  );
};
