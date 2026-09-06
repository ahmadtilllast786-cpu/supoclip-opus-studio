import { CaptionTrackItem, TranscriptWord } from '../../types/timeline';

export interface GroupWordsOptions {
  maxWordsPerChunk?: number;
  maxDurationSec?: number;
  pauseThresholdSec?: number;
  detectedLanguage?: string;
}

/**
 * Groups raw timestamped words into short, punchy subtitle chunks
 * (Opus Clip / Alex Hormozi cadence of 2-4 words per card), breaking
 * naturally on speech pauses and punctuation.
 */
export function groupWordsIntoCaptionChunks(
  words: TranscriptWord[],
  options: GroupWordsOptions = {}
): CaptionTrackItem[] {
  if (!words || words.length === 0) return [];

  const maxWords = options.maxWordsPerChunk || 3;
  const maxDur = options.maxDurationSec || 2.4;
  const pauseThreshold = options.pauseThresholdSec || 0.35;
  const detectedLanguage = options.detectedLanguage || 'en';

  const chunks: CaptionTrackItem[] = [];
  let currentWords: TranscriptWord[] = [];

  const flushChunk = () => {
    if (currentWords.length === 0) return;
    const startTime = currentWords[0].start;
    const endTime = currentWords[currentWords.length - 1].end;
    const text = currentWords.map((w) => w.word).join(' ');

    chunks.push({
      id: `caption-${chunks.length}-${Date.now()}`,
      text,
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(Math.max(startTime + 0.3, endTime).toFixed(2)),
      words: [...currentWords],
      detectedLanguage,
    });
    currentWords = [];
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = words[i - 1];

    // Check natural boundary conditions:
    // 1. Pause gap in speech
    const hasPauseGap = prevWord && word.start - prevWord.end >= pauseThreshold;

    // 2. Strong sentence/phrase punctuation on previous word
    const hasPunctuationBreak = prevWord && /[.?!,;:]$/.test(prevWord.word.trim());

    // 3. Max words per card exceeded
    const isMaxWordsReached = currentWords.length >= maxWords;

    // 4. Max duration for single card exceeded
    const isDurationExceeded =
      currentWords.length > 0 && word.end - currentWords[0].start > maxDur;

    if (
      currentWords.length > 0 &&
      (hasPauseGap || hasPunctuationBreak || isMaxWordsReached || isDurationExceeded)
    ) {
      flushChunk();
    }

    currentWords.push(word);
  }

  flushChunk();

  return chunks;
}

/**
 * Recalculates individual word start and end times proportionally when a subtitle
 * card is trimmed or dragged along the timeline.
 */
export function recalculateChunkWordTimings(
  chunk: CaptionTrackItem,
  newStartTime: number,
  newEndTime: number
): CaptionTrackItem {
  const newDuration = Math.max(0.2, newEndTime - newStartTime);
  const words = chunk.words;

  if (words.length === 0) {
    return {
      ...chunk,
      startTime: newStartTime,
      endTime: newEndTime,
    };
  }

  const origStart = words[0].start;
  const origEnd = words[words.length - 1].end;
  const origDuration = Math.max(0.1, origEnd - origStart);

  const updatedWords = words.map((w) => {
    const relStartRatio = (w.start - origStart) / origDuration;
    const relEndRatio = (w.end - origStart) / origDuration;

    const wStart = newStartTime + relStartRatio * newDuration;
    const wEnd = newStartTime + relEndRatio * newDuration;

    return {
      ...w,
      start: Number(wStart.toFixed(2)),
      end: Number(wEnd.toFixed(2)),
    };
  });

  return {
    ...chunk,
    startTime: Number(newStartTime.toFixed(2)),
    endTime: Number(newEndTime.toFixed(2)),
    words: updatedWords,
  };
}

/**
 * Flattens all words across caption chunks into a unified sorted TranscriptWord array.
 */
export function flattenCaptionsToWords(captions: CaptionTrackItem[]): TranscriptWord[] {
  const allWords: TranscriptWord[] = [];
  captions.forEach((c) => {
    allWords.push(...c.words);
  });
  return allWords.sort((a, b) => a.start - b.start);
}
