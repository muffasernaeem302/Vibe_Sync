/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { SyncProgressItem } from '../types/spotify';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SyncProgressItem[];
  isCompleted: boolean;
  overallTitle?: string;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  items,
  isCompleted,
  overallTitle = 'Synchronizing Playlists with Spotify',
}) => {
  if (!isOpen) return null;

  const totalSuccess = items.filter((i) => i.status === 'success').length;
  const hasErrors = items.some((i) => i.status === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-zinc-100">{overallTitle}</h3>
              <p className="text-xs text-zinc-400">
                Chunked batching &amp; duplicate prevention engine active
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close sync modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sync Feature Callout */}
        <div className="my-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-3.5 flex items-center gap-3 text-xs text-zinc-300">
          <ShieldCheck className="h-5 w-5 text-[#1DB954] flex-shrink-0" />
          <div>
            <strong className="text-zinc-100">Smart Deduplication:</strong> VibeSync scans existing playlists before creating new ones and writes tracks in chunks of 100 to honor Spotify API limits.
          </div>
        </div>

        {/* Progress Items List */}
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {items.map((item) => {
            return (
              <div
                key={item.moodKey}
                className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-200">
                        {item.playlistName}
                      </span>
                      {item.isExisting && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
                          Existing Playlist (Updated)
                        </span>
                      )}
                      {!item.isExisting && item.status === 'success' && (
                        <span className="rounded bg-[#1DB954]/20 px-2 py-0.5 text-[10px] font-semibold text-[#1DB954] border border-[#1DB954]/30">
                          New Playlist Created
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">{item.message}</p>
                  </div>

                  {/* Status Indicator */}
                  <div className="flex-shrink-0">
                    {item.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-[#1DB954]" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-rose-500" />
                    )}
                    {(item.status === 'checking' ||
                      item.status === 'creating' ||
                      item.status === 'updating') && (
                      <RefreshCw className="h-5 w-5 text-amber-400 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Progress bar and link */}
                <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-zinc-800/50 text-xs">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {item.syncedTracks} / {item.totalTracks} tracks processed
                    </span>
                  </div>

                  {item.playlistUrl && (
                    <a
                      href={item.playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#1DB954] hover:underline"
                    >
                      <span>Open on Spotify</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <div className="text-xs text-zinc-400">
            {isCompleted ? (
              <span className="text-[#1DB954] font-medium">
                Sync completed: {totalSuccess} playlist{totalSuccess === 1 ? '' : 's'} synchronized
              </span>
            ) : (
              <span className="text-zinc-400">Synchronizing tracks in background...</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-800 px-5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            {isCompleted ? 'Done' : 'Close View'}
          </button>
        </div>
      </div>
    </div>
  );
};
