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
import { getLastSubtitleBounds } from '../../core/captions/captionRenderer';

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
  onUpdateCaptionPosition?: (x: number, y: number) => void;
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
  onUpdateCaptionPosition,
  words = [],
  captionTemplate,
  hookTitle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isHoveringCaption, setIsHoveringCaption] = useState(false);
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const [captionDragOffset, setCaptionDragOffset] = useState({ x: 0, y: 0 });
  const lastTriggeredSfxRef = useRef<Set<string>>(new Set());
  const lastStateUpdateTimeRef = useRef(0);

  // Mutable state refs to prevent re-instantiating RAF loop on every frame
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);
  const clipsRef = useRef(clips);
  const videoElementsRef = useRef(videoElements);
  const isMutedRef = useRef(isMuted);
  const sfxTracksRef = useRef(sfxTracks);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    sfxTracksRef.current = sfxTracks;
  }, [sfxTracks]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      lastTriggeredSfxRef.current.clear();
      // When pausing, immediately pause all active video elements
      videoElementsRef.current.forEach((vid) => {
        if (!vid.paused) vid.pause();
      });
    }
  }, [isPlaying]);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    videoElementsRef.current = videoElements;
  }, [videoElements]);

  useEffect(() => {
    isMutedRef.current = isMuted;
    videoElements.forEach((vid) => {
      vid.muted = isMuted;
    });
  }, [isMuted, videoElements]);

  // Parse width/height from resolution string
  const [targetWidth, targetHeight] = resolution.split('x').map(Number);
  const aspectRatio = targetWidth / targetHeight;

  // Calculate total duration
  const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.startTimelineTime + c.duration), 0);

  // Active Punch Zoom info
  const punchZoom = calculatePunchZoom(currentTime, zoomKeyframes);

  // 1. Master Playback & Animation Loop (Sequential Video Engine)
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const delta = Math.min(0.067, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      let time = currentTimeRef.current;
      const curClips = clipsRef.current;
      const curVideoElements = videoElementsRef.current;
      const playing = isPlayingRef.current;
      const muted = isMutedRef.current;
      const curSfx = sfxTracksRef.current;

      if (playing && totalDuration > 0) {
        // Locate active clip at current playhead
        const activeClipIndex = curClips.findIndex(
          (c) => time >= c.startTimelineTime && time < c.startTimelineTime + c.duration
        );

        if (activeClipIndex !== -1) {
          const activeClip = curClips[activeClipIndex];
          const activeVideo = curVideoElements.get(activeClip.id);
          const nextClip = activeClipIndex + 1 < curClips.length ? curClips[activeClipIndex + 1] : null;
          const nextVideo = nextClip ? curVideoElements.get(nextClip.id) : null;
          const transitionDuration = nextClip?.transitionDuration || 0.25;
          const timeLeftInClip = activeClip.startTimelineTime + activeClip.duration - time;

          // Check if active clip finished its duration segment
          const isClipEnded =
            activeVideo?.ended ||
            timeLeftInClip <= 0.01;

          if (isClipEnded) {
            if (activeVideo && !activeVideo.paused) {
              activeVideo.pause();
            }

            if (nextClip && nextVideo) {
              nextVideo.currentTime = nextClip.inPoint;
              nextVideo.muted = muted;
              nextVideo.volume = nextClip.volume;
              nextVideo.play().catch(() => {});
              time = nextClip.startTimelineTime;
            } else {
              time = totalDuration;
              setIsPlaying(false);
            }
          } else {
            // Keep active clip playing smoothly in hardware sync without seek loops
            if (activeVideo) {
              activeVideo.muted = muted;
              activeVideo.volume = activeClip.volume;

              const targetVideoTime =
                activeClip.inPoint + (time - activeClip.startTimelineTime) * activeClip.speed;

              if (activeVideo.paused && !activeVideo.seeking) {
                // Initial start: seek once to target time and start playback
                if (Math.abs(activeVideo.currentTime - targetVideoTime) > 0.05) {
                  activeVideo.currentTime = targetVideoTime;
                }
                activeVideo.play().catch(() => {});
                time += delta;
              } else if (!activeVideo.seeking && !activeVideo.paused) {
                // Video is actively playing natively: let the video's hardware clock drive timeline time!
                const vidElapsed = (activeVideo.currentTime - activeClip.inPoint) / (activeClip.speed || 1.0);
                if (!isNaN(vidElapsed) && vidElapsed >= 0) {
                  time = activeClip.startTimelineTime + Math.min(activeClip.duration, vidElapsed);
                } else {
                  time += delta;
                }
              } else {
                time += delta;
              }
            } else {
              time += delta;
            }

            // Pre-roll incoming clip smoothly during transition window
            if (nextClip && nextVideo && timeLeftInClip <= transitionDuration + 0.1) {
              nextVideo.muted = muted;
              nextVideo.volume = nextClip.volume;
              if (nextVideo.paused && !nextVideo.seeking) {
                nextVideo.currentTime = nextClip.inPoint;
                nextVideo.play().catch(() => {});
              }
            }
          }

          // Pause all video elements that are not active and not part of the active transition
          curVideoElements.forEach((vid, id) => {
            const isIncoming = nextClip && id === nextClip.id && timeLeftInClip <= transitionDuration + 0.1;
            if (id !== activeClip.id && !isIncoming && !vid.paused) {
              vid.pause();
            }
          });
        } else {
          // Playhead is in a gap or past clips
          time += delta;
        }

        if (time >= totalDuration && totalDuration > 0) {
          time = totalDuration;
          setIsPlaying(false);
          curVideoElements.forEach((vid) => {
            if (!vid.paused) vid.pause();
          });
        }

        // Trigger synchronized SFX nodes without React state delay
        curSfx.forEach((sfx) => {
          if (time >= sfx.startTimelineTime && time < sfx.startTimelineTime + 0.15) {
            if (!lastTriggeredSfxRef.current.has(sfx.id)) {
              lastTriggeredSfxRef.current.add(sfx.id);
              if (!isMutedRef.current) {
                playSfxInstant(sfx.preset, sfx.volume);
              }
            }
          } else if (time < sfx.startTimelineTime) {
            lastTriggeredSfxRef.current.delete(sfx.id);
          }
        });

        currentTimeRef.current = time;

        // Throttle React state re-renders to ~25fps while maintaining 60fps canvas drawing
        if (timestamp - lastStateUpdateTimeRef.current > 40) {
          lastStateUpdateTimeRef.current = timestamp;
          setCurrentTime(time);
        }
      }

      // Render canvas frame at 60fps
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCompositedFrame(ctx, {
            currentTime: time,
            clips: curClips,
            overlays,
            zoomKeyframes,
            videoElements: curVideoElements,
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
  }, [totalDuration, targetWidth, targetHeight, overlays, zoomKeyframes, words, captionTemplate, hookTitle, setCurrentTime, setIsPlaying]);

  // 2. Handle scrubbing / seek when paused
  useEffect(() => {
    if (!isPlaying) {
      clips.forEach((clip) => {
        const videoEl = videoElements.get(clip.id);
        if (!videoEl) return;

        const isInside =
          currentTime >= clip.startTimelineTime &&
          currentTime <= clip.startTimelineTime + clip.duration;

        if (isInside) {
          const targetVideoTime =
            clip.inPoint + (currentTime - clip.startTimelineTime) * clip.speed;
          if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.03) {
            videoEl.currentTime = targetVideoTime;
          }
        }
        if (!videoEl.paused) {
          videoEl.pause();
        }
      });
    }
  }, [currentTime, isPlaying, clips, videoElements]);

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

  // Handle overlay & caption drag on canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // 1. Check Subtitle / Caption Bounding Box first
    const subBounds = getLastSubtitleBounds();
    const isOverCaption =
      subBounds &&
      clickX >= subBounds.x - 3 &&
      clickX <= subBounds.x + subBounds.width + 3 &&
      clickY >= subBounds.y - 3 &&
      clickY <= subBounds.y + subBounds.height + 3;

    if (isOverCaption && onUpdateCaptionPosition) {
      setIsDraggingCaption(true);
      const curX = (captionTemplate?.position_x ?? 0.5) * 100;
      const curY = (captionTemplate?.position_y ?? 0.74) * 100;
      setCaptionDragOffset({ x: clickX - curX, y: clickY - curY });
      return;
    }

    // 2. Check if clicked near an active sticker overlay
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    // If dragging caption
    if (isDraggingCaption && onUpdateCaptionPosition) {
      const newX = Math.max(6, Math.min(94, mouseX - captionDragOffset.x));
      const newY = Math.max(6, Math.min(94, mouseY - captionDragOffset.y));
      onUpdateCaptionPosition(Number((newX / 100).toFixed(3)), Number((newY / 100).toFixed(3)));
      return;
    }

    // If dragging sticker overlay
    if (isDraggingOverlay && selectedOverlayId && onUpdateOverlayPos) {
      const newX = Math.max(5, Math.min(95, mouseX));
      const newY = Math.max(5, Math.min(95, mouseY));
      onUpdateOverlayPos(selectedOverlayId, Math.round(newX), Math.round(newY));
      return;
    }

    // Detect hovering over captions
    const subBounds = getLastSubtitleBounds();
    const isOver = Boolean(
      subBounds &&
      mouseX >= subBounds.x - 3 &&
      mouseX <= subBounds.x + subBounds.width + 3 &&
      mouseY >= subBounds.y - 3 &&
      mouseY <= subBounds.y + subBounds.height + 3
    );
    setIsHoveringCaption(isOver);
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingCaption(false);
    setIsDraggingOverlay(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsDraggingCaption(false);
    setIsDraggingOverlay(false);
    setIsHoveringCaption(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#07090e] items-center justify-center p-3 relative overflow-hidden select-none">
      {/* Dynamic Status / Punch Zoom Indicator Badge */}
      <div className="absolute top-4 left-6 flex items-center space-x-2 z-20">
        {punchZoom.isActive && (
          <div className="flex items-center space-x-1.5 bg-amber-950/90 border border-amber-500/60 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full shadow-xl animate-pulse">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span>PUNCH ZOOM {punchZoom.scale.toFixed(2)}x</span>
          </div>
        )}

        {overlays.some(
          (o) => currentTime >= o.startTimelineTime && currentTime < o.startTimelineTime + o.duration
        ) && (
          <div className="flex items-center space-x-1.5 bg-pink-950/90 border border-pink-500/60 text-pink-300 text-xs font-bold px-2.5 py-1 rounded-full shadow-xl">
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
          onMouseLeave={handleCanvasMouseLeave}
          className={`w-full h-full object-contain ${
            isDraggingCaption
              ? 'cursor-grabbing'
              : isHoveringCaption
              ? 'cursor-grab'
              : isDraggingOverlay
              ? 'cursor-grabbing'
              : 'cursor-crosshair'
          }`}
          title={isHoveringCaption ? 'Click and drag captions anywhere' : 'Click to reposition captions or stickers'}
        />

        {/* Interactive Caption Drag Bounding Box & Handles */}
        {(isHoveringCaption || isDraggingCaption) && getLastSubtitleBounds() && (
          <div
            className={`absolute pointer-events-none rounded-xl transition-all duration-75 border-2 ${
              isDraggingCaption
                ? 'border-pink-500 shadow-xl shadow-pink-500/30 bg-pink-500/10'
                : 'border-indigo-400 border-dashed bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
            }`}
            style={{
              left: `${getLastSubtitleBounds()!.x}%`,
              top: `${getLastSubtitleBounds()!.y}%`,
              width: `${getLastSubtitleBounds()!.width}%`,
              height: `${getLastSubtitleBounds()!.height}%`,
            }}
          >
            {/* 4 Corner drag dots */}
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow" />
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow" />
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow" />
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full shadow" />

            {/* Position readout badge */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white font-mono text-[9px] px-2.5 py-0.5 rounded-full border border-indigo-500/60 shadow flex items-center space-x-1.5 whitespace-nowrap">
              <span className="text-slate-300 font-sans font-bold">Captions</span>
              <span className="text-pink-400 font-bold">
                X:{Math.round((captionTemplate?.position_x ?? 0.5) * 100)}%
              </span>
              <span className="text-indigo-400 font-bold">
                Y:{Math.round((captionTemplate?.position_y ?? 0.74) * 100)}%
              </span>
            </div>
          </div>
        )}

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
      <div className="mt-3 flex items-center space-x-4 bg-slate-900/95 border border-slate-800 px-4 py-2 rounded-xl shadow-2xl z-20">
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
