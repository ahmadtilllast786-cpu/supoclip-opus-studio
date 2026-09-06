import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Volume2,
  Plus,
  Smile,
  Search,
  Flame,
  Target,
  Bell,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import {
  StickerOverlay,
  SfxTrackItem,
  SfxPreset,
  StickerCatalogItem,
} from '../../types/timeline';
import { playSfxInstant } from '../../core/audio/sfxSynthesizer';
import {
  fetchStickerCatalog,
  preloadStickerAssets,
} from '../../core/stickers/stickerCatalogService';

interface StickerStorePanelProps {
  currentTime: number;
  onAddOverlayAndSfx: (overlay: StickerOverlay, sfx: SfxTrackItem) => void;
}

type CategoryFilter = 'all' | 'trending' | 'arrows' | 'social';

export const StickerStorePanel: React.FC<StickerStorePanelProps> = ({
  currentTime,
  onAddOverlayAndSfx,
}) => {
  const [catalog, setCatalog] = useState<StickerCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [addedFeedbackId, setAddedFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchStickerCatalog().then((items) => {
      if (isMounted) {
        setCatalog(items);
        setLoading(false);
        preloadStickerAssets(items.map((i) => i.assetUrl));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePreviewSfx = (preset: SfxPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    playSfxInstant(preset, 0.9);
  };

  const handleAddSticker = (item: StickerCatalogItem) => {
    const overlayId = `ov-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sfxId = `sfx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const overlay: StickerOverlay = {
      id: overlayId,
      emoji: item.emoji,
      label: item.label,
      assetUrl: item.assetUrl,
      assetType: item.format,
      category: item.category,
      startTimelineTime: currentTime,
      duration: 1.5,
      x: 50,
      y: 35,
      scale: 1.25,
      rotation: 0,
      animation: item.defaultAnimation,
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

    // Instant sound feedback
    playSfxInstant(item.sfx, 0.9);

    // Visual feedback
    setAddedFeedbackId(item.id);
    setTimeout(() => setAddedFeedbackId(null), 1200);

    onAddOverlayAndSfx(overlay, sfxItem);
  };

  const filteredItems = useMemo(() => {
    return catalog.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        item.emoji.includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [catalog, selectedCategory, searchQuery]);

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center">
          <Smile className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
          Animated Vector Stickers
        </span>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
          SFX Synced
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        High-definition vector animations scaled for 9:16 vertical shorts. Adding a sticker auto-pairs a synchronized sound effect at the current playhead (<span className="font-mono text-pink-400 font-bold">{currentTime.toFixed(2)}s</span>).
      </p>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search stickers (e.g. fire, skull, arrow)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-800 focus:border-pink-500/70 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800/80 text-[10px]">
        {[
          { id: 'all', label: 'All', icon: Layers },
          { id: 'trending', label: 'Trending', icon: Flame },
          { id: 'arrows', label: 'Arrows', icon: Target },
          { id: 'social', label: 'Social', icon: Bell },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
              className={`py-1 rounded flex items-center justify-center space-x-1 font-medium transition ${
                isActive
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stickers Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
          Loading animated sticker catalog...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
          No stickers found matching "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const isAdded = addedFeedbackId === item.id;

            return (
              <div
                key={item.id}
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
                className={`bg-slate-900/90 hover:bg-slate-800/90 border p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition flex flex-col items-center justify-between group shadow-sm select-none relative overflow-hidden ${
                  isAdded
                    ? 'border-emerald-500 ring-1 ring-emerald-500/50 bg-emerald-950/20'
                    : 'border-slate-800 hover:border-pink-500/60 hover:shadow-pink-500/10'
                }`}
                title="Click to add at playhead, or drag directly to timeline"
              >
                {/* Vector Image / Animation Container */}
                <div className="w-14 h-14 flex items-center justify-center my-1 group-hover:scale-110 transition-transform duration-200">
                  {item.assetUrl ? (
                    <img
                      src={item.assetUrl}
                      alt={item.name}
                      className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-3xl">{item.emoji}</span>
                  )}
                </div>

                {/* Name / Label */}
                <div className="font-bold text-[10px] text-slate-200 text-center tracking-wide mt-1">
                  {item.label || item.name}
                </div>

                {/* Footer Badges & Audio Preview */}
                <div className="w-full flex items-center justify-between mt-2 pt-1 border-t border-slate-800/60 text-[9px]">
                  <button
                    onClick={(e) => handlePreviewSfx(item.sfx, e)}
                    className="flex items-center space-x-1 text-slate-400 hover:text-pink-400 transition py-0.5 px-1 rounded hover:bg-slate-800"
                    title={`Listen to SFX: ${item.sfxLabel}`}
                  >
                    <Volume2 className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[50px]">{item.sfxLabel.split(' ')[0]}</span>
                  </button>

                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-pink-950/60 text-pink-300 border border-pink-800/50 flex items-center">
                    {isAdded ? (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 text-emerald-400" />
                        Added!
                      </>
                    ) : (
                      <>
                        <Plus className="w-2.5 h-2.5 mr-0.5" />
                        Add
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
