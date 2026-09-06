import { VideoClip, StickerOverlay } from '../../types/timeline';

/**
 * Generates a ready-to-run FFmpeg command and shell/batch script
 * for lossless / high-bitrate rendering on Desktop / CLI.
 */
export function generateFfmpegScript(
  clips: VideoClip[],
  _overlays: StickerOverlay[],
  width: number = 1080,
  height: number = 1920,
  fps: number = 60,
  crf: number = 18
): { command: string; script: string } {
  if (clips.length === 0) {
    return {
      command: '# Add clips to generate FFmpeg export command',
      script: '# No clips on timeline',
    };
  }

  // 1. Concat / Trim filter graph
  const inputArgs: string[] = [];
  const filterChains: string[] = [];
  const concatVideoLabels: string[] = [];
  const concatAudioLabels: string[] = [];

  clips.forEach((clip, idx) => {
    // Escape filename or use clip.name
    const safeName = clip.name.replace(/"/g, '\\"');
    inputArgs.push(`-ss ${clip.inPoint.toFixed(2)} -t ${clip.duration.toFixed(2)} -i "${safeName}"`);

    // Scale and crop to 9:16 target aspect ratio
    filterChains.push(
      `[${idx}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps}[v${idx}]`
    );
    concatVideoLabels.push(`[v${idx}]`);
    concatAudioLabels.push(`[${idx}:a]`);
  });

  // Concat filter
  const numClips = clips.length;
  filterChains.push(
    `${concatVideoLabels.join('')}concat=n=${numClips}:v=1:a=0[vconcat]`
  );
  filterChains.push(
    `${concatAudioLabels.join('')}concat=n=${numClips}:v=0:a=1[aconcat]`
  );

  const filterComplex = filterChains.join('; ');

  const command = `ffmpeg ${inputArgs.join(' ')} -filter_complex "${filterComplex}" -map "[vconcat]" -map "[aconcat]" -c:v libx264 -preset slow -crf ${crf} -pix_fmt yuv420p -c:a aac -b:a 320k -movflags +faststart output_short_lossless.mp4`;

  const script = `@echo off
REM === Synapse Studio / CapCut Lossless Native Render Script ===
REM Target: ${width}x${height} @ ${fps}fps | CRF: ${crf} (Visually Lossless)
echo Starting high-bitrate render...

${command}

echo Render complete! Saved to output_short_lossless.mp4
pause
`;

  return { command, script };
}
