import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Search,
  Check,
  FolderOpen,
  Trash2,
  Clock,
  Layers,
} from 'lucide-react';
import { VideoClip, MediaAsset } from '../../types/timeline';
import { generateDemoVideoClip } from '../../core/video/demoMediaGenerator';
import { decodeAudioBuffer, generateWaveformPeaks } from '../../core/audio/audioAnalyzer';

interface AssetBinProps {
  onAddClip: (clip: VideoClip) => void;
  isLoadingDemo: boolean;
  setIsLoadingDemo: (loading: boolean) => void;
  mediaAssets: MediaAsset[];
  onAddAssetToBin: (asset: MediaAsset) => void;
  onRemoveAssetFromBin?: (id: string) => void;
  currentTime?: number;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec: number): string {
  if (isNaN(sec) || sec <= 0) return '0.0s';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${sec.toFixed(1)}s`;
}

export const AssetBin: React.FC<AssetBinProps> = ({
  onAddClip,
  isLoadingDemo,
  setIsLoadingDemo,
  mediaAssets = [],
  onAddAssetToBin,
  onRemoveAssetFromBin,
  currentTime = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'video' | 'image'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedAssetId, setAddedAssetId] = useState<string | null>(null);

  const captureVideoThumbnail = async (video: HTMLVideoElement): Promise<string | undefined> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(320, video.videoWidth || 320);
      canvas.height = Math.min(180, video.videoHeight || 180);
      const ctx = canvas.getContext('2d');
      if (ctx && (video.readyState >= 2 || video.videoWidth > 0)) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    } catch {
      // ignore
    }
    return undefined;
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        const sourceUrl = URL.createObjectURL(file);

        if (isImage) {
          // Photo / Image Ingestion Pipeline
          const img = new Image();
          img.src = sourceUrl;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 1500);
          });

          const asset: MediaAsset = {
            id: `asset-img-${Date.now()}-${i}`,
            name: file.name,
            type: 'image',
            sourceUrl,
            blob: file,
            thumbnailUrl: sourceUrl,
            duration: 3.0, // Default 3.0 seconds duration for photos
            width: img.naturalWidth || 1080,
            height: img.naturalHeight || 1920,
            fileSize: formatFileSize(file.size),
          };

          onAddAssetToBin(asset);

          // Auto add clip to timeline
          const photoClip: VideoClip = {
            id: `clip-img-${Date.now()}-${i}`,
            name: file.name,
            mediaType: 'image',
            trackId: 'v1',
            sourceUrl,
            blob: file,
            thumbnailUrl: sourceUrl,
            originalDuration: 60, // images have unconstrained duration
            inPoint: 0,
            outPoint: 3.0,
            duration: 3.0, // default 3.0s
            startTimelineTime: 0,
            speed: 1.0,
            volume: 0,
            isMuted: true,
            zoomScale: 1.0,
            zoomCenter: { x: 0.5, y: 0.5 },
            transitionIn: 'none',
            transitionDuration: 0.25,
          };

          onAddClip(photoClip);
        } else {
          // Video Ingestion Pipeline
          const video = document.createElement('video');
          video.src = sourceUrl;
          video.preload = 'metadata';
          video.crossOrigin = 'anonymous';

          await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
            video.onerror = resolve;
            setTimeout(resolve, 2500);
          });

          const duration = video.duration && !isNaN(video.duration) ? video.duration : 5;
          const thumbnail = await captureVideoThumbnail(video);

          // Extract waveform and audio buffer
          let waveform: number[] = [];
          let decodedBuffer: AudioBuffer | undefined;
          try {
            decodedBuffer = await decodeAudioBuffer(file);
            waveform = generateWaveformPeaks(decodedBuffer, Math.max(100, Math.floor(duration * 50)));
          } catch {
            waveform = Array.from({ length: 80 }, () => 0.02);
          }

          const asset: MediaAsset = {
            id: `asset-vid-${Date.now()}-${i}`,
            name: file.name,
            type: 'video',
            sourceUrl,
            blob: file,
            thumbnailUrl: thumbnail || sourceUrl,
            duration,
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
            fileSize: formatFileSize(file.size),
            waveform,
            audioBuffer: decodedBuffer,
          };

          onAddAssetToBin(asset);

          const videoClip: VideoClip = {
            id: `clip-${Date.now()}-${i}`,
            name: file.name,
            mediaType: 'video',
            trackId: 'v1',
            sourceUrl,
            blob: file,
            thumbnailUrl: thumbnail || sourceUrl,
            originalDuration: duration,
            inPoint: 0,
            outPoint: duration,
            duration,
            startTimelineTime: 0,
            speed: 1.0,
            volume: 1.0,
            zoomScale: 1.0,
            zoomCenter: { x: 0.5, y: 0.45 },
            transitionIn: 'whip-pan',
            transitionDuration: 0.25,
            waveform,
            audioBuffer: decodedBuffer,
          };

          onAddClip(videoClip);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
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

      // Register into Media Asset bin
      [clip1, clip2, clip3].forEach((clip, idx) => {
        const asset: MediaAsset = {
          id: `asset-demo-${idx + 1}`,
          name: clip.name,
          type: 'video',
          sourceUrl: clip.sourceUrl,
          blob: clip.blob,
          thumbnailUrl: clip.sourceUrl,
          duration: clip.duration,
          width: 1080,
          height: 1920,
          fileSize: '4.2 MB',
          waveform: clip.waveform,
          audioBuffer: clip.audioBuffer,
        };
        onAddAssetToBin(asset);
        onAddClip(clip);
      });
    } catch (err) {
      console.error('Failed to load demo clips:', err);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  // Add Asset from Bin to Timeline
  const handleAddAssetToTimeline = (asset: MediaAsset) => {
    const isImage = asset.type === 'image';
    const newClip: VideoClip = {
      id: `clip-${isImage ? 'img' : 'vid'}-${Date.now()}`,
      name: asset.name,
      mediaType: asset.type,
      trackId: 'v1',
      sourceUrl: asset.sourceUrl,
      blob: asset.blob,
      thumbnailUrl: asset.thumbnailUrl,
      originalDuration: isImage ? 60 : asset.duration,
      inPoint: 0,
      outPoint: isImage ? 3.0 : asset.duration,
      duration: isImage ? 3.0 : asset.duration, // 3.0s default for photos
      startTimelineTime: currentTime || 0,
      speed: 1.0,
      volume: isImage ? 0 : 1.0,
      isMuted: isImage,
      zoomScale: 1.0,
      zoomCenter: { x: 0.5, y: 0.5 },
      transitionIn: isImage ? 'none' : 'whip-pan',
      transitionDuration: 0.25,
      waveform: asset.waveform || [],
      audioBuffer: asset.audioBuffer,
    };

    onAddClip(newClip);
    setAddedAssetId(asset.id);
    setTimeout(() => setAddedAssetId(null), 1200);
  };

  // Filter and search media assets
  const filteredAssets = mediaAssets.filter((asset) => {
    if (filterType !== 'all' && asset.type !== filterType) return false;
    if (searchQuery.trim()) {
      return asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const videoCount = mediaAssets.filter((a) => a.type === 'video').length;
  const imageCount = mediaAssets.filter((a) => a.type === 'image').length;

  return (
    <div className="p-3 space-y-3.5 flex flex-col h-full overflow-hidden">
      {/* 1. Upload Drop Zone with Drag-and-Drop (Photos + Videos) */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition group shrink-0 ${
          isDraggingOver
            ? 'border-indigo-400 bg-indigo-950/50 ring-2 ring-indigo-500/50'
            : 'border-slate-700/80 hover:border-indigo-500 bg-slate-900/60 hover:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,image/*,audio/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="w-9 h-9 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 flex items-center justify-center mb-1.5 transition">
          <UploadCloud className={`w-5 h-5 ${isProcessing ? 'animate-bounce text-indigo-300' : ''}`} />
        </div>
        <div className="text-xs font-bold text-slate-200">
          {isProcessing ? 'Decoding & Ingesting Media...' : 'Upload Photos or Videos'}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          PNG, JPG, WebP, MP4, MOV, WebM (auto-detects dimensions)
        </div>
      </div>

      {/* 2. 1-Click High-Energy Demo Loader */}
      <button
        onClick={handleLoadDemoBundle}
        disabled={isLoadingDemo}
        className="w-full bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 hover:border-indigo-400 text-indigo-300 text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition shadow-sm shrink-0"
      >
        <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isLoadingDemo ? 'animate-spin' : ''}`} />
        <span>{isLoadingDemo ? 'Generating 60fps Demo Clips...' : 'Load 3x Viral Demo Clips'}</span>
      </button>

      {/* 3. Dedicated Media Assets Library Panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 rounded-xl border border-slate-800/80 p-2.5 space-y-2.5 overflow-hidden">
        {/* Header with Total Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200">Media Assets Bin</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-900 text-indigo-300 rounded border border-slate-800 font-semibold">
            {mediaAssets.length} items
          </span>
        </div>

        {/* Filter Badges: All | [VID] Videos | [IMG] Photos */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-[10px] font-semibold shrink-0">
          <button
            onClick={() => setFilterType('all')}
            className={`py-1 rounded transition text-center ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({mediaAssets.length})
          </button>
          <button
            onClick={() => setFilterType('video')}
            className={`py-1 rounded transition flex items-center justify-center space-x-1 ${
              filterType === 'video'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-purple-300/80 hover:text-purple-200'
            }`}
          >
            <span className="font-mono font-bold text-[9px] px-1 bg-purple-950/60 rounded border border-purple-500/40">
              VID
            </span>
            <span>({videoCount})</span>
          </button>
          <button
            onClick={() => setFilterType('image')}
            className={`py-1 rounded transition flex items-center justify-center space-x-1 ${
              filterType === 'image'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-cyan-300/80 hover:text-cyan-200'
            }`}
          >
            <span className="font-mono font-bold text-[9px] px-1 bg-cyan-950/60 rounded border border-cyan-500/40">
              IMG
            </span>
            <span>({imageCount})</span>
          </button>
        </div>

        {/* Quick Search */}
        {mediaAssets.length > 3 && (
          <div className="relative shrink-0">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2.5" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Media Assets List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredAssets.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center text-center p-3 text-slate-500 space-y-1">
              <FolderOpen className="w-7 h-7 text-slate-700 stroke-1" />
              <div className="text-[11px] font-semibold text-slate-400">
                {mediaAssets.length === 0 ? 'Media Bin is Empty' : 'No matching assets found'}
              </div>
              <div className="text-[9px] text-slate-500 max-w-[200px]">
                {mediaAssets.length === 0
                  ? 'Drag photos or videos into the drop zone above to start building your library.'
                  : 'Try searching with another keyword or change the media filter.'}
              </div>
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isImg = asset.type === 'image';
              const isAdded = addedAssetId === asset.id;

              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        type: 'media-asset',
                        asset,
                      })
                    );
                  }}
                  className="group relative bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/80 rounded-xl p-2 transition flex items-center space-x-2.5 cursor-grab active:cursor-grabbing select-none shadow-sm"
                  title="Drag directly to Timeline Track V1 or V2, or click + Add"
                >
                  {/* Thumbnail with Media Type Badge */}
                  <div className="relative w-16 h-12 rounded-lg bg-slate-950 overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                    {isImg ? (
                      <img
                        src={asset.thumbnailUrl || asset.sourceUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.thumbnailUrl && asset.thumbnailUrl.startsWith('data:') ? (
                      <img
                        src={asset.thumbnailUrl}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-950/30">
                        <Film className="w-5 h-5 text-purple-400" />
                      </div>
                    )}

                    {/* Media Type Badge: [IMG] or [VID] */}
                    <div className="absolute top-1 left-1">
                      {isImg ? (
                        <span className="px-1 py-0.2 bg-cyan-500/90 text-slate-950 font-mono text-[8px] font-black rounded shadow">
                          IMG
                        </span>
                      ) : (
                        <span className="px-1 py-0.2 bg-purple-500/90 text-slate-950 font-mono text-[8px] font-black rounded shadow">
                          VID
                        </span>
                      )}
                    </div>

                    {/* Duration Badge */}
                    <div className="absolute bottom-1 right-1 px-1 py-0.2 bg-slate-950/80 text-white font-mono text-[8px] font-bold rounded">
                      {isImg ? '3.0s' : formatDuration(asset.duration)}
                    </div>
                  </div>

                  {/* Asset Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-indigo-300 transition-colors">
                      {asset.name}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 flex items-center space-x-1.5 mt-0.5">
                      {asset.width && asset.height && (
                        <span>{asset.width}×{asset.height}</span>
                      )}
                      {asset.fileSize && (
                        <>
                          <span>•</span>
                          <span>{asset.fileSize}</span>
                        </>
                      )}
                    </div>
                    <div className="text-[8px] text-slate-500 mt-0.5 flex items-center space-x-1">
                      <Layers className="w-2.5 h-2.5 text-slate-500" />
                      <span>Drag to V1 or V2</span>
                    </div>
                  </div>

                  {/* Action: Click to Add Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddAssetToTimeline(asset);
                    }}
                    title="Add to Timeline (at current playhead)"
                    className={`p-1.5 rounded-lg border transition shrink-0 ${
                      isAdded
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-800 hover:bg-indigo-600 border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Tip footer */}
        <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 shrink-0">
          <div className="flex items-center space-x-1 text-slate-300 font-semibold mb-0.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Universal Freeform Timeline</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-tight">
            Drag any photo or video directly onto Track V1 or V2. Photos default to 3.0s with expandable edge handles.
          </p>
        </div>
      </div>
    </div>
  );
};
export default AssetBin;
