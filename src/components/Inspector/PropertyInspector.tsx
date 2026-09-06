import React, { useState, useEffect } from 'react';
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
  Type,
  Palette,
  Zap,
  CheckCircle2,
  AlignLeft,
  AlignCenter,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  SfxTrackItem,
  TransitionType,
  SfxPreset,
  OverlayAnimation,
  CaptionTemplate,
  CaptionTemplateId,
} from '../../types/timeline';
import { playSfxInstant } from '../../core/audio/sfxSynthesizer';
import { CAPTION_PRESETS, getCaptionPreset } from '../../styles/captionPresets';

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
  captionTemplate?: CaptionTemplate;
  onUpdateCaptionTemplate?: (template: CaptionTemplate) => void;
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
  captionTemplate,
  onUpdateCaptionTemplate,
}) => {
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'captions'>('properties');

  // When selection changes to an item, switch to properties view
  useEffect(() => {
    if (selectedClip || selectedOverlay || selectedSfx) {
      setInspectorTab('properties');
    }
  }, [selectedClip?.id, selectedOverlay?.id, selectedSfx?.id]);

  const presetList = Object.values(CAPTION_PRESETS);

  return (
    <div className="w-72 bg-[#0e131d] border-l border-slate-800 flex flex-col h-full overflow-hidden select-none shrink-0">
      {/* Top Header Tabs */}
      <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/80 p-1 gap-1 text-[11px] font-semibold shrink-0">
        <button
          onClick={() => setInspectorTab('properties')}
          className={`py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition ${
            inspectorTab === 'properties'
              ? 'bg-slate-800 text-indigo-300 shadow-sm border border-slate-700/60'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>
            {selectedClip
              ? 'Clip'
              : selectedOverlay
              ? 'Sticker'
              : selectedSfx
              ? 'SFX'
              : 'Properties'}
          </span>
        </button>

        <button
          onClick={() => setInspectorTab('captions')}
          className={`py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition ${
            inspectorTab === 'captions'
              ? 'bg-gradient-to-r from-pink-900/60 to-purple-900/60 text-pink-300 shadow-sm border border-pink-700/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Type className="w-3.5 h-3.5 text-pink-400" />
          <span>Caption Presets</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col space-y-4">
        {inspectorTab === 'captions' ? (
          /* ========================================================================= */
          /* CAPTION PRESETS & ENGINE STYLING TAB                                      */
          /* ========================================================================= */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Animated Caption Engine
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                Whisper Word Sync
              </span>
            </div>

            {/* Caption Preset Selector Cards */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>Preset Style</span>
                <span className="text-[10px] text-indigo-400 font-mono">
                  {captionTemplate?.name || 'Default'}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                {presetList.map((preset) => {
                  const isSelected = captionTemplate?.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (onUpdateCaptionTemplate) {
                          onUpdateCaptionTemplate({
                            ...getCaptionPreset(preset.id),
                            position_x: captionTemplate?.position_x ?? preset.position_x,
                            position_y: captionTemplate?.position_y ?? preset.position_y,
                          });
                        }
                      }}
                      className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-gradient-to-b from-indigo-950/70 to-purple-950/70 border-indigo-500 ring-1 ring-indigo-500/50 text-white'
                          : 'bg-slate-900/70 hover:bg-slate-800/70 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold truncate">
                          {preset.name.split(' ')[0]}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3 h-3 text-indigo-400 shrink-0" />
                        )}
                      </div>

                      <div
                        className="text-[10px] px-1 py-0.5 rounded text-center font-extrabold truncate"
                        style={{
                          fontFamily: preset.font_family,
                          backgroundColor: preset.word_box
                            ? preset.word_box_color || '#00BF49'
                            : preset.background
                            ? 'rgba(0,0,0,0.6)'
                            : 'transparent',
                          color: preset.highlight_color || preset.font_color,
                          textShadow: preset.stroke_color
                            ? `0 0 3px ${preset.stroke_color}`
                            : 'none',
                        }}
                      >
                        {preset.id === 'hormozi'
                          ? 'HORMOZI'
                          : preset.id === 'beast'
                          ? 'PUNCHY'
                          : preset.id === 'minimal'
                          ? 'minimal'
                          : 'SAMPLE'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Typography Controls */}
            {captionTemplate && onUpdateCaptionTemplate && (
              <>
                {/* Font Family */}
                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <label className="text-[11px] font-bold text-slate-300">Font Family</label>
                  <select
                    value={captionTemplate.font_family}
                    onChange={(e) =>
                      onUpdateCaptionTemplate({
                        ...captionTemplate,
                        font_family: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value='Montserrat, "Space Grotesk", sans-serif'>
                      Montserrat (Bold & Modern)
                    </option>
                    <option value='Bangers, Montserrat, sans-serif'>
                      Bangers (Punchy Beast Style)
                    </option>
                    <option value='Inter, system-ui, sans-serif'>
                      Inter (Clean Minimal)
                    </option>
                    <option value='"Space Grotesk", sans-serif'>
                      Space Grotesk (Tech / Edgy)
                    </option>
                    <option value='"JetBrains Mono", monospace'>
                      JetBrains Mono (Code)
                    </option>
                  </select>
                </div>

                {/* Font Size & Stroke Thickness */}
                <div className="space-y-2.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  {/* Font Size */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-300">
                      <span>Font Size</span>
                      <span className="font-mono text-indigo-400">{captionTemplate.font_size}px</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="64"
                      step="1"
                      value={captionTemplate.font_size}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          font_size: Number(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Stroke Thickness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold text-slate-300">
                      <span>Stroke Thickness</span>
                      <span className="font-mono text-pink-400">{captionTemplate.stroke_width}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="0.5"
                      value={captionTemplate.stroke_width}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          stroke_width: Number(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>
                </div>

                {/* Text Position Sliders (X/Y) with Quick Anchors */}
                <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center">
                      <Move className="w-3 h-3 mr-1" />
                      <span>Text Placement</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      X:{Math.round((captionTemplate.position_x ?? 0.5) * 100)}% Y:
                      {Math.round((captionTemplate.position_y ?? 0.74) * 100)}%
                    </span>
                  </div>

                  {/* Position X */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">Horizontal Center (X)</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.01"
                      value={captionTemplate.position_x ?? 0.5}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          position_x: Number(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Position Y */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">Vertical Offset (Y)</span>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.01"
                      value={captionTemplate.position_y ?? 0.74}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          position_y: Number(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    {[
                      { label: 'Top', y: 0.18 },
                      { label: 'Center', y: 0.5 },
                      { label: 'Lower 1/3', y: 0.74 },
                      { label: 'Bottom', y: 0.84 },
                    ].map((pos) => (
                      <button
                        key={pos.label}
                        onClick={() =>
                          onUpdateCaptionTemplate({
                            ...captionTemplate,
                            position_y: pos.y,
                          })
                        }
                        className={`py-1 text-[9px] font-mono rounded border transition ${
                          Math.abs((captionTemplate.position_y ?? 0.74) - pos.y) < 0.04
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Highlight Active Word Color & Swatches */}
                <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center">
                      <Palette className="w-3 h-3 mr-1" />
                      <span>Active Word Highlight</span>
                    </span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="color"
                        value={captionTemplate.highlight_color || '#FFE000'}
                        onChange={(e) =>
                          onUpdateCaptionTemplate({
                            ...captionTemplate,
                            highlight_color: e.target.value,
                          })
                        }
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-slate-300">
                        {captionTemplate.highlight_color}
                      </span>
                    </div>
                  </div>

                  {/* Swatches */}
                  <div className="flex items-center space-x-1.5">
                    {[
                      { label: 'Green', color: '#00FF66' },
                      { label: 'Yellow', color: '#FFE600' },
                      { label: 'Pink', color: '#FE2C55' },
                      { label: 'Cyan', color: '#00F0FF' },
                      { label: 'Red', color: '#FF2D2D' },
                      { label: 'White', color: '#FFFFFF' },
                    ].map((swatch) => (
                      <button
                        key={swatch.color}
                        onClick={() =>
                          onUpdateCaptionTemplate({
                            ...captionTemplate,
                            highlight_color: swatch.color,
                          })
                        }
                        style={{ backgroundColor: swatch.color }}
                        title={swatch.label}
                        className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 ${
                          captionTemplate.highlight_color?.toLowerCase() ===
                          swatch.color.toLowerCase()
                            ? 'border-white ring-2 ring-indigo-500'
                            : 'border-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Bounce Intensity Slider */}
                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center">
                      <Zap className="w-3 h-3 mr-1 text-amber-400" />
                      <span>Word Scale Bounce</span>
                    </span>
                    <span className="font-mono text-amber-400">
                      {((captionTemplate.bounce_intensity ?? 0.25) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={captionTemplate.bounce_intensity ?? 0.25}
                    onChange={(e) =>
                      onUpdateCaptionTemplate({
                        ...captionTemplate,
                        bounce_intensity: Number(e.target.value),
                      })
                    }
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Toggles: Pill Box, Uppercase, Pop */}
                <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 text-xs">
                  {/* Word Pill Box */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Hormozi Capsule Pill</span>
                    <input
                      type="checkbox"
                      checked={captionTemplate.word_box}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          word_box: e.target.checked,
                          word_box_color: e.target.checked
                            ? captionTemplate.word_box_color || '#00BF49'
                            : null,
                        })
                      }
                      className="rounded accent-emerald-500"
                    />
                  </label>

                  {/* Uppercase */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">ALL CAPS (Uppercase)</span>
                    <input
                      type="checkbox"
                      checked={captionTemplate.uppercase}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          uppercase: e.target.checked,
                        })
                      }
                      className="rounded accent-indigo-500"
                    />
                  </label>

                  {/* Word Pop */}
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-300">Active Word Pop</span>
                    <input
                      type="checkbox"
                      checked={captionTemplate.word_pop}
                      onChange={(e) =>
                        onUpdateCaptionTemplate({
                          ...captionTemplate,
                          word_pop: e.target.checked,
                        })
                      }
                      className="rounded accent-pink-500"
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* PROPERTIES TAB: Clip / Sticker / SFX / Overview                           */
          /* ========================================================================= */
          <>
            {/* Case 1: Video Clip Selected */}
            {selectedClip && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center">
                    <Video className="w-3.5 h-3.5 mr-1.5" />
                    Clip Inspector
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono text-slate-400">
                      {selectedClip.duration.toFixed(2)}s
                    </span>
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

                <div className="text-xs font-semibold text-slate-200 truncate">
                  {selectedClip.name}
                </div>

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
                      onUpdateClip({
                        ...selectedClip,
                        transitionIn: e.target.value as TransitionType,
                      })
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
                </div>

                {/* Clip Volume */}
                <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center">
                      <Volume2 className="w-3 h-3 mr-1" /> Volume
                    </span>
                    <span className="font-mono text-indigo-400">
                      {Math.round(selectedClip.volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={selectedClip.volume}
                    onChange={(e) =>
                      onUpdateClip({ ...selectedClip, volume: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Clip Zoom Scale */}
                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center">
                      <Maximize className="w-3 h-3 mr-1" /> Clip Scale
                    </span>
                    <span className="font-mono text-amber-400">
                      {selectedClip.zoomScale.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.5"
                    step="0.05"
                    value={selectedClip.zoomScale}
                    onChange={(e) =>
                      onUpdateClip({ ...selectedClip, zoomScale: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Case 2: Sticker Overlay Selected */}
            {selectedOverlay && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center">
                    <Smile className="w-3.5 h-3.5 mr-1.5" />
                    Sticker & SFX Inspector
                  </span>
                  <div className="flex items-center space-x-2">
                    {selectedOverlay.assetUrl ? (
                      <div className="w-7 h-7 flex items-center justify-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                        <img
                          src={selectedOverlay.assetUrl}
                          alt={selectedOverlay.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="text-xl">{selectedOverlay.emoji}</span>
                    )}

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
                    onChange={(e) =>
                      onUpdateOverlay({ ...selectedOverlay, label: e.target.value })
                    }
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
                        onChange={(e) =>
                          onUpdateOverlay({ ...selectedOverlay, x: Number(e.target.value) })
                        }
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
                        onChange={(e) =>
                          onUpdateOverlay({ ...selectedOverlay, y: Number(e.target.value) })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Scale & Rotation */}
                <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span className="flex items-center">
                      <Maximize className="w-3 h-3 mr-1" /> Scale
                    </span>
                    <span className="font-mono text-pink-400">
                      {(selectedOverlay.scale ?? 1.25).toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={selectedOverlay.scale ?? 1.25}
                    onChange={(e) =>
                      onUpdateOverlay({ ...selectedOverlay, scale: Number(e.target.value) })
                    }
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                  />
                </div>

                {/* Animation Style */}
                <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <label className="text-[11px] font-bold text-slate-300">Entrance Animation</label>
                  <select
                    value={selectedOverlay.animation}
                    onChange={(e) =>
                      onUpdateOverlay({
                        ...selectedOverlay,
                        animation: e.target.value as OverlayAnimation,
                      })
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
                      const paired = sfxTracks.find((s) => s.linkedOverlayId === selectedOverlay.id);
                      if (paired) {
                        onUpdateSfx({
                          ...paired,
                          preset,
                          name: `${selectedOverlay.emoji} ${preset.toUpperCase()}`,
                        });
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
                </div>
              </div>
            )}

            {/* Case 3: SFX Track Selected */}
            {selectedSfx && !selectedClip && !selectedOverlay && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                    <Music className="w-3.5 h-3.5 mr-1.5" />
                    SFX Inspector
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => playSfxInstant(selectedSfx.preset, selectedSfx.volume ?? 1.0)}
                      className="bg-emerald-800/60 hover:bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded text-[10px]"
                    >
                      Play
                    </button>
                    {onDeleteSfx && (
                      <button
                        onClick={() => onDeleteSfx(selectedSfx.id)}
                        className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-0.5 rounded text-[10px] border border-rose-500/30"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-200 truncate">
                  {selectedSfx.name}
                </div>

                <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <label className="text-[11px] font-bold text-slate-300">SFX Preset</label>
                  <select
                    value={selectedSfx.preset}
                    onChange={(e) =>
                      onUpdateSfx({ ...selectedSfx, preset: e.target.value as SfxPreset })
                    }
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
                </div>
              </div>
            )}

            {/* Case 4: Project Overview (Default) */}
            {!selectedClip && !selectedOverlay && !selectedSfx && (
              <div className="space-y-4">
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
                    <span className="font-mono text-pink-400 font-semibold">
                      {totalDuration.toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>SFX Nodes Synced:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {sfxTracks.length}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  <div className="font-bold text-slate-300 mb-1">Quick Tip</div>
                  <p>
                    Switch to the <span className="text-pink-400 font-semibold">Caption Presets</span> tab above to customize Hormozi green pills, Beast bounce animations, colors, and font strokes in real time.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
