import React, { useRef } from 'react';
import { VideoClip, StickerOverlay, SfxTrackItem } from '../../types/timeline';

interface TimelineMinimapProps {
  clips: VideoClip[];
  overlays: StickerOverlay[];
  sfxTracks: SfxTrackItem[];
  totalDuration: number;
  projectEndSec: number;
  currentTime: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  timelineWidth: number;
  pixelsPerSecond: number;
  onSeek: (time: number) => void;
}

export const TimelineMinimap: React.FC<TimelineMinimapProps> = ({
  clips,
  overlays,
  sfxTracks,
  totalDuration,
  projectEndSec,
  currentTime,
  containerRef,
  timelineWidth,
  pixelsPerSecond,
  onSeek,
}) => {
  const minimapRef = useRef<HTMLDivElement>(null);

  // Effective duration for the minimap view
  const mapDuration = Math.max(projectEndSec + 1, totalDuration);

  // Convert timeline second to percentage (0% to 100%)
  const toPercent = (timeSec: number) => {
    return Math.min(100, Math.max(0, (timeSec / mapDuration) * 100));
  };

  // Handle click to seek
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const seekTime = ratio * mapDuration;
    onSeek(Math.min(projectEndSec, Math.max(0, seekTime)));

    // Also scroll the main container to center around this time
    if (containerRef.current) {
      const targetScroll = 112 + seekTime * pixelsPerSecond - containerRef.current.clientWidth / 2;
      containerRef.current.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  };

  // Calculate visible viewport window in minimap
  let viewportLeftPercent = 0;
  let viewportWidthPercent = 100;
  if (containerRef.current && timelineWidth > 0) {
    const scrollLeft = containerRef.current.scrollLeft;
    const clientWidth = containerRef.current.clientWidth;
    const visibleStartSec = Math.max(0, (scrollLeft - 112) / pixelsPerSecond);
    const visibleDuration = clientWidth / pixelsPerSecond;

    viewportLeftPercent = toPercent(visibleStartSec);
    viewportWidthPercent = Math.min(100 - viewportLeftPercent, (visibleDuration / mapDuration) * 100);
  }

  const playheadPercent = toPercent(currentTime);

  return (
    <div className="relative w-full h-7 bg-slate-950/90 border-b border-slate-800/80 px-2 py-1 select-none flex items-center">
      <div
        ref={minimapRef}
        onClick={handleMinimapClick}
        className="relative w-full h-full bg-slate-900/90 rounded border border-slate-800 overflow-hidden cursor-pointer group shadow-inner"
      >
        {/* Layer 1: Overlays (Top strip) */}
        {overlays.map((ov) => (
          <div
            key={ov.id}
            style={{
              left: `${toPercent(ov.startTimelineTime)}%`,
              width: `${Math.max(0.6, (ov.duration / mapDuration) * 100)}%`,
            }}
            className="absolute top-0.5 h-1 bg-purple-400/80 rounded-xs pointer-events-none"
            title={`Overlay: ${ov.label}`}
          />
        ))}

        {/* Layer 2: Video Clips (Middle main strip) */}
        {clips.map((clip) => (
          <div
            key={clip.id}
            style={{
              left: `${toPercent(clip.startTimelineTime)}%`,
              width: `${Math.max(0.8, (clip.duration / mapDuration) * 100)}%`,
            }}
            className="absolute top-2 h-1.5 bg-indigo-500/90 rounded-xs border-r border-indigo-300/40 pointer-events-none shadow-xs"
            title={`Video: ${clip.name}`}
          />
        ))}

        {/* Layer 3: Audio Clips (Lower strip) */}
        {clips.map((clip) => (
          <div
            key={`audio-${clip.id}`}
            style={{
              left: `${toPercent(clip.startTimelineTime)}%`,
              width: `${Math.max(0.8, (clip.duration / mapDuration) * 100)}%`,
            }}
            className="absolute top-4 h-1 bg-sky-400/80 rounded-xs pointer-events-none"
            title={`Audio: ${clip.name}`}
          />
        ))}

        {/* Layer 4: SFX Tracks (Bottom strip) */}
        {sfxTracks.map((sfx) => (
          <div
            key={sfx.id}
            style={{
              left: `${toPercent(sfx.startTimelineTime)}%`,
              width: `${Math.max(0.6, (sfx.duration / mapDuration) * 100)}%`,
            }}
            className="absolute top-5 h-1 bg-emerald-400/90 rounded-xs pointer-events-none"
            title={`SFX: ${sfx.name}`}
          />
        ))}

        {/* End of Project Demarcator */}
        <div
          style={{ left: `${toPercent(projectEndSec)}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-amber-500 pointer-events-none z-10"
        />

        {/* Visible Viewport Window */}
        <div
          style={{
            left: `${viewportLeftPercent}%`,
            width: `${Math.max(2, viewportWidthPercent)}%`,
          }}
          className="absolute top-0 bottom-0 bg-indigo-400/15 border border-indigo-400/50 rounded-xs pointer-events-none z-10 shadow-xs"
        />

        {/* Playhead Marker */}
        <div
          style={{ left: `${playheadPercent}%` }}
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-[0_0_4px_rgba(239,68,68,0.8)]"
        />
      </div>
    </div>
  );
};
