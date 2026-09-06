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
 * Uses RMS and peak amplitude with a noise gate so silence drops to a flat baseline (~0.02)
 * and voice/sound spikes proportionally up to 1.0.
 */
export function generateWaveformPeaks(buffer: AudioBuffer, numPeaks: number = 100): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    let sumSquares = 0;
    let max = 0;
    let count = 0;
    for (let j = 0; j < step && start + j < channelData.length; j++) {
      const sample = channelData[start + j] || 0;
      const val = Math.abs(sample);
      sumSquares += sample * sample;
      if (val > max) max = val;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
    if (rms < 0.012 && max < 0.03) {
      peaks.push(0.02); // Clean silence floor
    } else {
      const intensity = Math.min(1.0, Math.max(0.06, rms * 3.2 + max * 0.35));
      peaks.push(intensity);
    }
  }
  return peaks;
}

/**
 * Extracts a normalized waveform segment (0 to 1) for a specific clip segment between inPoint and outPoint.
 * Maps directly across the duration: silent intervals are at low baseline (2px), and spoken/sound
 * intervals spike in intensity according to actual audio energy.
 */
export function extractClipWaveformSegment(
  buffer?: AudioBuffer,
  fallbackWaveform?: number[],
  inPointSec: number = 0,
  outPointSec: number = 0,
  originalDuration: number = 1,
  numBars: number = 60
): number[] {
  const bars = Math.max(8, numBars);

  // Path A: Extract directly from PCM AudioBuffer if available
  if (buffer && buffer.length > 0) {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const startSample = Math.max(0, Math.floor(inPointSec * sampleRate));
    const endSample = Math.min(channelData.length, Math.floor(outPointSec * sampleRate));
    const totalSamples = Math.max(1, endSample - startSample);
    const step = Math.max(1, Math.floor(totalSamples / bars));

    const result: number[] = [];
    for (let i = 0; i < bars; i++) {
      const windowStart = startSample + i * step;
      let sumSquares = 0;
      let peak = 0;
      let count = 0;

      for (let j = 0; j < step && windowStart + j < endSample; j++) {
        const sample = channelData[windowStart + j];
        const absVal = Math.abs(sample);
        sumSquares += sample * sample;
        if (absVal > peak) peak = absVal;
        count++;
      }

      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      if (rms < 0.012 && peak < 0.03) {
        result.push(0.02); // Flat baseline for silence
      } else {
        const intensity = Math.min(1.0, Math.max(0.08, rms * 3.5 + peak * 0.3));
        result.push(intensity);
      }
    }
    return result;
  }

  // Path B: Extract from pre-computed fallbackWaveform
  if (fallbackWaveform && fallbackWaveform.length > 0) {
    const total = fallbackWaveform.length;
    const safeDuration = Math.max(0.1, originalDuration);
    const startRatio = Math.max(0, Math.min(1, inPointSec / safeDuration));
    const endRatio = Math.max(startRatio, Math.min(1, outPointSec / safeDuration));

    const startIdx = Math.floor(startRatio * total);
    const endIdx = Math.ceil(endRatio * total);
    const slice = fallbackWaveform.slice(startIdx, Math.max(startIdx + 1, endIdx));

    const result: number[] = [];
    for (let i = 0; i < bars; i++) {
      const sliceIdx = Math.min(slice.length - 1, Math.floor((i / bars) * slice.length));
      const val = slice[sliceIdx] ?? 0.02;
      result.push(val < 0.08 ? 0.02 : val);
    }
    return result;
  }

  // Path C: Flat silence baseline fallback
  return Array.from({ length: bars }, () => 0.02);
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
