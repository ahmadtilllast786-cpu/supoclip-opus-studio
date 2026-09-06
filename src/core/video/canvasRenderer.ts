import {
  VideoClip,
  StickerOverlay,
  DynamicZoomKeyframe,
  TranscriptWord,
  CaptionTemplate,
  SfxTrackItem,
} from '../../types/timeline';
import { calculatePunchZoom } from './punchZoomEngine';
import { renderTransition } from './transitions';
import { renderCaptionsAndHookTitle } from '../captions/captionRenderer';
import { getStickerImage } from '../stickers/stickerCatalogService';

export interface RenderFrameOptions {
  currentTime: number;
  clips: VideoClip[];
  overlays: StickerOverlay[];
  zoomKeyframes: DynamicZoomKeyframe[];
  videoElements: Map<string, HTMLVideoElement>;
  imageElements?: Map<string, HTMLImageElement>;
  width: number;
  height: number;
  words?: TranscriptWord[];
  captionTemplate?: CaptionTemplate;
  hookTitle?: string | null;
  autoFramingEnabled?: boolean;
  sfxTracks?: SfxTrackItem[];
  masterOverlayVisible?: boolean;
  maxActiveOverlays?: number;
  masterSfxMuted?: boolean;
}

/**
 * Composites and draws the complete video frame at the given timeline time,
 * including V1 main clips, V2 overlay/B-roll clips, SupoClip caption templates,
 * hook titles, punch zooms, and transitions.
 */
