import React, { useState } from 'react';
import {
  Flame,
  TrendingUp,
  Sparkles,
  Play,
  Check,
  Award,
  ChevronRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  ViralClipSegment,
  VideoClip,
  TranscriptWord,
} from '../../types/timeline';
import { generateViralMoments } from '../../core/ai/viralityScorer';

interface ViralMomentsPanelProps {
  clips: VideoClip[];
  viralMoments: ViralClipSegment[];
  setViralMoments: React.Dispatch<React.SetStateAction<ViralClipSegment[]>>;
  activeMomentId: string | null;
  onSelectMoment: (moment: ViralClipSegment) => void;
  setWords: React.Dispatch<React.SetStateAction<TranscriptWord[]>>;
  setHookTitle: (title: string) => void;
}

export const ViralMomentsPanel: React.FC<ViralMomentsPanelProps> = ({
  clips,
  viralMoments,
  setViralMoments,
  activeMomentId,
  onSelectMoment,
  setWords,
  setHookTitle,
}) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleScanViralMoments = () => {
    if (clips.length === 0) return;
    setIsScanning(true);

    setTimeout(() => {
      const generated = generateViralMoments(clips);
      setViralMoments(generated);
      setIsScanning(false);
      if (generated.length > 0) {
        onSelectMoment(generated[0]);
        setWords(generated[0].words);
        setHookTitle(generated[0].scores.hookTitle);
      }
    }, 500);
  };

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center">
          <Flame className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
          SupoClip Viral Moments
        </span>
        <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
          AI Scored
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        AI scans transcripts, cadence, and hooks to extract the highest-retention short clips (0–100 virality score).
      </p>

      {/* Action Button */}
      <button
        onClick={handleScanViralMoments}
        disabled={isScanning || clips.length === 0}
        className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-rose-500/20 transition active:scale-95"
      >
        <Sparkles className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
        <span>{isScanning ? 'Analyzing Virality Signals...' : 'Scan & Rank Viral Clips'}</span>
      </button>

      {/* Viral Moments List */}
      <div className="space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
        {viralMoments.map((moment, idx) => {
          const isActive = activeMomentId === moment.id;
          const score = moment.scores.overall;

          return (
            <div
              key={moment.id}
              onClick={() => {
                onSelectMoment(moment);
                setWords(moment.words);
                setHookTitle(moment.scores.hookTitle);
              }}
              className={`p-3 rounded-xl border cursor-pointer transition flex flex-col space-y-2.5 ${
                isActive
                  ? 'bg-rose-950/40 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              {/* Header Badge & Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-purple-950 border border-purple-800 text-purple-300">
                    {moment.scores.hookType}
                  </span>
                </div>

                <div className="flex items-center space-x-1 font-mono font-extrabold text-xs">
                  <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span
                    className={
                      score >= 90
                        ? 'text-rose-400'
                        : score >= 80
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }
                  >
                    {score}/100
                  </span>
                </div>
              </div>

              {/* Hook Title Headline */}
              <div className="text-xs font-bold text-slate-100 leading-snug">
                "{moment.scores.hookTitle}"
              </div>

              {/* Sub-Scores Grid */}
              <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-800/80 text-[9px] font-mono text-center">
                <div className="bg-slate-950/80 p-1 rounded">
                  <div className="text-slate-500">HOOK</div>
                  <div className="font-bold text-rose-300">{moment.scores.hook}%</div>
                </div>
                <div className="bg-slate-950/80 p-1 rounded">
                  <div className="text-slate-500">ENGAG</div>
                  <div className="font-bold text-amber-300">{moment.scores.engagement}%</div>
                </div>
                <div className="bg-slate-950/80 p-1 rounded">
                  <div className="text-slate-500">VALUE</div>
                  <div className="font-bold text-emerald-300">{moment.scores.value}%</div>
                </div>
                <div className="bg-slate-950/80 p-1 rounded">
                  <div className="text-slate-500">SHARE</div>
                  <div className="font-bold text-cyan-300">{moment.scores.shareability}%</div>
                </div>
              </div>

              {/* AI Reasoning */}
              <div className="text-[10px] text-slate-400 italic bg-black/30 p-1.5 rounded border border-slate-800/50">
                "{moment.scores.reasoning}"
              </div>

              {/* Active Indicator / Load button */}
              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="font-mono text-slate-400">{moment.duration.toFixed(1)}s duration</span>
                <span
                  className={`font-bold flex items-center space-x-1 ${
                    isActive ? 'text-rose-400' : 'text-slate-500'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Loaded on Timeline</span>
                    </>
                  ) : (
                    <span>Click to Load</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
