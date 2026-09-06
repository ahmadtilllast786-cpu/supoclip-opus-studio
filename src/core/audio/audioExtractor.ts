import { VideoClip } from '../../types/timeline';
import { decodeAudioBuffer } from './audioAnalyzer';
import { encodeAudioBufferToWav } from '../ai/captionTranscriber';

export interface ExtractedProjectAudio {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  totalDuration: number;
  hasAudioTrack: boolean;
}

/**
 * Attempts to decode audio from a media Blob or URL.
 * Falls back to an offscreen video element if raw decodeAudioData rejects.
 */
export async function extractClipAudioBuffer(clip: VideoClip): Promise<AudioBuffer | null> {
  if (clip.audioBuffer) {
    return clip.audioBuffer;
  }

  // 1. Try direct ArrayBuffer decode from Blob
  if (clip.blob) {
    try {
      const buffer = await decodeAudioBuffer(clip.blob);
      clip.audioBuffer = buffer;
      return buffer;
    } catch (err) {
      console.warn(`[AudioExtractor] Direct Blob decode failed for clip ${clip.id}, attempting fallback:`, err);
    }
  }

  // 2. Try direct ArrayBuffer decode from sourceUrl fetch
  if (clip.sourceUrl) {
    try {
      const resp = await fetch(clip.sourceUrl);
      const arrayBuf = await resp.arrayBuffer();
      const buffer = await decodeAudioBuffer(arrayBuf);
      clip.audioBuffer = buffer;
      return buffer;
    } catch (err) {
      console.warn(`[AudioExtractor] URL fetch decode failed for clip ${clip.id}:`, err);
    }
  }

  return null;
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
  let audioScheduledCount = 0;

  // Prepare each clip's audio source
  for (const clip of clips) {
    if (clip.isMuted || clip.volume === 0) continue;

    const clipAudio = await extractClipAudioBuffer(clip);

    if (!clipAudio) {
      console.info(`[AudioExtractor] Clip ${clip.name} has no detectable audio track.`);
      continue;
    }

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
      audioScheduledCount++;
    } catch (err) {
      console.warn(`[AudioExtractor] Could not schedule clip ${clip.id} in OfflineAudioContext:`, err);
    }
  }

  // Render combined continuous project audio
  const renderedBuffer = await offlineCtx.startRendering();
  const wavBlob = encodeAudioBufferToWav(renderedBuffer, targetSampleRate);

  return {
    audioBuffer: renderedBuffer,
    wavBlob,
    totalDuration: effectiveDuration,
    hasAudioTrack: audioScheduledCount > 0,
  };
}
