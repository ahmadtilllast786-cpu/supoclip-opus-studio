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
  Subtitles,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  SfxPreset,
  TransitionType,
  CaptionTrackItem,
  TranscriptWord,
  DiagnosticSettings,
} from '../../types/timeline';
import { extractClipWaveformSegment } from '../../core/audio/audioAnalyzer';
import { recalculateChunkWordTimings, flattenCaptionsToWords } from '../../core/captions/captionHandler';
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
  captions?: CaptionTrackItem[];
  setCaptions?: React.Dispatch<React.SetStateAction<CaptionTrackItem[]>>;
  selectedCaptionId?: string | null;
  setSelectedCaptionId?: (id: string | null) => void;
  words?: TranscriptWord[];
  setWords?: React.Dispatch<React.SetStateAction<TranscriptWord[]>>;
  detectedLanguage?: string;
  isPlaying?: boolean;
  setIsPlaying?: (playing: boolean) => void;
  onAddPunchZoom: () => void;
  onOpenDiagnostics?: () => void;
  diagnosticSettings?: DiagnosticSettings;
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
  captions = [],
  setCaptions,
  selectedCaptionId,
  setSelectedCaptionId,
  words = [],
  setWords,
  detectedLanguage = 'en',
  isPlaying = false,
  setIsPlaying,
  onAddPunchZoom,
  onOpenDiagnostics,
  diagnosticSettings,
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
  const [isCaptionLocked, setIsCaptionLocked] = useState(false);
  const [isOverlayLocked, setIsOverlayLocked] = useState(false);
  const [isVideoLocked, setIsVideoLocked] = useState(false);
  const [isAudioLocked, setIsAudioLocked] = useState(false);
  const [isSfxLocked, setIsSfxLocked] = useState(false);

  // Track Visibility & Mute States
  const [isCaptionVisible, setIsCaptionVisible] = useState(true);
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

  // Trailing dead space clamped to exactly 5 seconds
  const trailingDeadSpaceSec = 5;

  // Exact ending boundary time across ALL tracks (Clips, Overlays, SFX, Captions)
  const clipsEndSec = clips.reduce(
    (acc, c) => Math.max(acc, c.startTimelineTime + c.duration),
    0
  );
  const overlaysEndSec = overlays.reduce(
    (acc, o) => Math.max(acc, o.startTimelineTime + o.duration),
    0
  );
  const sfxEndSec = sfxTracks.reduce(
    (acc, s) => Math.max(acc, s.startTimelineTime + s.duration),
    0
  );
  const captionsEndSec = (captions || []).reduce(
    (acc, c) => Math.max(acc, c.endTime),
    0
  );
  const projectEndSec = Math.max(clipsEndSec, overlaysEndSec, sfxEndSec, captionsEndSec, 0);

  // Total project duration including clamped trailing 5s dead space
  const totalDuration = projectEndSec > 0 ? projectEndSec + trailingDeadSpaceSec : 10;

  // Dragging Item State (Clips, Overlays, SFX, Captions)
  const [draggingItem, setDraggingItem] = useState<{
    id: string;
    type: 'clip' | 'overlay' | 'sfx' | 'caption';
    initialStartTime: number;
    duration: number;
    startX: number;
    currentStartTime: number;
  } | null>(null);

  // Active Drop Zone Highlight State
  const [dragOverTrack, setDragOverTrack] = useState<'c1' | 'v2' | 'v1' | 'a2' | null>(null);
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState(false);
  const hasMovedRef = useRef(false);
  const rafItemDragRef = useRef<number | null>(null);

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

  // Compute fit-to-screen pixelsPerSecond so the entire video + 5s dead space ends cleanly inside one screen visual
  const calculateFitPps = useCallback(
    (cWidth: number, endSec: number) => {
      const availableLane = Math.max(200, cWidth - TRACK_HEADER_WIDTH - 20);
      const targetSec = endSec > 0 ? endSec + trailingDeadSpaceSec : 10;
      return Math.max(10, Math.min(200, availableLane / targetSec));
    },
    [TRACK_HEADER_WIDTH, trailingDeadSpaceSec]
  );

  // When auto-fit is active or container width / project changes, sync pixelsPerSecond
  useEffect(() => {
    if (isAutoFit && containerWidth > 0 && projectEndSec > 0) {
      const fitPps = calculateFitPps(containerWidth, projectEndSec);
      setPixelsPerSecond(fitPps);
    }
  }, [isAutoFit, containerWidth, projectEndSec, calculateFitPps]);

  // Clamped horizontal canvas width:
  // When isAutoFit is true, timelineWidth matches containerWidth exactly (0 horizontal scrollbar).
  // When zoomed in, timelineWidth expands up to projectEndSec + exactly 5s trailing dead space.
  const naturalContentWidth =
    TRACK_HEADER_WIDTH + (projectEndSec + trailingDeadSpaceSec) * pixelsPerSecond;
  const timelineWidth =
    isAutoFit && containerWidth > 0
      ? containerWidth
      : Math.max(containerWidth || 800, naturalContentWidth);

  // Has any active selection
  const hasSelection = Boolean(
    selectedClipId || selectedOverlayId || selectedSfxId || selectedCaptionId
  );

  // Calculate magnetic snap points across all elements
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
    sfxTracks.forEach((s) => {
      points.add(Number(s.startTimelineTime.toFixed(3)));
      points.add(Number((s.startTimelineTime + s.duration).toFixed(3)));
    });
    (captions || []).forEach((cap) => {
      points.add(Number(cap.startTime.toFixed(3)));
      points.add(Number(cap.endTime.toFixed(3)));
    });
    zoomKeyframes.forEach((k) => {
      points.add(Number(k.startTimelineTime.toFixed(3)));
    });
    return Array.from(points);
  }, [clips, overlays, sfxTracks, captions, zoomKeyframes, projectEndSec]);

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
    } else if (selectedCaptionId && !isCaptionLocked && setCaptions) {
      setCaptions((prev) => {
        const updated = prev.filter((c) => c.id !== selectedCaptionId);
        if (setWords) setWords(flattenCaptionsToWords(updated));
        return updated;
      });
      if (setSelectedCaptionId) setSelectedCaptionId(null);
    }
  }, [
    selectedClipId,
    selectedOverlayId,
    selectedSfxId,
    selectedCaptionId,
    clips,
    isVideoLocked,
    isOverlayLocked,
    isSfxLocked,
    isCaptionLocked,
    setClips,
    setOverlays,
    setSfxTracks,
    setCaptions,
    setSelectedClipId,
    setSelectedOverlayId,
    setSelectedSfxId,
    setSelectedCaptionId,
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
    const availableWidth = Math.max(200, containerRef.current.clientWidth - TRACK_HEADER_WIDTH - 20);
    const targetDuration = projectEndSec + trailingDeadSpaceSec;
    const calculatedPps = Math.max(10, Math.min(200, availableWidth / targetDuration));
    setPixelsPerSecond(calculatedPps);
    containerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
  }, [projectEndSec, TRACK_HEADER_WIDTH, trailingDeadSpaceSec]);

  // Smooth wheel zoom listener (Ctrl / Alt / Meta + Wheel or Pinch) calibrated to 10 - 200 px/s
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        setIsAutoFit(false);
        setPixelsPerSecond((prev) => {
          return Math.max(10, Math.min(200, Math.round(prev * factor)));
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

  // Convert mouse/pointer X coordinate to exact timeline seconds with precise clamping
  const getTimeFromClientX = useCallback(
    (clientX: number, snap: boolean = false) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const clickX = clientX - rect.left + scrollLeft;
      const relativeX = clickX - TRACK_HEADER_WIDTH;
      const maxAllowedTime = projectEndSec > 0 ? projectEndSec : totalDuration;
      let targetTime = Math.max(0, Math.min(maxAllowedTime, relativeX / pixelsPerSecond));

      if (snap && isSnappingEnabled) {
        // Fine 4px snap threshold so it assists cuts without violently jerking the needle away
        const snapThresholdSec = 4 / pixelsPerSecond;
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

      return Number(targetTime.toFixed(3));
    },
    [pixelsPerSecond, projectEndSec, totalDuration, TRACK_HEADER_WIDTH, isSnappingEnabled, getSnapPoints]
  );

  // Dedicated Playhead Pointer Drag Scrubber (1:1 Cursor Tracking & Pause-on-Scrub)
  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    if (isPlaying && setIsPlaying) {
      setIsPlaying(false);
    }

    setIsScrubbingPlayhead(true);
    const initialTime = getTimeFromClientX(e.clientX, false);
    setCurrentTime(initialTime);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!containerRef.current) return;

      // Smooth auto-scroll when dragging near viewport edges
      const rect = containerRef.current.getBoundingClientRect();
      const leftBoundary = rect.left + TRACK_HEADER_WIDTH + 40;
      const rightBoundary = rect.right - 40;
      if (moveEvent.clientX > rightBoundary) {
        const speed = Math.min(25, (moveEvent.clientX - rightBoundary) * 0.4);
        containerRef.current.scrollLeft += speed;
      } else if (moveEvent.clientX < leftBoundary) {
        const speed = Math.min(25, (leftBoundary - moveEvent.clientX) * 0.4);
        containerRef.current.scrollLeft -= speed;
      }

      const targetTime = getTimeFromClientX(moveEvent.clientX, isSnappingEnabled);
      setCurrentTime(targetTime);
    };

    const handlePointerUp = () => {
      setIsScrubbingPlayhead(false);
      setSnapGuideTime(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Format time for floating playhead tooltip HUD
  const formatPlayheadTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    if (timecodeMode === 'smpte') {
      const frames = Math.floor((sec % 1) * 30);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Throttled scrubbing with requestAnimationFrame for 60fps smoothness
  const rafScrubRef = useRef<number | null>(null);

  // Hand / Pan Tool dragging & Track Background Scrubbing
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

    if (isPlaying && setIsPlaying) {
      setIsPlaying(false);
    }

    setIsScrubbingPlayhead(true);
    const initialTime = getTimeFromClientX(e.clientX, false);
    setCurrentTime(initialTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafScrubRef.current !== null) cancelAnimationFrame(rafScrubRef.current);
      rafScrubRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (moveEvent.clientX > rect.right - 40) {
          containerRef.current.scrollLeft += 15;
        } else if (moveEvent.clientX < rect.left + TRACK_HEADER_WIDTH + 40) {
          containerRef.current.scrollLeft -= 15;
        }
        const time = getTimeFromClientX(moveEvent.clientX, isSnappingEnabled);
        setCurrentTime(time);
      });
    };

    const handleMouseUp = () => {
      setIsScrubbingPlayhead(false);
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

  // Universal Item Drag Engine for Clips, Overlays, SFX, and Captions
  const handleItemDragStart = (
    e: React.PointerEvent,
    id: string,
    type: 'clip' | 'overlay' | 'sfx' | 'caption',
    initialStartTime: number,
    duration: number
  ) => {
    // Only primary left button & select tool mode
    if (e.button !== 0 || toolMode !== 'select') return;
    if (type === 'clip' && isVideoLocked) return;
    if (type === 'overlay' && isOverlayLocked) return;
    if (type === 'sfx' && isSfxLocked) return;
    if (type === 'caption' && isCaptionLocked) return;

    // Ignore if clicking buttons, trim handles, or inputs
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-trim-handle]')) return;

    e.stopPropagation();
    hasMovedRef.current = false;

    // Immediately select target item
    if (type === 'clip') {
      setSelectedClipId(id);
      setSelectedOverlayId(null);
      if (setSelectedSfxId) setSelectedSfxId(null);
      if (setSelectedCaptionId) setSelectedCaptionId(null);
    } else if (type === 'overlay') {
      setSelectedOverlayId(id);
      setSelectedClipId(null);
      if (setSelectedSfxId) setSelectedSfxId(null);
      if (setSelectedCaptionId) setSelectedCaptionId(null);
    } else if (type === 'sfx') {
      if (setSelectedSfxId) setSelectedSfxId(id);
      setSelectedClipId(null);
      setSelectedOverlayId(null);
      if (setSelectedCaptionId) setSelectedCaptionId(null);
    } else if (type === 'caption') {
      if (setSelectedCaptionId) setSelectedCaptionId(id);
      setSelectedClipId(null);
      setSelectedOverlayId(null);
      if (setSelectedSfxId) setSelectedSfxId(null);
    }

    const startX = e.clientX;

    setDraggingItem({
      id,
      type,
      initialStartTime,
      duration,
      startX,
      currentStartTime: initialStartTime,
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      if (Math.abs(deltaPx) > 3) {
        hasMovedRef.current = true;
      }

      if (rafItemDragRef.current !== null) cancelAnimationFrame(rafItemDragRef.current);
      rafItemDragRef.current = requestAnimationFrame(() => {
        const deltaSec = deltaPx / pixelsPerSecond;
        let newStart = Math.max(0, initialStartTime + deltaSec);

        // Magnetic Snapping along Time Axis
        if (isSnappingEnabled) {
          const snapThresholdSec = 10 / pixelsPerSecond;
          const snapPoints = getSnapPoints().filter((p) => {
            return (
              Math.abs(p - initialStartTime) > 0.05 &&
              Math.abs(p - (initialStartTime + duration)) > 0.05
            );
          });
          snapPoints.push(currentTime); // Snap to Playhead

          let snapped = false;
          // Snap Start edge
          for (const pt of snapPoints) {
            if (Math.abs(pt - newStart) <= snapThresholdSec) {
              newStart = pt;
              setSnapGuideTime(pt);
              snapped = true;
              break;
            }
          }
          // Snap End edge
          if (!snapped) {
            for (const pt of snapPoints) {
              if (Math.abs(pt - (newStart + duration)) <= snapThresholdSec) {
                newStart = Math.max(0, pt - duration);
                setSnapGuideTime(pt);
                snapped = true;
                break;
              }
            }
          }
          if (!snapped) {
            setSnapGuideTime(null);
          }
        } else {
          setSnapGuideTime(null);
        }

        setDraggingItem((prev) => (prev ? { ...prev, currentStartTime: newStart } : null));

        // Live-update position in state for buttery smooth responsiveness
        if (type === 'clip') {
          setClips((prev) =>
            prev.map((c) => (c.id === id ? { ...c, startTimelineTime: newStart } : c))
          );
        } else if (type === 'overlay') {
          setOverlays((prev) =>
            prev.map((o) => (o.id === id ? { ...o, startTimelineTime: newStart } : o))
          );
        } else if (type === 'sfx') {
          setSfxTracks((prev) =>
            prev.map((s) => (s.id === id ? { ...s, startTimelineTime: newStart } : s))
          );
        } else if (type === 'caption' && setCaptions) {
          const chunkDur = duration;
          const newEnd = newStart + chunkDur;
          setCaptions((prev) =>
            prev.map((c) =>
              c.id === id ? recalculateChunkWordTimings(c, newStart, newEnd) : c
            )
          );
        }
      });
    };

    const handlePointerUp = () => {
      if (type === 'caption' && setWords && setCaptions) {
        setCaptions((curr) => {
          setWords(flattenCaptionsToWords(curr));
          return curr;
        });
      }
      setDraggingItem(null);
      setSnapGuideTime(null);
      if (rafItemDragRef.current !== null) {
        cancelAnimationFrame(rafItemDragRef.current);
        rafItemDragRef.current = null;
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Overlay Trimming Logic (Start & End Handles)
  const handleOverlayTrimStart = (
    e: React.PointerEvent,
    overlayId: string,
    edge: 'left' | 'right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (isOverlayLocked) return;
    const ov = overlays.find((o) => o.id === overlayId);
    if (!ov) return;

    const startX = e.clientX;
    const initialStart = ov.startTimelineTime;
    const initialDuration = ov.duration;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / pixelsPerSecond;
      setOverlays((prev) =>
        prev.map((o) => {
          if (o.id !== overlayId) return o;
          if (edge === 'left') {
            const maxStart = initialStart + initialDuration - 0.2;
            const newStart = Math.max(0, Math.min(maxStart, initialStart + deltaSec));
            const newDuration = initialDuration - (newStart - initialStart);
            return { ...o, startTimelineTime: newStart, duration: Math.max(0.2, newDuration) };
          } else {
            const newDuration = Math.max(0.2, initialDuration + deltaSec);
            return { ...o, duration: newDuration };
          }
        })
      );
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  // SFX Trimming Logic (Start & End Handles)
  const handleSfxTrimStart = (
    e: React.PointerEvent,
    sfxId: string,
    edge: 'left' | 'right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (isSfxLocked) return;
    const sfx = sfxTracks.find((s) => s.id === sfxId);
    if (!sfx) return;

    const startX = e.clientX;
    const initialStart = sfx.startTimelineTime;
    const initialDuration = sfx.duration;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / pixelsPerSecond;
      setSfxTracks((prev) =>
        prev.map((s) => {
          if (s.id !== sfxId) return s;
          if (edge === 'left') {
            const maxStart = initialStart + initialDuration - 0.2;
            const newStart = Math.max(0, Math.min(maxStart, initialStart + deltaSec));
            const newDuration = initialDuration - (newStart - initialStart);
            return { ...s, startTimelineTime: newStart, duration: Math.max(0.2, newDuration) };
          } else {
            const newDuration = Math.max(0.2, initialDuration + deltaSec);
            return { ...s, duration: newDuration };
          }
        })
      );
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  // Caption Subtitle Trimming Logic (Start & End Handles)
  const handleCaptionTrimStart = (
    e: React.PointerEvent,
    captionId: string,
    edge: 'left' | 'right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (isCaptionLocked || !setCaptions) return;
    const targetCaption = (captions || []).find((c) => c.id === captionId);
    if (!targetCaption) return;

    const startX = e.clientX;
    const initialStart = targetCaption.startTime;
    const initialEnd = targetCaption.endTime;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / pixelsPerSecond;
      setCaptions((prev) =>
        prev.map((c) => {
          if (c.id !== captionId) return c;
          if (edge === 'left') {
            const maxStart = initialEnd - 0.2;
            const newStart = Math.max(0, Math.min(maxStart, initialStart + deltaSec));
            return recalculateChunkWordTimings(c, newStart, c.endTime);
          } else {
            const minEnd = initialStart + 0.2;
            const newEnd = Math.max(minEnd, initialEnd + deltaSec);
            return recalculateChunkWordTimings(c, c.startTime, newEnd);
          }
        })
      );
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (setWords && setCaptions) {
        setCaptions((curr) => {
          setWords(flattenCaptionsToWords(curr));
          return curr;
        });
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  // Quick Add Subtitle Chunk at Playhead
  const handleAddCaptionAtPlayhead = useCallback(() => {
    if (isCaptionLocked || !setCaptions) return;
    const newCap: CaptionTrackItem = {
      id: `caption-${Date.now()}`,
      text: 'New Subtitle',
      startTime: Number(currentTime.toFixed(2)),
      endTime: Number((currentTime + 1.8).toFixed(2)),
      words: [
        { word: 'New', start: currentTime, end: currentTime + 0.8, confidence: 0.98 },
        { word: 'Subtitle', start: currentTime + 0.8, end: currentTime + 1.8, confidence: 0.98 },
      ],
      detectedLanguage: detectedLanguage || 'en',
    };
    setCaptions((prev) => {
      const updated = [...prev, newCap].sort((a, b) => a.startTime - b.startTime);
      if (setWords) setWords(flattenCaptionsToWords(updated));
      return updated;
    });
    if (setSelectedCaptionId) setSelectedCaptionId(newCap.id);
  }, [isCaptionLocked, setCaptions, setWords, currentTime, detectedLanguage, setSelectedCaptionId]);

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
      } else if (e.key === 'd' || e.key === 'D') {
        if (onOpenDiagnostics) {
          e.preventDefault();
          onOpenDiagnostics();
        }
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
    onOpenDiagnostics,
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
        onOpenDiagnostics={onOpenDiagnostics}
        diagnosticSettings={diagnosticSettings}
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
        style={{ height: '375px' }}
      >
        <div style={{ width: `${timelineWidth}px` }} className="relative h-full flex flex-col">
          {/* Time Ruler */}
          <TimelineRuler
            totalDuration={totalDuration}
            projectEndSec={projectEndSec}
            pixelsPerSecond={pixelsPerSecond}
            currentTime={currentTime}
            onSeek={setCurrentTime}
            onScrubStart={() => {
              if (isPlaying && setIsPlaying) setIsPlaying(false);
            }}
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

          {/* Start Boundary Vertical Line across all tracks */}
          <div
            style={{ left: `${TRACK_HEADER_WIDTH}px` }}
            className="absolute top-7 bottom-0 w-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)] z-20 pointer-events-none"
          >
            <div className="absolute bottom-2 -translate-x-1/2 px-1.5 py-0.5 bg-emerald-500/90 text-slate-950 font-mono font-black text-[9px] rounded uppercase shadow whitespace-nowrap">
              Start
            </div>
          </div>

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

          {/* Inactive Hatched Zone Past End of Video (Trailing 5s Dead Space) */}
          {projectEndSec > 0 && (
            <div
              style={{
                left: `${TRACK_HEADER_WIDTH + projectEndSec * pixelsPerSecond}px`,
                width: `${Math.max(0, timelineWidth - (TRACK_HEADER_WIDTH + projectEndSec * pixelsPerSecond))}px`,
              }}
              className="absolute top-7 bottom-0 bg-[repeating-linear-gradient(45deg,rgba(15,23,42,0.6),rgba(15,23,42,0.6)_10px,rgba(30,41,59,0.3)_10px,rgba(30,41,59,0.3)_20px)] border-l border-amber-500/40 pointer-events-none z-10"
            />
          )}

          {/* Floating Time Badge while Dragging Elements */}
          {draggingItem && (
            <div
              style={{
                left: `${TRACK_HEADER_WIDTH + draggingItem.currentStartTime * pixelsPerSecond}px`,
                top:
                  draggingItem.type === 'caption'
                    ? '32px'
                    : draggingItem.type === 'overlay'
                    ? '88px'
                    : draggingItem.type === 'clip'
                    ? '144px'
                    : '290px',
              }}
              className="absolute z-50 pointer-events-none -translate-x-1/2 px-2.5 py-1 bg-indigo-600 text-white font-mono text-[11px] font-bold rounded-lg shadow-2xl border border-indigo-300/80 flex items-center gap-1.5 ring-2 ring-indigo-400/50"
            >
              <MoveHorizontal className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span>{draggingItem.currentStartTime.toFixed(2)}s</span>
              <span className="text-indigo-200 text-[9px]">
                ({draggingItem.currentStartTime - draggingItem.initialStartTime >= 0 ? '+' : ''}
                {(draggingItem.currentStartTime - draggingItem.initialStartTime).toFixed(2)}s)
              </span>
            </div>
          )}

          {/* ========================================================= */}
          {/* TRACK 0: C1 SUBTITLES & CAPTIONS TRACK (h-14)             */}
          {/* ========================================================= */}
          <div
            className={`relative h-14 border-b border-slate-800/80 flex items-center bg-slate-950/60 transition-opacity ${
              !isCaptionVisible ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <TimelineTrackHeader
              type="caption"
              trackId="c1"
              label="Subtitles"
              badge="C1"
              isLocked={isCaptionLocked}
              onToggleLock={() => setIsCaptionLocked((l) => !l)}
              isVisible={isCaptionVisible}
              onToggleVisibility={() => setIsCaptionVisible((v) => !v)}
              onQuickAdd={handleAddCaptionAtPlayhead}
              quickAddTitle="Add Subtitle chunk at current playhead"
              itemCount={(captions || []).length}
            />

            {/* Lane Items & Dedicated Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (dragOverTrack !== 'c1') setDragOverTrack('c1');
              }}
              onDragLeave={() => {
                setDragOverTrack((prev) => (prev === 'c1' ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTrack(null);
                if (isCaptionLocked || !setCaptions) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const dropSec = Math.max(0, dropX / pixelsPerSecond);

                const newCap: CaptionTrackItem = {
                  id: `caption-${Date.now()}`,
                  text: 'New Subtitle',
                  startTime: Number(dropSec.toFixed(2)),
                  endTime: Number((dropSec + 1.8).toFixed(2)),
                  words: [
                    { word: 'New', start: dropSec, end: dropSec + 0.8, confidence: 0.95 },
                    { word: 'Subtitle', start: dropSec + 0.8, end: dropSec + 1.8, confidence: 0.95 },
                  ],
                  detectedLanguage: detectedLanguage || 'en',
                };
                setCaptions((prev) => {
                  const updated = [...prev, newCap].sort((a, b) => a.startTime - b.startTime);
                  if (setWords) setWords(flattenCaptionsToWords(updated));
                  return updated;
                });
                if (setSelectedCaptionId) setSelectedCaptionId(newCap.id);
              }}
              className={`relative flex-1 h-full flex items-center transition-all ${
                dragOverTrack === 'c1'
                  ? 'bg-amber-950/40 ring-2 ring-amber-400/80 ring-inset'
                  : ''
              }`}
            >
              {(captions || []).map((cap) => {
                const isSelected = selectedCaptionId === cap.id;
                const leftPx = cap.startTime * pixelsPerSecond;
                const widthPx = Math.max(45, (cap.endTime - cap.startTime) * pixelsPerSecond);

                const isTriggeredNow =
                  currentTime >= cap.startTime && currentTime <= cap.endTime;

                return (
                  <div
                    key={cap.id}
                    data-no-scrub="true"
                    onPointerDown={(e) =>
                      handleItemDragStart(
                        e,
                        cap.id,
                        'caption',
                        cap.startTime,
                        cap.endTime - cap.startTime
                      )
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedRef.current) return;
                      setCurrentTime(cap.startTime);
                      if (toolMode === 'select' && !isCaptionLocked && setSelectedCaptionId) {
                        setSelectedCaptionId(cap.id);
                        setSelectedClipId(null);
                        setSelectedOverlayId(null);
                        if (setSelectedSfxId) setSelectedSfxId(null);
                      }
                    }}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    className={`absolute h-10 rounded-lg flex items-center px-2 border-2 transition-all shadow-md select-none group ${
                      toolMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                      isTriggeredNow
                        ? 'bg-amber-900/90 border-amber-300 ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)] scale-[1.02] z-20'
                        : isSelected
                        ? 'bg-amber-950 border-amber-400 ring-2 ring-amber-400/50 shadow-amber-950/80 z-20'
                        : 'bg-amber-950/70 border-amber-700/60 hover:border-amber-500 z-10'
                    }`}
                  >
                    {/* Left Trim Handle */}
                    {!isCaptionLocked && (
                      <div
                        data-trim-handle="true"
                        onPointerDown={(e) => handleCaptionTrimStart(e, cap.id, 'left')}
                        title="Trim subtitle start"
                        className="absolute left-0 top-0 bottom-0 w-2.5 bg-amber-500/30 hover:bg-amber-400 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-amber-500/60"
                      >
                        <div className="w-0.5 h-3 bg-white/80 rounded" />
                      </div>
                    )}

                    <Subtitles className="w-3.5 h-3.5 text-amber-400 mr-1.5 shrink-0" />
                    <span className="text-xs font-semibold text-amber-100 truncate">
                      {cap.text}
                    </span>
                    <span className="ml-auto text-[9px] font-mono text-amber-300/70 shrink-0 pl-1.5">
                      {(cap.endTime - cap.startTime).toFixed(1)}s
                    </span>

                    {/* Right Trim Handle */}
                    {!isCaptionLocked && (
                      <div
                        data-trim-handle="true"
                        onPointerDown={(e) => handleCaptionTrimStart(e, cap.id, 'right')}
                        title="Trim subtitle end"
                        className="absolute right-0 top-0 bottom-0 w-2.5 bg-amber-500/30 hover:bg-amber-400 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-amber-500/60"
                      >
                        <div className="w-0.5 h-3 bg-white/80 rounded" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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

            {/* Lane Items & Dedicated Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (dragOverTrack !== 'v2') setDragOverTrack('v2');
              }}
              onDragLeave={() => {
                setDragOverTrack((prev) => (prev === 'v2' ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTrack(null);
                if (isOverlayLocked) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const dropSec = Math.max(0, dropX / pixelsPerSecond);

                try {
                  const rawData = e.dataTransfer.getData('application/json');
                  if (rawData) {
                    const parsed = JSON.parse(rawData);
                    if (parsed.type === 'sticker' && parsed.item) {
                      const item = parsed.item;
                      const newOverlay: StickerOverlay = {
                        id: `overlay-${Date.now()}`,
                        emoji: item.emoji || '✨',
                        label: item.label || 'Sticker',
                        assetUrl: item.assetUrl || undefined,
                        assetType: item.format || undefined,
                        category: item.category || undefined,
                        startTimelineTime: dropSec,
                        duration: 2.0,
                        x: 50,
                        y: 40,
                        scale: 1,
                        rotation: 0,
                        animation: (item.defaultAnimation || item.animation as any) || 'bounce',
                        pairedSfx: item.sfx || null,
                      };
                      setOverlays((prev) => [...prev, newOverlay]);
                      setSelectedOverlayId(newOverlay.id);

                      // If sticker has sound effect, auto-pair SFX item
                      if (item.sfx && !isSfxLocked) {
                        const newSfx: SfxTrackItem = {
                          id: `sfx-${Date.now()}`,
                          name: item.sfxLabel || `${item.label} Sound`,
                          preset: item.sfx,
                          startTimelineTime: dropSec,
                          duration: 0.8,
                          volume: 1.0,
                          isMuted: false,
                        };
                        setSfxTracks((prev) => [...prev, newSfx]);
                      }
                    }
                  }
                } catch (err) {
                  console.error('Failed to parse dropped overlay:', err);
                }
              }}
              className={`relative flex-1 h-full flex items-center transition-all ${
                dragOverTrack === 'v2'
                  ? 'bg-purple-950/40 ring-2 ring-purple-400/80 ring-inset'
                  : ''
              }`}
            >
              {overlays.map((ov) => {
                const isSelected = selectedOverlayId === ov.id;
                const leftPx = ov.startTimelineTime * pixelsPerSecond;
                const widthPx = Math.max(30, ov.duration * pixelsPerSecond);

                return (
                  <div
                    key={ov.id}
                    data-no-scrub="true"
                    onPointerDown={(e) =>
                      handleItemDragStart(e, ov.id, 'overlay', ov.startTimelineTime, ov.duration)
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedRef.current) return;
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
                    className={`absolute h-10 rounded-lg flex items-center px-2 border-2 transition-all shadow-md select-none group ${
                      toolMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                      ov.isDisabled
                        ? 'bg-purple-950/40 border-dashed border-amber-600/50 opacity-60'
                        : isSelected
                        ? 'bg-purple-900/90 border-purple-400 ring-2 ring-purple-400/50 shadow-purple-950/80 z-20'
                        : 'bg-purple-950/70 border-purple-700/60 hover:border-purple-500 z-10'
                    }`}
                  >
                    {/* Left Trim Handle */}
                    {!isOverlayLocked && (
                      <div
                        data-trim-handle="true"
                        onPointerDown={(e) => handleOverlayTrimStart(e, ov.id, 'left')}
                        title="Trim overlay start"
                        className="absolute left-0 top-0 bottom-0 w-2.5 bg-purple-500/30 hover:bg-purple-400 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-purple-500/60"
                      >
                        <div className="w-0.5 h-3 bg-white/80 rounded" />
                      </div>
                    )}

                    {ov.assetUrl ? (
                      <img
                        src={ov.assetUrl}
                        alt={ov.label}
                        className="w-5 h-5 object-contain mr-1.5 shrink-0 select-none pl-1"
                      />
                    ) : (
                      <span className="text-base mr-1.5 shrink-0 select-none pl-1">{ov.emoji}</span>
                    )}
                    <span
                      className={`text-xs font-semibold truncate ${
                        ov.isDisabled ? 'line-through text-slate-400' : 'text-purple-200'
                      }`}
                    >
                      {ov.label}
                    </span>

                    <div className="ml-auto flex items-center gap-1 shrink-0 pr-1">
                      {/* Individual Overlay Visibility Bypass Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverlays((prev) =>
                            prev.map((o) => (o.id === ov.id ? { ...o, isDisabled: !o.isDisabled } : o))
                          );
                        }}
                        title={ov.isDisabled ? 'Enable overlay (currently bypassed)' : 'Bypass / hide overlay on canvas'}
                        className={`p-0.5 rounded transition-colors ${
                          ov.isDisabled
                            ? 'text-amber-400 bg-amber-950/60 hover:bg-amber-900/80'
                            : 'text-purple-300/70 hover:text-white hover:bg-purple-800/60'
                        }`}
                      >
                        {ov.isDisabled ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                      </button>

                      <span className="text-[9px] font-mono text-purple-300/70">
                        {ov.duration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Right Trim Handle */}
                    {!isOverlayLocked && (
                      <div
                        data-trim-handle="true"
                        onPointerDown={(e) => handleOverlayTrimStart(e, ov.id, 'right')}
                        title="Trim overlay duration (end)"
                        className="absolute right-0 top-0 bottom-0 w-2.5 bg-purple-500/30 hover:bg-purple-400 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-purple-500/60"
                      >
                        <div className="w-0.5 h-3 bg-white/80 rounded" />
                      </div>
                    )}
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

            {/* Lane Items & Dedicated Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (dragOverTrack !== 'v1') setDragOverTrack('v1');
              }}
              onDragLeave={() => {
                setDragOverTrack((prev) => (prev === 'v1' ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTrack(null);
              }}
              className={`relative flex-1 h-full flex items-center transition-all ${
                dragOverTrack === 'v1'
                  ? 'bg-indigo-950/40 ring-2 ring-indigo-400/80 ring-inset'
                  : ''
              }`}
            >
              {clips.map((clip, idx) => {
                const isSelected = selectedClipId === clip.id;
                const isTrimming = trimmingClipId === clip.id;
                const leftPx = clip.startTimelineTime * pixelsPerSecond;
                const widthPx = clip.duration * pixelsPerSecond;

                return (
                  <div
                    key={clip.id}
                    data-no-scrub="true"
                    onPointerDown={(e) => {
                      if (toolMode === 'select') {
                        handleItemDragStart(e, clip.id, 'clip', clip.startTimelineTime, clip.duration);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedRef.current) return;
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
                      toolMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-400 ring-2 ring-indigo-400/60 shadow-indigo-950/80 z-20'
                        : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 z-10'
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
                        data-trim-handle="true"
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
                        data-trim-handle="true"
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

            {/* Lane Items & Dedicated Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                if (dragOverTrack !== 'a2') setDragOverTrack('a2');
              }}
              onDragLeave={() => {
                setDragOverTrack((prev) => (prev === 'a2' ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTrack(null);
                if (isSfxLocked) return;

                const rect = e.currentTarget.getBoundingClientRect();
                const dropX = e.clientX - rect.left;
                const dropSec = Math.max(0, dropX / pixelsPerSecond);

                try {
                  const rawData = e.dataTransfer.getData('application/json');
                  if (rawData) {
                    const parsed = JSON.parse(rawData);
                    if (parsed.type === 'sticker' && parsed.item) {
                      const item = parsed.item;
                      const newSfx: SfxTrackItem = {
                        id: `sfx-${Date.now()}`,
                        name: item.sfxLabel || `${item.label} Sound`,
                        preset: item.sfx || 'pop',
                        startTimelineTime: dropSec,
                        duration: 0.8,
                        volume: 1.0,
                        isMuted: false,
                      };
                      setSfxTracks((prev) => [...prev, newSfx]);
                      if (setSelectedSfxId) setSelectedSfxId(newSfx.id);
                    }
                  }
                } catch (err) {
                  console.error('Failed to parse dropped SFX:', err);
                }
              }}
              className={`relative flex-1 h-full flex items-center transition-all ${
                dragOverTrack === 'a2'
                  ? 'bg-emerald-950/40 ring-2 ring-emerald-400/80 ring-inset'
                  : ''
              }`}
            >
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
                    onPointerDown={(e) =>
                      handleItemDragStart(e, sfx.id, 'sfx', sfx.startTimelineTime, sfx.duration)
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedRef.current) return;
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
                    className={`absolute h-11 rounded-lg px-2 flex items-center justify-between border-2 transition-all shadow-md select-none group ${
                      toolMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${
                      sfx.isMuted
                        ? 'bg-emerald-950/40 border-dashed border-rose-600/50 opacity-60'
                        : isTriggeredNow
                        ? 'bg-emerald-900/90 border-emerald-300 ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] scale-[1.02] z-20'
                        : isSelected
                        ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-400/50 z-20'
                        : 'bg-emerald-950/70 border-emerald-700/60 hover:border-emerald-500 z-10'
                    }`}
                  >
                    {/* Left Trim Handle */}
                    {!isSfxLocked && (
                      <div
                        data-trim-handle="true"
                        onPointerDown={(e) => handleSfxTrimStart(e, sfx.id, 'left')}
                        title="Trim SFX start"
                        className="absolute left-0 top-0 bottom-0 w-2.5 bg-emerald-500/30 hover:bg-emerald-400 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-emerald-500/60"
                      >
                        <div className="w-0.5 h-3 bg-white/80 rounded" />
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 overflow-hidden pl-1">
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span
                        className={`text-xs font-semibold truncate ${
                          sfx.isMuted ? 'line-through text-slate-400' : 'text-emerald-200'
                        }`}
                      >
                        {sfx.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pr-1">
                      {/* Individual SFX Mute/Unmute Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSfxTracks((prev) =>
                            prev.map((s) => (s.id === sfx.id ? { ...s, isMuted: !s.isMuted } : s))
                          );
                        }}
                        title={sfx.isMuted ? 'Unmute this sound effect' : 'Mute this sound effect'}
                        className={`p-0.5 rounded transition-colors ${
                          sfx.isMuted
                            ? 'text-rose-400 bg-rose-950/60 hover:bg-rose-900/80'
                            : 'text-emerald-300/70 hover:text-white hover:bg-emerald-800/60'
                        }`}
                      >
                        {sfx.isMuted ? <VolumeX className="w-2.5 h-2.5 text-rose-400" /> : <Volume2 className="w-2.5 h-2.5" />}
                      </button>

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

                    {/* Right Trim Handle */}
                    {!isSfxLocked && (
                      <div
                        data-trim-handle="true"
                        onPointerDown={(e) => handleSfxTrimStart(e, sfx.id, 'right')}
                        title="Trim SFX duration (end)"
                        className="absolute right-0 top-0 bottom-0 w-2.5 bg-emerald-500/30 hover:bg-emerald-400 cursor-col-resize flex items-center justify-center z-30 transition-colors group-hover:bg-emerald-500/60"
                      >
                        <div className="w-0.5 h-3 bg-white/80 rounded" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* PLAYHEAD NEEDLE & INTERACTIVE SCRUBBER HANDLE             */}
          {/* ========================================================= */}
          <div
            style={{
              transform: `translate3d(${TRACK_HEADER_WIDTH + currentTime * pixelsPerSecond}px, 0, 0)`,
              willChange: 'transform',
            }}
            className="absolute top-0 bottom-0 left-0 z-50 pointer-events-none"
          >
            {/* Extended Vertical Needle Hit Zone (Full Timeline Height) */}
            <div
              onPointerDown={handlePlayheadPointerDown}
              className="absolute top-0 bottom-0 -left-2.5 w-5 cursor-ew-resize pointer-events-auto group/needle flex justify-center"
              title="Drag playhead line"
            >
              {/* Vertical Red Needle Line with Halo */}
              <div
                className={`w-0.5 h-full transition-all ${
                  isScrubbingPlayhead
                    ? 'bg-red-400 shadow-[0_0_12px_rgba(239,68,68,1)]'
                    : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)] group-hover/needle:bg-red-400 group-hover/needle:shadow-[0_0_12px_rgba(239,68,68,1)]'
                }`}
              />
            </div>

            {/* Top Interactive Playhead Header Handle (Ruler Level) */}
            <div
              onPointerDown={handlePlayheadPointerDown}
              className="absolute -top-0.5 -translate-x-1/2 cursor-ew-resize pointer-events-auto group/head z-50 flex flex-col items-center select-none"
              title="Drag playhead scrubber"
            >
              {/* Triangular Downward Handle Icon */}
              <div
                className={`w-4 h-5 flex items-center justify-center transition-all ${
                  isScrubbingPlayhead ? 'scale-110 shadow-lg shadow-red-500/50' : 'group-hover/head:scale-105'
                }`}
              >
                <div
                  className={`w-full h-full bg-gradient-to-b from-red-500 to-rose-600 shadow-md flex items-center justify-center [clip-path:polygon(0%_0%,100%_0%,100%_60%,50%_100%,0%_60%)] ${
                    isScrubbingPlayhead ? 'from-red-400 to-rose-500 ring-1 ring-white/60' : ''
                  }`}
                >
                  <div className="w-1 h-1 bg-white/90 rounded-full -translate-y-0.5" />
                </div>
              </div>

              {/* Real-time floating HUD Tooltip while dragging */}
              {isScrubbingPlayhead && (
                <div className="absolute -top-6 px-1.5 py-0.5 bg-red-600 text-white font-mono font-bold text-[9px] rounded shadow-xl whitespace-nowrap pointer-events-none border border-red-400">
                  {formatPlayheadTime(currentTime)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
