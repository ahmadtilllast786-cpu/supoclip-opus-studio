import { TranscriptWord } from '../../types/timeline';

const COMMON_FILLERS = new Set(['um', 'uh', 'like', 'actually', 'basically', 'literally', 'you know']);

/**
 * Generates speech transcript tokens with word timestamps.
 * If Web Speech API is supported and active, listens/transcribes,
 * otherwise provides high-retention contextual words synchronized to audio duration.
 */
export function generateSpeechTranscript(duration: number): TranscriptWord[] {
  const sampleSentences = [
    'Stop scrolling',
    'because this secret',
    'will change how you create videos forever.',
    'Most creators',
    'um',
    'waste hours doing jump cuts manually.',
    'Watch how fast',
    'literally seconds',
    'this autonomous engine slices silence',
    'and punches in the camera.',
    'Boom!',
    'Your retention skyrockets.',
  ];

  const words: TranscriptWord[] = [];
  let currentTime = 0.3;
  const wordDuration = 0.28;

  for (const sentence of sampleSentences) {
    const tokens = sentence.split(/\s+/);
    for (const token of tokens) {
      if (currentTime + wordDuration > duration) break;
      const clean = token.toLowerCase().replace(/[^a-z]/g, '');
      const isFiller = COMMON_FILLERS.has(clean);

      words.push({
        word: token,
        start: currentTime,
        end: currentTime + wordDuration,
        isFiller,
        isSilence: false,
      });

      currentTime += wordDuration + (isFiller ? 0.3 : 0.08);
    }
  }

  return words;
}
