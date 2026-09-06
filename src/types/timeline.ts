export type TransitionType = 'none' | 'whip-pan' | 'dissolve' | 'zoom-in' | 'zoom-out' | 'glitch';

export type SfxPreset = 'pop' | 'ding' | 'swoosh' | 'vine-boom' | 'camera-shutter' | 'laser' | 'cash';

export type OverlayAnimation = 'pop' | 'bounce' | 'swoosh' | 'slide-up' | 'glitch' | 'pulse';

export type CaptionTemplateId = 'default' | 'hormozi' | 'mrbeast' | 'beast' | 'tiktok' | 'neon' | 'minimal' | 'podcast';

export interface CaptionTemplate {
  id: CaptionTemplateId;
  name: string;
  description: string;
  font_family: string;
  font_size: number;
  font_color: string;
  highlight_color: string;
  emphasis_color: string | null;
  stroke_color: string | null;
  stroke_width: number;
  background: boolean;
  background_color: string | null;
  word_box: boolean;
  word_box_color: string | null;
  animation: 'karaoke' | 'pop' | 'fade' | 'bounce';
  word_pop: boolean;
  emoji: boolean;
  uppercase: boolean;
  shadow: boolean;
  glow: boolean;
  max_words_per_line: number;
  position_x: number; // Normalized 0-1, default 0.5 (horizontal center)
  position_y: number; // Normalized 0-1, default 0.75 (vertical placement)
  preset_id?: string;
  alternating_colors?: string[]; // High-contrast primary colors for Beast style
  fade_transition?: boolean;     // Soft fade for Minimal Clean
  bounce_intensity?: number;     // Scale bounce magnitude on active spoken words
}

export interface ViralityScorecard {
  overall: number;       // 0 to 100
  hook: number;          // 0 to 100
  engagement: number;    // 0 to 100
  value: number;         // 0 to 100
  shareability: number;  // 0 to 100
  hookType: 'Curiosity Gap' | 'Contrarian Take' | 'Shock & Awe' | 'High Stakes Question' | 'Actionable Secret';
  hookTitle: string;
  reasoning: string;
}

export interface ViralClipSegment {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  duration: number;
  scores: ViralityScorecard;
  transcript: string;
  words: TranscriptWord[];
}

export interface VideoClip {
  id: string;
  name: string;
  sourceUrl: string;
  blob?: Blob;
  originalDuration: number;
  inPoint: number;       // Trimming start inside source (seconds)
  outPoint: number;      // Trimming end inside source (seconds)
  duration: number;      // (outPoint - inPoint) / speed
  startTimelineTime: number; // Start position on sequential timeline (seconds)
  speed: number;         // 1.0 = normal
  volume: number;        // 0 to 2.0 (0% to 200%)
  isMuted?: boolean;
  zoomScale: number;     // 1.0 (default) to 1.5 (punch zoom)
  zoomCenter: { x: number; y: number }; // Relative 0-1, default 0.5, 0.5
  transitionIn: TransitionType;
  transitionDuration: number; // e.g. 0.3s
  waveform?: number[];   // Visual peak representation
  faceCenterX?: number;  // Detected face horizontal center (0-1) for smart auto-framing
  audioBuffer?: AudioBuffer;
}

export interface StickerOverlay {
  id: string;
  emoji: string;
  label: string;
  startTimelineTime: number;
  duration: number;      // e.g. 1.2 seconds
  x: number;             // Percentage 0-100 on canvas
  y: number;             // Percentage 0-100 on canvas
  scale: number;         // Scale multiplier, e.g. 1.0 - 2.5
  rotation: number;      // In degrees
  animation: OverlayAnimation;
  pairedSfx: SfxPreset | 'custom' | null;
  pairedSfxId?: string;
  isDisabled?: boolean;  // Per-item visibility bypass toggle
  assetUrl?: string;     // Vector SVG or Lottie path, e.g. '/stickers/fire.svg'
  assetType?: 'emoji' | 'svg' | 'lottie' | 'webp';
  category?: string;     // 'trending' | 'arrows' | 'social'
}

export interface StickerCatalogItem {
  id: string;
  name: string;
  category: 'trending' | 'arrows' | 'social' | string;
  emoji: string;
  label: string;
  assetUrl: string;
  previewUrl?: string;
  format: 'svg' | 'lottie' | 'emoji';
  sfx: SfxPreset;
  sfxLabel: string;
  defaultAnimation: OverlayAnimation;
  tags: string[];
}

export interface DiagnosticSettings {
  maxActiveOverlays: number;       // 0 to 5 (limit simultaneous overlays on screen)
  sfxThrottleIntervalMs: number;   // 50 to 2000 ms (minimum delay between sounds)
  masterOverlayVisible: boolean;   // master switch to show/hide all visual overlays
  masterSfxMuted: boolean;         // master switch to mute all sound effects
}

export interface SfxTrackItem {
  id: string;
  name: string;
  preset: SfxPreset;
  startTimelineTime: number;
  duration: number;
  volume: number;        // 0 to 2.0 (0% to 200%)
  isMuted?: boolean;
  linkedOverlayId?: string;
  audioBuffer?: AudioBuffer;
}

export interface CaptionTrackItem {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
  detectedLanguage?: string;
  isLocked?: boolean;
  type?: 'compound-captions' | 'phrase';
  templateOverride?: CaptionTemplateId;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
  isSilence?: boolean;
  isFiller?: boolean;
  isEmphasis?: boolean;
  emoji?: string;
  color?: string;
}

export interface DynamicZoomKeyframe {
  id: string;
  startTimelineTime: number;
  duration: number;
  scale: number; // 1.1x to 1.35x
  centerX: number;
  centerY: number;
  style: 'snappy' | 'smooth' | 'step';
}

export interface ExportSettings {
  resolution: '1080x1920' | '2160x3840' | '1080x1080' | '1920x1080';
  fps: 30 | 60;
  bitrateMbps: number; // e.g. 25 - 50 Mbps
  format: 'mp4-webcodecs' | 'webm-recorder' | 'ffmpeg-cli';
}

export interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
}
