import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Volume2,
  VolumeX,
  Crosshair,
  Sparkles,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  TranscriptWord,
  CaptionTemplate,
} from '../../types/timeline';
import { renderCompositedFrame } from '../../core/video/canvasRenderer';
import { playSfxInstant } from '../../core/audio/sfxSynthesizer';
import { calculatePunchZoom } from '../../core/video/punchZoomEngine';

interface CanvasPlayerProps {
  currentTime: number;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean | ((prev: boolean) => boolean)) => void;
  clips: VideoClip[];
  overlays: StickerOverlay[];
  zoomKeyframes: DynamicZoomKeyframe[];
  sfxTracks: SfxTrackItem[];
  videoElements: Map<string, HTMLVideoElement>;
  resolution: string; // '1080x1920'
  onSelectOverlay?: (id: string) => void;
  selectedOverlayId?: string | null;
  onUpdateOverlayPos?: (id: string, x: number, y: number) => void;
  words?: TranscriptWord[];
  captionTemplate?: CaptionTemplate;
  hookTitle?: string | null;
}

export const CanvasPlayer: React.FC<CanvasPlayerProps> = ({
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  clips,
  overlays,
  zoomKeyframes,
  sfxTracks,
  videoElements,
  resolution,
  onSelectOverlay,
  selectedOverlayId,
  onUpdateOverlayPos,
  words = [],
  captionTemplate,
  hookTitle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const lastTriggeredSfxRef = useRef<Set<string>>(new Set());

  // Parse width/height from resolution string
  const [targetWidth, targetHeight] = resolution.split('x').map(Number);
  const aspectRatio = targetWidth / targetHeight;

  // Calculate total duration
  const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.startTimelineTime + c.duration), 0);

  // Active Punch Zoom info
  const punchZoom = calculatePunchZoom(currentTime, zoomKeyframes);

  // 1. Master Playback & Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const nextTime = prev + delta;
          if (nextTime >= totalDuration && totalDuration > 0) {
            setIsPlaying(false);
            return totalDuration;
          }
          return nextTime;
        });
      }

      // Render canvas frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCompositedFrame(ctx, {
            currentTime,
            clips,
            overlays,
            zoomKeyframes,
            videoElements,
            width: targetWidth,
            height: targetHeight,
            words,
            captionTemplate,
            hookTitle,
          });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, currentTime, clips, overlays, zoomKeyframes, videoElements, targetWidth, targetHeight, totalDuration, setCurrentTime, setIsPlaying, words, captionTemplate, hookTitle]);

  // 2. Video Element Frame Synchronization & Audio Sync
  useEffect(() => {
    clips.forEach((clip) => {
      const videoEl = videoElements.get(clip.id);
      if (!videoEl) return;

      const isInside = currentTime >= clip.startTimelineTime && currentTime < clip.startTimelineTime + clip.duration;

      if (isInside) {
        const targetVideoTime = clip.inPoint + (currentTime - clip.startTimelineTime) * clip.speed;
        
        // Sync time if drift is > 50ms
        if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.05) {
          videoEl.currentTime = targetVideoTime;
        }

        videoEl.muted = isMuted;
        videoEl.volume = clip.volume;

        if (isPlaying && videoEl.paused) {
          videoEl.play().catch(() => {});
        } else if (!isPlaying && !videoEl.paused) {
          videoEl.pause();
        }
      } else {
        if (!videoEl.paused) {
          videoEl.pause();
        }
      }
    });
  }, [currentTime, isPlaying, clips, videoElements, isMuted]);

  // 3. Trigger Synchronized SFX Nodes when Playhead passes sticker start time
  useEffect(() => {
    if (!isPlaying) {
      lastTriggeredSfxRef.current.clear();
      return;
    }

    sfxTracks.forEach((sfx) => {
      // If playhead just passed SFX start time within a 150ms window
      if (currentTime >= sfx.startTimelineTime && currentTime < sfx.startTimelineTime + 0.15) {
        if (!lastTriggeredSfxRef.current.has(sfx.id)) {
          lastTriggeredSfxRef.current.add(sfx.id);
          if (!isMuted) {
            playSfxInstant(sfx.preset, sfx.volume);
          }
        }
      } else if (currentTime < sfx.startTimelineTime) {
        lastTriggeredSfxRef.current.delete(sfx.id);
      }
    });
  }, [currentTime, isPlaying, sfxTracks, isMuted]);

  // Format time as MM:SS.ms
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcut for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 1 / 30));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((t) => Math.min(totalDuration, t + 1 / 30));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalDuration, setIsPlaying, setCurrentTime]);

  // Handle overlay drag on canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicked near an active overlay
    const activeOverlays = overlays.filter(
      (ov) => currentTime >= ov.startTimelineTime && currentTime < ov.startTimelineTime + ov.duration
    );

    const hit = activeOverlays.find((ov) => {
      const dx = ov.x - clickX;
      const dy = ov.y - clickY;
      return Math.sqrt(dx * dx + dy * dy) < 14;
    });

    if (hit) {
      if (onSelectOverlay) onSelectOverlay(hit.id);
      setIsDraggingOverlay(true);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingOverlay || !selectedOverlayId || !onUpdateOverlayPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const newX = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const newY = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    onUpdateOverlayPos(selectedOverlayId, Math.round(newX), Math.round(newY));
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingOverlay(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07090e] items-center justify-center p-3 relative overflow-hidden select-none">
      {/* Dynamic Status / Punch Zoom Indicator Badge */}
      <div className="absolute top-4 left-6 flex items-center space-x-2 z-20">
        {punchZoom.isActive && (
          <div className="flex items-center space-x-1.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md animate-pulse">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span>PUNCH ZOOM {punchZoom.scale.toFixed(2)}x</span>
          </div>
        )}

        {overlays.some(
          (o) => currentTime >= o.startTimelineTime && currentTime < o.startTimelineTime + o.duration
        ) && (
          <div className="flex items-center space-x-1.5 bg-pink-500/20 border border-pink-500/50 text-pink-300 text-xs font-bold px-2.5 py-1 rounded-full shadow-lg backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>SYNCED SFX ACTIVE</span>
          </div>
        )}
      </div>

      {/* 9:16 Vertical Screen Frame */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-center max-h-[calc(100vh-290px)] h-full aspect-[9/16] bg-black rounded-2xl shadow-2xl border-2 border-slate-800/80 overflow-hidden group shadow-indigo-950/20"
        style={{ aspectRatio: `${targetWidth} / ${targetHeight}` }}
      >
        <canvas
          ref={canvasRef}
          width={targetWidth}
          height={targetHeight}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="w-full h-full object-contain cursor-crosshair"
          title="Click to reposition active stickers"
        />

        {/* Punch Zoom Target Crosshair Overlay if Zoom is active */}
        {punchZoom.isActive && (
          <div
            className="absolute pointer-events-none w-8 h-8 -ml-4 -mt-4 border border-amber-400/60 rounded-full flex items-center justify-center transition-all duration-75"
            style={{
              left: `${punchZoom.centerX * 100}%`,
              top: `${punchZoom.centerY * 100}%`,
            }}
          >
            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
          </div>
        )}
      </div>

      {/* Floating Transport Bar */}
      <div className="mt-3 flex items-center space-x-4 bg-slate-900/95 border border-slate-800 px-4 py-2 rounded-xl shadow-xl backdrop-blur-md z-20">
        {/* Reset to 0 */}
        <button
          onClick={() => setCurrentTime(0)}
          className="text-slate-400 hover:text-white transition p-1"
          title="Jump to Start"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Step -1 Frame */}
        <button
          onClick={() => setCurrentTime((t) => Math.max(0, t - 1 / 30))}
          className="text-slate-400 hover:text-white transition p-1"
          title="Previous Frame (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Master Play / Pause */}
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white flex items-center justify-center shadow-md shadow-pink-500/25 transition transform active:scale-95"
          title="Play/Pause (Spacebar)"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>

        {/* Step +1 Frame */}
        <button
          onClick={() => setCurrentTime((t) => Math.min(totalDuration, t + 1 / 30))}
          className="text-slate-400 hover:text-white transition p-1"
          title="Next Frame (Right Arrow)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Timecode */}
        <div className="text-xs font-mono font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-200">
          <span className="text-pink-400">{formatTime(currentTime)}</span>
          <span className="text-slate-600 mx-1">/</span>
          <span className="text-slate-400">{formatTime(totalDuration)}</span>
        </div>

        {/* Audio Mute Toggle */}
        <button
          onClick={() => setIsMuted((m) => !m)}
          className="text-slate-400 hover:text-white transition p-1"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
