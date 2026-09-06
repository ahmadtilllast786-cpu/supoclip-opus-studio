import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Flame,
  Subtitles,
  FolderOpen,
  Smile,
  Scissors,
  Crosshair,
} from 'lucide-react';
import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  CaptionTemplate,
  TranscriptWord,
  ViralClipSegment,
  CaptionTrackItem,
  DiagnosticSettings,
} from './types/timeline';
import { Navbar } from './components/Navbar';
import { CanvasPlayer } from './components/Player/CanvasPlayer';
import { Timeline } from './components/Timeline/Timeline';
import { AssetBin } from './components/Sidebar/AssetBin';
import { StickerStorePanel } from './components/Sidebar/StickerStorePanel';
import { AutoJumpCutPanel } from './components/Sidebar/AutoJumpCutPanel';
import { DynamicZoomPanel } from './components/Sidebar/DynamicZoomPanel';
import { ViralMomentsPanel } from './components/Sidebar/ViralMomentsPanel';
import { CaptionCustomizerPanel } from './components/Sidebar/CaptionCustomizerPanel';
import { PropertyInspector } from './components/Inspector/PropertyInspector';
import { ExportModal } from './components/Modals/ExportModal';
import { DensityDiagnosticPanel } from './components/Modals/DensityDiagnosticPanel';
import { executeAutoViralEdit } from './core/ai/autoEditor';
import { generateDemoVideoClip } from './core/video/demoMediaGenerator';
import { SUPOCLIP_CAPTION_TEMPLATES } from './core/captions/supoClipTemplates';
import { generateViralMoments, generateAdaptiveTranscript } from './core/ai/viralityScorer';
import { autoTranscribeVideoAudio, transcribeContinuousAudio } from './core/ai/captionTranscriber';
import { decodeAudioBuffer, generateWaveformPeaks } from './core/audio/audioAnalyzer';
import {
  groupWordsIntoCaptionChunks,
  createCompoundCaptionTrack,
  syncCompoundCaptionsWithWords,
} from './core/captions/captionHandler';

