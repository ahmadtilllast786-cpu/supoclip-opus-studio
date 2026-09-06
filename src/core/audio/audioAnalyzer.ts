import { SilenceRegion } from '../../types/timeline';
import { getAudioContext } from './sfxSynthesizer';

/**
 * Decodes audio data from a video/audio Blob or ArrayBuffer.
 */
export async function decodeAudioBuffer(blobOrBuffer: Blob | ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  let arrayBuffer: ArrayBuffer;
  if (blobOrBuffer instanceof Blob) {
    arrayBuffer = await blobOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = blobOrBuffer;
  }
  return await ctx.decodeAudioData(arrayBuffer.slice(0));
}

/**
 * Generates an array of normalized waveform peaks (0 to 1) for timeline UI display.
 */
export function generateWaveformPeaks(buffer: AudioBuffer, numPeaks: number = 100): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, max));
  }
  return peaks;
}

/**
 * Detects silent intervals in an AudioBuffer.
 * Uses RMS (Root-Mean-Square) calculation in sliding windows.
 * 
 * @param buffer AudioBuffer to analyze
 * @param thresholdDb Silence threshold in decibels (e.g. -38 dB)
 * @param minDurationSec Minimum silence length to qualify as a cut region (e.g. 0.35s)
 * @param paddingSec Safety padding around speech (e.g. 0.04s) so consonants aren't chopped off
 */
export function detectSilenceRegions(
  buffer: AudioBuffer,
  thresholdDb: number = -38,
  minDurationSec: number = 0.35,
  paddingSec: number = 0.05
): SilenceRegion[] {
  const rawData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  // Linear threshold from dB: 10^(dB / 20)
  const thresholdLinear = Math.pow(10, thresholdDb / 20);

  // Window size of ~25ms
  const windowSize = Math.floor(sampleRate * 0.025);
  const totalWindows = Math.floor(rawData.length / windowSize);

  const silenceWindows: boolean[] = new Array(totalWindows);

  for (let w = 0; w < totalWindows; w++) {
    const offset = w * windowSize;
    let sumSquares = 0;
    for (let i = 0; i < windowSize; i++) {
      const sample = rawData[offset + i];
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / windowSize);
    silenceWindows[w] = rms < thresholdLinear;
  }

  const regions: SilenceRegion[] = [];
  let inSilence = false;
  let silenceStartSec = 0;

  for (let w = 0; w < totalWindows; w++) {
    const isSilent = silenceWindows[w];
    const timeSec = (w * windowSize) / sampleRate;

    if (isSilent && !inSilence) {
      inSilence = true;
      silenceStartSec = timeSec;
    } else if (!isSilent && inSilence) {
      inSilence = false;
      const duration = timeSec - silenceStartSec;
      if (duration >= minDurationSec) {
        // Apply speech padding
        const safeStart = silenceStartSec + paddingSec;
        const safeEnd = Math.max(safeStart, timeSec - paddingSec);
        if (safeEnd - safeStart > 0.1) {
          regions.push({
            start: safeStart,
            end: safeEnd,
            duration: safeEnd - safeStart,
          });
        }
      }
    }
  }

  // Handle trailing silence
  if (inSilence) {
    const endTime = buffer.duration;
    if (endTime - silenceStartSec >= minDurationSec) {
      regions.push({
        start: silenceStartSec + paddingSec,
        end: endTime,
        duration: endTime - (silenceStartSec + paddingSec),
      });
    }
  }

  return regions;
}

/**
 * Detects sudden energy spikes in speech, ideal for triggering dynamic punch-zooms!
 */
export function detectSpeechEnergySpikes(
  buffer: AudioBuffer,
  sensitivity: number = 1.8,
  minIntervalSec: number = 2.5
): number[] {
  const rawData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms
  const totalWindows = Math.floor(rawData.length / windowSize);

  const energies: number[] = [];
  let avgEnergy = 0;

  for (let w = 0; w < totalWindows; w++) {
    const offset = w * windowSize;
    let sum = 0;
    for (let i = 0; i < windowSize; i++) {
      sum += Math.abs(rawData[offset + i]);
    }
    const energy = sum / windowSize;
    energies.push(energy);
    avgEnergy += energy;
  }

  avgEnergy = avgEnergy / (totalWindows || 1);
  const spikeThreshold = Math.max(0.08, avgEnergy * sensitivity);

  const spikeTimestamps: number[] = [];
  let lastSpikeTime = -999;

  for (let w = 1; w < totalWindows - 1; w++) {
    const energy = energies[w];
    const timeSec = (w * windowSize) / sampleRate;

    // Check local peak above threshold
    if (
      energy > spikeThreshold &&
      energy > energies[w - 1] &&
      energy >= energies[w + 1] &&
      timeSec - lastSpikeTime >= minIntervalSec
    ) {
      spikeTimestamps.push(timeSec);
      lastSpikeTime = timeSec;
    }
  }

  return spikeTimestamps;
}
