/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Flame,
  Sun,
  HeartHandshake,
  Moon,
  Compass,
  RefreshCw,
  FolderSync,
  Music,
} from 'lucide-react';
import { MoodCategoryKey, TrackWithAudioFeatures } from '../types/spotify';
import { MOOD_CATEGORIES } from '../utils/classifier';
import { TrackCard } from './TrackCard';

interface MoodColumnProps {
  moodKey: MoodCategoryKey;
  tracks: TrackWithAudioFeatures[];
  onMoveMood: (trackId: string, newMood: MoodCategoryKey) => void;
  onSyncColumn: (moodKey: MoodCategoryKey) => void;
  isSyncing: boolean;
}

export const MoodColumn: React.FC<MoodColumnProps> = ({
  moodKey,
  tracks,
  onMoveMood,
  onSyncColumn,
  isSyncing,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = MOOD_CATEGORIES[moodKey];

  const renderIcon = () => {
    const props = { className: 'h-5 w-5', style: { color: config.accentHex } };
    switch (config.iconName) {
      case 'Flame':
        return <Flame {...props} />;
      case 'Sun':
        return <Sun {...props} />;
      case 'HeartHandshake':
        return <HeartHandshake {...props} />;
      case 'Moon':
        return <Moon {...props} />;
      default:
        return <Compass {...props} />;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const trackId = e.dataTransfer.getData('text/plain');
    if (trackId) {
      onMoveMood(trackId, moodKey);
    }
  };

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    e.dataTransfer.setData('text/plain', trackId);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-[750px] min-w-[320px] max-w-[380px] flex-1 rounded-2xl border transition-all duration-300 ${
        isDragOver
          ? 'border-[#1DB954] bg-zinc-900/90 shadow-2xl shadow-[#1DB954]/20 scale-[1.01]'
          : 'border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl hover:border-zinc-700/80'
      }`}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-zinc-800/60 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner"
              style={{ borderColor: `${config.accentHex}33` }}
            >
              {renderIcon()}
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                {config.title}
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                  {tracks.length}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 line-clamp-1">{config.description}</p>
            </div>
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={() => onSyncColumn(moodKey)}
            disabled={isSyncing || tracks.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tracks.length === 0
                ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed'
                : 'bg-zinc-800 text-zinc-200 hover:bg-[#1DB954] hover:text-black hover:font-semibold shadow-sm'
            }`}
            title={`Sync ${config.title} to Spotify`}
            aria-label={`Sync ${config.title} to Spotify`}
          >
            {isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderSync className="h-3.5 w-3.5" />
            )}
            <span>Sync</span>
          </button>
        </div>

        {/* Criteria summary badge */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-900/80 px-2.5 py-1.5 rounded-md border border-zinc-800/60">
          <span className="font-mono text-zinc-400">{config.criteriaSummary}</span>
          <span className="text-zinc-500 text-[10px]">Auto-rule</span>
        </div>
      </div>

      {/* Tracks Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tracks.length > 0 ? (
          tracks.map((item) => (
            <TrackCard
              key={item.track.id}
              item={item}
              onMoveMood={onMoveMood}
              onDragStart={handleDragStart}
            />
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-zinc-500 border-2 border-dashed border-zinc-800/60 rounded-xl">
            <Music className="h-8 w-8 mb-2 text-zinc-600 stroke-[1.5]" />
            <p className="text-xs font-medium text-zinc-400">No tracks in this vibe</p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-[200px]">
              Drag songs here or use the &quot;Move&quot; option on any track card.
            </p>
          </div>
        )}
      </div>

      {/* Column Footer */}
      <div className="p-2.5 border-t border-zinc-800/60 text-center text-[11px] text-zinc-500 bg-zinc-950/40">
        <span>Playlist: <strong className="text-zinc-400">{config.defaultPlaylistName}</strong></span>
      </div>
    </div>
  );
};
