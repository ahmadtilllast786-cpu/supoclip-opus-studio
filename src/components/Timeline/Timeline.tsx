import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Scissors,
  Trash2,
  FoldHorizontal,
  Plus,
  Minus,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  Music,
  Video,
  Smile,
  Film,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  SfxPreset,
  TransitionType,
} from '../../types/timeline';
import { extractClipWaveformSegment } from '../../core/audio/audioAnalyzer';
import { TimelineToolbar, TimelineToolMode } from './TimelineToolbar';
import { TimelineMinimap } from './TimelineMinimap';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrackHeader } from './TimelineTrackHeader';

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
  selectedSfxId?: string | null;
  setSelectedSfxId?: (id: string | null) => void;
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
  selectedSfxId,
  setSelectedSfxId,
  onAddPunchZoom,
}) => {
  // Timeline Zoom & Viewport Sizing (Adjusted to One Screen by Default)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [timecodeMode, setTimecodeMode] = useState<'standard' | 'smpte'>('standard');

  // Professional Tool Modes: Select ('select'), Razor ('razor'), Hand / Pan ('hand')
  const [toolMode, setToolMode] = useState<TimelineToolMode>('select');

  // Snapping & Guides
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);

  // Razor Blade Hover Line
  const [razorHoverSec, setRazorHoverSec] = useState<number | null>(null);
  const [razorHoverClipId, setRazorHoverClipId] = useState<string | null>(null);

  // Track Lock States
  const [isOverlayLocked, setIsOverlayLocked] = useState(false);
  const [isVideoLocked, setIsVideoLocked] = useState(false);
  const [isAudioLocked, setIsAudioLocked] = useState(false);
  const [isSfxLocked, setIsSfxLocked] = useState(false);

  // Track Visibility & Mute States
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isVideoVisible, setIsVideoVisible] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);
  const [isAudioSolo, setIsAudioSolo] = useState(false);

  // Trimming State
  const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);
  const [trimEdge, setTrimEdge] = useState<'left' | 'right' | null>(null);
  const [trimStartX, setTrimStartX] = useState(0);
  const [trimInitialIn, setTrimInitialIn] = useState(0);
  const [trimInitialOut, setTrimInitialOut] = useState(0);
  const [trimDeltaSec, setTrimDeltaSec] = useState<number | null>(null);

  // Hand / Pan Scrolling State
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartScrollLeft, setPanStartScrollLeft] = useState(0);

  // Standardized track header sidebar width (w-32 = 128px)
  const TRACK_HEADER_WIDTH = 128;

  // Exact ending boundary time of all video clips
  const projectEndSec = clips.reduce(
    (acc, c) => Math.max(acc, c.startTimelineTime + c.duration),
    0
  );

  // Total project duration with comfortable UI breathing room
  const totalDuration = Math.max(10, projectEndSec);

  // Measure container width dynamically with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Compute fit-to-screen pixelsPerSecond so the entire video ends cleanly inside one screen visual
  const calculateFitPps = useCallback(
    (cWidth: number, endSec: number) => {
      const availableLane = Math.max(200, cWidth - TRACK_HEADER_WIDTH - 60);
      return Math.max(15, Math.min(350, availableLane / Math.max(0.1, endSec)));
    },
    [TRACK_HEADER_WIDTH]
  );

  // When auto-fit is active or container width / project changes, sync pixelsPerSecond
  useEffect(() => {
    if (isAutoFit && containerWidth > 0 && projectEndSec > 0) {
      const fitPps = calculateFitPps(containerWidth, projectEndSec);
      setPixelsPerSecond(fitPps);
    }
  }, [isAutoFit, containerWidth, projectEndSec, calculateFitPps]);

  // Total horizontal canvas width:
  // When isAutoFit is true, timelineWidth matches containerWidth exactly (0 horizontal scrollbar!).
  // When zoomed in, timelineWidth expands allowing smooth horizontal panning.
  const naturalContentWidth = TRACK_HEADER_WIDTH + projectEndSec * pixelsPerSecond + 60;
  const timelineWidth =
    isAutoFit && containerWidth > 0
      ? containerWidth
      : Math.max(containerWidth || 800, naturalContentWidth);

  // Has any active selection
  const hasSelection = Boolean(selectedClipId || selectedOverlayId || selectedSfxId);

  // Calculate magnetic snap points
  const getSnapPoints = useCallback((): number[] => {
    const points = new Set<number>([0, Number(projectEndSec.toFixed(3))]);
    clips.forEach((c) => {
      points.add(Number(c.startTimelineTime.toFixed(3)));
      points.add(Number((c.startTimelineTime + c.duration).toFixed(3)));
    });
    overlays.forEach((o) => {
      points.add(Number(o.startTimelineTime.toFixed(3)));
      points.add(Number((o.startTimelineTime + o.duration).toFixed(3)));
    });
    zoomKeyframes.forEach((k) => {
      points.add(Number(k.startTimelineTime.toFixed(3)));
    });
    return Array.from(points);
  }, [clips, overlays, zoomKeyframes, projectEndSec]);

  // Split Clip at specific timeline timestamp
  const handleSplitClipAt = useCallback(
    (clipId: string, splitOffsetSec: number) => {
      if (isVideoLocked) return;
      const targetClipIndex = clips.findIndex((c) => c.id === clipId);
      if (targetClipIndex === -1) return;

      const clip = clips[targetClipIndex];
      const splitInSource = clip.inPoint + splitOffsetSec * clip.speed;

      // Ensure minimum 0.2s duration on either side
      if (splitOffsetSec < 0.2 || clip.duration - splitOffsetSec < 0.2) {
        return;
      }

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
        transitionIn: 'none',
      };

      const newClips = [...clips];
      newClips.splice(targetClipIndex, 1, firstHalf, secondHalf);
      setClips(newClips);
      setSelectedClipId(firstHalf.id);
    },
    [clips, isVideoLocked, setClips, setSelectedClipId]
  );

  // Split at current Playhead position
  const handleSplitAtPlayhead = useCallback(() => {
    if (isVideoLocked) return;
    const clipAtPlayhead = clips.find(
      (c) =>
        currentTime >= c.startTimelineTime &&
        currentTime <= c.startTimelineTime + c.duration
    );
    if (!clipAtPlayhead) return;

    const offset = currentTime - clipAtPlayhead.startTimelineTime;
    handleSplitClipAt(clipAtPlayhead.id, offset);
  }, [clips, currentTime, isVideoLocked, handleSplitClipAt]);

  // Delete currently selected item
  const handleDeleteSelected = useCallback(() => {
    if (selectedClipId && !isVideoLocked) {
      if (clips.length <= 1) return; // Keep at least one clip
      const newClips = clips.filter((c) => c.id !== selectedClipId);
      setClips(newClips);
      setSelectedClipId(null);
    } else if (selectedOverlayId && !isOverlayLocked) {
      setOverlays((prev) => prev.filter((o) => o.id !== selectedOverlayId));
      setSelectedOverlayId(null);
    } else if (selectedSfxId && !isSfxLocked) {
      setSfxTracks((prev) => prev.filter((s) => s.id !== selectedSfxId));
      if (setSelectedSfxId) setSelectedSfxId(null);
    }
  }, [
    selectedClipId,
    selectedOverlayId,
    selectedSfxId,
    clips,
    isVideoLocked,
    isOverlayLocked,
    isSfxLocked,
    setClips,
    setOverlays,
    setSfxTracks,
    setSelectedClipId,
    setSelectedOverlayId,
    setSelectedSfxId,
  ]);

  // Ripple Delete: Deletes selected clip and pulls all succeeding clips left
  const handleRippleDeleteSelected = useCallback(() => {
    if (!selectedClipId || isVideoLocked || clips.length <= 1) return;

    const targetIndex = clips.findIndex((c) => c.id === selectedClipId);
    if (targetIndex === -1) return;

    const deletedClip = clips[targetIndex];
    const durationToShift = deletedClip.duration;

    const updatedClips = clips
      .filter((c) => c.id !== selectedClipId)
      .map((c, idx) => {
        if (idx >= targetIndex) {
          return {
            ...c,
            startTimelineTime: Math.max(0, c.startTimelineTime - durationToShift),
          };
        }
        return c;
      });

    setClips(updatedClips);
    setSelectedClipId(null);
  }, [selectedClipId, isVideoLocked, clips, setClips, setSelectedClipId]);

  // Close All Gaps: Repacks all clips sequentially starting at 0
  const handleCloseGaps = useCallback(() => {
    if (isVideoLocked || clips.length === 0) return;

    // Sort clips by timeline position
    const sorted = [...clips].sort((a, b) => a.startTimelineTime - b.startTimelineTime);
    let runningTime = 0;

    const repacked = sorted.map((c) => {
      const updated = {
        ...c,
        startTimelineTime: runningTime,
      };
      runningTime += c.duration;
      return updated;
    });

    setClips(repacked);
  }, [clips, isVideoLocked, setClips]);

  // Jump to Next / Previous Cut
  const handleJumpToCut = useCallback(
    (direction: 'prev' | 'next') => {
      const cutTimes = getSnapPoints().sort((a, b) => a - b);
      if (direction === 'prev') {
        const prevCuts = cutTimes.filter((t) => t < currentTime - 0.05);
        if (prevCuts.length > 0) {
          setCurrentTime(prevCuts[prevCuts.length - 1]);
        } else {
          setCurrentTime(0);
        }
      } else {
        const nextCuts = cutTimes.filter((t) => t > currentTime + 0.05);
        if (nextCuts.length > 0) {
          setCurrentTime(nextCuts[0]);
        } else {
          setCurrentTime(projectEndSec);
        }
      }
    },
    [getSnapPoints, currentTime, projectEndSec, setCurrentTime]
  );

  // Nudge Playhead by Frame(s)
  const handleNudgeFrame = useCallback(
    (frames: number) => {
      const deltaSec = frames / 30;
      setCurrentTime((prev) => Math.max(0, Math.min(projectEndSec, prev + deltaSec)));
    },
    [projectEndSec, setCurrentTime]
  );

  // Zoom to Fit Project in visible container width (1-Screen view)
  const handleZoomToFit = useCallback(() => {
    setIsAutoFit(true);
    if (!containerRef.current || projectEndSec <= 0) return;
    const availableWidth = Math.max(200, containerRef.current.clientWidth - TRACK_HEADER_WIDTH - 60);
    const calculatedPps = Math.max(15, Math.min(350, availableWidth / projectEndSec));
    setPixelsPerSecond(calculatedPps);
    containerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
  }, [projectEndSec, TRACK_HEADER_WIDTH]);

  // Smooth wheel zoom listener (Ctrl / Alt / Meta + Wheel or Pinch)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        setIsAutoFit(false);
        setPixelsPerSecond((prev) => {
          return Math.max(15, Math.min(350, Math.round(prev * factor)));
        });
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Add SFX Item at current playhead
  const handleAddSfxAtPlayhead = useCallback(() => {
    if (isSfxLocked) return;
    const newSfx: SfxTrackItem = {
      id: `sfx-${Date.now()}`,
      name: 'Vine Boom',
      preset: 'vine-boom',
      startTimelineTime: currentTime,
      duration: 0.8,
      volume: 1.0,
      isMuted: false,
    };
    setSfxTracks((prev) => [...prev, newSfx]);
    if (setSelectedSfxId) setSelectedSfxId(newSfx.id);
  }, [isSfxLocked, currentTime, setSfxTracks, setSelectedSfxId]);

  // Update time from mouse X coordinates with magnetic snapping
  const updateTimeFromMouse = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const clickX = clientX - rect.left + scrollLeft;
      const relativeX = clickX - TRACK_HEADER_WIDTH;
      let targetTime = Math.max(0, relativeX / pixelsPerSecond);

      if (isSnappingEnabled) {
        const snapThresholdSec = 10 / pixelsPerSecond;
        const snapPoints = getSnapPoints();
        const nearest = snapPoints.find((p) => Math.abs(p - targetTime) <= snapThresholdSec);
        if (nearest !== undefined) {
          targetTime = nearest;
          setSnapGuideTime(nearest);
        } else {
          setSnapGuideTime(null);
        }
      } else {
        setSnapGuideTime(null);
      }

      setCurrentTime(targetTime);
    },
    [pixelsPerSecond, isSnappingEnabled, getSnapPoints, TRACK_HEADER_WIDTH, setCurrentTime]
  );

  // Throttled scrubbing with requestAnimationFrame for 60fps smoothness
  const rafScrubRef = useRef<number | null>(null);

  // Hand / Pan Tool dragging
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If Hand tool is active, start dragging the canvas horizontally
    if (toolMode === 'hand' && containerRef.current) {
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartScrollLeft(containerRef.current.scrollLeft);

      const handlePanMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;
        const deltaX = moveEvent.clientX - e.clientX;
        containerRef.current.scrollLeft = panStartScrollLeft - deltaX;
      };

      const handlePanUp = () => {
        setIsPanning(false);
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanUp);
      };

      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanUp);
      return;
    }

    // Razor tool clicking on track background
    if (toolMode === 'razor') return;

    // Normal scrubbing on click
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-no-scrub]')) return;

    updateTimeFromMouse(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafScrubRef.current !== null) cancelAnimationFrame(rafScrubRef.current);
      rafScrubRef.current = requestAnimationFrame(() => {
        updateTimeFromMouse(moveEvent.clientX);
      });
    };

    const handleMouseUp = () => {
      setSnapGuideTime(null);
      if (rafScrubRef.current !== null) {
        cancelAnimationFrame(rafScrubRef.current);
        rafScrubRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Trimming Logic with requestAnimationFrame
  const rafTrimRef = useRef<number | null>(null);

  const handleTrimStart = (
    e: React.MouseEvent,
    clipId: string,
    edge: 'left' | 'right'
  ) => {
    e.stopPropagation();
    if (isVideoLocked) return;
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    setTrimmingClipId(clipId);
    setTrimEdge(edge);
    setTrimStartX(e.clientX);
    setTrimInitialIn(clip.inPoint);
    setTrimInitialOut(clip.outPoint);
    setTrimDeltaSec(0);

    const handleTrimMove = (moveEvent: MouseEvent) => {
      if (rafTrimRef.current !== null) cancelAnimationFrame(rafTrimRef.current);
      rafTrimRef.current = requestAnimationFrame(() => {
        const deltaPixels = moveEvent.clientX - e.clientX;
        const deltaSec = deltaPixels / pixelsPerSecond;
        setTrimDeltaSec(deltaSec);

        setClips((prevClips) =>
          prevClips.map((c) => {
            if (c.id !== clipId) return c;
            if (edge === 'left') {
              const newInPoint = Math.max(
                0,
                Math.min(clip.outPoint - 0.3 * clip.speed, clip.inPoint + deltaSec * clip.speed)
              );
              const appliedDeltaSec = (newInPoint - clip.inPoint) / clip.speed;
              const newDuration = (clip.outPoint - newInPoint) / clip.speed;
              const newStart = Math.max(0, clip.startTimelineTime + appliedDeltaSec);
              return {
                ...c,
                inPoint: newInPoint,
                duration: newDuration,
                startTimelineTime: newStart,
              };
            } else {
              const newOutPoint = Math.min(
                clip.originalDuration,
                Math.max(clip.inPoint + 0.3 * clip.speed, clip.outPoint + deltaSec * clip.speed)
              );
              const newDuration = (newOutPoint - clip.inPoint) / clip.speed;
              return {
                ...c,
                outPoint: newOutPoint,
                duration: newDuration,
              };
            }
          })
        );
      });
    };

    const handleTrimEnd = () => {
      setTrimmingClipId(null);
      setTrimEdge(null);
      setTrimDeltaSec(null);
      if (rafTrimRef.current !== null) {
        cancelAnimationFrame(rafTrimRef.current);
        rafTrimRef.current = null;
      }
      window.removeEventListener('mousemove', handleTrimMove);
      window.removeEventListener('mouseup', handleTrimEnd);
    };

    window.addEventListener('mousemove', handleTrimMove);
    window.addEventListener('mouseup', handleTrimEnd);
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setToolMode('select');
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setToolMode('razor');
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setToolMode('hand');
      } else if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRippleDeleteSelected();
        } else {
          e.preventDefault();
          handleDeleteSelected();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsSnappingEnabled((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleZoomToFit();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNudgeFrame(e.shiftKey ? -30 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNudgeFrame(e.shiftKey ? 30 : 1);
      } else if (e.key === 'ArrowUp' || e.key === '[') {
        e.preventDefault();
        handleJumpToCut('prev');
      } else if (e.key === 'ArrowDown' || e.key === ']') {
        e.preventDefault();
        handleJumpToCut('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleSplitAtPlayhead,
    handleDeleteSelected,
    handleRippleDeleteSelected,
    handleZoomToFit,
    handleNudgeFrame,
    handleJumpToCut,
  ]);

  return (
    <div className="flex flex-col bg-slate-950 border-t border-slate-800 select-none shadow-2xl relative">
      {/* 1. PROFESSIONAL TOOLBAR */}
      <TimelineToolbar
        toolMode={toolMode}
        setToolMode={setToolMode}
        isSnappingEnabled={isSnappingEnabled}
        setIsSnappingEnabled={setIsSnappingEnabled}
        pixelsPerSecond={pixelsPerSecond}
        setPixelsPerSecond={(pps) => {
          setIsAutoFit(false);
          setPixelsPerSecond(pps);
        }}
        isAutoFit={isAutoFit}
        onToggleAutoFit={() => {
          setIsAutoFit((prev) => {
            const next = !prev;
            if (next) {
              handleZoomToFit();
            }
            return next;
          });
        }}
        currentTime={currentTime}
        totalDuration={totalDuration}
        projectEndSec={projectEndSec}
        hasSelection={hasSelection}
        onSplitAtPlayhead={handleSplitAtPlayhead}
        onDeleteSelected={handleDeleteSelected}
        onRippleDeleteSelected={handleRippleDeleteSelected}
        onCloseGaps={handleCloseGaps}
        onNudgeFrame={handleNudgeFrame}
        onJumpToCut={handleJumpToCut}
        onZoomToFit={handleZoomToFit}
        showMinimap={showMinimap}
        setShowMinimap={setShowMinimap}
        timecodeMode={timecodeMode}
        setTimecodeMode={setTimecodeMode}
        onAddPunchZoom={onAddPunchZoom}
      />

      {/* 2. TIMELINE MINIMAP NAVIGATOR */}
      {showMinimap && (
        <TimelineMinimap
          clips={clips}
          overlays={overlays}
          sfxTracks={sfxTracks}
          totalDuration={totalDuration}
          projectEndSec={projectEndSec}
          currentTime={currentTime}
          containerRef={containerRef}
          timelineWidth={timelineWidth}
          pixelsPerSecond={pixelsPerSecond}
          onSeek={setCurrentTime}
        />
      )}

      {/* 3. MULTI-TRACK SCROLL VIEWPORT */}
      <div
        ref={containerRef}
        onMouseDown={handleTimelineMouseDown}
        className={`relative overflow-x-auto overflow-y-hidden select-none bg-slate-950/95 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900 ${
          toolMode === 'razor'
            ? 'cursor-crosshair'
            : toolMode === 'hand'
            ? isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-default'
        }`}
        style={{ height: '315px' }}
      >
        <div style={{ width: `${timelineWidth}px` }} className="relative h-full flex flex-col">
          {/* Time Ruler */}
          <TimelineRuler
            totalDuration={totalDuration}
            projectEndSec={projectEndSec}
            pixelsPerSecond={pixelsPerSecond}
            currentTime={currentTime}
            onSeek={setCurrentTime}
            headerWidth={TRACK_HEADER_WIDTH}
            timecodeMode={timecodeMode}
          />

          {/* Magnetic Snap Vertical Guideline */}
          {snapGuideTime !== null && (
            <div
              style={{ left: `${TRACK_HEADER_WIDTH + snapGuideTime * pixelsPerSecond}px` }}
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] z-40 pointer-events-none"
            >
              <div className="absolute top-7 -translate-x-1/2 px-1 py-0.2 bg-cyan-500 text-slate-950 font-mono font-bold text-[9px] rounded shadow">
                SNAP
              </div>
            </div>
          )}

          {/* Project End Boundary Vertical Line across all tracks */}
          {projectEndSec > 0 && (
            <div
              style={{ left: `${TRACK_HEADER_WIDTH + projectEndSec * pixelsPerSecond}px` }}
              className="absolute top-7 bottom-0 w-0.5 bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.6)] z-20 pointer-events-none"
            >
              <div className="absolute bottom-2 -translate-x-1/2 px-1.5 py-0.5 bg-amber-500/90 text-slate-950 font-mono font-black text-[9px] rounded uppercase shadow whitespace-nowrap">
                End of Video
              </div>
            </div>
          )}

          {/* Inactive Hatched Zone Past End of Video */}
          {projectEndSec > 0 && (
            <div
              style={{
                left: `${TRACK_HEADER_WIDTH + projectEndSec * pixelsPerSecond}px`,
                width: `${timelineWidth - (TRACK_HEADER_WIDTH + projectEndSec * pixelsPerSecond)}px`,
              }}
              className="absolute top-7 bottom-0 bg-[repeating-linear-gradient(45deg,rgba(15,23,42,0.6),rgba(15,23,42,0.6)_10px,rgba(30,41,59,0.3)_10px,rgba(30,41,59,0.3)_20px)] border-l border-amber-500/40 pointer-events-none z-10"
            />
          )}

          {/* ========================================================= */}
          {/* TRACK 1: V2 OVERLAYS & TEXT STICKERS (h-14)               */}
          {/* ========================================================= */}
          <div
            className={`relative h-14 border-b border-slate-800/80 flex items-center bg-slate-950/40 transition-opacity ${
              !isOverlayVisible ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <TimelineTrackHeader
              type="overlay"
              trackId="v2"
              label="Overlays"
              badge="V2"
              isLocked={isOverlayLocked}
              onToggleLock={() => setIsOverlayLocked((l) => !l)}
              isVisible={isOverlayVisible}
              onToggleVisibility={() => setIsOverlayVisible((v) => !v)}
              itemCount={overlays.length}
            />

            {/* Lane Items */}
            <div className="relative flex-1 h-full flex items-center">
              {overlays.map((ov) => {
                const isSelected = selectedOverlayId === ov.id;
                const leftPx = ov.startTimelineTime * pixelsPerSecond;
                const widthPx = Math.max(30, ov.duration * pixelsPerSecond);

                return (
                  <div
                    key={ov.id}
                    data-no-scrub="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (toolMode === 'select' && !isOverlayLocked) {
                        setSelectedOverlayId(ov.id);
                        setSelectedClipId(null);
                        if (setSelectedSfxId) setSelectedSfxId(null);
                      }
                    }}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    className={`absolute h-10 rounded-lg flex items-center px-2 border-2 cursor-pointer transition-all shadow-md overflow-hidden ${
                      isSelected
                        ? 'bg-purple-900/90 border-purple-400 ring-2 ring-purple-400/50 shadow-purple-950/80'
                        : 'bg-purple-950/70 border-purple-700/60 hover:border-purple-500'
                    }`}
                  >
                    <span className="text-base mr-1.5 shrink-0 select-none">{ov.emoji}</span>
                    <span className="text-xs font-semibold text-purple-200 truncate">{ov.label}</span>
                    <span className="ml-auto text-[9px] font-mono text-purple-300/70 shrink-0">
                      {ov.duration.toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* TRACK 2: V1 VIDEO TRACK (h-22) - FILMSTRIP AESTHETIC       */}
          {/* ========================================================= */}
          <div
            className={`relative h-22 border-b border-slate-800 flex items-center bg-slate-900/30 transition-opacity ${
              !isVideoVisible ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <TimelineTrackHeader
              type="video"
              trackId="v1"
              label="Video"
              badge="V1"
              isLocked={isVideoLocked}
              onToggleLock={() => setIsVideoLocked((l) => !l)}
              isVisible={isVideoVisible}
              onToggleVisibility={() => setIsVideoVisible((v) => !v)}
              itemCount={clips.length}
            />

            {/* Lane Items */}
            <div className="relative flex-1 h-full flex items-center">
              {clips.map((clip, idx) => {
                const isSelected = selectedClipId === clip.id;
                const isTrimming = trimmingClipId === clip.id;
                const leftPx = clip.startTimelineTime * pixelsPerSecond;
                const widthPx = clip.duration * pixelsPerSecond;

                return (
                  <div
                    key={clip.id}
                    data-no-scrub="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isVideoLocked) return;

                      if (toolMode === 'razor') {
                        // Razor Tool: Split clip at clicked mouse position
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickOffsetSec = (e.clientX - rect.left) / pixelsPerSecond;
                        handleSplitClipAt(clip.id, clickOffsetSec);
                      } else if (toolMode === 'select') {
                        setSelectedClipId(clip.id);
                        setSelectedOverlayId(null);
                        if (setSelectedSfxId) setSelectedSfxId(null);
                      }
                    }}
                    onMouseMove={(e) => {
                      if (toolMode === 'razor' && !isVideoLocked) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetSec = (e.clientX - rect.left) / pixelsPerSecond;
                        setRazorHoverSec(clip.startTimelineTime + offsetSec);
                        setRazorHoverClipId(clip.id);
                      }
                    }}
                    onMouseLeave={() => {
                      if (toolMode === 'razor') {
                        setRazorHoverSec(null);
                        setRazorHoverClipId(null);
                      }
                    }}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    className={`absolute h-18 rounded-lg overflow-hidden border-2 flex flex-col justify-between transition-shadow group select-none shadow-md ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-400 ring-2 ring-indigo-400/60 shadow-indigo-950/80'
                        : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500'
                    }`}
                  >
                    {/* Simulated Filmstrip Perforations (Top & Bottom) */}
                    <div className="h-2 w-full bg-slate-950/80 flex items-center justify-between px-1 gap-1 overflow-hidden pointer-events-none border-b border-slate-800">
                      {Array.from({ length: Math.max(3, Math.floor(widthPx / 16)) }).map((_, i) => (
                        <div key={i} className="w-1.5 h-1 bg-slate-700/60 rounded-xs shrink-0" />
                      ))}
                    </div>

                    {/* Clip Body & Metadata */}
                    <div className="flex-1 flex items-center justify-between px-2 overflow-hidden relative">
                      <div className="flex items-center gap-1.5 overflow-hidden z-10">
                        <Film className="w-3 h-3 text-indigo-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-100 truncate">{clip.name}</span>
                        {clip.speed !== 1 && (
                          <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[9px] font-mono border border-amber-500/30">
                            {clip.speed}x
                          </span>
                        )}
                        {clip.transitionIn !== 'none' && (
                          <span className="px-1 py-0.2 bg-indigo-500/20 text-indigo-300 rounded text-[9px] font-mono border border-indigo-500/30">
                            {clip.transitionIn}
                          </span>
                        )}
                      </div>

                      {/* Quick Split / Delete Icons on Hover */}
                      <div className="hidden group-hover:flex items-center gap-1 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isVideoLocked) return;
                            handleSplitClipAt(clip.id, clip.duration / 2);
                          }}
                          title="Split Clip in Half"
                          className="p-1 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded border border-slate-700 shadow-sm"
                        >
                          <Scissors className="w-2.5 h-2.5" />
                        </button>
                        {clips.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isVideoLocked) return;
                              setClips((prev) => prev.filter((c) => c.id !== clip.id));
                              if (selectedClipId === clip.id) setSelectedClipId(null);
                            }}
                            title="Delete Clip"
                            className="p-1 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded border border-slate-700 shadow-sm"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filmstrip Bottom Perforations & Duration */}
                    <div className="h-3 w-full bg-slate-950/80 flex items-center justify-between px-1 border-t border-slate-800 text-[8px] font-mono text-slate-400 pointer-events-none">
                      <span>IN: {clip.inPoint.toFixed(1)}s</span>
                      <span>{clip.duration.toFixed(1)}s</span>
                      <span>OUT: {clip.outPoint.toFixed(1)}s</span>
                    </div>

                    {/* Razor Scissor Cut Guide Line */}
                    {toolMode === 'razor' && razorHoverClipId === clip.id && razorHoverSec !== null && (
                      <div
                        style={{ left: `${(razorHoverSec - clip.startTimelineTime) * pixelsPerSecond}px` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,1)] flex items-center justify-center"
                      >
                        <Scissors className="w-3.5 h-3.5 text-rose-300 -translate-y-4 fill-rose-600 animate-bounce" />
                      </div>
                    )}

                    {/* Left Trim Handle */}
                    {!isVideoLocked && (
                      <div
                        onMouseDown={(e) => handleTrimStart(e, clip.id, 'left')}
                        title="Drag to trim Start (IN)"
                        className="absolute left-0 top-0 bottom-0 w-2.5 bg-indigo-500/30 hover:bg-indigo-500 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-indigo-500/60"
                      >
                        <div className="w-0.5 h-4 bg-white/80 rounded" />
                      </div>
                    )}

                    {/* Right Trim Handle */}
                    {!isVideoLocked && (
                      <div
                        onMouseDown={(e) => handleTrimStart(e, clip.id, 'right')}
                        title="Drag to trim End (OUT)"
                        className="absolute right-0 top-0 bottom-0 w-2.5 bg-indigo-500/30 hover:bg-indigo-500 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-indigo-500/60"
                      >
                        <div className="w-0.5 h-4 bg-white/80 rounded" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* TRACK 3: A1 MAIN DIALOGUE AUDIO TRACK (h-20)               */}
          {/* ========================================================= */}
          <div
            className={`relative h-20 border-b border-slate-800 flex items-center bg-slate-900/20 transition-opacity ${
              isAudioMuted ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <TimelineTrackHeader
              type="audio"
              trackId="a1"
              label="Main Audio"
              badge="A1"
              isLocked={isAudioLocked}
              onToggleLock={() => setIsAudioLocked((l) => !l)}
              isMuted={isAudioMuted}
              onToggleMute={() => setIsAudioMuted((m) => !m)}
              isSolo={isAudioSolo}
              onToggleSolo={() => setIsAudioSolo((s) => !s)}
              itemCount={clips.length}
            />

            {/* Lane Items */}
            <div className="relative flex-1 h-full flex items-center">
              {clips.map((clip) => {
                const isSelected = selectedClipId === clip.id;
                const leftPx = clip.startTimelineTime * pixelsPerSecond;
                const widthPx = clip.duration * pixelsPerSecond;
                const numBars = Math.max(16, Math.floor(widthPx / 3.5));

                const slicedWaveform = extractClipWaveformSegment(
                  clip.audioBuffer,
                  clip.waveform,
                  clip.inPoint,
                  clip.outPoint,
                  clip.originalDuration,
                  numBars
                );

                const isPlayheadInside =
                  currentTime >= clip.startTimelineTime &&
                  currentTime <= clip.startTimelineTime + clip.duration;

                const currentBarIdx = isPlayheadInside
                  ? Math.min(
                      numBars - 1,
                      Math.max(
                        0,
                        Math.floor(((currentTime - clip.startTimelineTime) / clip.duration) * numBars)
                      )
                    )
                  : -1;

                const activeEnergy =
                  currentBarIdx >= 0 && slicedWaveform[currentBarIdx] !== undefined
                    ? slicedWaveform[currentBarIdx]
                    : 0;

                return (
                  <div
                    key={`audio-${clip.id}`}
                    data-no-scrub="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (toolMode === 'select' && !isAudioLocked) {
                        setSelectedClipId(clip.id);
                        setSelectedOverlayId(null);
                        if (setSelectedSfxId) setSelectedSfxId(null);
                      }
                    }}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    className={`absolute h-16 rounded-lg overflow-hidden border-2 flex flex-col justify-between transition-all select-none shadow-md ${
                      isSelected
                        ? 'bg-slate-900 border-sky-400 ring-2 ring-sky-400/50 shadow-sky-950/80'
                        : 'bg-slate-900/80 border-slate-700/80 hover:border-sky-700'
                    }`}
                  >
                    {/* Header: Title, Live Ticking HUD Badge, Volume Controls */}
                    <div className="flex items-center justify-between px-2 pt-1 border-b border-slate-800/80 z-10">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <Music className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                        <span className="text-[11px] font-medium text-sky-200 truncate">{clip.name}</span>

                        {/* Live Playhead Sound Intensity Badge */}
                        {isPlayheadInside && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold transition-all ${
                              activeEnergy > 0.08
                                ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/60 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {activeEnergy > 0.08
                              ? `🔊 SOUND: ${Math.round(activeEnergy * 100)}%`
                              : '🔇 SILENCE'}
                          </span>
                        )}
                      </div>

                      {/* Inline Volume Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isAudioLocked) return;
                            setClips((prev) =>
                              prev.map((c) =>
                                c.id === clip.id ? { ...c, isMuted: !c.isMuted } : c
                              )
                            );
                          }}
                          className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                        >
                          {clip.isMuted ? (
                            <VolumeX className="w-2.5 h-2.5 text-rose-400" />
                          ) : (
                            <Volume2 className="w-2.5 h-2.5" />
                          )}
                        </button>
                        <span className="text-[9px] font-mono text-sky-300">
                          {clip.isMuted ? 'MUTE' : `${Math.round((clip.volume ?? 1) * 100)}%`}
                        </span>
                      </div>
                    </div>

                    {/* True Waveform Peak Display */}
                    <div className="flex-1 flex items-center justify-between px-1.5 gap-0.5 overflow-hidden">
                      {slicedWaveform.map((val, bIdx) => {
                        const isBarActive = bIdx === currentBarIdx;
                        const isSilent = val < 0.05;
                        const barHeightPct = isSilent ? 8 : Math.max(12, Math.min(100, val * 100));

                        return (
                          <div
                            key={bIdx}
                            style={{ height: `${barHeightPct}%` }}
                            className={`w-0.5 rounded-full transition-all ${
                              isBarActive
                                ? 'bg-white shadow-[0_0_8px_white] scale-y-125 z-10'
                                : isSilent
                                ? 'bg-slate-700/60'
                                : val > 0.6
                                ? 'bg-amber-400'
                                : 'bg-sky-400/90'
                            }`}
                          />
                        );
                      })}
                    </div>

                    {/* Bottom Duration Footer */}
                    <div className="h-2.5 bg-slate-950/80 px-1.5 flex items-center justify-between text-[8px] font-mono text-slate-500 border-t border-slate-800">
                      <span>IN: {clip.inPoint.toFixed(1)}s</span>
                      <span>OUT: {clip.outPoint.toFixed(1)}s</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* TRACK 4: A2 SFX AUDIO TRACK (h-16)                         */}
          {/* ========================================================= */}
          <div
            className={`relative h-16 border-b border-slate-800 flex items-center bg-slate-900/10 transition-opacity ${
              isSfxMuted ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <TimelineTrackHeader
              type="sfx"
              trackId="a2"
              label="SFX"
              badge="A2"
              isLocked={isSfxLocked}
              onToggleLock={() => setIsSfxLocked((l) => !l)}
              isMuted={isSfxMuted}
              onToggleMute={() => setIsSfxMuted((m) => !m)}
              onQuickAdd={handleAddSfxAtPlayhead}
              quickAddTitle="Add SFX at current playhead"
              itemCount={sfxTracks.length}
            />

            {/* Lane Items */}
            <div className="relative flex-1 h-full flex items-center">
              {sfxTracks.map((sfx) => {
                const isSelected = selectedSfxId === sfx.id;
                const leftPx = sfx.startTimelineTime * pixelsPerSecond;
                const widthPx = Math.max(50, sfx.duration * pixelsPerSecond);

                const isTriggeredNow =
                  currentTime >= sfx.startTimelineTime &&
                  currentTime <= sfx.startTimelineTime + sfx.duration;

                return (
                  <div
                    key={sfx.id}
                    data-no-scrub="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (toolMode === 'select' && !isSfxLocked && setSelectedSfxId) {
                        setSelectedSfxId(sfx.id);
                        setSelectedClipId(null);
                        setSelectedOverlayId(null);
                      }
                    }}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    className={`absolute h-11 rounded-lg px-2 flex items-center justify-between border-2 transition-all cursor-pointer shadow-md select-none ${
                      isTriggeredNow
                        ? 'bg-emerald-900/90 border-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] scale-[1.02]'
                        : isSelected
                        ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-400/50'
                        : 'bg-emerald-950/70 border-emerald-700/60 hover:border-emerald-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="text-xs font-semibold text-emerald-200 truncate">{sfx.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-emerald-400">
                        {Math.round((sfx.volume ?? 1) * 100)}%
                      </span>
                      {sfxTracks.length > 0 && !isSfxLocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSfxTracks((prev) => prev.filter((s) => s.id !== sfx.id));
                            if (selectedSfxId === sfx.id && setSelectedSfxId) setSelectedSfxId(null);
                          }}
                          className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* PLAYHEAD NEEDLE & HANDLE (Across All Tracks)               */}
          {/* ========================================================= */}
          <div
            style={{
              transform: `translate3d(${TRACK_HEADER_WIDTH + currentTime * pixelsPerSecond}px, 0, 0)`,
              willChange: 'transform',
            }}
            className="absolute top-0 bottom-0 left-0 w-0.5 bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.9)]"
          >
            {/* Playhead Triangular Header Handle */}
            <div className="absolute -top-0 -translate-x-1/2 w-3.5 h-4 bg-red-500 shadow-md flex items-center justify-center [clip-path:polygon(0%_0%,100%_0%,100%_65%,50%_100%,0%_65%)]" />
          </div>
        </div>
      </div>
    </div>
  );
};
