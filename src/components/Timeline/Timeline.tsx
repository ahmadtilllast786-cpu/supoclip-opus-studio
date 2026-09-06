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

  // Total duration of project
  const totalDuration = Math.max(
    10,
    clips.reduce((acc, c) => Math.max(acc, c.startTimelineTime + c.duration), 0)
  );

  const timelineWidth = Math.max(1200, totalDuration * pixelsPerSecond + 200);

  // Split Clip at current playhead
  const handleSplitClip = useCallback(() => {
    // Find clip at current playhead
    const targetClipIndex = clips.findIndex(
      (c) => currentTime > c.startTimelineTime + 0.1 && currentTime < c.startTimelineTime + c.duration - 0.1
    );

    if (targetClipIndex === -1) return;

    const clip = clips[targetClipIndex];
    const splitOffset = currentTime - clip.startTimelineTime;
    const splitInSource = clip.inPoint + splitOffset * clip.speed;

    const firstHalf: VideoClip = {
      ...clip,
      id: `${clip.id}-split1-${Date.now()}`,
      outPoint: splitInSource,
      duration: splitOffset,
    };

    const secondHalf: VideoClip = {
      ...clip,
      id: `${clip.id}-split2-${Date.now()}`,
      inPoint: splitInSource,
      duration: clip.duration - splitOffset,
      startTimelineTime: currentTime,
      transitionIn: 'whip-pan',
      transitionDuration: 0.25,
    };

    const updatedClips = [...clips];
    updatedClips.splice(targetClipIndex, 1, firstHalf, secondHalf);

    // Recompute sequential startTimelineTimes
    let curTime = 0;
    const resequenced = updatedClips.map((c) => {
      const item = { ...c, startTimelineTime: curTime };
      curTime += c.duration;
      return item;
    });

    setClips(resequenced);
    setSelectedClipId(secondHalf.id);
  }, [clips, currentTime, setClips, setSelectedClipId]);

  // Delete Selected Clip or Overlay
  const handleDeleteSelected = useCallback(() => {
    if (selectedClipId) {
      const updated = clips.filter((c) => c.id !== selectedClipId);
      // Recompute sequential start times
      let curTime = 0;
      const resequenced = updated.map((c) => {
        const item = { ...c, startTimelineTime: curTime };
        curTime += c.duration;
        return item;
      });
      setClips(resequenced);
      setSelectedClipId(null);
    } else if (selectedOverlayId) {
      setOverlays((ovs) => ovs.filter((o) => o.id !== selectedOverlayId));
      setSfxTracks((sfxs) => sfxs.filter((s) => s.linkedOverlayId !== selectedOverlayId));
      setSelectedOverlayId(null);
    }
  }, [selectedClipId, selectedOverlayId, clips, setClips, setOverlays, setSfxTracks, setSelectedClipId, setSelectedOverlayId]);

  // Keyboard shortcut for split (Ctrl+B or S) and delete (Del/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 's' || e.key === 'S' || ((e.ctrlKey || e.metaKey) && e.key === 'b')) {
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

  // Scrubber mouse drag
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    updateTimeFromMouse(e);
  };

  const updateTimeFromMouse = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(totalDuration, clickX / pixelsPerSecond));
    setCurrentTime(newTime);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) updateTimeFromMouse(e);
    };
    const handleMouseUp = () => {
      setIsScrubbing(false);
    };
    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, pixelsPerSecond, totalDuration]);

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
    <div className="h-64 bg-[#0d111a] border-t border-slate-800 flex flex-col shrink-0 select-none overflow-hidden">
      {/* Timeline Controls Toolbar */}
      <div className="h-10 bg-[#121722] border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          {/* Split Blade */}
          <button
            onClick={handleSplitClip}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-indigo-600/80 hover:text-white text-slate-300 text-xs px-2.5 py-1 rounded transition"
            title="Split Clip at Playhead (S or Ctrl+B)"
          >
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split Clip</span>
          </button>

          {/* Delete Selection */}
          <button
            onClick={handleDeleteSelected}
            disabled={!selectedClipId && !selectedOverlayId}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-rose-600/80 hover:text-white disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded transition"
            title="Delete Selected (Delete or Backspace)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>

          {/* Add Punch Zoom Keyframe */}
          <button
            onClick={onAddPunchZoom}
            className="flex items-center space-x-1.5 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 text-xs px-2.5 py-1 rounded transition"
            title="Add dynamic 1.25x punch zoom at playhead"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Punch Zoom (1.25x)</span>
          </button>
        </div>

        {/* Timeline Zoom Slider */}
        <div className="flex items-center space-x-2 text-slate-400 text-xs">
          <button
            onClick={() => setPixelsPerSecond((p) => Math.max(30, p - 20))}
            className="hover:text-white p-1"
            title="Zoom Out Timeline"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] w-12 text-center text-slate-300">
            {Math.round((pixelsPerSecond / 80) * 100)}%
          </span>
          <button
            onClick={() => setPixelsPerSecond((p) => Math.min(200, p + 20))}
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
          ref={rulerRef}
          onMouseDown={handleRulerMouseDown}
          style={{ width: `${timelineWidth}px` }}
          className="relative min-h-full cursor-pointer pb-4"
        >
          {/* Time Ruler */}
          <div className="h-6 bg-[#0f141f] border-b border-slate-800/80 sticky top-0 z-20 flex items-center">
            {Array.from({ length: Math.ceil(totalDuration) + 2 }).map((_, sec) => (
              <div
                key={sec}
                style={{ left: `${sec * pixelsPerSecond}px` }}
                className="absolute top-0 bottom-0 border-l border-slate-700/60 pl-1 text-[10px] font-mono text-slate-400 pointer-events-none"
              >
                {sec}s
              </div>
            ))}
          </div>

          {/* Red Playhead & Scrubber Line */}
          <div
            style={{ left: `${currentTime * pixelsPerSecond}px` }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.8)]"
          >
            <div className="w-3.5 h-3.5 -ml-[6px] -mt-1 bg-rose-500 rounded-sm transform rotate-45 shadow-md flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>

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
          <div className="h-20 border-b border-slate-800/60 relative flex items-center bg-[#090e18]/80">
            <div className="sticky left-0 w-24 z-10 bg-[#131926]/90 border-r border-slate-800 px-2 py-1 flex items-center space-x-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
              <Video className="w-3 h-3" />
              <span>Video</span>
            </div>

            {clips.map((clip, idx) => {
              const left = clip.startTimelineTime * pixelsPerSecond;
              const width = Math.max(50, clip.duration * pixelsPerSecond);
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
                      setSelectedClipId(clip.id);
                      setSelectedOverlayId(null);
                    }}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    className={`absolute h-16 rounded-lg border flex flex-col justify-between p-1.5 cursor-pointer overflow-hidden transition ${
                      isSelected
                        ? 'bg-indigo-600/90 border-white text-white shadow-xl shadow-indigo-600/30'
                        : 'bg-indigo-950/70 border-indigo-700/60 hover:bg-indigo-900/80 text-indigo-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold truncate">
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[10px] font-mono opacity-80">{clip.duration.toFixed(1)}s</span>
                    </div>

                    {/* Waveform graphic visualization */}
                    <div className="h-5 flex items-end space-x-0.5 opacity-60">
                      {clip.waveform &&
                        clip.waveform.slice(0, Math.floor(width / 4)).map((peak, pIdx) => (
                          <div
                            key={pIdx}
                            style={{ height: `${Math.max(15, peak * 100)}%` }}
                            className="w-1 bg-indigo-300/80 rounded-t-sm"
                          />
                        ))}
                    </div>

                    {/* Zoom badge if punch zoom is on clip */}
                    {clip.zoomScale > 1.0 && (
                      <div className="text-[9px] bg-amber-500/30 text-amber-300 font-mono px-1 rounded self-start">
                        {clip.zoomScale.toFixed(2)}x Zoom
                      </div>
                    )}
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