export function renderCompositedFrame(
  ctx: CanvasRenderingContext2D,
  options: RenderFrameOptions
) {
  const {
    currentTime,
    clips,
    overlays,
    zoomKeyframes,
    videoElements,
    imageElements,
    width,
    height,
    words = [],
    captionTemplate,
    hookTitle,
    autoFramingEnabled = true,
    sfxTracks,
    masterOverlayVisible = true,
    maxActiveOverlays = 5,
    masterSfxMuted = false,
  } = options;

  // Clear canvas background with dark studio backdrop
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, width, height);

  // Helper to obtain media source for any clip (video or photo)
  const getMediaSourceForClip = (clip: VideoClip): CanvasImageSource | null => {
    if (clip.mediaType === 'image') {
      const img = imageElements?.get(clip.id);
      if (img && img.complete && img.naturalWidth > 0) return img;
      // Fallback: try loading image dynamically if not cached
      if (clip.sourceUrl) {
        let cachedImg = (clip as any)._cachedImg as HTMLImageElement | undefined;
        if (!cachedImg) {
          cachedImg = new Image();
          cachedImg.crossOrigin = 'anonymous';
          cachedImg.src = clip.sourceUrl;
          (clip as any)._cachedImg = cachedImg;
        }
        if (cachedImg.complete && cachedImg.naturalWidth > 0) return cachedImg;
      }
      return null;
    }
    const vid = videoElements.get(clip.id);
    if (vid && (vid.readyState >= 1 || vid.videoWidth > 0)) return vid;
    return null;
  };

  // Separate clips into V1 (main track) and V2 (overlay / B-roll track)
  const v1Clips = clips.filter((c) => (c.trackId || 'v1') === 'v1');
  const v2Clips = clips.filter((c) => c.trackId === 'v2');

  // Locate current V1 clip
  let currentV1Index = -1;
  for (let i = 0; i < v1Clips.length; i++) {
    const c = v1Clips[i];
    if (currentTime >= c.startTimelineTime && currentTime < c.startTimelineTime + c.duration) {
      currentV1Index = i;
      break;
    }
  }

  // Calculate dynamic punch zoom transform at current playhead
  const zoomTransform = calculatePunchZoom(currentTime, zoomKeyframes);

  // Save context state before applying camera/punch-zoom transforms
  ctx.save();

  // Apply punch-zoom if active or if clip has clip-level zoom
  let effectiveScale = zoomTransform.scale;
  let focusX = zoomTransform.centerX;
  let focusY = zoomTransform.centerY;

  if (currentV1Index >= 0) {
    const activeClip = v1Clips[currentV1Index];
    if (activeClip.zoomScale && activeClip.zoomScale !== 1.0) {
      effectiveScale *= activeClip.zoomScale;
      focusX = activeClip.zoomCenter.x;
      focusY = activeClip.zoomCenter.y;
    }
    // SupoClip smart face centering
    if (autoFramingEnabled && activeClip.faceCenterX !== undefined) {
      focusX = activeClip.faceCenterX;
    }
  }

  if (effectiveScale !== 1.0) {
    const originX = width * focusX;
    const originY = height * focusY;
    ctx.translate(originX, originY);
    ctx.scale(effectiveScale, effectiveScale);
    ctx.translate(-originX, -originY);
  }

  // 1A. Draw V1 (Main Track) Layer
  if (currentV1Index >= 0) {
    const currentClip = v1Clips[currentV1Index];
    const nextClip = v1Clips[currentV1Index + 1];

    const timeIntoCurrent = currentTime - currentClip.startTimelineTime;
    const timeLeftInCurrent = currentClip.duration - timeIntoCurrent;

    // Check if we are within the transition window into the next clip
    const transitionDuration = nextClip?.transitionDuration || 0.25;
    const hasTransition =
      nextClip &&
      nextClip.transitionIn &&
      nextClip.transitionIn !== 'none' &&
      timeLeftInCurrent <= transitionDuration;

    const outMedia = getMediaSourceForClip(currentClip);

    if (hasTransition) {
      const inMedia = nextClip ? getMediaSourceForClip(nextClip) : null;
      if (outMedia && inMedia) {
        const transProgress = 1 - timeLeftInCurrent / transitionDuration;
        drawTransitionedMedia(
          ctx,
          outMedia,
          inMedia,
          transProgress,
          nextClip.transitionIn,
          width,
          height
        );
      } else if (outMedia) {
        drawCroppedMedia(ctx, outMedia, width, height);
      }
    } else if (outMedia) {
      drawCroppedMedia(ctx, outMedia, width, height);
    } else {
      drawClipPlaceholder(ctx, currentClip.name, width, height);
    }
  } else {
    // If no active V1 clip, check if there is an active V2 clip, else show empty screen
    const hasV2Active = v2Clips.some(
      (c) => currentTime >= c.startTimelineTime && currentTime < c.startTimelineTime + c.duration
    );
    if (!hasV2Active) {
      drawEmptyScreen(ctx, width, height);
    }
  }

  // 1B. Draw V2 (Overlays / B-roll Track) Visual Layer on top of V1
  const activeV2Clips = v2Clips.filter(
    (c) => currentTime >= c.startTimelineTime && currentTime < c.startTimelineTime + c.duration
  );
  for (const v2Clip of activeV2Clips) {
    const v2Media = getMediaSourceForClip(v2Clip);
    if (v2Media) {
      drawCroppedMedia(ctx, v2Media, width, height);
    } else {
      drawClipPlaceholder(ctx, v2Clip.name, width, height);
    }
  }

  ctx.restore(); // Restore punch-zoom transform

  // 2. Render Active Sticker & Emoji Overlays (Diagnostic & Density Filtered)
  if (masterOverlayVisible) {
    const activeOverlays = overlays
      .filter(
        (ov) =>
          !ov.isDisabled &&
          currentTime >= ov.startTimelineTime &&
          currentTime < ov.startTimelineTime + ov.duration
      )
      .slice(0, maxActiveOverlays);

    for (const ov of activeOverlays) {
      drawStickerOverlay(ctx, ov, currentTime, width, height);
    }
  }

  // 3. Render SupoClip Word-by-Word Captions & Hook Title Banner
  if (captionTemplate && (words.length > 0 || hookTitle)) {
    renderCaptionsAndHookTitle({
      ctx,
      currentTime,
      words,
      template: captionTemplate,
      hookTitle,
      width,
      height,
    });
  }

  // 4. Render Special Sound Wave Sonic Ripple Effect on Canvas (Diagnostic Filtered)
  if (sfxTracks && sfxTracks.length > 0 && !masterSfxMuted) {
    const activeSfx = sfxTracks.filter(
      (sfx) =>
        !sfx.isMuted &&
        currentTime >= sfx.startTimelineTime &&
        currentTime < sfx.startTimelineTime + sfx.duration
    );
    for (const sfx of activeSfx) {
      drawSpecialSoundEffect(ctx, sfx, currentTime, width, height, overlays);
    }
  }
}

/**
 * Draws a video or image element cropped and scaled to fit the vertical canvas (cover mode).
 */
