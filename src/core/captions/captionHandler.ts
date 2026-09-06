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
  const detectedLanguage = options.detectedLanguage || 'auto';

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

/**
 * Creates ONE unified continuous Compound Caption Track item spanning
 * from the first word to the last word, eliminating fragmented track cards.
 */
export function createCompoundCaptionTrack(
  words: TranscriptWord[],
  options: {
    detectedLanguage?: string;
    id?: string;
  } = {}
): CaptionTrackItem[] {
  if (!words || words.length === 0) return [];

  const sortedWords = [...words].sort((a, b) => a.start - b.start);
  const startTime = sortedWords[0].start;
  const endTime = Math.max(startTime + 0.5, sortedWords[sortedWords.length - 1].end);
  const text = sortedWords.map((w) => w.word).join(' ');
  const detectedLanguage = options.detectedLanguage || 'auto';

  return [
    {
      id: options.id || 'caption-master-1',
      text,
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(endTime.toFixed(2)),
      words: sortedWords,
      detectedLanguage,
      type: 'compound-captions',
    },
  ];
}

/**
 * Splits a Compound Caption item into two independent blocks at splitSec.
 * Block A: startTime to splitSec
 * Block B: splitSec to endTime
 */
export function splitCompoundCaptionItem(
  item: CaptionTrackItem,
  splitSec: number
): [CaptionTrackItem, CaptionTrackItem] | null {
  const normSplit = Number(splitSec.toFixed(2));
  if (normSplit <= item.startTime + 0.1 || normSplit >= item.endTime - 0.1) {
    return null;
  }

  const wordsBefore = item.words.filter((w) => (w.start + w.end) / 2 < normSplit);
  const wordsAfter = item.words.filter((w) => (w.start + w.end) / 2 >= normSplit);

  const blockA: CaptionTrackItem = {
    ...item,
    id: `${item.id}-a-${Date.now()}`,
    startTime: item.startTime,
    endTime: normSplit,
    words: wordsBefore,
    text: wordsBefore.map((w) => w.word).join(' '),
    type: 'compound-captions',
  };

  const blockB: CaptionTrackItem = {
    ...item,
    id: `${item.id}-b-${Date.now()}`,
    startTime: normSplit,
    endTime: item.endTime,
    words: wordsAfter,
    text: wordsAfter.map((w) => w.word).join(' '),
    type: 'compound-captions',
  };

  return [blockA, blockB];
}

/**
 * Cleanly shifts all word timestamps inside a compound caption block when dragged along the timeline.
 */
export function shiftCaptionBlockTime(
  item: CaptionTrackItem,
  deltaSec: number
): CaptionTrackItem {
  const normDelta = Number(deltaSec.toFixed(2));
  const newStart = Math.max(0, Number((item.startTime + normDelta).toFixed(2)));
  const shift = newStart - item.startTime;
  const newEnd = Number((item.endTime + shift).toFixed(2));

  const updatedWords = item.words.map((w) => ({
    ...w,
    start: Number((w.start + shift).toFixed(2)),
    end: Number((w.end + shift).toFixed(2)),
  }));

  return {
    ...item,
    startTime: newStart,
    endTime: newEnd,
    words: updatedWords,
  };
}

/**
 * Synchronizes compound caption containers with updated words while preserving user splits.
 */
export function syncCompoundCaptionsWithWords(
  existingCaptions: CaptionTrackItem[],
  words: TranscriptWord[],
  detectedLanguage?: string
): CaptionTrackItem[] {
  if (!words || words.length === 0) return [];
  if (!existingCaptions || existingCaptions.length <= 1) {
    return createCompoundCaptionTrack(words, {
      detectedLanguage,
      id: existingCaptions[0]?.id || 'caption-master-1',
    });
  }

  return existingCaptions.map((cap) => {
    const blockWords = words.filter(
      (w) => (w.start + w.end) / 2 >= cap.startTime && (w.start + w.end) / 2 < cap.endTime
    );
    return {
      ...cap,
      words: blockWords,
      text: blockWords.map((w) => w.word).join(' '),
      detectedLanguage: detectedLanguage || cap.detectedLanguage || 'auto',
      type: 'compound-captions',
    };
  });
}
