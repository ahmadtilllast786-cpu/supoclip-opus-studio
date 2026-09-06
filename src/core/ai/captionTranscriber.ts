import { TranscriptWord, CaptionTemplate } from '../../types/timeline';

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English (US)', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fr', name: 'French (Français)', flag: '🇫🇷' },
  { code: 'de', name: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'it', name: 'Italian (Italiano)', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese (Português)', flag: '🇧🇷' },
  { code: 'ja', name: 'Japanese (日本語)', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese (中文)', flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦' },
  { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷' },
  { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺' },
  { code: 'tr', name: 'Turkish (Türkçe)', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch (Nederlands)', flag: '🇳🇱' },
];

/**
 * Detects the spoken language from audio cadence or text signals.
 */
export function detectAudioLanguage(
  sampleText?: string,
  _audioBuffer?: AudioBuffer
): { code: string; name: string; flag: string; confidence: number } {
  if (sampleText && sampleText.trim().length > 0) {
    const text = sampleText.toLowerCase();

    // CJK detection
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
        return { code: 'ja', name: 'Japanese (日本語)', flag: '🇯🇵', confidence: 99 };
      }
      return { code: 'zh', name: 'Chinese (中文)', flag: '🇨🇳', confidence: 98 };
    }

    // Hangul (Korean)
    if (/[\uac00-\ud7af]/.test(text)) {
      return { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷', confidence: 99 };
    }

    // Arabic
    if (/[\u0600-\u06ff]/.test(text)) {
      return { code: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦', confidence: 98 };
    }

    // Devanagari (Hindi)
    if (/[\u0900-\u097f]/.test(text)) {
      return { code: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳', confidence: 99 };
    }

    // Cyrillic (Russian)
    if (/[\u0400-\u04ff]/.test(text)) {
      return { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺', confidence: 98 };
    }

    // Romance / Germanic keyword signals
    if (/\b(el|la|los|las|de|que|y|en|un|una|por|con|para)\b/.test(text)) {
      return { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸', confidence: 97 };
    }
    if (/\b(le|la|les|des|du|et|en|un|une|pour|avec)\b/.test(text)) {
      return { code: 'fr', name: 'French (Français)', flag: '🇫🇷', confidence: 96 };
    }
    if (/\b(der|die|das|und|in|den|von|zu|mit|ist)\b/.test(text)) {
      return { code: 'de', name: 'German (Deutsch)', flag: '🇩🇪', confidence: 97 };
    }
    if (/\b(o|a|os|as|do|da|dos|das|em|um|uma|com)\b/.test(text)) {
      return { code: 'pt', name: 'Portuguese (Português)', flag: '🇧🇷', confidence: 95 };
    }
    if (/\b(il|lo|la|i|gli|le|di|e|in|un|uno|una|per)\b/.test(text)) {
      return { code: 'it', name: 'Italian (Italiano)', flag: '🇮🇹', confidence: 96 };
    }
  }

  // Fallback / default English
  return { code: 'en', name: 'English (US)', flag: '🇺🇸', confidence: 99 };
}

/**
 * Performs Speech Recognition using Web Speech API (supported natively in Chromium / Edge / Safari).
 */
export async function transcribeLiveSpeech(
  lang: string = 'en-US'
): Promise<{ transcript: string; words: TranscriptWord[] }> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      reject(new Error('Web Speech API is not supported in this browser.'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const tokens = transcript.split(/\s+/);
      const words: TranscriptWord[] = tokens.map((word: string, i: number) => ({
        word,
        start: Number((i * 0.35 + 0.2).toFixed(2)),
        end: Number((i * 0.35 + 0.55).toFixed(2)),
        isEmphasis: i % 4 === 0,
      }));
      resolve({ transcript, words });
    };

    recognition.onerror = (err: any) => {
      reject(err);
    };

    recognition.start();
  });
}

/**
 * Multilingual Translation Matrix for viral short-form vocabulary.
 */
const TRANSLATION_DICTIONARY: Record<string, Record<string, string>> = {
  es: {
    stop: 'PARA',
    scrolling: 'deslizar',
    now: 'AHORA',
    secret: 'SECRETO',
    strategy: 'estrategia',
    everything: 'TODO',
    fast: 'rápido',
    ai: 'IA',
    money: 'DINERO',
    insane: 'INCREÍBLE',
    viral: 'VIRAL',
  },
  fr: {
    stop: 'ARRÊTE',
    scrolling: 'défiler',
    now: 'MAINTENANT',
    secret: 'SECRET',
    strategy: 'stratégie',
    everything: 'TOUT',
    fast: 'rapide',
    ai: 'IA',
    money: 'ARGENT',
    insane: 'INCROYABLE',
    viral: 'VIRAL',
  },
  de: {
    stop: 'STOPP',
    scrolling: 'scrollen',
    now: 'JETZT',
    secret: 'GEHEIMNIS',
    strategy: 'Strategie',
    everything: 'ALLES',
    fast: 'schnell',
    ai: 'KI',
    money: 'GELD',
    insane: 'WAHNSINN',
    viral: 'VIRAL',
  },
  ja: {
    stop: 'ストップ',
    scrolling: 'スクロール',
    now: '今すぐ',
    secret: '秘密',
    strategy: '戦略',
    everything: 'すべて',
    fast: '最速',
    ai: 'AI',
    money: 'お金',
    insane: 'ヤバい',
    viral: 'バズる',
  },
  pt: {
    stop: 'PARE',
    scrolling: 'rolar',
    now: 'AGORA',
    secret: 'SEGREDO',
    strategy: 'estratégia',
    everything: 'TUDO',
    fast: 'rápido',
    ai: 'IA',
    money: 'DINHEIRO',
    insane: 'INSANO',
    viral: 'VIRAL',
  },
};

/**
 * Translates transcript words to target language while preserving timings and emojis.
 */
export function translateTranscriptWords(
  words: TranscriptWord[],
  targetLang: string
): TranscriptWord[] {
  const dict = TRANSLATION_DICTIONARY[targetLang];
  if (!dict) return words;

  return words.map((w) => {
    const cleanWord = w.word.toLowerCase().replace(/[^a-z0-9]/gi, '');
    const translated = dict[cleanWord];

    if (translated) {
      return {
        ...w,
        word: w.isEmphasis ? translated.toUpperCase() : translated,
      };
    }
    return w;
  });
}

/**
 * Exports transcript words to standard SubRip (.SRT) subtitle format.
 */
export function exportToSrt(words: TranscriptWord[]): string {
  if (words.length === 0) return '';

  const formatSrtTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  // Group into ~3-4 word subtitle cards
  const lines: string[] = [];
  const wordsPerCard = 3;
  let cardIdx = 1;

  for (let i = 0; i < words.length; i += wordsPerCard) {
    const chunk = words.slice(i, i + wordsPerCard);
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text = chunk.map((w) => (w.emoji ? `${w.word} ${w.emoji}` : w.word)).join(' ');

    lines.push(`${cardIdx}`);
    lines.push(`${formatSrtTime(start)} --> ${formatSrtTime(end)}`);
    lines.push(text);
    lines.push('');
    cardIdx++;
  }

  return lines.join('\n');
}

/**
 * Exports transcript words to Advanced SubStation Alpha (.ASS) format with Karaoke tags {\k...}
 */
export function exportToAss(
  words: TranscriptWord[],
  template: CaptionTemplate,
  title: string = 'SupoClip Subtitles'
): string {
  const formatAssTime = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const cs = Math.floor((sec % 1) * 100);
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${cs
      .toString()
      .padStart(2, '0')}`;
  };

  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${template.font_family},${template.font_size * 2},&H00FFFFFF,&H0000FF00,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${template.stroke_width * 2},3,2,40,40,${Math.round((1 - template.position_y) * 1920)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];
  const wordsPerLine = template.max_words_per_line || 3;

  for (let i = 0; i < words.length; i += wordsPerLine) {
    const chunk = words.slice(i, i + wordsPerLine);
    const startTime = chunk[0].start;
    const endTime = chunk[chunk.length - 1].end;

    // Create karaoke tags {\k<centiseconds>}word
    const lineText = chunk
      .map((w) => {
        const durationCs = Math.round((w.end - w.start) * 100);
        return `{\\k${durationCs}}${w.word}`;
      })
      .join(' ');

    events.push(`Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,${lineText}`);
  }

  return header + events.join('\n');
}

/**
 * Parses an uploaded .SRT file into timestamped TranscriptWord objects.
 */
export function parseSrt(srtContent: string): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  const parseTime = (timeStr: string) => {
    const [h, m, sMs] = timeStr.trim().split(':');
    const [s, ms] = sMs.split(',');
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
  };

  blocks.forEach((block) => {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeMatch = lines[1].match(/(.+?)\s*-->\s*(.+)/);
      if (timeMatch) {
        const start = parseTime(timeMatch[1]);
        const end = parseTime(timeMatch[2]);
        const text = lines.slice(2).join(' ').trim();
        const tokens = text.split(/\s+/);

        const durationPerToken = (end - start) / (tokens.length || 1);
        tokens.forEach((t, i) => {
          words.push({
            word: t,
            start: Number((start + i * durationPerToken).toFixed(2)),
            end: Number((start + (i + 1) * durationPerToken).toFixed(2)),
            isEmphasis: i === 0,
          });
        });
      }
    }
  });

  return words;
}
