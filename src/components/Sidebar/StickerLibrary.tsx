import React from 'react';
import { Sparkles, Volume2, Plus, Smile } from 'lucide-react';
import { StickerOverlay, SfxTrackItem, SfxPreset, OverlayAnimation } from '../../types/timeline';
import { playSfxInstant } from '../../core/audio/sfxSynthesizer';

interface StickerLibraryProps {
  currentTime: number;
  onAddOverlayAndSfx: (overlay: StickerOverlay, sfx: SfxTrackItem) => void;
}

interface StickerItemDef {
  emoji: string;
  label: string;
  sfx: SfxPreset;
  sfxLabel: string;
  animation: OverlayAnimation;
}

const STICKER_CATALOG: StickerItemDef[] = [
  { emoji: '🔥', label: 'INSANE', sfx: 'pop', sfxLabel: 'Pop Chirp', animation: 'pop' },
  { emoji: '🤯', label: 'MIND BLOWN', sfx: 'vine-boom', sfxLabel: 'Vine Boom Bass', animation: 'bounce' },
  { emoji: '🚀', label: 'TO THE MOON', sfx: 'swoosh', sfxLabel: 'Fast Swoosh', animation: 'swoosh' },
  { emoji: '💡', label: 'SECRET TIP', sfx: 'ding', sfxLabel: 'Chime Ding', animation: 'pop' },
  { emoji: '💰', label: 'MONEY CASH', sfx: 'cash', sfxLabel: 'Register Chime', animation: 'bounce' },
  { emoji: '⚡', label: 'LOOK HERE', sfx: 'laser', sfxLabel: 'Laser Zap', animation: 'glitch' },
  { emoji: '📸', label: 'PROOF', sfx: 'camera-shutter', sfxLabel: 'Camera Shutter', animation: 'pop' },
  { emoji: '🚨', label: 'WARNING', sfx: 'laser', sfxLabel: 'Alert Siren', animation: 'pulse' },
  { emoji: '💀', label: 'DEAD', sfx: 'vine-boom', sfxLabel: 'Boom Impact', animation: 'bounce' },
  { emoji: '💯', label: '100% REAL', sfx: 'ding', sfxLabel: 'Chime Ding', animation: 'pop' },
];

export const StickerLibrary: React.FC<StickerLibraryProps> = ({
  currentTime,
  onAddOverlayAndSfx,
}) => {
  const handlePreviewSfx = (preset: SfxPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    playSfxInstant(preset, 0.9);
  };

  const handleAddSticker = (item: StickerItemDef) => {
    const overlayId = `ov-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sfxId = `sfx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const overlay: StickerOverlay = {
      id: overlayId,
      emoji: item.emoji,
      label: item.label,
      startTimelineTime: currentTime,
      duration: 1.5,
      x: 50,
      y: 30,
      scale: 1.25,
      rotation: 0,
      animation: item.animation,
      pairedSfx: item.sfx,
      pairedSfxId: sfxId,
    };

    const sfxItem: SfxTrackItem = {
      id: sfxId,
      name: `${item.emoji} ${item.sfxLabel}`,
      preset: item.sfx,
      startTimelineTime: currentTime,
      duration: 0.5,
      volume: 0.85,
      linkedOverlayId: overlayId,
    };

    // Play instant sound feedback
    playSfxInstant(item.sfx, 0.9);

    onAddOverlayAndSfx(overlay, sfxItem);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center">
          <Smile className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
          Viral Stickers & Emojis
        </span>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
          SFX Synced
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        Adding a sticker auto-pairs a synchronized sound effect node at the current playhead timestamp (<span className="font-mono text-pink-400 font-bold">{currentTime.toFixed(2)}s</span>).
      </p>

      {/* Grid of stickers */}
      <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {STICKER_CATALOG.map((item) => (
          <div
            key={item.label}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.setData(
                'application/json',
                JSON.stringify({
                  type: 'sticker',
                  item,
                })
              );
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => handleAddSticker(item)}
            className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-pink-500/60 p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition flex flex-col items-center justify-between group shadow-sm hover:shadow-pink-500/10 select-none"
            title="Click to add at playhead, or drag and drop directly onto Timeline Track 2"
          >
            <div className="text-3xl mb-1 group-hover:scale-125 transition transform pointer-events-none">
              {item.emoji}
            </div>

            <div className="font-bold text-[10px] text-slate-200 text-center tracking-wide">
              {item.label}
            </div>

            {/* SFX tag + preview audio button */}
            <div className="w-full mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
              <span className="truncate font-mono text-emerald-400">{item.sfxLabel}</span>
              <button
                onClick={(e) => handlePreviewSfx(item.sfx, e)}
                className="text-slate-500 hover:text-emerald-300 p-0.5"
                title="Preview SFX Sound"
              >
                <Volume2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