export function drawCroppedMedia(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  canvasWidth: number,
  canvasHeight: number
) {
  let mWidth = 1920;
  let mHeight = 1080;

  if ('videoWidth' in media && (media as HTMLVideoElement).videoWidth) {
    mWidth = (media as HTMLVideoElement).videoWidth;
    mHeight = (media as HTMLVideoElement).videoHeight;
  } else if ('naturalWidth' in media && (media as HTMLImageElement).naturalWidth) {
    mWidth = (media as HTMLImageElement).naturalWidth;
    mHeight = (media as HTMLImageElement).naturalHeight;
  } else if ('width' in media && typeof (media as any).width === 'number') {
    mWidth = (media as any).width || 1920;
    mHeight = (media as any).height || 1080;
  }

  const canvasRatio = canvasWidth / canvasHeight;
  const mediaRatio = mWidth / mHeight;

  let sx = 0,
    sy = 0,
    sWidth = mWidth,
    sHeight = mHeight;

  if (mediaRatio > canvasRatio) {
    // Media is wider than canvas: crop sides
    sWidth = mHeight * canvasRatio;
    sx = (mWidth - sWidth) / 2;
  } else {
    // Media is taller than canvas: crop top/bottom
    sHeight = mWidth / canvasRatio;
    sy = (mHeight - sHeight) / 2;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  try {
    ctx.drawImage(media, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
  } catch {
    // Gracefully ignore if browser frame decode is transiently locked
  }
}

// Backwards compatibility alias
export function drawCroppedVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number
) {
  drawCroppedMedia(ctx, video, canvasWidth, canvasHeight);
}

let cachedOff1: HTMLCanvasElement | null = null;
let cachedOff2: HTMLCanvasElement | null = null;

function getCachedTransitionCanvases(width: number, height: number): [HTMLCanvasElement, HTMLCanvasElement] {
  if (!cachedOff1) {
    cachedOff1 = document.createElement('canvas');
  }
  if (cachedOff1.width !== width || cachedOff1.height !== height) {
    cachedOff1.width = width;
    cachedOff1.height = height;
  }

  if (!cachedOff2) {
    cachedOff2 = document.createElement('canvas');
  }
  if (cachedOff2.width !== width || cachedOff2.height !== height) {
    cachedOff2.width = width;
    cachedOff2.height = height;
  }

  return [cachedOff1, cachedOff2];
}

/**
 * Draws two media sources (video or image) with a canvas transition effect.
 */
export function drawTransitionedMedia(
  ctx: CanvasRenderingContext2D,
  outgoingMedia: CanvasImageSource,
  incomingMedia: CanvasImageSource,
  progress: number,
  transition: any,
  width: number,
  height: number
) {
  const [off1, off2] = getCachedTransitionCanvases(width, height);

  const ctx1 = off1.getContext('2d');
  if (ctx1) {
    ctx1.imageSmoothingEnabled = true;
    ctx1.imageSmoothingQuality = 'high';
    ctx1.clearRect(0, 0, width, height);
    drawCroppedMedia(ctx1, outgoingMedia, width, height);
  }

  const ctx2 = off2.getContext('2d');
  if (ctx2) {
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = 'high';
    ctx2.clearRect(0, 0, width, height);
    drawCroppedMedia(ctx2, incomingMedia, width, height);
  }

  renderTransition(ctx, off1, off2, progress, transition, width, height);
}

// Backwards compatibility alias
export function drawTransitionedClips(
  ctx: CanvasRenderingContext2D,
  outgoingVideo: HTMLVideoElement,
  incomingVideo: HTMLVideoElement,
  progress: number,
  transition: any,
  width: number,
  height: number
) {
  drawTransitionedMedia(ctx, outgoingVideo, incomingVideo, progress, transition, width, height);
}

/**
 * Renders an animated sticker / emoji overlay.
 */
function drawStickerOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: StickerOverlay,
  currentTime: number,
  width: number,
  height: number
) {
  const posX = (overlay.x / 100) * width;
  const posY = (overlay.y / 100) * height;

  const elapsed = currentTime - overlay.startTimelineTime;
  const entranceDuration = 0.25;

  let animScale = overlay.scale || 1.0;
  let animRotation = overlay.rotation || 0;
  let animAlpha = 1.0;
  let offsetY = 0;

  // Entrance animation curves
  if (elapsed < entranceDuration) {
    const t = elapsed / entranceDuration;
    switch (overlay.animation) {
      case 'pop': {
        const bounce = Math.sin(t * Math.PI * 1.5) * 1.3;
        animScale *= Math.max(0.1, bounce);
        break;
      }
      case 'bounce': {
        offsetY = -60 * Math.cos(t * Math.PI * 2);
        break;
      }
      case 'swoosh': {
        const p = 1 - Math.pow(1 - t, 3);
        offsetY = 80 * (1 - p);
        animAlpha = p;
        break;
      }
      case 'glitch': {
        if (Math.random() > 0.4) {
          animRotation += (Math.random() - 0.5) * 20;
        }
        break;
      }
      case 'pulse': {
        animScale *= 1.0 + 0.15 * Math.sin(elapsed * 10);
        break;
      }
    }
  }

  // Draw overlay with drop shadow & transforms
  ctx.save();
  ctx.globalAlpha = animAlpha;
  ctx.translate(posX, posY + offsetY);
  ctx.rotate((animRotation * Math.PI) / 180);
  ctx.scale(animScale, animScale);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;

  const stickerSize = Math.floor(width * 0.22);
  let renderedAsset = false;

  if (overlay.assetUrl) {
    const img = getStickerImage(overlay.assetUrl);
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -stickerSize / 2, -stickerSize / 2, stickerSize, stickerSize);
      renderedAsset = true;
    }
  }

  if (!renderedAsset && overlay.emoji) {
    const fontSize = Math.floor(width * 0.14);
    ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay.emoji, 0, 0);
  }

  if (overlay.label) {
    const labelFontSize = Math.max(12, Math.floor(width * 0.048));
    const labelOffsetY = renderedAsset ? (stickerSize * 0.55) : (Math.floor(width * 0.14) * 0.65);
    ctx.shadowBlur = 8;
    ctx.font = `900 ${labelFontSize}px "Montserrat", "Bangers", sans-serif`;
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(overlay.label.toUpperCase(), 0, labelOffsetY);
    ctx.fillText(overlay.label.toUpperCase(), 0, labelOffsetY);
  }

  ctx.restore();
}

