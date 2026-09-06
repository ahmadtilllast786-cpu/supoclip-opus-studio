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

/**
 * Renders SupoClip-style word-by-word animated captions and Hook Title banner on HTML5 Canvas.
 */
export function renderCaptionsAndHookTitle(options: RenderCaptionsOptions) {
  const { ctx, currentTime, words, template, hookTitle, width, height } = options;

  // 1. Render Burned-In Hook Title Banner in Top Safe Zone (first 4.5 seconds)
  if (hookTitle && currentTime >= 0 && currentTime <= 4.8) {
    drawHookTitleBanner(ctx, hookTitle, currentTime, width, height);
  }

  // 2. Render Word-Level Animated Subtitles
  if (!words || words.length === 0) return;

  // Find active word index
  const activeWordIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  // If no word is strictly active, check if we are within speech range
  let targetIdx = activeWordIdx;
  if (targetIdx === -1) {
    targetIdx = words.findIndex((w) => currentTime < w.start);
    if (targetIdx > 0) targetIdx -= 1;
    else targetIdx = 0;

    const nearWord = words[targetIdx];
    if (!nearWord || Math.abs(currentTime - nearWord.end) > 0.6) {
      return; // Outside active subtitle window
    }
  }

  // Group into line chunks according to template.max_words_per_line
  const wordsPerLine = template.max_words_per_line || 4;
  const lineStartIdx = Math.floor(targetIdx / wordsPerLine) * wordsPerLine;
  const lineWords = words.slice(lineStartIdx, lineStartIdx + wordsPerLine);

  if (lineWords.length === 0) return;

  ctx.save();

  // Calculate scaled font size relative to 1080 canvas width
  const scaleFactor = width / 1080;
  const fontSize = Math.round(template.font_size * scaleFactor * 1.35);
  ctx.font = `900 ${fontSize}px ${template.font_family}`;
  ctx.textBaseline = 'middle';

  const posY = template.position_y * height;

  // Measure word widths to center the line
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

  let currentX = (width - totalLineWidth) / 2;

  // Optional background container for minimal/podcast templates
  if (template.background && template.background_color) {
    ctx.fillStyle = template.background_color;
    const paddingH = 24 * scaleFactor;
    const paddingV = 14 * scaleFactor;
    const boxHeight = fontSize + paddingV * 2;
    const boxY = posY - boxHeight / 2;

    ctx.beginPath();
    ctx.roundRect(
      currentX - paddingH,
      boxY,
      totalLineWidth + paddingH * 2,
      boxHeight,
      12 * scaleFactor
    );
    ctx.fill();
  }

  // Render each word
  wordMeasurements.forEach((item) => {
    const isCurrentActive =
      currentTime >= item.word.start && currentTime <= item.word.end;
    const elapsedInWord = currentTime - item.word.start;

    ctx.save();

    let wordScale = 1.0;
    let wordAlpha = 1.0;

    // SupoClip "word_pop" spring animation on active karaoke word
    if (isCurrentActive && template.word_pop) {
      const popT = Math.min(1, elapsedInWord / 0.12);
      wordScale = 1.0 + 0.18 * Math.sin(popT * Math.PI);
    }

    // Hormozi Style Word Box / Pill behind active word
    if (isCurrentActive && template.word_box && template.word_box_color) {
      const pillPadH = 14 * scaleFactor;
      const pillPadV = 8 * scaleFactor;
      const pillHeight = fontSize + pillPadV * 2;

      ctx.fillStyle = template.word_box_color;
      ctx.beginPath();
      ctx.roundRect(
        currentX - pillPadH / 2,
        posY - pillHeight / 2,
        item.width + pillPadH,
        pillHeight,
        8 * scaleFactor
      );
      ctx.fill();
    }

    // Neon Glow effect
    if (template.glow) {
      ctx.shadowColor = template.highlight_color;
      ctx.shadowBlur = isCurrentActive ? 22 * scaleFactor : 8 * scaleFactor;
    } else if (template.shadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 10 * scaleFactor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4 * scaleFactor;
    }

    // Determine font color
    let textColor = template.font_color;
    if (isCurrentActive) {
      textColor = template.highlight_color;
    } else if (item.word.isEmphasis && template.emphasis_color) {
      textColor = template.emphasis_color;
    }

    // Word transform for pop
    const centerX = currentX + item.width / 2;
    ctx.translate(centerX, posY);
    ctx.scale(wordScale, wordScale);
    ctx.translate(-centerX, -posY);

    // Draw outline
    if (template.stroke_color && template.stroke_width > 0) {
      ctx.strokeStyle = template.stroke_color;
      ctx.lineWidth = template.stroke_width * scaleFactor * 1.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(item.text, currentX, posY);
    }

    // Fill text
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
