import React from 'react';
import {
  Sliders,
  Volume2,
  VolumeX,
  Music,
  Video,
  Smile,
  Sparkles,
  Layers,
  RotateCw,
  Move,
  Maximize,
  Clock,
  Trash2,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  SfxTrackItem,
  TransitionType,
  SfxPreset,
  OverlayAnimation,
} from '../../types/timeline';
import { playSfxInstant } from '../../core/audio/sfxSynthesizer';

interface PropertyInspectorProps {
  selectedClip: VideoClip | null;
  onUpdateClip: (clip: VideoClip) => void;
  onDeleteClip?: (id: string) => void;
  selectedOverlay: StickerOverlay | null;
  onUpdateOverlay: (overlay: StickerOverlay) => void;
  onDeleteOverlay?: (id: string) => void;
  selectedSfx?: SfxTrackItem | null;
  onDeleteSfx?: (id: string) => void;
  sfxTracks: SfxTrackItem[];
  onUpdateSfx: (sfx: SfxTrackItem) => void;
  totalDuration: number;
  clipCount: number;
  resolution: string;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  selectedClip,
  onUpdateClip,
  onDeleteClip,
  selectedOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  selectedSfx,
  onDeleteSfx,
  sfxTracks,
  onUpdateSfx,
  totalDuration,
  clipCount,
  resolution,
}) => {
  // Case 1: Video Clip Selected
  if (selectedClip) {
    return (
      <div className="w-72 bg-[#0e131d] border-l border-slate-800 p-3.5 flex flex-col space-y-4 overflow-y-auto select-none shrink-0">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center">
            <Video className="w-3.5 h-3.5 mr-1.5" />
            Clip Inspector
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-mono text-slate-400">{selectedClip.duration.toFixed(2)}s</span>
            {onDeleteClip && (
              <button
                onClick={() => onDeleteClip(selectedClip.id)}
                className="flex items-center space-x-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-semibold transition border border-rose-500/30"
                title="Delete this clip"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-200 truncate">{selectedClip.name}</div>

        {/* Trimming In/Out */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-300 flex items-center">
            <Clock className="w-3 h-3 mr-1 text-slate-400" />
            <span>Trimming & Timing</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400">In Point (s)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max={selectedClip.outPoint - 0.2}
                value={Number(selectedClip.inPoint.toFixed(2))}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateClip({
                    ...selectedClip,
                    inPoint: val,
                    duration: (selectedClip.outPoint - val) / selectedClip.speed,
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-400">Out Point (s)</span>
              <input
                type="number"
                step="0.1"
                min={selectedClip.inPoint + 0.2}
                value={Number(selectedClip.outPoint.toFixed(2))}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateClip({
                    ...selectedClip,
                    outPoint: val,
                    duration: (val - selectedClip.inPoint) / selectedClip.speed,
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Transition In Selector */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-300">Transition In</div>
          <select
            value={selectedClip.transitionIn}
            onChange={(e) =>
              onUpdateClip({ ...selectedClip, transitionIn: e.target.value as TransitionType })
            }
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="none">None (Cut)</option>
            <option value="whip-pan">⚡ Whip Pan</option>
            <option value="zoom-in">🔍 Zoom In</option>
            <option value="zoom-out">🔎 Zoom Out</option>
            <option value="glitch">👾 RGB Glitch</option>
            <option value="dissolve">✨ Dissolve</option>
          </select>

          {selectedClip.transitionIn !== 'none' && (
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Duration</span>
                <span className="font-mono text-indigo-400">
                  {selectedClip.transitionDuration.toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={selectedClip.transitionDuration}
                onChange={(e) =>
                  onUpdateClip({
                    ...selectedClip,
                    transitionDuration: Number(e.target.value),
                  })
                }
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Volume & Audio Level (0% - 200%) */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center">
              {selectedClip.isMuted ? (
                <VolumeX className="w-3.5 h-3.5 mr-1 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 mr-1 text-indigo-400" />
              )}
              <span>Audio Volume</span>
            </span>
            <div className="flex items-center space-x-1.5">
              <span
                className={`font-mono font-bold text-[11px] ${
                  selectedClip.isMuted
                    ? 'text-rose-400'
                    : selectedClip.volume > 1.0
                    ? 'text-amber-400'
                    : 'text-indigo-400'
                }`}
              >
                {selectedClip.isMuted ? 'MUTED' : `${Math.round(selectedClip.volume * 100)}%`}
              </span>
              <button
                onClick={() =>
                  onUpdateClip({
                    ...selectedClip,
                    isMuted: !selectedClip.isMuted,
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition ${
                  selectedClip.isMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {selectedClip.isMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={selectedClip.isMuted ? 0 : selectedClip.volume}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateClip({
                ...selectedClip,
                volume: val,
                isMuted: val === 0,
              });
            }}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
          />

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-5 gap-1 pt-1">
            {[
              { label: '0%', val: 0, isMute: true },
              { label: '50%', val: 0.5, isMute: false },
              { label: '100%', val: 1.0, isMute: false },
              { label: '150%', val: 1.5, isMute: false },
              { label: '200%', val: 2.0, isMute: false },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() =>
                  onUpdateClip({
                    ...selectedClip,
                    volume: preset.val,
                    isMuted: preset.isMute,
                  })
                }
                className={`py-0.5 rounded text-[9px] font-mono font-bold transition border ${
                  (selectedClip.isMuted && preset.isMute) ||
                  (!selectedClip.isMuted && Math.abs(selectedClip.volume - preset.val) < 0.05)
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clip Zoom Scale */}
        <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="flex justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center">
              <Maximize className="w-3 h-3 mr-1" /> Clip Scale
            </span>
            <span className="font-mono text-amber-400">{selectedClip.zoomScale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="1.5"
            step="0.05"
            value={selectedClip.zoomScale}
            onChange={(e) => onUpdateClip({ ...selectedClip, zoomScale: Number(e.target.value) })}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>
    );
  }

  // Case 2: Sticker Overlay Selected
  if (selectedOverlay) {
    const pairedSfxItem = sfxTracks.find((s) => s.linkedOverlayId === selectedOverlay.id);

    return (
      <div className="w-72 bg-[#0e131d] border-l border-slate-800 p-3.5 flex flex-col space-y-4 overflow-y-auto select-none shrink-0">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center">
            <Smile className="w-3.5 h-3.5 mr-1.5" />
            Sticker & SFX Inspector
          </span>
          <div className="flex items-center space-x-2">
            <span className="text-xl">{selectedOverlay.emoji}</span>
            {onDeleteOverlay && (
              <button
                onClick={() => onDeleteOverlay(selectedOverlay.id)}
                className="flex items-center space-x-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-semibold transition border border-rose-500/30"
                title="Delete this sticker"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Label & Text */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-300 font-bold">Subtitle Label</label>
          <input
            type="text"
            value={selectedOverlay.label}
            onChange={(e) => onUpdateOverlay({ ...selectedOverlay, label: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
          />
        </div>

        {/* Position X / Y */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-300 flex items-center">
            <Move className="w-3 h-3 mr-1" />
            <span>Canvas Position</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400">X Position (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={selectedOverlay.x}
                onChange={(e) => onUpdateOverlay({ ...selectedOverlay, x: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Y Position (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={selectedOverlay.y}
                onChange={(e) => onUpdateOverlay({ ...selectedOverlay, y: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Animation Style */}
        <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <label className="text-[11px] font-bold text-slate-300">Entrance Animation</label>
          <select
            value={selectedOverlay.animation}
            onChange={(e) =>
              onUpdateOverlay({ ...selectedOverlay, animation: e.target.value as OverlayAnimation })
            }
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
          >
            <option value="pop">💥 Pop & Bounce</option>
            <option value="swoosh">💨 Swoosh Slide</option>
            <option value="bounce">⚡ Bounce</option>
            <option value="glitch">👾 Glitch Shake</option>
            <option value="pulse">💓 Pulse</option>
          </select>
        </div>

        {/* Paired SFX Node */}
        <div className="space-y-2 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/60">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
            <span className="flex items-center">
              <Volume2 className="w-3.5 h-3.5 mr-1" />
              <span>Synchronized SFX</span>
            </span>
            <button
              onClick={() => {
                if (selectedOverlay.pairedSfx) {
                  playSfxInstant(selectedOverlay.pairedSfx as SfxPreset, 0.9);
                }
              }}
              className="text-[9px] bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded"
            >
              Test SFX
            </button>
          </div>

          <select
            value={selectedOverlay.pairedSfx || 'pop'}
            onChange={(e) => {
              const preset = e.target.value as SfxPreset;
              onUpdateOverlay({ ...selectedOverlay, pairedSfx: preset });
              if (pairedSfxItem) {
                onUpdateSfx({ ...pairedSfxItem, preset, name: `${selectedOverlay.emoji} ${preset.toUpperCase()}` });
              }
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
          >
            <option value="pop">Pop Chirp</option>
            <option value="ding">Bell Chime (Ding)</option>
            <option value="swoosh">Fast Swoosh</option>
            <option value="vine-boom">Vine Boom Bass</option>
            <option value="camera-shutter">Camera Shutter</option>
            <option value="laser">Laser Zap</option>
            <option value="cash">Register Chime</option>
          </select>

          {pairedSfxItem && (
            <div className="space-y-1.5 pt-2 border-t border-emerald-800/40">
              <div className="flex justify-between items-center text-[10px] text-emerald-300 font-bold">
                <span>SFX Volume</span>
                <span className="font-mono">
                  {pairedSfxItem.isMuted ? 'MUTED' : `${Math.round((pairedSfxItem.volume ?? 1) * 100)}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={pairedSfxItem.isMuted ? 0 : (pairedSfxItem.volume ?? 1)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateSfx({ ...pairedSfxItem, volume: val, isMuted: val === 0 });
                }}
                className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Case 3: SFX Track Selected
  if (selectedSfx) {
    const isMuted = selectedSfx.isMuted ?? false;
    const volumePercent = Math.round((selectedSfx.volume ?? 1.0) * 100);

    return (
      <div className="w-72 bg-[#0e131d] border-l border-slate-800 p-3.5 flex flex-col space-y-4 overflow-y-auto select-none shrink-0">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center">
            <Music className="w-3.5 h-3.5 mr-1.5" />
            SFX Inspector
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-mono text-slate-400">{selectedSfx.duration.toFixed(2)}s</span>
            {onDeleteSfx && (
              <button
                onClick={() => onDeleteSfx(selectedSfx.id)}
                className="flex items-center space-x-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-0.5 rounded text-[10px] font-semibold transition border border-rose-500/30"
                title="Delete this SFX"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* SFX Name */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-300 font-bold">Sound Title</label>
          <input
            type="text"
            value={selectedSfx.name}
            onChange={(e) => onUpdateSfx({ ...selectedSfx, name: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
          />
        </div>

        {/* Preset Selector & Test Button */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>Audio Preset</span>
            <button
              onClick={() => playSfxInstant(selectedSfx.preset, selectedSfx.volume ?? 1.0)}
              className="text-[9px] bg-emerald-700/60 hover:bg-emerald-600 text-white px-2 py-0.5 rounded transition"
            >
              Test SFX
            </button>
          </div>

          <select
            value={selectedSfx.preset}
            onChange={(e) => {
              const preset = e.target.value as SfxPreset;
              onUpdateSfx({
                ...selectedSfx,
                preset,
                name: `SFX: ${preset.toUpperCase()}`,
                duration: preset === 'vine-boom' ? 1.2 : 0.6,
              });
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200"
          >
            <option value="vine-boom">💥 Vine Boom Bass</option>
            <option value="ding">🔔 Bell Chime (Ding)</option>
            <option value="pop">🎈 Pop Chirp</option>
            <option value="swoosh">💨 Fast Swoosh</option>
            <option value="camera-shutter">📷 Camera Shutter</option>
            <option value="laser">⚡ Laser Zap</option>
            <option value="cash">💰 Register Cash Chime</option>
          </select>
        </div>

        {/* Timing */}
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <div className="text-[11px] font-bold text-slate-300 flex items-center">
            <Clock className="w-3 h-3 mr-1 text-slate-400" />
            <span>SFX Timing</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400">Trigger Time (s)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={Number(selectedSfx.startTimelineTime.toFixed(2))}
                onChange={(e) =>
                  onUpdateSfx({
                    ...selectedSfx,
                    startTimelineTime: Math.max(0, Number(e.target.value)),
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-400">Duration (s)</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5"
                value={Number(selectedSfx.duration.toFixed(2))}
                onChange={(e) =>
                  onUpdateSfx({
                    ...selectedSfx,
                    duration: Math.max(0.1, Number(e.target.value)),
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Volume & Audio Level (0% - 200%) */}
        <div className="space-y-2 bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-800/60">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
            <span className="flex items-center">
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 mr-1 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              )}
              <span>SFX Volume</span>
            </span>
            <div className="flex items-center space-x-1.5">
              <span
                className={`font-mono font-bold text-[11px] ${
                  isMuted ? 'text-rose-400' : (selectedSfx.volume ?? 1) > 1.0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {isMuted ? 'MUTED' : `${volumePercent}%`}
              </span>
              <button
                onClick={() =>
                  onUpdateSfx({
                    ...selectedSfx,
                    isMuted: !isMuted,
                  })
                }
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border transition ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={isMuted ? 0 : (selectedSfx.volume ?? 1.0)}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateSfx({
                ...selectedSfx,
                volume: val,
                isMuted: val === 0,
              });
            }}
            className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
          />

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-5 gap-1 pt-1">
            {[
              { label: '0%', val: 0, isMute: true },
              { label: '50%', val: 0.5, isMute: false },
              { label: '100%', val: 1.0, isMute: false },
              { label: '150%', val: 1.5, isMute: false },
              { label: '200%', val: 2.0, isMute: false },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() =>
                  onUpdateSfx({
                    ...selectedSfx,
                    volume: preset.val,
                    isMuted: preset.isMute,
                  })
                }
                className={`py-0.5 rounded text-[9px] font-mono font-bold transition border ${
                  (isMuted && preset.isMute) ||
                  (!isMuted && Math.abs((selectedSfx.volume ?? 1) - preset.val) < 0.05)
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Default Project Summary
  return (
    <div className="w-72 bg-[#0e131d] border-l border-slate-800 p-3.5 flex flex-col space-y-4 select-none shrink-0">
      <div className="border-b border-slate-800 pb-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center">
          <Sliders className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
          Project Status
        </span>
      </div>

      <div className="space-y-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex justify-between text-slate-400">
          <span>Resolution:</span>
          <span className="font-mono text-slate-200 font-semibold">{resolution}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Clips on Timeline:</span>
          <span className="font-mono text-indigo-400 font-semibold">{clipCount}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Total Duration:</span>
          <span className="font-mono text-pink-400 font-semibold">{totalDuration.toFixed(2)}s</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>SFX Nodes Synced:</span>
          <span className="font-mono text-emerald-400 font-semibold">{sfxTracks.length}</span>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800 leading-relaxed">
        <div className="font-bold text-slate-300 mb-1">Quick Shortcuts</div>
        <ul className="space-y-1 text-[10px]">
          <li><kbd className="bg-slate-800 px-1 rounded text-slate-300">Space</kbd> Play / Pause</li>
          <li><kbd className="bg-slate-800 px-1 rounded text-slate-300">S</kbd> or <kbd className="bg-slate-800 px-1 rounded text-slate-300">Ctrl+B</kbd> Split Clip</li>
          <li><kbd className="bg-slate-800 px-1 rounded text-slate-300">Del</kbd> Delete Selection</li>
          <li><kbd className="bg-slate-800 px-1 rounded text-slate-300">← / →</kbd> Step 1 Frame</li>
        </ul>
      </div>
    </div>
  );
};