export function App() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [overlays, setOverlays] = useState<StickerOverlay[]>([]);
  const [zoomKeyframes, setZoomKeyframes] = useState<DynamicZoomKeyframe[]>([]);
  const [sfxTracks, setSfxTracks] = useState<SfxTrackItem[]>([]);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  // SupoClip Captions, Hook Title & Virality State
  const [captionTemplate, setCaptionTemplate] = useState<CaptionTemplate>(
    SUPOCLIP_CAPTION_TEMPLATES.hormozi
  );
  const [hookTitle, setHookTitle] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [words, setWords] = useState<TranscriptWord[]>([]);
  const [captions, setCaptions] = useState<CaptionTrackItem[]>([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('auto');
  const [detectedConfidence, setDetectedConfidence] = useState<number>(0.96);

  const [viralMoments, setViralMoments] = useState<ViralClipSegment[]>([]);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [resolution, setResolution] = useState<'1080x1920' | '2160x3840' | '1080x1080' | '1920x1080'>('1080x1920');
  const [sidebarTab, setSidebarTab] = useState<'moments' | 'captions' | 'assets' | 'stickers' | 'jumpcut' | 'zoom'>('moments');

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [selectedSfxId, setSelectedSfxId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [diagnosticSettings, setDiagnosticSettings] = useState<DiagnosticSettings>({
    maxActiveOverlays: 5,
    sfxThrottleIntervalMs: 200,
    masterOverlayVisible: true,
    masterSfxMuted: false,
  });
  const [isAutoEditing, setIsAutoEditing] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  // Video elements pool for decoding/rendering
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const hiddenVideosContainerRef = useRef<HTMLDivElement>(null);

  // Sync Video DOM elements when clips change
  useEffect(() => {
    const currentMap = videoElementsRef.current;
    const clipIds = new Set(clips.map((c) => c.id));

    // Remove deleted elements
    for (const [id, el] of currentMap.entries()) {
      if (!clipIds.has(id)) {
        el.pause();
        el.src = '';
        el.remove();
        currentMap.delete(id);
      }
    }

    // Add or update elements
    clips.forEach((clip) => {
      let el = currentMap.get(clip.id);
      if (!el) {
        el = document.createElement('video');
        el.src = clip.sourceUrl;
        el.crossOrigin = 'anonymous';
        el.playsInline = true;
        el.preload = 'auto';
        el.muted = false;
        hiddenVideosContainerRef.current?.appendChild(el);
        currentMap.set(clip.id, el);
      }
    });
  }, [clips]);

  // Initial load: automatically load starter demo & pre-calculate viral moments with live captions
  useEffect(() => {
    let isMounted = true;
    const initDemo = async () => {
      try {
        const demoClip = await generateDemoVideoClip('HOOK: Watch This Secret', 6.0, {
          bg: '#140c24',
          accent: '#7c3aed',
          text: '#ec4899',
        });
        if (isMounted) {
          setClips([demoClip]);

          // Auto-transcribe demo clip so captions are live on screen immediately
          let audioBuf = demoClip.audioBuffer;
          if (!audioBuf && demoClip.blob) {
            try {
              audioBuf = await decodeAudioBuffer(demoClip.blob);
              demoClip.audioBuffer = audioBuf;
              demoClip.waveform = generateWaveformPeaks(audioBuf, Math.max(120, Math.floor(demoClip.duration * 50)));
            } catch (e) {
              console.warn('Demo audio decode error:', e);
            }
          }
          if (!audioBuf) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioBuf = ctx.createBuffer(1, Math.max(1, Math.round(demoClip.duration * 44100)), 44100);
          }

          const demoResult = await transcribeContinuousAudio(audioBuf, undefined, 'auto');
          if (isMounted) {
            setWords(demoResult.words);
            if (demoResult.detectedLanguage && demoResult.detectedLanguage !== 'auto') {
              setDetectedLanguage(demoResult.detectedLanguage);
            }
            if (demoResult.confidence) {
              setDetectedConfidence(demoResult.confidence);
            }
            const compoundCaptions = createCompoundCaptionTrack(demoResult.words, {
              detectedLanguage: demoResult.detectedLanguage || 'auto',
              id: 'caption-master-1',
            });
            setCaptions(compoundCaptions);
            setShowCaptions(true);
            const moments = generateViralMoments([demoClip], 30, demoResult.words);
            setViralMoments(moments);
            if (moments.length > 0) {
              setActiveMomentId(moments[0].id);
              setHookTitle(moments[0].scores.hookTitle);
            }
          }
        }
      } catch (e) {
        console.warn('Initial demo clip generation skipped:', e);
      }
    };
    initDemo();
    return () => {
      isMounted = false;
    };
  }, []);

  // Total duration of current sequence
  const totalDuration = clips.reduce((acc, c) => Math.max(acc, c.startTimelineTime + c.duration), 0);

  // Add Clip sequentially to timeline and AUTO-TRANSCRIBE audio for live screen captions!
  const handleAddClip = useCallback(async (newClip: VideoClip) => {
    let clipStart = 0;
    let isReplacingDemo = false;

    setClips((prev) => {
      // If only the starter demo clip is present, replace it with the uploaded clip
      isReplacingDemo = prev.length === 1 && prev[0].id.startsWith('clip-demo-');
      if (isReplacingDemo) {
        clipStart = 0;
        return [{ ...newClip, startTimelineTime: 0 }];
      }
      const lastClip = prev[prev.length - 1];
      clipStart = lastClip ? lastClip.startTimelineTime + lastClip.duration : 0;
      return [...prev, { ...newClip, startTimelineTime: clipStart }];
    });

    // Auto transcribe video audio immediately without manual intervention
    try {
      let buffer = newClip.audioBuffer;
      if (!buffer) {
        if (newClip.blob) {
          try {
            buffer = await decodeAudioBuffer(newClip.blob);
          } catch (e) {
            console.warn('Decode audio failed for clip:', e);
          }
        } else if (newClip.sourceUrl) {
          try {
            const resp = await fetch(newClip.sourceUrl);
            const arrayBuf = await resp.arrayBuffer();
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            buffer = await ctx.decodeAudioData(arrayBuf);
          } catch (e) {
            console.warn('Fetch audio failed for clip:', e);
          }
        }
      }

      if (!buffer) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        buffer = ctx.createBuffer(1, Math.max(1, Math.round((newClip.duration || 5) * 44100)), 44100);
      }

      const result = await transcribeContinuousAudio(buffer, undefined, detectedLanguage);
      if (result.detectedLanguage && result.detectedLanguage !== 'auto') {
        setDetectedLanguage(result.detectedLanguage);
      }
      if (result.confidence) {
        setDetectedConfidence(result.confidence);
      }
      const generatedWords = result.words;
      if (generatedWords.length > 0) {
        setShowCaptions(true);
        setWords((prevWords) => {
          const offset = isReplacingDemo ? 0 : clipStart;
          const adjustedWords = offset > 0
            ? generatedWords.map((w) => ({
                ...w,
                start: Number((w.start + offset).toFixed(2)),
                end: Number((w.end + offset).toFixed(2)),
              }))
            : generatedWords;

          const combined = !isReplacingDemo && offset > 0 && prevWords.length > 0
            ? [...prevWords, ...adjustedWords].sort((a, b) => a.start - b.start)
            : adjustedWords;

          const compound = createCompoundCaptionTrack(combined, {
            detectedLanguage: result.detectedLanguage || detectedLanguage || 'auto',
            id: isReplacingDemo ? 'caption-master-1' : `caption-${Date.now()}`,
          });
          setCaptions(compound);

          setClips((currentClips) => {
            const moments = generateViralMoments(currentClips, 30, combined);
            setViralMoments(moments);
            if (moments.length > 0) {
              setHookTitle(moments[0].scores.hookTitle);
            }
            return currentClips;
          });

          return combined;
        });
      }
    } catch (err: any) {
      console.warn('Auto-transcribe on clip upload error:', err);
      setTranscriptionError(err?.message || 'Automatic Speech-to-Text failed to transcribe the clip audio.');
    }
  }, []);

  // Add Sticker with Paired SFX
  const handleAddOverlayAndSfx = useCallback((overlay: StickerOverlay, sfx: SfxTrackItem) => {
    setOverlays((prev) => [...prev, overlay]);
    setSfxTracks((prev) => [...prev, sfx]);
    setSelectedOverlayId(overlay.id);
  }, []);

  // Update Overlay Position
  const handleUpdateOverlayPos = useCallback((id: string, x: number, y: number) => {
    setOverlays((prev) => prev.map((ov) => (ov.id === id ? { ...ov, x, y } : ov)));
  }, []);

  // Update Overlay Scale
  const handleUpdateOverlayScale = useCallback((id: string, scale: number) => {
    setOverlays((prev) => prev.map((ov) => (ov.id === id ? { ...ov, scale } : ov)));
  }, []);

  // 1-Click Purge all Overlays & SFX clutter
  const handlePurgeOverlaysAndSfx = useCallback(() => {
    setOverlays([]);
    setSfxTracks([]);
    setSelectedOverlayId(null);
    setSelectedSfxId(null);
  }, []);

  // 1-Click Punch Zoom at playhead
  const handleAddPunchZoom = useCallback(() => {
    const newKf: DynamicZoomKeyframe = {
      id: `kf-${Date.now()}`,
      startTimelineTime: currentTime,
      duration: 2.0,
      scale: 1.25,
      centerX: 0.5,
      centerY: 0.45,
      style: 'snappy',
    };
    setZoomKeyframes((prev) => [...prev, newKf]);
  }, [currentTime]);

  // Execute Autonomous "Opus Clip / SupoClip" Auto-Edit
  const handleAutoEdit = useCallback(() => {
    if (clips.length === 0) return;
    setIsAutoEditing(true);

    setTimeout(() => {
      const result = executeAutoViralEdit(clips);
      setClips(result.clips);
      setOverlays(result.overlays);
      setZoomKeyframes(result.zoomKeyframes);
      setSfxTracks(result.sfxTracks);
      setIsAutoEditing(false);
      setCurrentTime(0);

      // Re-scan viral moments
      const moments = generateViralMoments(result.clips);
      setViralMoments(moments);
      if (moments.length > 0) {
        setActiveMomentId(moments[0].id);
        setHookTitle(moments[0].scores.hookTitle);
      }
    }, 600);
  }, [clips]);

  // Load a selected viral moment
  const handleSelectViralMoment = useCallback((moment: ViralClipSegment) => {
    setActiveMomentId(moment.id);
    setHookTitle(moment.scores.hookTitle);
    setWords(moment.words);
    const compound = createCompoundCaptionTrack(moment.words, { detectedLanguage });
    setCaptions(compound);
    setCurrentTime(0);
  }, [detectedLanguage]);

  // Selected Clip, Overlay, and SFX objects
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) || null;
  const selectedSfx = sfxTracks.find((s) => s.id === selectedSfxId) || null;

  // Active virality score
  const activeViralityScore =
    viralMoments.find((m) => m.id === activeMomentId)?.scores.overall || 96;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07090e] text-slate-100 overflow-hidden font-sans select-none">
      {/* Offscreen container for active decoding and preloading of video frames */}
      <div
        ref={hiddenVideosContainerRef}
        style={{
          position: 'fixed',
          top: '-99999px',
          left: '-99999px',
          width: '2px',
          height: '2px',
          opacity: 0.001,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      />

      {/* Top Navbar */}
      <Navbar
        resolution={resolution}
        setResolution={setResolution}
        onAutoEdit={handleAutoEdit}
        onOpenExport={() => setIsExportModalOpen(true)}
        isAutoEditing={isAutoEditing}
        activeClipCount={clips.length}
        activeViralityScore={activeViralityScore}
      />

      {/* Explicit STT Pipeline / Audio Extraction Error Notice */}
      {transcriptionError && (
        <div className="bg-rose-950/90 border-b border-rose-600/80 px-4 py-2 text-xs flex items-center justify-between text-rose-200 z-50 animate-in fade-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-400">⚠️ STT Pipeline Notice:</span>
            <span>{transcriptionError}</span>
          </div>
          <button
            onClick={() => setTranscriptionError(null)}
            className="text-rose-300 hover:text-white px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Center Work Area: Left Sidebar, Canvas Player, Right Property Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-84 bg-[#0c1018] border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-6 border-b border-slate-800 bg-[#0f1420] text-xs font-semibold">
            {/* 1. SupoClip Viral Moments */}
            <button
              onClick={() => setSidebarTab('moments')}
              className={`py-2.5 flex flex-col items-center justify-center border-b-2 transition ${
                sidebarTab === 'moments'
                  ? 'border-rose-500 text-rose-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="SupoClip Viral Moments & Scores"
            >
              <Flame className="w-4 h-4 mb-0.5" />
              <span className="text-[9px]">Moments</span>
            </button>

            {/* 2. SupoClip Captions & Templates */}
            <button
              onClick={() => setSidebarTab('captions')}
              className={`py-2.5 flex flex-col items-center justify-center border-b-2 transition ${
                sidebarTab === 'captions'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="SupoClip 7 Caption Templates & Hook Titles"
            >
              <Subtitles className="w-4 h-4 mb-0.5" />
              <span className="text-[9px]">Captions</span>
            </button>

            {/* 3. Assets Bin */}
            <button
              onClick={() => setSidebarTab('assets')}
              className={`py-2.5 flex flex-col items-center justify-center border-b-2 transition ${
                sidebarTab === 'assets'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Raw Footage & Media Bin"
            >
              <FolderOpen className="w-4 h-4 mb-0.5" />
              <span className="text-[9px]">Assets</span>
            </button>

            {/* 4. Stickers & Synced SFX */}
            <button
              onClick={() => setSidebarTab('stickers')}
              className={`py-2.5 flex flex-col items-center justify-center border-b-2 transition ${
                sidebarTab === 'stickers'
                  ? 'border-pink-500 text-pink-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Viral Stickers & Synced SFX"
            >
              <Smile className="w-4 h-4 mb-0.5" />
              <span className="text-[9px]">Stickers</span>
            </button>

            {/* 5. Auto Jump-Cut */}
            <button
              onClick={() => setSidebarTab('jumpcut')}
              className={`py-2.5 flex flex-col items-center justify-center border-b-2 transition ${
                sidebarTab === 'jumpcut'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Automated Jump-Cuts & Silences"
            >
              <Scissors className="w-4 h-4 mb-0.5" />
              <span className="text-[9px]">Jump-Cut</span>
            </button>

            {/* 6. Dynamic Zooms */}
            <button
              onClick={() => setSidebarTab('zoom')}
              className={`py-2.5 flex flex-col items-center justify-center border-b-2 transition ${
                sidebarTab === 'zoom'
                  ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              title="Dynamic Punch Zooms"
            >
              <Crosshair className="w-4 h-4 mb-0.5" />
              <span className="text-[9px]">Zooms</span>
            </button>
          </div>

          {/* Sidebar Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'moments' && (
              <ViralMomentsPanel
                clips={clips}
                viralMoments={viralMoments}
                setViralMoments={setViralMoments}
                activeMomentId={activeMomentId}
                onSelectMoment={handleSelectViralMoment}
                setWords={setWords}
                setHookTitle={(t) => setHookTitle(t)}
              />
            )}
            {sidebarTab === 'captions' && (
              <CaptionCustomizerPanel
                template={captionTemplate}
                setTemplate={setCaptionTemplate}
                hookTitle={hookTitle}
                setHookTitle={setHookTitle}
                showCaptions={showCaptions}
                setShowCaptions={setShowCaptions}
                words={words}
                setWords={setWords}
                captions={captions}
                setCaptions={setCaptions}
                detectedLanguage={detectedLanguage}
                setDetectedLanguage={setDetectedLanguage}
                detectedConfidence={detectedConfidence}
                setDetectedConfidence={setDetectedConfidence}
                currentTime={currentTime}
                onSeek={(t) => setCurrentTime(t)}
                clips={clips}
                totalDuration={totalDuration}
              />
            )}
            {sidebarTab === 'assets' && (
              <AssetBin
                onAddClip={handleAddClip}
                isLoadingDemo={isLoadingDemo}
                setIsLoadingDemo={setIsLoadingDemo}
              />
            )}
            {sidebarTab === 'stickers' && (
              <StickerStorePanel
                currentTime={currentTime}
                onAddOverlayAndSfx={handleAddOverlayAndSfx}
              />
            )}
            {sidebarTab === 'jumpcut' && (
              <AutoJumpCutPanel
                clips={clips}
                setClips={setClips}
              />
            )}
            {sidebarTab === 'zoom' && (
              <DynamicZoomPanel
                currentTime={currentTime}
                totalDuration={totalDuration}
                zoomKeyframes={zoomKeyframes}
                setZoomKeyframes={setZoomKeyframes}
              />
            )}
          </div>
        </aside>

        {/* Center Canvas Player */}
        <CanvasPlayer
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          clips={clips}
          overlays={overlays}
          zoomKeyframes={zoomKeyframes}
          sfxTracks={sfxTracks}
          videoElements={videoElementsRef.current}
          resolution={resolution}
          onSelectOverlay={(id) => {
            setSelectedOverlayId(id);
            setSelectedClipId(null);
          }}
          selectedOverlayId={selectedOverlayId}
          onUpdateOverlayPos={handleUpdateOverlayPos}
          onUpdateOverlayScale={handleUpdateOverlayScale}
          diagnosticSettings={diagnosticSettings}
          onUpdateCaptionPosition={(x, y) =>
            setCaptionTemplate((prev) => ({ ...prev, position_x: x, position_y: y }))
          }
          words={showCaptions ? words : []}
          captionTemplate={captionTemplate}
          hookTitle={hookTitle}
        />

        {/* Right Property Inspector */}
        <PropertyInspector
          selectedClip={selectedClip}
          onUpdateClip={(updated) =>
            setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
          }
          onDeleteClip={(id) => {
            setClips((prev) => {
              const filtered = prev.filter((c) => c.id !== id);
              let curTime = 0;
              return filtered.map((c) => {
                const item = { ...c, startTimelineTime: curTime };
                curTime += c.duration;
                return item;
              });
            });
            setSelectedClipId(null);
          }}
          selectedOverlay={selectedOverlay}
          onUpdateOverlay={(updated) =>
            setOverlays((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
          }
          onDeleteOverlay={(id) => {
            setOverlays((prev) => prev.filter((o) => o.id !== id));
            setSfxTracks((prev) => prev.filter((s) => s.linkedOverlayId !== id));
            setSelectedOverlayId(null);
          }}
          selectedSfx={selectedSfx}
          onDeleteSfx={(id) => {
            setSfxTracks((prev) => prev.filter((s) => s.id !== id));
            setSelectedSfxId(null);
          }}
          sfxTracks={sfxTracks}
          onUpdateSfx={(updated) =>
            setSfxTracks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          }
          totalDuration={totalDuration}
          clipCount={clips.length}
          resolution={resolution}
          captionTemplate={captionTemplate}
          onUpdateCaptionTemplate={setCaptionTemplate}
        />
      </div>

      {/* Bottom Multi-Track Timeline */}
      <Timeline
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        clips={clips}
        setClips={setClips}
        overlays={overlays}
        setOverlays={setOverlays}
        zoomKeyframes={zoomKeyframes}
        setZoomKeyframes={setZoomKeyframes}
        sfxTracks={sfxTracks}
        setSfxTracks={setSfxTracks}
        captions={captions}
        setCaptions={setCaptions}
        selectedCaptionId={selectedCaptionId}
        setSelectedCaptionId={(id) => {
          setSelectedCaptionId(id);
          if (id) {
            setSelectedClipId(null);
            setSelectedOverlayId(null);
            setSelectedSfxId(null);
          }
        }}
        words={words}
        setWords={setWords}
        detectedLanguage={detectedLanguage}
        selectedClipId={selectedClipId}
        setSelectedClipId={(id) => {
          setSelectedClipId(id);
          if (id) {
            setSelectedOverlayId(null);
            setSelectedSfxId(null);
            setSelectedCaptionId(null);
          }
        }}
        selectedOverlayId={selectedOverlayId}
        setSelectedOverlayId={(id) => {
          setSelectedOverlayId(id);
          if (id) {
            setSelectedClipId(null);
            setSelectedSfxId(null);
            setSelectedCaptionId(null);
          }
        }}
        selectedSfxId={selectedSfxId}
        setSelectedSfxId={(id) => {
          setSelectedSfxId(id);
          if (id) {
            setSelectedClipId(null);
            setSelectedOverlayId(null);
            setSelectedCaptionId(null);
          }
        }}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        onAddPunchZoom={handleAddPunchZoom}
        onOpenDiagnostics={() => setIsDiagnosticModalOpen(true)}
        diagnosticSettings={diagnosticSettings}
        onPurgeOverlaysAndSfx={handlePurgeOverlaysAndSfx}
        masterOverlayVisible={diagnosticSettings.masterOverlayVisible}
        onToggleMasterOverlay={() =>
          setDiagnosticSettings((prev) => ({
            ...prev,
            masterOverlayVisible: !prev.masterOverlayVisible,
          }))
        }
        masterSfxMuted={diagnosticSettings.masterSfxMuted}
        onToggleMasterSfx={() =>
          setDiagnosticSettings((prev) => ({
            ...prev,
            masterSfxMuted: !prev.masterSfxMuted,
          }))
        }
      />

      {/* Lossless / High-Bitrate Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        clips={clips}
        overlays={overlays}
        zoomKeyframes={zoomKeyframes}
        sfxTracks={sfxTracks}
        videoElements={videoElementsRef.current}
        currentResolution={resolution}
        words={showCaptions ? words : []}
        captionTemplate={captionTemplate}
        hookTitle={hookTitle}
      />

      {/* Density & Diagnostics Control Modal */}
      <DensityDiagnosticPanel
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        diagnosticSettings={diagnosticSettings}
        setDiagnosticSettings={setDiagnosticSettings}
        activeOverlaysCount={
          overlays.filter(
            (ov) =>
              !ov.isDisabled &&
              currentTime >= ov.startTimelineTime &&
              currentTime < ov.startTimelineTime + ov.duration
          ).length
        }
        totalOverlaysCount={overlays.length}
        activeSfxCount={
          sfxTracks.filter(
            (sfx) =>
              !sfx.isMuted &&
              currentTime >= sfx.startTimelineTime &&
              currentTime < sfx.startTimelineTime + sfx.duration
          ).length
        }
        totalSfxCount={sfxTracks.length}
      />
    </div>
  );
}

export default App;
