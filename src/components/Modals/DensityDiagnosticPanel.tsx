import React from 'react';
import {
  X,
  Gauge,
  Sliders,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  RotateCcw,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { DiagnosticSettings } from '../../types/timeline';

interface DensityDiagnosticPanelProps {
  isOpen: boolean;
  onClose: () => void;
  diagnosticSettings: DiagnosticSettings;
  setDiagnosticSettings: React.Dispatch<React.SetStateAction<DiagnosticSettings>>;
  activeOverlaysCount: number;
  totalOverlaysCount: number;
  activeSfxCount: number;
  totalSfxCount: number;
}

export const DensityDiagnosticPanel: React.FC<DensityDiagnosticPanelProps> = ({
  isOpen,
  onClose,
  diagnosticSettings,
  setDiagnosticSettings,
  activeOverlaysCount,
  totalOverlaysCount,
  activeSfxCount,
  totalSfxCount,
}) => {
  if (!isOpen) return null;

  const {
    maxActiveOverlays,
    sfxThrottleIntervalMs,
    masterOverlayVisible,
    masterSfxMuted,
  } = diagnosticSettings;

  const handleResetDefaults = () => {
    setDiagnosticSettings({
      maxActiveOverlays: 5,
      sfxThrottleIntervalMs: 200,
      masterOverlayVisible: true,
      masterSfxMuted: false,
    });
  };

  const handleApplyCleanFootage = () => {
    setDiagnosticSettings((prev) => ({
      ...prev,
      masterOverlayVisible: false,
      masterSfxMuted: true,
    }));
  };

  const handleApplyHighEnergy = () => {
    setDiagnosticSettings({
      maxActiveOverlays: 5,
      sfxThrottleIntervalMs: 50,
      masterOverlayVisible: true,
      masterSfxMuted: false,
    });
  };

  const sfxRatePerSec = (1000 / Math.max(50, sfxThrottleIntervalMs)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0d121d] border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/30 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#090d16]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Density & Diagnostic Controls
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold">
                  LIVE INSPECTOR
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tune visual clutter, throttle audio triggers, or isolate clean footage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Live Telemetry Bar */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-300">Overlays Active</span>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300">
                {activeOverlaysCount} <span className="text-slate-500 font-normal">/ {totalOverlaysCount}</span>
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300">SFX Nodes</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-300">
                {activeSfxCount} <span className="text-slate-500 font-normal">/ {totalSfxCount}</span>
              </span>
            </div>
          </div>

          {/* Master Isolation Toggles */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Master Layer Isolation Switches
            </h3>

            {/* Master Overlays Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/90 hover:border-slate-700 transition">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg border transition ${
                    masterOverlayVisible
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {masterOverlayVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    Master Visual Overlays
                  </div>
                  <div className="text-xs text-slate-400">
                    {masterOverlayVisible
                      ? 'All graphic overlays, stickers & B-rolls are rendered'
                      : 'All overlays bypassed for clean cut inspection'}
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  setDiagnosticSettings((prev) => ({
                    ...prev,
                    masterOverlayVisible: !prev.masterOverlayVisible,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  masterOverlayVisible ? 'bg-purple-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    masterOverlayVisible ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Master SFX Mute Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-900/50 rounded-xl border border-slate-800/90 hover:border-slate-700 transition">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg border transition ${
                    !masterSfxMuted
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {!masterSfxMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-200">
                    Master SFX Playback
                  </div>
                  <div className="text-xs text-slate-400">
                    {!masterSfxMuted
                      ? 'Sound effects play in live preview sync'
                      : 'All sound effects muted for dialogue pacing verification'}
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  setDiagnosticSettings((prev) => ({
                    ...prev,
                    masterSfxMuted: !prev.masterSfxMuted,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  !masterSfxMuted ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    !masterSfxMuted ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Density & Rate Throttles */}
          <div className="space-y-4 pt-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Density & Rate Limit Controls
            </h3>

            {/* Maximum Active Overlays Limit Slider */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Maximum Simultaneous Overlays
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Limits active stickers on screen at any instant (0 = hide all, 5 = uncapped)
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-purple-950/80 border border-purple-500/50 text-purple-300 font-mono text-xs font-bold">
                  {maxActiveOverlays === 5 ? '5 (Full)' : `${maxActiveOverlays} max`}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-[11px] font-mono text-slate-500">0</span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={maxActiveOverlays}
                  onChange={(e) =>
                    setDiagnosticSettings((prev) => ({
                      ...prev,
                      maxActiveOverlays: Number(e.target.value),
                    }))
                  }
                  className="w-full h-1.5 accent-purple-500 bg-slate-800 rounded appearance-none cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-500">5</span>
              </div>
            </div>

            {/* SFX Throttle Rate Slider */}
            <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    SFX Trigger Throttle Rate
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Minimum delay between SFX fires to prevent audio clutter & distortion
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold">
                    {sfxThrottleIntervalMs}ms
                  </span>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    ~{sfxRatePerSec} SFX/sec max
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-[11px] font-mono text-slate-500">50ms</span>
                <input
                  type="range"
                  min={50}
                  max={1500}
                  step={50}
                  value={sfxThrottleIntervalMs}
                  onChange={(e) =>
                    setDiagnosticSettings((prev) => ({
                      ...prev,
                      sfxThrottleIntervalMs: Number(e.target.value),
                    }))
                  }
                  className="w-full h-1.5 accent-emerald-500 bg-slate-800 rounded appearance-none cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-500">1500ms</span>
              </div>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-400 font-medium">Quick Presets:</span>
            <button
              onClick={handleApplyCleanFootage}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg border border-amber-600/40 transition flex items-center gap-1"
            >
              <EyeOff className="w-3 h-3" />
              Clean Footage Check
            </button>
            <button
              onClick={handleApplyHighEnergy}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg border border-cyan-600/40 transition flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              High Energy
            </button>
            <button
              onClick={handleResetDefaults}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1 ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-[#090d16]">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Settings apply in real time</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
