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
} from './types/timeline';
import { Navbar } from './components/Navbar';
import { CanvasPlayer } from './components/Player/CanvasPlayer';
import { Timeline } from './components/Timeline/Timeline';
import { AssetBin } from './components/Sidebar/AssetBin';
import { StickerLibrary } from './components/Sidebar/StickerLibrary';
import { AutoJumpCutPanel } from './components/Sidebar/AutoJumpCutPanel';
import { DynamicZoomPanel } from './components/Sidebar/DynamicZoomPanel';
import { ViralMomentsPanel } from './components/Sidebar/ViralMomentsPanel';
import { CaptionCustomizerPanel } from './components/Sidebar/CaptionCustomizerPanel';
import { PropertyInspector } from './components/Inspector/PropertyInspector';
import { ExportModal } from './components/Modals/ExportModal';
import { executeAutoViralEdit } from './core/ai/autoEditor';
import { generateDemoVideoClip } from './core/video/demoMediaGenerator';
import { SUPOCLIP_CAPTION_TEMPLATES } from './core/captions/supoClipTemplates';
import { generateViralMoments, generateAdaptiveTranscript } from './core/ai/viralityScorer';

export function App() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [overlays, setOverlays] = useState<StickerOverlay[]>([]);
  const [zoomKeyframes, setZoomKeyframes] = useState<DynamicZoomKeyframe[]>([]);
  const [sfxTracks, setSfxTracks] = useState<SfxTrackItem[]>([]);

  // SupoClip Captions, Hook Title & Virality State
  const [captionTemplate, setCaptionTemplate] = useState<CaptionTemplate>(
    SUPOCLIP_CAPTION_TEMPLATES.hormozi
  );
  const [hookTitle, setHookTitle] = useState<string | null>(
    'THE #1 SECRET NOBODY TELLS YOU'
  );
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [words, setWords] = useState<TranscriptWord[]>([
    { word: 'STOP', start: 0.2, end: 0.6, isEmphasis: true, emoji: '🛑' },
    { word: 'scrolling', start: 0.6, end: 1.0 },
    { word: 'right', start: 1.0, end: 1.25 },
    { word: 'now', start: 1.25, end: 1.5, isEmphasis: true },
    { word: 'because', start: 1.6, end: 1.9 },
    { word: 'this', start: 1.9, end: 2.1 },
    { word: 'INSANE', start: 2.1, end: 2.6, isEmphasis: true, emoji: '🔥' },
    { word: 'strategy', start: 2.6, end: 3.0 },
    { word: 'will', start: 3.1, end: 3.3 },
    { word: 'change', start: 3.3, end: 3.6 },
    { word: 'everything.', start: 3.6, end: 4.1, isEmphasis: true, emoji: '🚀' },
    { word: 'Watch', start: 4.2, end: 4.6 },
    { word: 'how', start: 4.6, end: 4.8 },
    { word: 'fast', start: 4.8, end: 5.1 },
    { word: 'AI', start: 5.1, end: 5.4, isEmphasis: true },
    { word: 'edits.', start: 5.4, end: 5.8 },
  ]);

  const [viralMoments, setViralMoments] = useState<ViralClipSegment[]>([]);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [resolution, setResolution] = useState<'1080x1920' | '2160x3840' | '1080x1080' | '1920x1080'>('1080x1920');
  const [sidebarTab, setSidebarTab] = useState<'moments' | 'captions' | 'assets' | 'stickers' | 'jumpcut' | 'zoom'>('moments');

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
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

  // Initial load: automatically load starter demo & pre-calculate viral moments
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
          const moments = generateViralMoments([demoClip]);
          setViralMoments(moments);
          if (moments.length > 0) {
            setActiveMomentId(moments[0].id);
            setHookTitle(moments[0].scores.hookTitle);
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

  // Add Clip sequentially to timeline and auto-align captions across full duration
  const handleAddClip = useCallback((newClip: VideoClip) => {
    setClips((prev) => {
      const lastClip = prev[prev.length - 1];
      const startTimelineTime = lastClip ? lastClip.startTimelineTime + lastClip.duration : 0;
      const updated = [...prev, { ...newClip, startTimelineTime }];

      // Adapt captions to match new total sequence duration
      const totalDur = updated.reduce((sum, c) => sum + c.duration, 0);
      setWords((prevWords) => {
        if (prevWords.length === 0 || prevWords[prevWords.length - 1].end < totalDur - 1.5) {
          return generateAdaptiveTranscript(totalDur);
        }
        return prevWords;
      });

      // Recalculate viral moments
      const moments = generateViralMoments(updated);
      setViralMoments(moments);
      if (moments.length > 0 && !activeMomentId) {
        setActiveMomentId(moments[0].id);
        setHookTitle(moments[0].scores.hookTitle);
      }

      return updated;
    });
  }, [activeMomentId]);

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
    setCurrentTime(0);
  }, []);

  // Selected Clip and Overlay objects
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) || null;

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
                currentTime={currentTime}
                onSeek={(t) => setCurrentTime(t)}
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
              <StickerLibrary
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
          sfxTracks={sfxTracks}
          onUpdateSfx={(updated) =>
            setSfxTracks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
          }
          totalDuration={totalDuration}
          clipCount={clips.length}
          resolution={resolution}
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
        selectedClipId={selectedClipId}
        setSelectedClipId={setSelectedClipId}
        selectedOverlayId={selectedOverlayId}
        setSelectedOverlayId={setSelectedOverlayId}
        onAddPunchZoom={handleAddPunchZoom}
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
    </div>
  );
}

export default App;
