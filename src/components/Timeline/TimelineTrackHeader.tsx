import React from 'react';
import {
  Video,
  Layers,
  Music,
  Sparkles,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Radio,
  Plus,
} from 'lucide-react';

export type TrackType = 'overlay' | 'video' | 'audio' | 'sfx';

interface TimelineTrackHeaderProps {
  type: TrackType;
  trackId: string;
  label: string;
  badge: string;
  isLocked: boolean;
  onToggleLock: () => void;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isSolo?: boolean;
  onToggleSolo?: () => void;
  onQuickAdd?: () => void;
  quickAddTitle?: string;
  itemCount: number;
}

export const TimelineTrackHeader: React.FC<TimelineTrackHeaderProps> = ({
  type,
  label,
  badge,
  isLocked,
  onToggleLock,
  isVisible = true,
  onToggleVisibility,
  isMuted = false,
  onToggleMute,
  isSolo = false,
  onToggleSolo,
  onQuickAdd,
  quickAddTitle = 'Add',
  itemCount,
}) => {
  // Theme styling based on track type
  const theme = {
    overlay: {
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: <Layers className="w-3.5 h-3.5 text-purple-400" />,
      border: 'border-purple-500/20',
      accent: 'text-purple-300',
    },
    video: {
      badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      icon: <Video className="w-3.5 h-3.5 text-indigo-400" />,
      border: 'border-indigo-500/20',
      accent: 'text-indigo-300',
    },
    audio: {
      badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      icon: <Music className="w-3.5 h-3.5 text-sky-400" />,
      border: 'border-sky-500/20',
      accent: 'text-sky-300',
    },
    sfx: {
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
      border: 'border-emerald-500/20',
      accent: 'text-emerald-300',
    },
  }[type];

  return (
    <div
      style={{ width: '128px' }}
      className="sticky left-0 z-30 w-32 shrink-0 h-full bg-slate-900/95 border-r border-slate-700/80 px-2 py-1.5 flex flex-col justify-between select-none shadow-md backdrop-blur-xs"
    >
      {/* Top: Track Type Badge & Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {theme.icon}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${theme.badgeBg}`}>
                {badge}
              </span>
              <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[58px]">
                {label}
              </span>
            </div>
          </div>
        </div>

        {/* Item count pill */}
        <span className="text-[9px] font-mono text-slate-400 px-1 bg-slate-800/80 rounded border border-slate-700/50">
          {itemCount}
        </span>
      </div>

      {/* Bottom: Track Action Controls (Lock, Visibility / Mute, Quick Add) */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-slate-400">
        <div className="flex items-center space-x-1">
          {/* Lock / Unlock Toggle */}
          <button
            onClick={onToggleLock}
            title={isLocked ? 'Unlock Track' : 'Lock Track (Prevents editing)'}
            className={`p-1 rounded transition-colors ${
              isLocked
                ? 'bg-rose-950/60 text-rose-400 hover:bg-rose-900/80'
                : 'hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {isLocked ? <Lock className="w-3 h-3 text-rose-400" /> : <Unlock className="w-3 h-3 opacity-60" />}
          </button>

          {/* Visibility Eye (For Video & Overlays) */}
          {onToggleVisibility && (
            <button
              onClick={onToggleVisibility}
              title={isVisible ? 'Hide Track' : 'Show Track'}
              className={`p-1 rounded transition-colors ${
                !isVisible
                  ? 'bg-amber-950/60 text-amber-400 hover:bg-amber-900/80'
                  : 'hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {isVisible ? <Eye className="w-3 h-3 opacity-80" /> : <EyeOff className="w-3 h-3 text-amber-400" />}
            </button>
          )}

          {/* Mute Speaker (For Audio & SFX) */}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              title={isMuted ? 'Unmute Track' : 'Mute Track'}
              className={`p-1 rounded transition-colors ${
                isMuted
                  ? 'bg-rose-950/60 text-rose-400 hover:bg-rose-900/80'
                  : 'hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {isMuted ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3 opacity-80" />}
            </button>
          )}

          {/* Solo Track Toggle */}
          {onToggleSolo && (
            <button
              onClick={onToggleSolo}
              title={isSolo ? 'Turn Solo Off' : 'Solo Track'}
              className={`p-1 rounded transition-colors ${
                isSolo
                  ? 'bg-sky-600 text-white font-bold shadow-xs'
                  : 'hover:bg-slate-800 hover:text-slate-200 text-[10px] font-mono'
              }`}
            >
              <Radio className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Quick Add Button (e.g. + SFX) */}
        {onQuickAdd && (
          <button
            onClick={onQuickAdd}
            disabled={isLocked}
            title={quickAddTitle}
            className="flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-medium border border-slate-700/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Add</span>
          </button>
        )}
      </div>
    </div>
  );
};
