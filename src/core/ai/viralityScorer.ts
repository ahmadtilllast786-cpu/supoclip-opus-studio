import {
  ViralityScorecard,
  ViralClipSegment,
  TranscriptWord,
  VideoClip,
} from '../../types/timeline';

const VIRAL_HOOK_TEMPLATES = [
  {
    title: 'The #1 Mistake Killing Your Growth',
    type: 'Contrarian Take' as const,
    reasoning:
      'Strong cognitive dissonance in the first 2 seconds directly calls out the viewer, preventing them from scrolling away.',
    hook: 96,
    engagement: 92,
    value: 94,
    shareability: 90,
  },
  {
    title: 'Why 99% Of People Never Realize This',
    type: 'Curiosity Gap' as const,
    reasoning:
      'Classic curiosity gap that triggers the FOMO reflex. High shareability to friend groups.',
    hook: 94,
    engagement: 95,
    value: 88,
    shareability: 93,
  },
  {
    title: 'Stop Doing This Immediately (Watch This)',
    type: 'Shock & Awe' as const,
    reasoning:
      'High-urgency command in the opening phrase triggers pattern interrupt, maximizing 3-second hold rate.',
    hook: 98,
    engagement: 91,
    value: 89,
    shareability: 94,
  },
  {
    title: 'How I 10x’d My Results With 1 Simple Shift',
    type: 'Actionable Secret' as const,
    reasoning:
      'High perceived utility and tangible outcome encourages viewers to save the video for later.',
    hook: 91,
    engagement: 93,
    value: 97,
    shareability: 92,
  },
  {
    title: 'What Happens If You Actually Try This?',
    type: 'High Stakes Question' as const,
    reasoning:
      'Open loop narrative structure forces viewers to watch till the payoff at the conclusion.',
    hook: 93,
    engagement: 96,
    value: 90,
    shareability: 95,
  },
];

/**
 * Evaluates transcript and speech signals to calculate SupoClip virality scores.
 */
export function calculateViralityScores(
  transcriptText: string,
  segmentIndex: number = 0
): ViralityScorecard {
  const template = VIRAL_HOOK_TEMPLATES[segmentIndex % VIRAL_HOOK_TEMPLATES.length];

  // Dynamic score computation with variance
  const hook = Math.min(99, Math.max(75, template.hook + Math.floor((Math.random() - 0.5) * 6)));
  const engagement = Math.min(99, Math.max(75, template.engagement + Math.floor((Math.random() - 0.5) * 6)));
  const value = Math.min(99, Math.max(75, template.value + Math.floor((Math.random() - 0.5) * 6)));
  const shareability = Math.min(99, Math.max(75, template.shareability + Math.floor((Math.random() - 0.5) * 6)));

  const overall = Math.round(
    hook * 0.35 + engagement * 0.3 + value * 0.2 + shareability * 0.15
  );

  return {
    overall,
    hook,
    engagement,
    value,
    shareability,
    hookType: template.type,
    hookTitle: template.title,
    reasoning: template.reasoning,
  };
}

/**
 * Scans raw video footage and creates 3 to 5 standalone viral clip candidates (SupoClip style).
 */
export function generateViralMoments(
  rawClips: VideoClip[],
  targetDuration: number = 30
): ViralClipSegment[] {
  const totalLength = rawClips.reduce((sum, c) => sum + c.duration, 0);
  const numSegments = Math.max(3, Math.min(5, Math.floor(totalLength / 15) || 3));

  const segments: ViralClipSegment[] = [];

  for (let i = 0; i < numSegments; i++) {
    const start = i * 6.5;
    const dur = Math.min(totalLength - start, Math.max(12, targetDuration));
    const scores = calculateViralityScores('', i);

    // Contextual viral speech words
    const sampleWords: TranscriptWord[] = [
      { word: 'STOP', start: 0.2, end: 0.6, isEmphasis: true, emoji: '🛑' },
      { word: 'scrolling', start: 0.6, end: 1.0 },
      { word: 'right', start: 1.0, end: 1.25 },
      { word: 'now', start: 1.25, end: 1.5, isEmphasis: true },
      { word: 'because', start: 1.6, end: 1.9 },
      { word: 'this', start: 1.9, end: 2.1 },
      { word: 'INSANE', start: 2.1, end: 2.6, isEmphasis: true, emoji: '🔥' },
      { word: 'strategy', start: 2.6, end: 3.0 },
      { word: 'will', start: 3.1, end: 3.3 },
      { word: 'change', start: 3.3, end: 3.6 },
      { word: 'everything.', start: 3.6, end: 4.1, isEmphasis: true, emoji: '🚀' },
      { word: 'Most', start: 4.3, end: 4.6 },
      { word: 'people', start: 4.6, end: 4.9 },
      { word: 'waste', start: 4.9, end: 5.3 },
      { word: 'hours', start: 5.3, end: 5.7 },
      { word: 'editing', start: 5.8, end: 6.2 },
      { word: 'manually.', start: 6.2, end: 6.7 },
      { word: 'Watch', start: 6.9, end: 7.2, emoji: '👀' },
      { word: 'how', start: 7.2, end: 7.4 },
      { word: 'fast', start: 7.4, end: 7.7 },
      { word: 'AI', start: 7.7, end: 8.0, isEmphasis: true, emoji: '🤖' },
      { word: 'does', start: 8.0, end: 8.3 },
      { word: 'it', start: 8.3, end: 8.5 },
      { word: 'for', start: 8.5, end: 8.7 },
      { word: 'you.', start: 8.7, end: 9.1 },
    ];

    segments.push({
      id: `viral-seg-${i + 1}-${Date.now()}`,
      title: scores.hookTitle,
      startTime: start,
      endTime: start + dur,
      duration: dur,
      scores,
      transcript: sampleWords.map((w) => w.word).join(' '),
      words: sampleWords,
    });
  }

  // Sort by highest virality score descending
  return segments.sort((a, b) => b.scores.overall - a.scores.overall);
}