function drawClipPlaceholder(ctx: CanvasRenderingContext2D, name: string, width: number, height: number) {
  ctx.fillStyle = '#111622';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Loading: ${name}`, width / 2, height / 2);
}

function drawEmptyScreen(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#1e293b';
  ctx.font = '800 32px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SUPOCLIP AUTONOMOUS STUDIO', width / 2, height / 2 - 20);

  ctx.font = '500 16px Inter, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Drop Video or Load Viral Moments', width / 2, height / 2 + 25);
}

/**
 * Draws an energetic audio-reactive soundwave ripple ring and sonic pulse on canvas
 * when special sound/SFX timestamp plays.
 */
function drawSpecialSoundEffect(
  ctx: CanvasRenderingContext2D,
  sfx: SfxTrackItem,
  currentTime: number,
  width: number,
  height: number,
  overlays: StickerOverlay[]
) {
  const elapsed = currentTime - sfx.startTimelineTime;
  const progress = Math.max(0, Math.min(1, elapsed / sfx.duration));

  // Determine center origin from linked overlay or center of screen
  let originX = width / 2;
  let originY = height * 0.45;

  if (sfx.linkedOverlayId) {
    const linked = overlays.find((o) => o.id === sfx.linkedOverlayId);
    if (linked) {
      originX = (linked.x / 100) * width;
      originY = (linked.y / 100) * height;
    }
  }

  ctx.save();

  // Multi-ring sonic wave pulse
  const maxRadius = Math.min(width, height) * 0.32;
  const waveCycle = (elapsed * 3.5) % 1.0;
  const radius = 25 + waveCycle * maxRadius;
  const waveAlpha = Math.max(0, (1 - waveCycle) * (1 - progress * 0.5));

  ctx.beginPath();
  ctx.arc(originX, originY, radius, 0, Math.PI * 2);
  ctx.strokeStyle =
    sfx.preset === 'vine-boom'
      ? `rgba(239, 68, 68, ${waveAlpha * 0.9})`
      : sfx.preset === 'laser'
      ? `rgba(56, 189, 248, ${waveAlpha * 0.9})`
      : sfx.preset === 'cash'
      ? `rgba(34, 197, 94, ${waveAlpha * 0.9})`
      : `rgba(244, 63, 94, ${waveAlpha * 0.9})`;
  ctx.lineWidth = Math.max(2, 6 * (1 - waveCycle));
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 12;
  ctx.stroke();

  // Secondary harmonic echo ring
  if (waveCycle > 0.25) {
    const echoRadius = (waveCycle - 0.25) * maxRadius;
    const echoAlpha = waveAlpha * 0.5;
    ctx.beginPath();
    ctx.arc(originX, originY, echoRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${echoAlpha})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.stroke();
  }

  ctx.restore();
}
