import React, { useState } from 'react';
import {
  MousePointer2,
  Scissors,
  Hand,
  Trash2,
  FoldHorizontal,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HelpCircle,
  Clock,
  Layers,
  Sparkles,
  Map,
  X,
} from 'lucide-react';

export type TimelineToolMode = 'select' | 'razor' | 'hand';

interface TimelineToolbarProps {
  toolMode: TimelineToolMode;
  setToolMode: (mode: TimelineToolMode) => void;
  isSnappingEnabled: boolean;
  setIsSnappingEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  pixelsPerSecond: number;
  setPixelsPerSecond: (pps: number | ((prev: number) => number)) => void;
  currentTime: number;
  totalDuration: number;
  projectEndSec: number;
  hasSelection: boolean;
  onSplitAtPlayhead: () => void;
  onDeleteSelected: () => void;
  onRippleDeleteSelected: () => void;
  onCloseGaps: () => void;
  onNudgeFrame: (frames: number) => void;
  onJumpToCut: (direction: 'prev' | 'next') => void;
  onZoomToFit: () => void;
  isAutoFit?: boolean;
  onToggleAutoFit?: () => void;
  showMinimap: boolean;
  setShowMinimap: (show: boolean | ((prev: boolean) => boolean)) => void;
  timecodeMode: 'standard' | 'smpte';
  setTimecodeMode: (mode: 'standard' | 'smpte') => void;
  onAddPunchZoom: () => void;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
  toolMode,
  setToolMode,
  isSnappingEnabled,
  setIsSnappingEnabled,
  pixelsPerSecond,
  setPixelsPerSecond,
  currentTime,
  totalDuration,
  projectEndSec,
  hasSelection,
  onSplitAtPlayhead,
  onDeleteSelected,
  onRippleDeleteSelected,
  onCloseGaps,
  onNudgeFrame,
  onJumpToCut,
  onZoomToFit,
  isAutoFit = true,
  onToggleAutoFit,
  showMinimap,
  setShowMinimap,
  timecodeMode,
  setTimecodeMode,
  onAddPunchZoom,
}) => {
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Format time (Standard ms vs SMPTE 30fps)
  const formatTime = (seconds: number) => {
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

  const currentFrame = Math.floor(currentTime * 30);
  const totalFrames = Math.floor(projectEndSec * 30);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-slate-800 text-xs text-slate-300 select-none">
      {/* LEFT: Tool Modes & Core Edit Operations */}
      <div className="flex items-center space-x-1 sm:space-x-1.5">
        {/* Tool Mode Segmented Control */}
        <div className="flex items-center bg-slate-950/80 rounded-lg p-0.5 border border-slate-800 shadow-inner">
          <button
            onClick={() => setToolMode('select')}
            title="Selection Tool (V) - Select, move, and trim clips"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              toolMode === 'select'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Select</span>
            <span className="text-[10px] opacity-70 font-mono">V</span>
          </button>

          <button
            onClick={() => setToolMode('razor')}
            title="Razor Blade Tool (C) - Click on any clip to cut at mouse position"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              toolMode === 'razor'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/50 animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Razor</span>
            <span className="text-[10px] opacity-70 font-mono">C</span>
          </button>

          <button
            onClick={() => setToolMode('hand')}
            title="Hand / Pan Tool (H) - Drag to scroll horizontally"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              toolMode === 'hand'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Hand</span>
            <span className="text-[10px] opacity-70 font-mono">H</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Edit Operations */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onSplitAtPlayhead}
            title="Split Clip at Playhead (S or Ctrl+K)"
            className="flex items-center gap-1 px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700/60 transition-colors shadow-sm"
          >
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden lg:inline">Split</span>
            <span className="text-[10px] text-slate-400 font-mono">S</span>
          </button>

          <button
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            title="Delete Selected Clip / SFX / Overlay (Del or Backspace)"
            className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-colors shadow-sm ${
              hasSelection
                ? 'bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 text-slate-200 border-slate-700/60'
                : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden lg:inline">Delete</span>
          </button>

          <button
            onClick={onRippleDeleteSelected}
            disabled={!hasSelection}
            title="Ripple Delete (Shift+Del) - Delete and pull subsequent clips left"
            className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-colors shadow-sm ${
              hasSelection
                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed'
            }`}
          >
            <FoldHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Ripple Del</span>
            <span className="text-[10px] opacity-70 font-mono hidden xl:inline">⇧Del</span>
          </button>

          <button
            onClick={onCloseGaps}
            title="Close All Gaps - Pulls all clips together with zero empty space"
            className="flex items-center gap-1 px-2 py-1 bg-slate-800/60 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700/50 transition-colors shadow-sm hidden sm:flex"
          >
            <FoldHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden xl:inline">Close Gaps</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Frame & Cut Navigation */}
        <div className="flex items-center space-x-0.5 bg-slate-950/60 rounded-md p-0.5 border border-slate-800/80">
          <button
            onClick={() => onJumpToCut('prev')}
            title="Jump to Previous Cut (Up Arrow or [)"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          >
            <SkipBack className="w-3 h-3" />
          </button>
          <button
            onClick={() => onNudgeFrame(-1)}
            title="Nudge 1 Frame Backward (Left Arrow or <)"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => onNudgeFrame(1)}
            title="Nudge 1 Frame Forward (Right Arrow or >)"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => onJumpToCut('next')}
            title="Jump to Next Cut (Down Arrow or ])"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
          >
            <SkipForward className="w-3 h-3" />
          </button>
        </div>

        {/* Snapping */}
        <button
          onClick={() => setIsSnappingEnabled((prev) => !prev)}
          title={`Magnetic Snapping (M): ${isSnappingEnabled ? 'Enabled' : 'Disabled'}`}
          className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${
            isSnappingEnabled
              ? 'bg-cyan-950/40 text-cyan-300 border-cyan-700/50 shadow-sm shadow-cyan-950/50'
              : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Snap</span>
        </button>

        {/* Punch Zoom Shortcut */}
        <button
          onClick={onAddPunchZoom}
          title="Add Dynamic Punch Zoom (Z)"
          className="flex items-center gap-1 px-2 py-1 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 rounded-md border border-amber-700/40 transition-colors shadow-sm hidden md:flex"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">+ Zoom</span>
        </button>
      </div>

      {/* CENTER: Dual Timecode & Frame Readout */}
      <div className="flex items-center space-x-2 bg-slate-950/90 px-3 py-1 rounded-lg border border-slate-800 shadow-inner">
        <Clock className="w-3.5 h-3.5 text-indigo-400" />
        <button
          onClick={() => setTimecodeMode(timecodeMode === 'standard' ? 'smpte' : 'standard')}
          title="Click to toggle between SMPTE (frames) and Standard (ms)"
          className="font-mono text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
        >
          {formatTime(currentTime)}
        </button>
        <span className="text-slate-600 font-mono">/</span>
        <span className="font-mono text-xs text-slate-400">
          {formatTime(projectEndSec)}
        </span>
        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800 text-[10px] text-slate-400 font-mono">
          <span className="text-cyan-400 font-bold">F{currentFrame}</span>
          <span className="text-slate-600">/</span>
          <span>{totalFrames}</span>
          <span className="px-1 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px]">30fps</span>
        </div>
      </div>

      {/* RIGHT: Minimap, Zoom Slider & Shortcuts Help */}
      <div className="flex items-center space-x-2">
        {/* Minimap Navigator Toggle */}
        <button
          onClick={() => setShowMinimap((prev) => !prev)}
          title={`Minimap Navigator (${showMinimap ? 'Hide' : 'Show'})`}
          className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-all ${
            showMinimap
              ? 'bg-indigo-950/50 text-indigo-300 border-indigo-700/50'
              : 'bg-slate-800/40 text-slate-400 hover:text-white border-slate-700/40'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Minimap</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1.5 bg-slate-950/70 px-2 py-1 rounded-lg border border-slate-800">
          <button
            onClick={() => {
              if (onToggleAutoFit) onToggleAutoFit();
              else onZoomToFit();
            }}
            title="Fit Entire Video in One Screen Visual (F)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all border ${
              isAutoFit
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-xs'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700/80'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span>1-Screen</span>
          </button>

          <button
            onClick={() => setPixelsPerSecond((p) => Math.max(15, p - 15))}
            title="Zoom Out (-)"
            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min={15}
            max={350}
            step={5}
            value={pixelsPerSecond}
            onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
            title={`Timeline Zoom: ${pixelsPerSecond}px/sec (Ctrl+Wheel to zoom)`}
            className="w-16 sm:w-20 md:w-24 h-1 accent-indigo-500 bg-slate-800 rounded appearance-none cursor-pointer"
          />

          <button
            onClick={() => setPixelsPerSecond((p) => Math.min(350, p + 15))}
            title="Zoom In for Minor Detail (+)"
            className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Keyboard Shortcuts Help */}
        <button
          onClick={() => setShowShortcutsModal(true)}
          title="Keyboard Shortcuts Cheatsheet (?)"
          className="p-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md border border-slate-700/40 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-slate-100 text-sm">Timeline Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Play / Pause</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">Space</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Select Tool</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">V</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Razor / Blade Tool</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">C</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Hand / Pan Tool</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">H</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Split at Playhead</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">S</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Delete Clip</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">Del</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Ripple Delete</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">⇧ + Del</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Toggle Snapping</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">M</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Zoom to Fit</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">F</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Zoom In / Out</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">+ / -</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Nudge Frame</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">← / →</kbd>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Jump to Cut</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-950 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">↑ / ↓</kbd>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs shadow-md transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
