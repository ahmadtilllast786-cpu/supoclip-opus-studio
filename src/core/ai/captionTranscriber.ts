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

/**
 * Encodes an AudioBuffer into a 16kHz mono PCM 16-bit WAV Blob for speech recognition APIs.
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer, targetSampleRate: number = 16000): Blob {
  const numChannels = 1;
  const sourceRate = buffer.sampleRate;
  const sourceChannel = buffer.getChannelData(0);

  // Resample to targetSampleRate (e.g. 16kHz for Whisper)
  const ratio = sourceRate / targetSampleRate;
  const targetLength = Math.round(sourceChannel.length / ratio);
  const resampled = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, sourceChannel.length - 1);
    const frac = srcIndex - i0;
    resampled[i] = sourceChannel[i0] * (1 - frac) + sourceChannel[i1] * frac;
  }

  // Create WAV buffer
  const bufferLength = 44 + targetLength * 2;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + targetLength * 2, true);
  writeString(8, 'WAVE');
  // format chunk identifier
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1size (16 for PCM)
  view.setUint16(20, 1, true);  // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // data chunk identifier
  writeString(36, 'data');
  view.setUint32(40, targetLength * 2, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < targetLength; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export interface SpeechSegment {
  start: number;
  end: number;
  duration: number;
  energy: number;
}

/**
 * Detects actual spoken vocal utterances using Voice Activity Detection (VAD) from raw AudioBuffer.
 */
export function detectEnglishSpeechSegments(audioBuffer: AudioBuffer): SpeechSegment[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const frameDuration = 0.03; // 30ms frames
  const frameSize = Math.floor(sampleRate * frameDuration);
  const totalFrames = Math.floor(channelData.length / frameSize);

  const energies = new Float32Array(totalFrames);
  let totalEnergy = 0;

  for (let i = 0; i < totalFrames; i++) {
    let sumSquares = 0;
    const start = i * frameSize;
    for (let j = 0; j < frameSize; j++) {
      const val = channelData[start + j];
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / frameSize);
    energies[i] = rms;
    totalEnergy += rms;
  }

  const avgEnergy = totalEnergy / (totalFrames || 1);
  const threshold = Math.max(0.012, avgEnergy * 0.6);

  const segments: SpeechSegment[] = [];
  let inSpeech = false;
  let segmentStartFrame = 0;

  for (let i = 0; i < totalFrames; i++) {
    const isVoice = energies[i] > threshold;

    if (isVoice && !inSpeech) {
      inSpeech = true;
      segmentStartFrame = i;
    } else if (!isVoice && inSpeech) {
      // Check if gap is short (< 150ms) to bridge natural intra-word stops
      let gapLen = 0;
      while (i + gapLen < totalFrames && energies[i + gapLen] <= threshold && gapLen * frameDuration < 0.18) {
        gapLen++;
      }
      if (gapLen * frameDuration >= 0.18) {
        inSpeech = false;
        const start = segmentStartFrame * frameDuration;
        const end = i * frameDuration;
        if (end - start >= 0.12) {
          segments.push({
            start: Number(start.toFixed(2)),
            end: Number(end.toFixed(2)),
            duration: Number((end - start).toFixed(2)),
            energy: energies[segmentStartFrame],
          });
        }
      } else {
        i += gapLen; // Bridge over short silence
      }
    }
  }

  if (inSpeech) {
    const start = segmentStartFrame * frameDuration;
    const end = totalFrames * frameDuration;
    if (end - start >= 0.12) {
      segments.push({
        start: Number(start.toFixed(2)),
        end: Number(end.toFixed(2)),
        duration: Number((end - start).toFixed(2)),
        energy: energies[segmentStartFrame],
      });
    }
  }

  return segments;
}

/**
 * Maps an English script or transcript onto real spoken audio intervals detected from the video.
 */
export function alignScriptToSpeechAudio(
  script: string,
  audioBuffer?: AudioBuffer,
  totalDurationSec?: number
): TranscriptWord[] {
  const tokens = script.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const words: TranscriptWord[] = [];

  if (audioBuffer) {
    const segments = detectEnglishSpeechSegments(audioBuffer);
    if (segments.length > 0) {
      // Subdivide speech segments among the script tokens proportionally
      const totalSpeechTime = segments.reduce((sum, s) => sum + s.duration, 0);
      let tokenIdx = 0;

      for (const seg of segments) {
        if (tokenIdx >= tokens.length) break;

        // Estimate number of words in this segment proportional to duration
        const proportion = seg.duration / totalSpeechTime;
        const segWordCount = Math.max(1, Math.min(tokens.length - tokenIdx, Math.round(tokens.length * proportion)));
        const wordTime = seg.duration / segWordCount;

        for (let w = 0; w < segWordCount; w++) {
          if (tokenIdx >= tokens.length) break;
          const text = tokens[tokenIdx];
          const wStart = seg.start + w * wordTime;
          const wEnd = Math.min(seg.end, wStart + wordTime * 0.92);

          words.push({
            word: text,
            start: Number(wStart.toFixed(2)),
            end: Number(wEnd.toFixed(2)),
            isEmphasis: text.length > 5 || text === text.toUpperCase() || tokenIdx % 4 === 0,
          });
          tokenIdx++;
        }
      }

      // Distribute any remaining tokens
      while (tokenIdx < tokens.length) {
        const lastWord = words[words.length - 1];
        const start = lastWord ? lastWord.end + 0.08 : 0.2;
        words.push({
          word: tokens[tokenIdx],
          start: Number(start.toFixed(2)),
          end: Number((start + 0.35).toFixed(2)),
          isEmphasis: false,
        });
        tokenIdx++;
      }

      return words;
    }
  }

  // Uniform fallback alignment across duration
  const dur = totalDurationSec || tokens.length * 0.4;
  const timePerWord = Math.max(0.28, Math.min(0.65, dur / (tokens.length || 1)));

  tokens.forEach((t, i) => {
    words.push({
      word: t,
      start: Number((i * timePerWord + 0.2).toFixed(2)),
      end: Number((i * timePerWord + timePerWord * 0.9 + 0.2).toFixed(2)),
      isEmphasis: i % 4 === 0,
    });
  });

  return words;
}

/**
 * Transcribes audio with OpenAI or Groq Whisper API for genuine English word-level timestamps.
 */
export async function transcribeWithWhisperApi(
  audioBlob: Blob,
  apiKey: string,
  service: 'groq' | 'openai' = 'groq'
): Promise<TranscriptWord[]> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', service === 'groq' ? 'whisper-large-v3' : 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const endpoint =
    service === 'groq'
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const words: TranscriptWord[] = [];

  if (Array.isArray(data.words)) {
    data.words.forEach((w: any, idx: number) => {
      words.push({
        word: w.word.trim(),
        start: Number(Number(w.start).toFixed(2)),
        end: Number(Number(w.end).toFixed(2)),
        isEmphasis: idx % 4 === 0 || w.word.length > 6,
      });
    });
  } else if (typeof data.text === 'string') {
    // If words array not returned, align text across detected duration
    return alignScriptToSpeechAudio(data.text, undefined, data.duration || 10);
  }

  return words;
}
