/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ExternalLink,
  GripVertical,
  Zap,
  Smile,
  Activity,
  Music2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { TrackWithAudioFeatures, MoodCategoryKey } from '../types/spotify';
import { MOOD_CATEGORIES, MOOD_KEYS_ORDER } from '../utils/classifier';

interface TrackCardProps {
  item: TrackWithAudioFeatures;
  onMoveMood: (trackId: string, newMood: MoodCategoryKey) => void;
  onDragStart: (e: React.DragEvent, trackId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  item,
  onMoveMood,
  onDragStart,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const { track, audioFeatures, assignedMood, manuallyAssigned } = item;

  const currentMood = MOOD_CATEGORIES[assignedMood];
  const albumImage = track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop';
  const artistNames = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';

  const energyPct = audioFeatures ? Math.round(audioFeatures.energy * 100) : null;
  const valencePct = audioFeatures ? Math.round(audioFeatures.valence * 100) : null;
  const tempoBpm = audioFeatures ? Math.round(audioFeatures.tempo) : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, track.id)}
      className="group relative rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3.5 backdrop-blur-md transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/80 hover:shadow-lg hover:shadow-black/40 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div
          className="mt-1 text-zinc-600 transition-colors group-hover:text-zinc-400"
          title="Drag to move between mood categories"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Album Artwork */}
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800 shadow-md">
          <img
            src={albumImage}
            alt={track.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        {/* Track Title and Artist */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="truncate text-sm font-semibold text-zinc-100 group-hover:text-[#1DB954] transition-colors" title={track.name}>
              {track.name}
            </h4>
            <a
              href={track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-[#1DB954] p-0.5 rounded transition-colors"
              title="Open track in Spotify"
              aria-label={`Open ${track.name} on Spotify`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <p className="truncate text-xs text-zinc-400" title={artistNames}>
            {artistNames}
          </p>
        </div>
      </div>

      {/* Audio Features Metrics Bar */}
      {audioFeatures ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg bg-zinc-950/60 p-2 border border-zinc-800/50 text-[11px]">
          <div className="flex items-center gap-1.5" title={`Energy: ${energyPct}%`}>
            <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-mono">Energy</span>
              <span className="font-semibold text-zinc-200">{energyPct}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5" title={`Valence (Positivity): ${valencePct}%`}>
            <Smile className="h-3 w-3 text-emerald-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-mono">Valence</span>
              <span className="font-semibold text-zinc-200">{valencePct}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5" title={`Tempo: ${tempoBpm} BPM`}>
            <Activity className="h-3 w-3 text-cyan-400 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-mono">Tempo</span>
              <span className="font-semibold text-zinc-200">{tempoBpm} bpm</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-zinc-500 italic">
          Audio features calculating...
        </div>
      )}

      {/* Mood category tag & quick switch */}
      <div className="mt-3 flex items-center justify-between border-t border-zinc-800/50 pt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${currentMood.badgeColor}`}
          >
            {manuallyAssigned && <Sparkles className="h-2.5 w-2.5" />}
            {currentMood.title}
          </span>
          {manuallyAssigned && (
            <span className="text-[10px] text-zinc-500">Custom</span>
          )}
        </div>

        {/* Move dropdown button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label={`Move ${track.name} to another mood`}
          >
            <span>Move</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {showMoveMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMoveMenu(false)}
              />
              <div className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-black/80">
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Reassign Mood:
                </div>
                {MOOD_KEYS_ORDER.map((key) => {
                  const targetConfig = MOOD_CATEGORIES[key];
                  const isCurrent = key === assignedMood;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => {
                        onMoveMood(track.id, key);
                        setShowMoveMenu(false);
                      }}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors ${
                        isCurrent
                          ? 'bg-zinc-800/50 text-zinc-500 cursor-default'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <span>{targetConfig.title}</span>
                      {isCurrent && <span className="text-[10px] text-zinc-500">Current</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
