import { VideoClip } from '../../types/timeline';
import { decodeAudioBuffer } from './audioAnalyzer';
import { encodeAudioBufferToWav } from '../ai/captionTranscriber';

export interface ExtractedProjectAudio {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  totalDuration: number;
}

/**
 * Extracts the audio track from uploaded sequential video clips into a single continuous
 * 16kHz mono AudioBuffer and WAV Blob, strictly honoring timeline start times, trimming
 * in/out points, playback speeds, and volume levels.
 */
export async function extractSequentialAudioTrack(
  clips: VideoClip[],
  targetSampleRate: number = 16000
): Promise<ExtractedProjectAudio> {
  const totalDuration = clips.reduce(
    (acc, c) => Math.max(acc, c.startTimelineTime + c.duration),
    0
  );

  const effectiveDuration = Math.max(0.5, totalDuration);
  const totalFrames = Math.max(1, Math.ceil(effectiveDuration * targetSampleRate));

  const offlineCtx = new OfflineAudioContext(1, totalFrames, targetSampleRate);

  // Prepare each clip's audio source
  for (const clip of clips) {
    if (clip.isMuted || clip.volume === 0) continue;

    let clipAudio: AudioBuffer | null = clip.audioBuffer || null;

    if (!clipAudio) {
      if (clip.blob) {
        try {
          clipAudio = await decodeAudioBuffer(clip.blob);
          clip.audioBuffer = clipAudio;
        } catch (err) {
          console.warn(`Failed to decode audio from clip ${clip.id}:`, err);
        }
      } else if (clip.sourceUrl) {
        try {
          const resp = await fetch(clip.sourceUrl);
          const arrayBuf = await resp.arrayBuffer();
          clipAudio = await decodeAudioBuffer(arrayBuf);
          clip.audioBuffer = clipAudio;
        } catch (err) {
          console.warn(`Failed to fetch and decode audio from ${clip.sourceUrl}:`, err);
        }
      }
    }

    if (!clipAudio) continue;

    try {
      const source = offlineCtx.createBufferSource();
      source.buffer = clipAudio;
      source.playbackRate.value = Math.max(0.25, Math.min(4.0, clip.speed || 1));

      const gain = offlineCtx.createGain();
      gain.gain.value = Math.max(0, Math.min(2.0, clip.volume ?? 1));

      source.connect(gain);
      gain.connect(offlineCtx.destination);

      const startTime = Math.max(0, clip.startTimelineTime);
      const offset = Math.max(0, clip.inPoint || 0);
      const duration = Math.max(0.1, clip.duration);

      source.start(startTime, offset, duration);
    } catch (err) {
      console.warn(`Could not schedule clip ${clip.id} in OfflineAudioContext:`, err);
    }
  }

  // Render combined continuous project audio
  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = encodeAudioBufferToWav(renderedBuffer, targetSampleRate);

  return {
    audioBuffer: renderedBuffer,
    wavBlob,
    totalDuration: effectiveDuration,
  };
}
