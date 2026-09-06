import React, { useState } from 'react';
import {
  X,
  Download,
  Terminal,
  Check,
  Copy,
  Sparkles,
  Cpu,
  Film,
  HardDrive,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  TranscriptWord,
  CaptionTemplate,
} from '../../types/timeline';
import { renderAndExportMp4, ExportProgress } from '../../core/export/webCodecsExporter';
import { generateFfmpegScript } from '../../core/export/ffmpegCliExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: VideoClip[];
  overlays: StickerOverlay[];
  zoomKeyframes: DynamicZoomKeyframe[];
  sfxTracks: SfxTrackItem[];
  videoElements: Map<string, HTMLVideoElement>;
  currentResolution: string;
  words?: TranscriptWord[];
  captionTemplate?: CaptionTemplate;
  hookTitle?: string | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  clips,
  overlays,
  zoomKeyframes,
  sfxTracks,
  videoElements,
  currentResolution,
  words,
  captionTemplate,
  hookTitle,
}) => {
  const [tab, setTab] = useState<'webcodecs' | 'ffmpeg'>('webcodecs');
  const [resolution, setResolution] = useState<'1080x1920' | '2160x3840'>(
    currentResolution === '2160x3840' ? '2160x3840' : '1080x1920'
  );
  const [fps, setFps] = useState<30 | 60>(60);
  const [bitrateMbps, setBitrateMbps] = useState<number>(35); // 35 Mbps for CRF 18 equivalent
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const [width, height] = resolution.split('x').map(Number);
  const { command, script } = generateFfmpegScript(clips, overlays, width, height, fps, 18);

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress({
      currentFrame: 0,
      totalFrames: 100,
      progressPercent: 0,
      statusText: 'Initializing deterministic frame rendering pipeline...',
    });

    try {
      const blob = await renderAndExportMp4({
        clips,
        overlays,
        zoomKeyframes,
        sfxTracks,
        videoElements,
        width,
        height,
        fps,
        bitrateMbps,
        words,
        captionTemplate,
        hookTitle,
        onProgress: (p) => setProgress(p),
      });

      // Trigger celebration confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      // Download MP4 blob
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autocut_viral_${resolution}_${fps}fps_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `render_lossless_ffmpeg.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e131d] border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Lossless High-Bitrate Export</h3>
              <p className="text-[10px] text-slate-400">Pristine 1080p/4K Frame-Accurate Video Pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setTab('webcodecs')}
            className={`py-3 flex items-center justify-center space-x-2 border-b-2 transition ${
              tab === 'webcodecs'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>In-Browser MP4 (WebCodecs)</span>
          </button>

          <button
            onClick={() => setTab('ffmpeg')}
            className={`py-3 flex items-center justify-center space-x-2 border-b-2 transition ${
              tab === 'ffmpeg'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Desktop Native FFmpeg (CRF 18)</span>
          </button>
        </div>

        {/* Tab 1: WebCodecs + MP4 Muxer */}
        {tab === 'webcodecs' && (
          <div className="p-5 space-y-4">
            {/* Resolution & FPS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Target Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="1080x1920">1080x1920 (FHD 9:16 Shorts)</option>
                  <option value="2160x3840">2160x3840 (4K UHD 9:16)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Frame Rate</label>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value) as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value={60}>60 FPS (Ultra Smooth)</option>
                  <option value={30}>30 FPS (Standard)</option>
                </select>
              </div>
            </div>

            {/* Bitrate Slider */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="font-bold">Target Bitrate (CRF 18 Equiv.)</span>
                <span className="font-mono text-emerald-400 font-bold">{bitrateMbps} Mbps</span>
              </div>
              <input
                type="range"
                min="15"
                max="50"
                step="5"
                value={bitrateMbps}
                onChange={(e) => setBitrateMbps(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>15 Mbps (High)</span>
                <span>35 Mbps (Visually Lossless)</span>
                <span>50 Mbps (Master 4K)</span>
              </div>
            </div>

            {/* Progress Display */}
            {isExporting && progress && (
              <div className="space-y-2 bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-emerald-400">Rendering & Muxing MP4...</span>
                  <span className="font-mono text-white">{progress.progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${progress.progressPercent}%` }}
                    className="h-full bg-emerald-500 transition-all duration-150"
                  />
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{progress.statusText}</div>
              </div>
            )}

            {/* Action Trigger */}
            <button
              onClick={handleStartExport}
              disabled={isExporting}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Encoding Video...' : 'Start Lossless In-Browser Render'}</span>
            </button>
          </div>
        )}

        {/* Tab 2: Desktop Native FFmpeg */}
        {tab === 'ffmpeg' && (
          <div className="p-5 space-y-4">
            <div className="text-xs text-slate-300 leading-relaxed">
              For 100% bit-exact desktop encoding with native NVIDIA NVENC or libx264 CRF 18, execute this command directly in your command line or run the generated script:
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-36">
              {command}
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleCopyCli}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy FFmpeg Command'}</span>
              </button>

              <button
                onClick={handleDownloadScript}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center space-x-2 transition"
              >
                <Terminal className="w-4 h-4" />
                <span>Download .BAT Script</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
