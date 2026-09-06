import React, { useRef } from 'react';
import { UploadCloud, Film, PlayCircle, Plus, Sparkles, Music } from 'lucide-react';
import { VideoClip } from '../../types/timeline';
import { generateDemoVideoClip } from '../../core/video/demoMediaGenerator';
import { decodeAudioBuffer, generateWaveformPeaks } from '../../core/audio/audioAnalyzer';

interface AssetBinProps {
  onAddClip: (clip: VideoClip) => void;
  isLoadingDemo: boolean;
  setIsLoadingDemo: (loading: boolean) => void;
}

export const AssetBin: React.FC<AssetBinProps> = ({
  onAddClip,
  isLoadingDemo,
  setIsLoadingDemo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sourceUrl = URL.createObjectURL(file);

      // Probe duration and audio
      const video = document.createElement('video');
      video.src = sourceUrl;
      video.preload = 'metadata';

      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        video.onerror = resolve;
      });

      const duration = video.duration || 5;

      // Extract waveform
      let waveform: number[] = [];
      try {
        const audioBuffer = await decodeAudioBuffer(file);
        waveform = generateWaveformPeaks(audioBuffer, 60);
      } catch {
        // Fallback waveform if no audio track
        waveform = Array.from({ length: 40 }, () => 0.2 + Math.random() * 0.6);
      }

      const newClip: VideoClip = {
        id: `clip-${Date.now()}-${i}`,
        name: file.name,
        sourceUrl,
        blob: file,
        originalDuration: duration,
        inPoint: 0,
        outPoint: duration,
        duration: duration,
        startTimelineTime: 0,
        speed: 1.0,
        volume: 1.0,
        zoomScale: 1.0,
        zoomCenter: { x: 0.5, y: 0.45 },
        transitionIn: 'whip-pan',
        transitionDuration: 0.25,
        waveform,
      };

      onAddClip(newClip);
    }
  };

  const handleLoadDemoBundle = async () => {
    setIsLoadingDemo(true);
    try {
      const clip1 = await generateDemoVideoClip('HOOK: Stop Scrolling', 4.5, {
        bg: '#1e1035',
        accent: '#9333ea',
        text: '#ec4899',
      });
      const clip2 = await generateDemoVideoClip('BODY: The Secret Strategy', 5.0, {
        bg: '#0f172a',
        accent: '#3b82f6',
        text: '#06b6d4',
      });
      const clip3 = await generateDemoVideoClip('CTA: Follow For More', 3.5, {
        bg: '#1a0b16',
        accent: '#f43f5e',
        text: '#facc15',
      });

      onAddClip(clip1);
      onAddClip(clip2);
      onAddClip(clip3);
    } catch (err) {
      console.error('Failed to load demo clips:', err);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  return (
    <div className="p-3 space-y-4">
      {/* Upload Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500 rounded-xl p-4 text-center bg-slate-900/60 hover:bg-slate-900 cursor-pointer transition group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="w-10 h-10 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 flex items-center justify-center mb-2 transition">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div className="text-xs font-bold text-slate-200">Upload Raw Footage or Audio</div>
        <div className="text-[10px] text-slate-400 mt-0.5">MP4, MOV, WebM, MP3</div>
      </div>

      {/* 1-Click High-Energy Demo Loader */}
      <button
        onClick={handleLoadDemoBundle}
        disabled={isLoadingDemo}
        className="w-full bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 hover:border-indigo-400 text-indigo-300 text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition shadow-sm"
      >
        <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isLoadingDemo ? 'animate-spin' : ''}`} />
        <span>{isLoadingDemo ? 'Generating 60fps Demo Clips...' : 'Load 3x Viral Demo Clips'}</span>
      </button>

      <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/80">
        <div className="font-bold text-slate-300 flex items-center space-x-1">
          <Film className="w-3.5 h-3.5 text-pink-400" />
          <span>Sequential Multi-Clip Engine</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Clips automatically arrange sequentially on the video track. Slicing with the split tool or silence scanner preserves seamless transitions.
        </p>
      </div>
    </div>
  );
};
