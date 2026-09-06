import React, { useState } from 'react';
import { Crosshair, Sparkles, ZoomIn, Sliders, Check } from 'lucide-react';
import { DynamicZoomKeyframe } from '../../types/timeline';
import { generateAutoPunchZooms } from '../../core/video/punchZoomEngine';

interface DynamicZoomPanelProps {
  currentTime: number;
  totalDuration: number;
  zoomKeyframes: DynamicZoomKeyframe[];
  setZoomKeyframes: React.Dispatch<React.SetStateAction<DynamicZoomKeyframe[]>>;
}

export const DynamicZoomPanel: React.FC<DynamicZoomPanelProps> = ({
  currentTime,
  totalDuration,
  zoomKeyframes,
  setZoomKeyframes,
}) => {
  const [scale, setScale] = useState(1.25);
  const [duration, setDuration] = useState(2.0);
  const [focalPreset, setFocalPreset] = useState<'speaker' | 'center' | 'top'>('speaker');
  const [style, setStyle] = useState<'snappy' | 'smooth' | 'step'>('snappy');

  const getFocalCoords = () => {
    switch (focalPreset) {
      case 'speaker':
        return { x: 0.5, y: 0.45 };
      case 'top':
        return { x: 0.5, y: 0.28 };
      case 'center':
      default:
        return { x: 0.5, y: 0.5 };
    }
  };

  const handleAddPunchZoomAtPlayhead = () => {
    const coords = getFocalCoords();
    const newKf: DynamicZoomKeyframe = {
      id: `kf-${Date.now()}`,
      startTimelineTime: currentTime,
      duration,
      scale,
      centerX: coords.x,
      centerY: coords.y,
      style,
    };

    setZoomKeyframes((prev) => [...prev, newKf]);
  };

  const handleAutoGenerateRhythm = () => {
    const coords = getFocalCoords();
    const generated = generateAutoPunchZooms(totalDuration, [], scale, coords.x, coords.y);
    setZoomKeyframes(generated);
  };

  const handleClearZooms = () => {
    setZoomKeyframes([]);
  };

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center">
          <Crosshair className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
          Dynamic Punch Zooms
        </span>
        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800">
          {zoomKeyframes.length} Active
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        Punch zooms create visual pattern interrupts that prevent viewers from swiping away on short-form feeds.
      </p>

      {/* Sliders & Controls */}
      <div className="space-y-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        {/* Scale Slider */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-300 mb-1">
            <span>Punch Zoom Scale</span>
            <span className="font-mono text-amber-400 font-bold">{scale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="1.1"
            max="1.5"
            step="0.05"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
            <span>1.10x (Subtle)</span>
            <span>1.30x (Standard)</span>
            <span>1.50x (Dramatic)</span>
          </div>
        </div>

        {/* Focal Point Preset */}
        <div>
          <div className="text-[11px] text-slate-300 mb-1.5">Focal Center Preset</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              onClick={() => setFocalPreset('speaker')}
              className={`py-1.5 px-2 rounded-lg border text-center transition ${
                focalPreset === 'speaker'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Speaker Face
            </button>
            <button
              onClick={() => setFocalPreset('center')}
              className={`py-1.5 px-2 rounded-lg border text-center transition ${
                focalPreset === 'center'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Center
            </button>
            <button
              onClick={() => setFocalPreset('top')}
              className={`py-1.5 px-2 rounded-lg border text-center transition ${
                focalPreset === 'top'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Upper Third
            </button>
          </div>
        </div>

        {/* Curve Style */}
        <div>
          <div className="text-[11px] text-slate-300 mb-1.5">Animation Curve</div>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {(['snappy', 'smooth', 'step'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`py-1 px-1.5 rounded-lg border text-center capitalize transition ${
                  style === s
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-2">
        <button
          onClick={handleAddPunchZoomAtPlayhead}
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Add Punch Zoom at {currentTime.toFixed(2)}s</span>
        </button>

        <button
          onClick={handleAutoGenerateRhythm}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 transition"
        >
          <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
          <span>Auto-Rhythm Punch Zooms (Entire Video)</span>
        </button>

        {zoomKeyframes.length > 0 && (
          <button
            onClick={handleClearZooms}
            className="w-full text-slate-500 hover:text-rose-400 text-[11px] py-1 transition text-center"
          >
            Clear All Punch Zooms
          </button>
        )}
      </div>
    </div>
  );
};
