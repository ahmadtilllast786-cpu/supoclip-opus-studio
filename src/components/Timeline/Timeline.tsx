import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sparkles,
  Layers,
  Music,
  Video,
  Smile,
  Volume2,
  Sliders,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight,
  Magnet,
  Crosshair,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  TransitionType,
} from '../../types/timeline';

interface TimelineProps {
  currentTime: number;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  clips: VideoClip[];
  setClips: React.Dispatch<React.SetStateAction<VideoClip[]>>;
  overlays: StickerOverlay[];
  setOverlays: React.Dispatch<React.SetStateAction<StickerOverlay[]>>;
  zoomKeyframes: DynamicZoomKeyframe[];
  setZoomKeyframes: React.Dispatch<React.SetStateAction<DynamicZoomKeyframe[]>>;
  sfxTracks: SfxTrackItem[];
  setSfxTracks: React.Dispatch<React.SetStateAction<SfxTrackItem[]>>;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  selectedOverlayId: string | null;
  setSelectedOverlayId: (id: string | null) => void;
  onAddPunchZoom: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  setCurrentTime,
  clips,
  setClips,
  overlays,
  setOverlays,
  zoomKeyframes,
  setZoomKeyframes,
  sfxTracks,
  setSfxTracks,
  selectedClipId,
  setSelectedClipId,
  selectedOverlayId,
  setSelectedOverlayId,
  onAddPunchZoom,
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80);
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Elite Features: Magnetic Snapping, Blade Tool Mode, Timecode Format
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [isBladeMode, setIsBladeMode] = useState(false);
  const [timecodeMode, setTimecodeMode] = useState<'standard' | 'smpte'>('standard');

  // Trimming State
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);
  const [trimEdge, setTrimEdge] = useState<'left' | 'right' | null>(null);
  const [trimStartX, setTrimStartX] = useState(0);
  const [trimInitialIn, setTrimInitialIn] = useState(0);
  const [trimInitialOut, setTrimInitialOut] = useState(0);

  // Total duration of project
  const totalDuration = Math.max(
    10,
    clips.reduce((acc, c) => Math.max(acc, c.startTimelineTime + c.duration), 0)
  );

  const timelineWidth = Math.max(1200, totalDuration * pixelsPerSecond + 250);

  // Calculate magnetic snap points (clip cuts, boundaries, overlay starts)
  const getSnapPoints = useCallback((): number[] => {
    const points = new Set<number>([0]);
    clips.forEach((c) => {
      points.add(Number(c.startTimelineTime.toFixed(3)));
      points.add(Number((c.startTimelineTime + c.duration).toFixed(3)));
    });
    overlays.forEach((o) => {
      points.add(Number(o.startTimelineTime.toFixed(3)));
    });
    return Array.from(points);
  }, [clips, overlays]);

  // Format time (Standard vs SMPTE HH:MM:SS:FF)
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (timecodeMode === 'smpte') {
      const frames = Math.floor((seconds % 1) * 30);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames
        .toString()
        .padStart(2, '0')}`;
    }
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms
      .toString()
      .padStart(2, '0')}`;
  };

  // Split Clip at specific timeline timestamp
  const handleSplitClipAt = useCallback(
    (clipId: string, splitOffsetSec: number) => {
      const targetClipIndex = clips.findIndex((c) => c.id === clipId);
      if (targetClipIndex === -1) return;

      const clip = clips[targetClipIndex];
      const splitInSource = clip.inPoint + splitOffsetSec * clip.speed;

      const firstHalf: VideoClip = {
        ...clip,
        id: `${clip.id}-split1-${Date.now()}`,
        outPoint: splitInSource,
        duration: splitOffsetSec,
      };

      const secondHalf: VideoClip = {
        ...clip,
        id: `${clip.id}-split2-${Date.now()}`,
        inPoint: splitInSource,
        duration: clip.duration - splitOffsetSec,
        startTimelineTime: clip.startTimelineTime + splitOffsetSec,
        transitionIn: 'whip-pan',
        transitionDuration: 0.25,
      };

      const updatedClips = [...clips];
      updatedClips.splice(targetClipIndex, 1, firstHalf, secondHalf);

      let curTime = 0;
      const resequenced = updatedClips.map((c) => {
        const item = { ...c, startTimelineTime: curTime };
        curTime += c.duration;
        return item;
      });

      setClips(resequenced);
      setSelectedClipId(secondHalf.id);
    },
    [clips, setClips, setSelectedClipId]
  );

  // Split Clip at current playhead
  const handleSplitClip = useCallback(() => {
    const targetClipIndex = clips.findIndex(
      (c) =>
        currentTime > c.startTimelineTime + 0.1 &&
        currentTime < c.startTimelineTime + c.duration - 0.1
    );
    if (targetClipIndex === -1) return;
    const clip = clips[targetClipIndex];
    handleSplitClipAt(clip.id, currentTime - clip.startTimelineTime);
  }, [clips, currentTime, handleSplitClipAt]);

  // Delete Clip by ID
  const handleDeleteClip = useCallback(
    (clipId: string) => {
      const updated = clips.filter((c) => c.id !== clipId);
      let curTime = 0;
      const resequenced = updated.map((c) => {
        const item = { ...c, startTimelineTime: curTime };
        curTime += c.duration;
        return item;
      });
      setClips(resequenced);
      if (selectedClipId === clipId) setSelectedClipId(null);
    },
    [clips, selectedClipId, setClips, setSelectedClipId]
  );

  // Re-order Clip Left or Right
  const handleMoveClip = useCallback(
    (clipId: string, direction: 'left' | 'right') => {
      const idx = clips.findIndex((c) => c.id === clipId);
      if (idx === -1) return;
      if (direction === 'left' && idx === 0) return;
      if (direction === 'right' && idx === clips.length - 1) return;

      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      const updated = [...clips];
      const [moved] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, moved);

      let curTime = 0;
      const resequenced = updated.map((c) => {
        const item = { ...c, startTimelineTime: curTime };
        curTime += c.duration;
        return item;
      });
      setClips(resequenced);
    },
    [clips, setClips]
  );

  // Delete Selected Clip or Overlay
  const handleDeleteSelected = useCallback(() => {
    if (selectedClipId) {
      handleDeleteClip(selectedClipId);
    } else if (selectedOverlayId) {
      setOverlays((ovs) => ovs.filter((o) => o.id !== selectedOverlayId));
      setSfxTracks((sfxs) => sfxs.filter((s) => s.linkedOverlayId !== selectedOverlayId));
      setSelectedOverlayId(null);
    }
  }, [selectedClipId, selectedOverlayId, handleDeleteClip, setOverlays, setSfxTracks, setSelectedOverlayId]);

  // Fit Timeline to Screen
  const handleFitToScreen = useCallback(() => {
    if (containerRef.current && totalDuration > 0) {
      const containerWidth = containerRef.current.clientWidth - 150;
      const pps = Math.max(30, Math.min(220, Math.floor(containerWidth / totalDuration)));
      setPixelsPerSecond(pps);
    }
  }, [totalDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'c' || e.key === 'C') {
        // Toggle Razor / Blade Mode (Premiere / CapCut shortcut)
        e.preventDefault();
        setIsBladeMode((prev) => !prev);
      } else if (e.key === 'v' || e.key === 'V') {
        // Select tool
        e.preventDefault();
        setIsBladeMode(false);
      } else if (e.key === 's' || e.key === 'S' || ((e.ctrlKey || e.metaKey) && e.key === 'b')) {
        e.preventDefault();
        handleSplitClip();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSplitClip, handleDeleteSelected]);

  // Mouse wheel zoom centered on cursor
  const handleTimelineWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 15 : -15;
      setPixelsPerSecond((prev) => Math.max(30, Math.min(240, prev + zoomFactor)));
    }
  };

  // Scrubber mouse drag with Magnetic Snapping
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    updateTimeFromMouse(e);
  };

  const updateTimeFromMouse = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    let targetTime = Math.max(0, Math.min(totalDuration, clickX / pixelsPerSecond));

    // Apply Magnetic Snapping
    let activeSnap: number | null = null;
    if (isSnappingEnabled) {
      const snapPoints = getSnapPoints();
      for (const sp of snapPoints) {
        if (Math.abs(sp - targetTime) * pixelsPerSecond < 9) {
          targetTime = sp;
          activeSnap = sp;
          break;
        }
      }
    }

    setSnapGuideTime(activeSnap);
    setCurrentTime(targetTime);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) updateTimeFromMouse(e);
    };
    const handleMouseUp = () => {
      setIsScrubbing(false);
      setSnapGuideTime(null);
    };
    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, pixelsPerSecond, totalDuration, isSnappingEnabled, getSnapPoints]);

  // Interactive Clip Trimming Mouse Move
  useEffect(() => {
    const handleTrimMouseMove = (e: MouseEvent) => {
      if (!trimmingClipId || !trimEdge) return;

      const deltaX = e.clientX - trimStartX;
      const deltaSec = deltaX / pixelsPerSecond;

      setClips((prev) => {
        const idx = prev.findIndex((c) => c.id === trimmingClipId);
        if (idx === -1) return prev;
        const clip = prev[idx];

        if (trimEdge === 'left') {
          // Adjust inPoint
          const newIn = Math.max(0, Math.min(trimInitialOut - 0.3, trimInitialIn + deltaSec * clip.speed));
          const newDur = (clip.outPoint - newIn) / clip.speed;
          const updated = [...prev];
          updated[idx] = { ...clip, inPoint: newIn, duration: newDur };

          // Resequence sequential start times
          let curTime = 0;
          return updated.map((c) => {
            const item = { ...c, startTimelineTime: curTime };
            curTime += c.duration;
            return item;
          });
        } else {
          // Adjust outPoint
          const newOut = Math.min(clip.originalDuration, Math.max(clip.inPoint + 0.3, trimInitialOut + deltaSec * clip.speed));
          const newDur = (newOut - clip.inPoint) / clip.speed;
          const updated = [...prev];
          updated[idx] = { ...clip, outPoint: newOut, duration: newDur };

          let curTime = 0;
          return updated.map((c) => {
            const item = { ...c, startTimelineTime: curTime };
            curTime += c.duration;
            return item;
          });
        }
      });
    };

    const handleTrimMouseUp = () => {
      setTrimmingClipId(null);
      setTrimEdge(null);
    };

    if (trimmingClipId) {
      window.addEventListener('mousemove', handleTrimMouseMove);
      window.addEventListener('mouseup', handleTrimMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleTrimMouseMove);
      window.removeEventListener('mouseup', handleTrimMouseUp);
    };
  }, [trimmingClipId, trimEdge, trimStartX, trimInitialIn, trimInitialOut, pixelsPerSecond, setClips]);

  // Cycle transition on badge click
  const handleCycleTransition = (clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const transitions: TransitionType[] = ['none', 'whip-pan', 'dissolve', 'zoom-in', 'zoom-out', 'glitch'];
    setClips((prev) =>
      prev.map((c) => {
        if (c.id === clipId) {
          const curIdx = transitions.indexOf(c.transitionIn);
          const nextTrans = transitions[(curIdx + 1) % transitions.length];
          return { ...c, transitionIn: nextTrans };
        }
        return c;
      })
    );
  };

  return (
    <div
      onWheel={handleTimelineWheel}
      className="h-68 bg-[#0d111a] border-t border-slate-800 flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Timeline Controls Toolbar */}
      <div className="h-10 bg-[#121722] border-b border-slate-800 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1.5">
          {/* Blade / Razor Tool Mode Toggle */}
          <button
            onClick={() => setIsBladeMode((b) => !b)}
            className={`flex items-center space-x-1 text-xs px-2 py-1 rounded transition ${
              isBladeMode
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Razor Blade Tool: Click anywhere on a clip to cut (Shortcut: C / V)"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>{isBladeMode ? 'Razor: ON (C)' : 'Razor (C)'}</span>
          </button>

          {/* Split at Playhead */}
          <button
            onClick={handleSplitClip}
            className="flex items-center space-x-1 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-xs px-2 py-1 rounded transition"
            title="Split Clip at Current Playhead (S or Ctrl+B)"
          >
            <span>Split (S)</span>
          </button>

          {/* Delete Selection */}
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedClipId && !selectedOverlayId}
            className={`flex items-center space-x-1 text-xs px-2.5 py-1 rounded transition font-medium ${
              selectedClipId || selectedOverlayId
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 ring-1 ring-rose-400'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
            title="Delete Selected Clip or Overlay (Del/Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{selectedClipId ? 'Delete Clip' : selectedOverlayId ? 'Delete Sticker' : 'Delete'}</span>
          </button>

          {/* Magnetic Snapping Toggle */}
          <button
            onClick={() => setIsSnappingEnabled((s) => !s)}
            className={`flex items-center space-x-1 text-xs px-2 py-1 rounded transition ${
              isSnappingEnabled
                ? 'bg-indigo-600/30 border border-indigo-500/60 text-indigo-300'
                : 'bg-slate-800 text-slate-500 border border-transparent'
            }`}
            title="Magnetic Snapping to Cuts & In/Out Points"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap: {isSnappingEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Re-order Clip Buttons if Clip Selected */}
          {selectedClipId && (
            <div className="flex items-center space-x-1 border-l border-slate-700/80 pl-2">
              <button
                onClick={() => handleMoveClip(selectedClipId, 'left')}
                className="flex items-center space-x-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs px-2 py-1 rounded transition"
                title="Move Selected Clip Earlier"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Move Left</span>
              </button>
              <button
                onClick={() => handleMoveClip(selectedClipId, 'right')}
                className="flex items-center space-x-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs px-2 py-1 rounded transition"
                title="Move Selected Clip Later"
              >
                <span>Move Right</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Add Punch Zoom */}
          <button
            onClick={onAddPunchZoom}
            className="flex items-center space-x-1 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 text-xs px-2 py-1 rounded transition"
            title="Add dynamic punch zoom at playhead"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Punch Zoom</span>
          </button>
        </div>

        {/* Right Tools: Timecode Mode, Fit, and Zoom */}
        <div className="flex items-center space-x-2 text-slate-400 text-xs">
          {/* Timecode Toggle */}
          <button
            onClick={() => setTimecodeMode((m) => (m === 'standard' ? 'smpte' : 'standard'))}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 px-2 py-0.5 rounded font-mono text-[10px] text-slate-300"
            title="Toggle between Seconds and SMPTE Timecode (HH:MM:SS:FF)"
          >
            {timecodeMode === 'smpte' ? 'SMPTE' : 'SEC'}
          </button>

          {/* Fit to Screen */}
          <button
            onClick={handleFitToScreen}
            className="hover:text-white p-1"
            title="Fit Entire Timeline to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Zoom In/Out */}
          <button
            onClick={() => setPixelsPerSecond((p) => Math.max(30, p - 20))}
            className="hover:text-white p-1"
            title="Zoom Out Timeline"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] w-10 text-center text-slate-300">
            {Math.round((pixelsPerSecond / 80) * 100)}%
          </span>
          <button
            onClick={() => setPixelsPerSecond((p) => Math.min(240, p + 20))}
            className="hover:text-white p-1"
            title="Zoom In Timeline"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multi-Track Workspace Scroll Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#090c12]"
      >
        <div
          style={{ width: `${timelineWidth}px` }}
          className="relative min-h-full pb-4"
        >
          {/* Time Ruler - Mousedown restricted strictly to ruler bar */}
          <div
            ref={rulerRef}
            onMouseDown={handleRulerMouseDown}
            className="h-7 bg-[#0f141f] hover:bg-[#141b2a] border-b border-slate-800/80 sticky top-0 z-20 flex items-center cursor-pointer transition select-none"
            title="Click or drag on ruler to scrub playhead"
          >
            {Array.from({ length: Math.ceil(totalDuration) + 2 }).map((_, sec) => (
              <div
                key={sec}
                style={{ left: `${sec * pixelsPerSecond}px` }}
                className="absolute top-0 bottom-0 border-l border-slate-700/60 pl-1 text-[10px] font-mono text-slate-400 pointer-events-none"
              >
                {formatTimecode(sec)}
              </div>
            ))}
          </div>

          {/* Red Playhead Line */}
          <div
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
          >
            <div className="w-3.5 h-3.5 -ml-[6px] -mt-1 bg-rose-500 rounded-sm transform rotate-45 shadow-md flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>

          {/* Magnetic Snap Guide Indicator Line */}
          {snapGuideTime !== null && (
            <div
              style={{ left: `${snapGuideTime * pixelsPerSecond}px` }}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,1)] animate-pulse"
            >
              <div className="bg-amber-400 text-slate-950 font-mono text-[9px] font-bold px-1 rounded -ml-6 -mt-3.5">
                SNAP {snapGuideTime.toFixed(2)}s
              </div>
            </div>
          )}

          {/* TRACK 1: Stickers & Overlays */}
          <div className="h-10 border-b border-slate-800/60 relative flex items-center bg-[#0d121c]/60">
            <div className="sticky left-0 w-24 z-10 bg-[#131926]/90 border-r border-slate-800 px-2 py-1 flex items-center space-x-1 text-[10px] font-bold text-pink-400 uppercase tracking-wider">
              <Smile className="w-3 h-3" />
              <span>Overlays</span>
            </div>

            {overlays.map((ov) => {
              const left = ov.startTimelineTime * pixelsPerSecond;
              const width = Math.max(40, ov.duration * pixelsPerSecond);
              const isSelected = selectedOverlayId === ov.id;

              return (
                <div
                  key={ov.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOverlayId(ov.id);
                    setSelectedClipId(null);
                  }}
                  style={{ left: `${left}px`, width: `${width}px` }}
                  className={`absolute h-7 rounded-md border flex items-center justify-between px-2 cursor-pointer transition ${
                    isSelected
                      ? 'bg-pink-600/80 border-white text-white shadow-lg shadow-pink-600/30'
                      : 'bg-pink-950/60 border-pink-700/60 hover:bg-pink-900/80 text-pink-200'
                  }`}
                >
                  <div className="flex items-center space-x-1 truncate text-xs">
                    <span>{ov.emoji}</span>
                    <span className="font-bold text-[10px]">{ov.label || 'Sticker'}</span>
                  </div>
                  {ov.pairedSfx && (
                    <span className="text-[9px] bg-black/40 px-1 py-0.5 rounded font-mono text-pink-300">
                      SFX
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* TRACK 2: Primary Video Track */}
          <div
            onClick={() => {
              setSelectedClipId(null);
              setSelectedOverlayId(null);
            }}
            className="h-20 border-b border-slate-800/60 relative flex items-center bg-[#090e18]/80 cursor-default"
          >
            <div className="sticky left-0 w-24 z-10 bg-[#131926]/90 border-r border-slate-800 px-2 py-1 flex items-center space-x-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              <Video className="w-3 h-3" />
              <span>Video</span>
            </div>

            {clips.map((clip, idx) => {
              const left = clip.startTimelineTime * pixelsPerSecond;
              const width = Math.max(60, clip.duration * pixelsPerSecond);
              const isSelected = selectedClipId === clip.id;

              return (
                <React.Fragment key={clip.id}>
                  {/* Transition Cut Badge */}
                  {idx > 0 && clip.transitionIn && (
                    <div
                      onClick={(e) => handleCycleTransition(clip.id, e)}
                      style={{ left: `${left - 12}px` }}
                      className={`absolute z-10 top-2 -mt-1 w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold cursor-pointer transition shadow-md ${
                        clip.transitionIn !== 'none'
                          ? 'bg-indigo-600 border-indigo-400 text-white animate-pulse'
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
                      }`}
                      title={`Transition: ${clip.transitionIn.toUpperCase()} (Click to cycle)`}
                    >
                      {clip.transitionIn === 'whip-pan'
                        ? '⚡'
                        : clip.transitionIn === 'zoom-in'
                        ? '🔍'
                        : clip.transitionIn === 'glitch'
                        ? '👾'
                        : clip.transitionIn === 'dissolve'
                        ? '✨'
                        : '✂️'}
                    </div>
                  )}

                  {/* Video Clip Block */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isBladeMode) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickOffsetPx = e.clientX - rect.left;
                        const splitOffsetSec = clickOffsetPx / pixelsPerSecond;
                        if (splitOffsetSec > 0.2 && splitOffsetSec < clip.duration - 0.2) {
                          handleSplitClipAt(clip.id, splitOffsetSec);
                        }
                      } else {
                        setSelectedClipId(clip.id);
                        setSelectedOverlayId(null);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (!isBladeMode) {
                        setSelectedClipId(clip.id);
                        setSelectedOverlayId(null);
                      }
                    }}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    className={`group absolute h-16 rounded-lg border flex flex-col justify-between p-1.5 transition-all duration-150 ${
                      isBladeMode
                        ? 'cursor-crosshair hover:ring-2 hover:ring-amber-400'
                        : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'bg-indigo-600 border-white text-white ring-2 ring-rose-500 shadow-2xl shadow-indigo-600/50 z-10'
                        : 'bg-indigo-950/80 border-indigo-700/60 hover:border-indigo-400 hover:bg-indigo-900/90 text-indigo-100'
                    }`}
                    title={
                      isBladeMode
                        ? 'Click to cut clip at this position'
                        : `Clip: ${clip.name} (Click to select, drag handles to trim, Del to delete)`
                    }
                  >
                    {/* Left Trim Handle */}
                    {isSelected && !isBladeMode && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setTrimmingClipId(clip.id);
                          setTrimEdge('left');
                          setTrimStartX(e.clientX);
                          setTrimInitialIn(clip.inPoint);
                          setTrimInitialOut(clip.outPoint);
                        }}
                        className="absolute left-0 top-0 bottom-0 w-2.5 bg-white/40 hover:bg-white cursor-ew-resize rounded-l flex items-center justify-center z-20"
                        title="Drag left edge to trim inPoint"
                      >
                        <div className="w-0.5 h-4 bg-black/60 rounded"></div>
                      </div>
                    )}

                    {/* Right Trim Handle */}
                    {isSelected && !isBladeMode && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setTrimmingClipId(clip.id);
                          setTrimEdge('right');
                          setTrimStartX(e.clientX);
                          setTrimInitialIn(clip.inPoint);
                          setTrimInitialOut(clip.outPoint);
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/40 hover:bg-white cursor-ew-resize rounded-r flex items-center justify-center z-20"
                        title="Drag right edge to trim outPoint"
                      >
                        <div className="w-0.5 h-4 bg-black/60 rounded"></div>
                      </div>
                    )}

                    {/* Card Header */}
                    <div className="flex items-center justify-between text-[11px] font-semibold truncate space-x-1 px-1">
                      <span className="truncate">{clip.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        <span className="text-[10px] font-mono opacity-80">{clip.duration.toFixed(1)}s</span>

                        {/* Reorder Buttons when selected */}
                        {isSelected && (
                          <div className="flex items-center bg-black/50 rounded px-0.5 space-x-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveClip(clip.id, 'left');
                              }}
                              disabled={idx === 0}
                              className="p-0.5 hover:bg-white/20 disabled:opacity-20 rounded text-white"
                              title="Move Left (Reorder earlier)"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveClip(clip.id, 'right');
                              }}
                              disabled={idx === clips.length - 1}
                              className="p-0.5 hover:bg-white/20 disabled:opacity-20 rounded text-white"
                              title="Move Right (Reorder later)"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {/* Direct 1-Click Delete Button on Clip Card */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClip(clip.id);
                          }}
                          className={`p-1 rounded bg-rose-600/95 hover:bg-rose-500 text-white shadow-sm transition ${
                            isSelected ? 'opacity-100 ring-1 ring-white' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Delete this clip"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Waveform graphic visualization */}
                    <div className="h-5 flex items-end space-x-0.5 opacity-70 px-1">
                      {clip.waveform &&
                        clip.waveform.slice(0, Math.floor(width / 4)).map((peak, pIdx) => (
                          <div
                            key={pIdx}
                            style={{ height: `${Math.max(15, peak * 100)}%` }}
                            className="w-1 bg-indigo-200/90 rounded-t-sm"
                          />
                        ))}
                    </div>

                    {/* Footer: Zoom scale badge or Selection Status */}
                    <div className="flex items-center justify-between text-[9px] font-mono px-1">
                      {clip.zoomScale > 1.0 ? (
                        <span className="bg-amber-500/30 text-amber-300 px-1 rounded">
                          {clip.zoomScale.toFixed(2)}x Zoom
                        </span>
                      ) : (
                        <span className="opacity-50">#{idx + 1}</span>
                      )}
                      {isSelected && (
                        <span className="bg-rose-500 text-white font-bold px-1 rounded shadow-sm text-[8px] uppercase">
                          SELECTED
                        </span>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* TRACK 3: Audio & Synchronized SFX Track */}
          <div className="h-12 border-b border-slate-800/60 relative flex items-center bg-[#0d121c]/40">
            <div className="sticky left-0 w-24 z-10 bg-[#131926]/90 border-r border-slate-800 px-2 py-1 flex items-center space-x-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              <Music className="w-3 h-3" />
              <span>Audio / SFX</span>
            </div>

            {sfxTracks.map((sfx) => {
              const left = sfx.startTimelineTime * pixelsPerSecond;
              const width = Math.max(35, sfx.duration * pixelsPerSecond);

              return (
                <div
                  key={sfx.id}
                  style={{ left: `${left}px`, width: `${width}px` }}
                  className="absolute h-8 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 flex items-center px-1.5 text-[10px] font-mono shadow-sm"
                  title={`Trigger SFX: ${sfx.preset}`}
                >
                  <Volume2 className="w-3 h-3 mr-1 text-emerald-400" />
                  <span className="truncate">{sfx.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
