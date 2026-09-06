import { CaptionTemplate, TranscriptWord } from '../../types/timeline';

export interface RenderCaptionsOptions {
  ctx: CanvasRenderingContext2D;
  currentTime: number;
  words: TranscriptWord[];
  template: CaptionTemplate;
  hookTitle?: string | null;
  width: number;
  height: number;
}

export interface SubtitleBoundingBox {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

let lastSubtitleBounds: SubtitleBoundingBox | null = null;

export function getLastSubtitleBounds(): SubtitleBoundingBox | null {
  return lastSubtitleBounds;
}

/**
 * Renders high-quality viral word-by-word animated captions and Hook Title banner on HTML5 Canvas.
 */
export function renderCaptionsAndHookTitle(options: RenderCaptionsOptions) {
  const { ctx, currentTime, words, template, hookTitle, width, height } = options;

  // 1. Render Burned-In Hook Title Banner in Top Safe Zone (first 4.5 seconds)
  if (hookTitle && currentTime >= 0 && currentTime <= 4.8) {
    drawHookTitleBanner(ctx, hookTitle, currentTime, width, height);
  }

  // 2. Render Word-Level Animated Subtitles
  if (!words || words.length === 0) {
    lastSubtitleBounds = null;
    return;
  }

  // Find active word index matching current playhead timestamp
  let targetIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  // If no word is strictly active at currentTime:
  // Check if we are within the small pause between words in the same phrase
  if (targetIdx === -1) {
    const nearbyIdx = words.findIndex((w, i) => {
      if (currentTime >= w.start - 0.12 && currentTime <= w.end + 0.20) {
        return true;
      }
      const next = words[i + 1];
      if (next && currentTime > w.end && currentTime < next.start && next.start - w.end <= 0.65) {
        return true;
      }
      return false;
    });
    if (nearbyIdx !== -1) {
      targetIdx = nearbyIdx;
    }
  }

  // If not active and in silence gaps (>0.4s pause, or before/after speech),
  // suppress captions dynamically to keep preview clean
  if (targetIdx === -1) {
    lastSubtitleBounds = null;
    return;
  }

  // Group into line chunks according to template.max_words_per_line
  const wordsPerLine = template.max_words_per_line || 3;
  const lineStartIdx = Math.floor(targetIdx / wordsPerLine) * wordsPerLine;
  const lineWords = words.slice(lineStartIdx, lineStartIdx + wordsPerLine);

  if (lineWords.length === 0) {
    lastSubtitleBounds = null;
    return;
  }

  ctx.save();

  // Calculate scaled font size relative to 1080 canvas width
  const scaleFactor = width / 1080;
  const fontSize = Math.round((template.font_size || 34) * scaleFactor * 1.35);
  const fontFamily = template.font_family || '"Montserrat", "Space Grotesk", sans-serif';
  ctx.font = `900 ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';

  // Support 2D Draggable Position (position_x and position_y)
  const normX = template.position_x !== undefined ? template.position_x : 0.5;
  const normY = template.position_y !== undefined ? template.position_y : 0.74;
  const posX = normX * width;
  const posY = normY * height;

  // Measure word widths to layout the line
  const wordMeasurements = lineWords.map((item) => {
    let text = template.uppercase ? item.word.toUpperCase() : item.word;
    if (template.emoji && item.emoji) text += ` ${item.emoji}`;
    const metrics = ctx.measureText(text);
    return {
      word: item,
      text,
      width: metrics.width,
    };
  });

  const wordSpacing = 16 * scaleFactor;
  const totalLineWidth =
    wordMeasurements.reduce((sum, m) => sum + m.width, 0) +
    (wordMeasurements.length - 1) * wordSpacing;

  let currentX = posX - totalLineWidth / 2;

  // Save bounding box for interactive dragging on canvas
  const padH = 22 * scaleFactor;
  const padV = 16 * scaleFactor;
  const boxHeight = fontSize + padV * 2;
  lastSubtitleBounds = {
    x: Math.max(2, Math.min(95, ((posX - totalLineWidth / 2 - padH) / width) * 100)),
    y: Math.max(2, Math.min(95, ((posY - boxHeight / 2) / height) * 100)),
    width: Math.max(10, ((totalLineWidth + padH * 2) / width) * 100),
    height: Math.max(6, (boxHeight / height) * 100),
  };

  // Minimal Clean / Fade transition handling
  if (template.fade_transition || template.animation === 'fade') {
    const lineStartSec = lineWords[0].start;
    const lineEndSec = lineWords[lineWords.length - 1].end;
    const timeIntoLine = currentTime - lineStartSec;
    const timeLeftInLine = lineEndSec - currentTime;
    const fadeWindow = 0.22;
    let lineAlpha = 1.0;
    if (timeIntoLine < fadeWindow && timeIntoLine >= 0) {
      lineAlpha = Math.max(0.15, timeIntoLine / fadeWindow);
    } else if (timeLeftInLine < fadeWindow && timeLeftInLine >= 0) {
      lineAlpha = Math.max(0.15, timeLeftInLine / fadeWindow);
    }
    ctx.globalAlpha = lineAlpha;
  }

  // Optional background container for minimal/podcast templates
  if (template.background && template.background_color) {
    ctx.fillStyle = template.background_color;
    ctx.beginPath();
    ctx.roundRect(
      currentX - padH,
      posY - boxHeight / 2,
      totalLineWidth + padH * 2,
      boxHeight,
      14 * scaleFactor
    );
    ctx.fill();
  }

  // Render each word with active karaoke styling
  wordMeasurements.forEach((item, idx) => {
    const isCurrentActive =
      currentTime >= item.word.start && currentTime <= item.word.end;
    const elapsedInWord = currentTime - item.word.start;

    ctx.save();

    let wordScale = 1.0;

    // Scale bounce transform on active karaoke word (Beast / Hormozi / Pop styles)
    if (isCurrentActive && (template.word_pop || template.animation === 'bounce')) {
      const popT = Math.min(1, Math.max(0, elapsedInWord / 0.16));
      const intensity = template.bounce_intensity ?? (template.animation === 'bounce' ? 0.35 : 0.20);
      wordScale = 1.0 + intensity * Math.sin(popT * Math.PI);
    }

    // Hormozi Style Capsule Pill behind active word
    if (isCurrentActive && template.word_box && template.word_box_color) {
      const pillPadH = 18 * scaleFactor;
      const pillPadV = 10 * scaleFactor;
      const pillHeight = fontSize + pillPadV * 2;
      const pillRadius = pillHeight / 2; // Full rounded capsule

      ctx.fillStyle = template.word_box_color;
      ctx.beginPath();
      ctx.roundRect(
        currentX - pillPadH / 2,
        posY - pillHeight / 2,
        item.width + pillPadH,
        pillHeight,
        pillRadius
      );
      ctx.fill();
    }

    // Drop shadow & Glow
    if (template.glow) {
      ctx.shadowColor = template.highlight_color;
      ctx.shadowBlur = isCurrentActive ? 24 * scaleFactor : 8 * scaleFactor;
    } else if (template.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 14 * scaleFactor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * scaleFactor;
    }

    // Determine active highlight color (with Beast alternating primary colors)
    let activeHighlight = template.highlight_color;
    if (template.alternating_colors && template.alternating_colors.length > 0) {
      const colorIndex = (lineStartIdx + idx) % template.alternating_colors.length;
      activeHighlight = template.alternating_colors[colorIndex];
    }

    // High contrast color selection
    let textColor = template.font_color;
    if (isCurrentActive) {
      // In pill box mode (e.g. Hormozi), text is dark on bright green pill
      textColor = template.word_box ? '#05070a' : activeHighlight;
    } else if (item.word.isEmphasis && template.emphasis_color) {
      textColor = template.emphasis_color;
    }

    // Word transform for active pop
    const centerX = currentX + item.width / 2;
    ctx.translate(centerX, posY);
    ctx.scale(wordScale, wordScale);
    ctx.translate(-centerX, -posY);

    // Thick clean stroke with round joins (prevents letter spikes)
    if (template.stroke_color && template.stroke_width > 0 && !(isCurrentActive && template.word_box)) {
      ctx.strokeStyle = template.stroke_color;
      ctx.lineWidth = Math.max(1.5, template.stroke_width * scaleFactor * 1.5);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(item.text, currentX, posY);
    }

    // Fill high quality text
    ctx.fillStyle = textColor;
    ctx.fillText(item.text, currentX, posY);

    ctx.restore();

    currentX += item.width + wordSpacing;
  });

  ctx.restore();
}

/**
 * Renders the SupoClip Hook Title headline banner in the top safe zone.
 */
function drawHookTitleBanner(
  ctx: CanvasRenderingContext2D,
  hookTitle: string,
  currentTime: number,
  width: number,
  height: number
) {
  const scale = width / 1080;
  const posY = height * 0.16;

  // Entrance & fade out animation
  let alpha = 1.0;
  if (currentTime < 0.3) {
    alpha = currentTime / 0.3;
  } else if (currentTime > 4.2) {
    alpha = Math.max(0, 1 - (currentTime - 4.2) / 0.6);
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  const text = hookTitle.toUpperCase();
  const fontSize = Math.round(38 * scale);
  ctx.font = `900 ${fontSize}px "Space Grotesk", Montserrat, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const bannerWidth = Math.min(width * 0.9, metrics.width + 48 * scale);
  const bannerHeight = fontSize + 28 * scale;

  // Glowing shadow
  ctx.shadowColor = 'rgba(236, 72, 153, 0.4)';
  ctx.shadowBlur = 20 * scale;

  // Pill badge background
  const grad = ctx.createLinearGradient(
    (width - bannerWidth) / 2,
    0,
    (width + bannerWidth) / 2,
    0
  );
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(0.5, '#9333ea');
  grad.addColorStop(1, '#ec4899');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(
    (width - bannerWidth) / 2,
    posY - bannerHeight / 2,
    bannerWidth,
    bannerHeight,
    14 * scale
  );
  ctx.fill();

  // Border outline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  // Text
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, width / 2, posY);

  ctx.restore();
}
