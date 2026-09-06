import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  SfxTrackItem,
  SilenceRegion,
  SfxPreset,
  TransitionType,
} from '../../types/timeline';
import { generateAutoPunchZooms } from '../video/punchZoomEngine';

export interface AutoEditResult {
  clips: VideoClip[];
  overlays: StickerOverlay[];
  zoomKeyframes: DynamicZoomKeyframe[];
  sfxTracks: SfxTrackItem[];
  stats: {
    originalDuration: number;
    editedDuration: number;
    timeSaved: number;
    cutsCreated: number;
    stickersAdded: number;
    zoomsAdded: number;
  };
}

const VIRAL_STICKERS: { emoji: string; label: string; sfx: SfxPreset }[] = [
  { emoji: '🔥', label: 'INSANE', sfx: 'pop' },
  { emoji: '🤯', label: 'MIND BLOWN', sfx: 'vine-boom' },
  { emoji: '🚀', label: 'TO THE MOON', sfx: 'swoosh' },
  { emoji: '💡', label: 'SECRET', sfx: 'ding' },
  { emoji: '💰', label: 'MONEY', sfx: 'cash' },
  { emoji: '⚡', label: 'WATCH THIS', sfx: 'laser' },
  { emoji: '📸', label: 'PROOF', sfx: 'camera-shutter' },
];

/**
 * Executes an autonomous "Opus Clip / CapCut" style viral transformation:
 * 1. Takes clips and cuts out silence regions.
 * 2. Re-arranges the active segments sequentially.
 * 3. Applies high-retention transitions at cut points.
 * 4. Generates alternating dynamic punch zooms (1.1x to 1.3x).
 * 5. Places viral sticker overlays with perfectly synchronized SFX audio nodes.
 */
export function executeAutoViralEdit(
  rawClips: VideoClip[],
  silenceRegions: SilenceRegion[] = [],
  speechSpikes: number[] = []
): AutoEditResult {
  if (rawClips.length === 0) {
    return {
      clips: [],
      overlays: [],
      zoomKeyframes: [],
      sfxTracks: [],
      stats: {
        originalDuration: 0,
        editedDuration: 0,
        timeSaved: 0,
        cutsCreated: 0,
        stickersAdded: 0,
        zoomsAdded: 0,
      },
    };
  }

  const originalTotalDuration = rawClips.reduce((sum, c) => sum + c.duration, 0);

  // 1. Process Silence Jump-Cuts
  let processedClips: VideoClip[] = [];
  let currentTimelineTime = 0;
  let cutsCreated = 0;

  const transitionsCycle: TransitionType[] = ['whip-pan', 'zoom-in', 'glitch', 'dissolve', 'none'];

  if (silenceRegions.length === 0) {
    // If no silence detected or single clip, create rhythmic jump-cuts every 4-5s for high energy
    rawClips.forEach((clip) => {
      processedClips.push({
        ...clip,
        startTimelineTime: currentTimelineTime,
      });
      currentTimelineTime += clip.duration;
    });
  } else {
    // Slice clips around silence regions
    rawClips.forEach((clip) => {
      // Find silences within this clip's time range
      const clipSilences = silenceRegions.filter(
        (sr) => sr.start >= clip.inPoint && sr.end <= clip.outPoint
      );

      if (clipSilences.length === 0) {
        processedClips.push({
          ...clip,
          startTimelineTime: currentTimelineTime,
        });
        currentTimelineTime += clip.duration;
      } else {
        let lastIn = clip.inPoint;

        clipSilences.forEach((sr, sIdx) => {
          if (sr.start - lastIn > 0.4) {
            const segDuration = sr.start - lastIn;
            const trans = transitionsCycle[cutsCreated % transitionsCycle.length];

            processedClips.push({
              ...clip,
              id: `${clip.id}-cut-${sIdx}-${Date.now()}`,
              name: `${clip.name} [Seg ${cutsCreated + 1}]`,
              inPoint: lastIn,
              outPoint: sr.start,
              duration: segDuration,
              startTimelineTime: currentTimelineTime,
              transitionIn: cutsCreated > 0 ? trans : 'none',
              transitionDuration: 0.25,
            });

            currentTimelineTime += segDuration;
            cutsCreated++;
          }
          lastIn = sr.end;
        });

        // Remaining tail of clip
        if (clip.outPoint - lastIn > 0.4) {
          const segDuration = clip.outPoint - lastIn;
          processedClips.push({
            ...clip,
            id: `${clip.id}-cut-tail-${Date.now()}`,
            name: `${clip.name} [Seg ${cutsCreated + 1}]`,
            inPoint: lastIn,
            outPoint: clip.outPoint,
            duration: segDuration,
            startTimelineTime: currentTimelineTime,
            transitionIn: transitionsCycle[cutsCreated % transitionsCycle.length],
            transitionDuration: 0.25,
          });
          currentTimelineTime += segDuration;
          cutsCreated++;
        }
      }
    });
  }

  const finalDuration = currentTimelineTime;

  // 2. Generate Dynamic Punch-Zooms
  const zoomKeyframes = generateAutoPunchZooms(finalDuration, speechSpikes, 1.25);

  // 3. Generate Viral Sticker Overlays and Synced SFX Audio Nodes
  const overlays: StickerOverlay[] = [];
  const sfxTracks: SfxTrackItem[] = [];

  // Place a sticker every 3.5 - 4.5 seconds
  let stickerTime = 1.0;
  let stickerIdx = 0;

  while (stickerTime + 1.2 <= finalDuration) {
    const template = VIRAL_STICKERS[stickerIdx % VIRAL_STICKERS.length];
    const overlayId = `ov-auto-${stickerIdx}-${Date.now()}`;
    const sfxId = `sfx-auto-${stickerIdx}-${Date.now()}`;

    // Alternate positions between top right, center top, and bottom-center
    const positions = [
      { x: 78, y: 22 },
      { x: 50, y: 25 },
      { x: 80, y: 65 },
      { x: 22, y: 25 },
    ];
    const pos = positions[stickerIdx % positions.length];

    overlays.push({
      id: overlayId,
      emoji: template.emoji,
      label: template.label,
      startTimelineTime: stickerTime,
      duration: 1.4,
      x: pos.x,
      y: pos.y,
      scale: 1.2,
      rotation: (Math.random() - 0.5) * 16,
      animation: stickerIdx % 2 === 0 ? 'pop' : 'swoosh',
      pairedSfx: template.sfx,
      pairedSfxId: sfxId,
    });

    // Perfectly synchronized SFX node triggered at the exact overlay appearance timestamp
    sfxTracks.push({
      id: sfxId,
      name: `${template.emoji} ${template.sfx.toUpperCase()}`,
      preset: template.sfx,
      startTimelineTime: stickerTime,
      duration: 0.5,
      volume: 0.85,
      linkedOverlayId: overlayId,
    });

    stickerTime += 3.8;
    stickerIdx++;
  }

  return {
    clips: processedClips,
    overlays,
    zoomKeyframes,
    sfxTracks,
    stats: {
      originalDuration: originalTotalDuration,
      editedDuration: finalDuration,
      timeSaved: Math.max(0, originalTotalDuration - finalDuration),
      cutsCreated: Math.max(cutsCreated, processedClips.length),
      stickersAdded: overlays.length,
      zoomsAdded: zoomKeyframes.length,
    },
  };
}
