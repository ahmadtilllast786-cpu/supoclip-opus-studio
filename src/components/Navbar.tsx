import React from 'react';
import {
  Wand2,
  Download,
  Smartphone,
  Monitor,
  Square,
  Sparkles,
  Scissors,
  Flame,
} from 'lucide-react';

interface NavbarProps {
  resolution: string;
  setResolution: (res: any) => void;
  onAutoEdit: () => void;
  onOpenExport: () => void;
  isAutoEditing: boolean;
  activeClipCount: number;
  activeViralityScore?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  resolution,
  setResolution,
  onAutoEdit,
  onOpenExport,
  isAutoEditing,
  activeClipCount,
  activeViralityScore = 96,
}) => {
  return (
    <header className="h-14 bg-[#0d111a] border-b border-slate-800/80 px-4 flex items-center justify-between shrink-0 select-none z-30">
      {/* Brand & Project Info */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
          <Flame className="w-5 h-5 fill-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm tracking-tight text-white font-['Space_Grotesk']">
              SUPOCLIP <span className="text-rose-500">x</span> OPUS
            </span>
            <span className="text-[10px] font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-700/50 px-1.5 py-0.5 rounded">
              v4.5 SUPO ENGINE
            </span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>VIRALITY: {activeViralityScore}/100</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{activeClipCount} clips on timeline</span>
          </div>
        </div>
      </div>

      {/* Aspect Ratio & Format Selector */}
      <div className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs font-medium text-slate-300">
        <button
          onClick={() => setResolution('1080x1920')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition ${
            resolution === '1080x1920'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'hover:text-white hover:bg-slate-800'
          }`}
          title="9:16 Vertical (TikTok, Reels, Shorts)"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>9:16 Shorts</span>
        </button>

        <button
          onClick={() => setResolution('2160x3840')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition ${
            resolution === '2160x3840'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'hover:text-white hover:bg-slate-800'
          }`}
          title="4K UHD Vertical (2160x3840)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>4K Ultra</span>
        </button>

        <button
          onClick={() => setResolution('1080x1080')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition ${
            resolution === '1080x1080'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'hover:text-white hover:bg-slate-800'
          }`}
          title="1:1 Square (Instagram Feed)"
        >
          <Square className="w-3.5 h-3.5" />
          <span>1:1</span>
        </button>

        <button
          onClick={() => setResolution('1920x1080')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition ${
            resolution === '1920x1080'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'hover:text-white hover:bg-slate-800'
          }`}
          title="16:9 Landscape"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>16:9</span>
        </button>
      </div>

      {/* Primary Actions: Auto-Edit & Lossless Export */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onAutoEdit}
          disabled={isAutoEditing || activeClipCount === 0}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-lg ${
            isAutoEditing
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : activeClipCount === 0
              ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 hover:from-amber-600 hover:to-purple-700 text-white shadow-pink-500/20 active:scale-95'
          }`}
          title="Detect silences, place punch zooms, and sync sticker SFX"
        >
          <Wand2 className={`w-3.5 h-3.5 ${isAutoEditing ? 'animate-spin' : ''}`} />
          <span>{isAutoEditing ? 'AI EDITING...' : 'AUTONOMOUS OPUS EDIT'}</span>
        </button>

        <button
          onClick={onOpenExport}
          disabled={activeClipCount === 0}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20 transition active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>EXPORT HIGH-BITRATE</span>
        </button>
      </div>
    </header>
  );
};
