import { DynamicZoomKeyframe } from '../../types/timeline';

export interface PunchZoomTransform {
  scale: number;
  centerX: number; // 0 to 1
  centerY: number; // 0 to 1
  isActive: boolean;
}

/**
 * Calculates current punch zoom scale and focal center for a given timeline time.
 */
export function calculatePunchZoom(
  currentTime: number,
  keyframes: DynamicZoomKeyframe[]
): PunchZoomTransform {
  if (!keyframes || keyframes.length === 0) {
    return { scale: 1.0, centerX: 0.5, centerY: 0.5, isActive: false };
  }

  // Find active keyframe
  const activeKf = keyframes.find(
    (kf) => currentTime >= kf.startTimelineTime && currentTime < kf.startTimelineTime + kf.duration
  );

  if (!activeKf) {
    return { scale: 1.0, centerX: 0.5, centerY: 0.5, isActive: false };
  }

  const elapsed = currentTime - activeKf.startTimelineTime;
  const progress = Math.min(1, elapsed / activeKf.duration);

  let scale = activeKf.scale;

  if (activeKf.style === 'snappy') {
    // 80ms snappy zoom in
    const punchDuration = 0.08;
    if (elapsed < punchDuration) {
      const p = elapsed / punchDuration;
      // Spring/ease-out
      scale = 1.0 + (activeKf.scale - 1.0) * (1 - Math.pow(1 - p, 3));
    } else {
      scale = activeKf.scale;
    }
  } else if (activeKf.style === 'smooth') {
    // Smooth cosine pulse
    const p = Math.sin(progress * Math.PI);
    scale = 1.0 + (activeKf.scale - 1.0) * p;
  }

  return {
    scale,
    centerX: activeKf.centerX,
    centerY: activeKf.centerY,
    isActive: true,
  };
}

/**
 * Generates automated dynamic punch-zoom keyframes across a timeline:
 * Alternates between wide (1.0x) and punch-in (1.2x - 1.3x) every 2.5 - 4.0 seconds,
 * focusing near the center or speaker face position (0.5, 0.45).
 */
export function generateAutoPunchZooms(
  timelineDuration: number,
  speechSpikes: number[] = [],
  baseScale: number = 1.25,
  centerX: number = 0.5,
  centerY: number = 0.45
): DynamicZoomKeyframe[] {
  const keyframes: DynamicZoomKeyframe[] = [];

  if (speechSpikes.length > 0) {
    // Anchor to speech spikes
    speechSpikes.forEach((spikeTime, idx) => {
      // Alternate: even spikes punch in, odd spikes return to wide
      if (idx % 2 === 0 && spikeTime + 1.8 <= timelineDuration) {
        keyframes.push({
          id: `kf-auto-${idx}-${Date.now()}`,
          startTimelineTime: spikeTime,
          duration: 2.2,
          scale: baseScale,
          centerX,
          centerY,
          style: 'snappy',
        });
      }
    });
  } else {
    // Rhythm pattern every 3.0 seconds
    const interval = 3.2;
    let time = 1.5;
    let idx = 0;

    while (time + 1.8 <= timelineDuration) {
      keyframes.push({
        id: `kf-rhythm-${idx}-${Date.now()}`,
        startTimelineTime: time,
        duration: 2.2,
        scale: idx % 2 === 0 ? baseScale : 1.15,
        centerX: 0.5,
        centerY: 0.45,
        style: 'snappy',
      });
      time += interval;
      idx++;
    }
  }

  return keyframes;
}
