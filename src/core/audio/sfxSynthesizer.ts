import { SfxPreset } from '../../types/timeline';

// Shared AudioContext instance for real-time playback
let audioCtxInstance: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtxInstance) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtxInstance = new AudioContextClass();
  }
  if (audioCtxInstance.state === 'suspended') {
    audioCtxInstance.resume();
  }
  return audioCtxInstance;
}

// Cached white noise buffer to prevent synchronous CPU allocations during playback
let cachedNoiseBuffer: AudioBuffer | null = null;

function getSharedNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (!cachedNoiseBuffer || cachedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const bufferSize = Math.floor(ctx.sampleRate * 0.3);
    cachedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = cachedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }
  return cachedNoiseBuffer;
}

/**
 * Procedurally synthesizes sound effects using Web Audio API nodes.
 * Works both with real-time AudioContext (for timeline playback)
 * and with OfflineAudioContext (for deterministic lossless video export).
 */
export function synthesizeSfx(
  ctx: BaseAudioContext,
  preset: SfxPreset,
  startTime: number = 0,
  volume: number = 0.8
): AudioNode {
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, startTime);
  masterGain.connect(ctx.destination);

  switch (preset) {
    case 'pop': {
      // Fast downward frequency chirp with exponential decay (TikTok pop)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, startTime);
      osc.frequency.exponentialRampToValueAtTime(140, startTime + 0.08);

      gain.gain.setValueAtTime(1.0, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
      break;
    }

    case 'ding': {
      // Bell/chime double harmonic
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2093, startTime); // C7

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(4186, startTime); // C8

      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + 0.5);
      osc2.stop(startTime + 0.5);
      break;
    }

    case 'swoosh': {
      // Swept white noise through bandpass filter with cached buffer
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = getSharedNoiseBuffer(ctx);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3;
      filter.frequency.setValueAtTime(200, startTime);
      filter.frequency.exponentialRampToValueAtTime(3200, startTime + 0.12);
      filter.frequency.exponentialRampToValueAtTime(400, startTime + 0.25);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.9, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      whiteNoise.start(startTime);
      whiteNoise.stop(startTime + 0.25);
      break;
    }

    case 'vine-boom': {
      // Sub-bass heavy impact with distortion
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, startTime);
      osc.frequency.exponentialRampToValueAtTime(35, startTime + 0.4);

      gain.gain.setValueAtTime(1.0, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.7);
      break;
    }

    case 'camera-shutter': {
      // Click burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(2400, startTime);
      osc.frequency.exponentialRampToValueAtTime(300, startTime + 0.04);

      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.05);
      break;
    }

    case 'laser': {
      // Retro laser zap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, startTime);
      osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.15);

      gain.gain.setValueAtTime(0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
      break;
    }

    case 'cash': {
      // Register chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1318.5, startTime); // E6
      osc.frequency.setValueAtTime(1760.0, startTime + 0.08); // A6

      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
      break;
    }
  }

  return masterGain;
}

/**
 * Triggers instant real-time SFX playback (useful for previewing sticker drops)
 */
export function playSfxInstant(preset: SfxPreset, volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    synthesizeSfx(ctx, preset, ctx.currentTime, volume);
  } catch (err) {
    console.warn('Unable to play audio instant:', err);
  }
}
