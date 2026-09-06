import { VideoClip } from '../../types/timeline';
import { generateWaveformPeaks } from '../audio/audioAnalyzer';

/**
 * Procedurally generates a colorful, high-energy sample video clip with real audio
 * right inside the browser. Enables instant 1-click testing of all editing features!
 */
export async function generateDemoVideoClip(
  title: string,
  durationSec: number = 6,
  colorScheme: { bg: string; accent: string; text: string }
): Promise<VideoClip> {
  const width = 1080;
  const height = 1920;
  const fps = 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Generate synthetic audio using AudioContext and MediaStreamDestination
  const audioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new audioCtxClass();
  const dest = audioCtx.createMediaStreamDestination();

  // Create rhythmic audio pulse
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.connect(gain);
  gain.connect(dest);

  // Rhythmic dialogue bursts with distinct silence gaps
  const speechIntervals = [
    { start: 0.2, end: 0.8 },
    { start: 1.15, end: 1.8 },
    { start: 2.15, end: 2.9 },
    { start: 3.25, end: 4.1 },
    { start: 4.4, end: 5.35 },
  ];

  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  speechIntervals.forEach(({ start, end }) => {
    if (start < durationSec) {
      const safeEnd = Math.min(durationSec, end);
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + start + 0.04);
      gain.gain.setValueAtTime(0.45, audioCtx.currentTime + safeEnd - 0.04);
      gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + safeEnd);
    }
  });

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + durationSec);

  // Combine canvas video stream + audio stream
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 10_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const clipBlobPromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start();

  const totalFrames = Math.floor(durationSec * fps);
  let frame = 0;

  const intervalId = setInterval(() => {
    const time = frame / fps;
    
    // Draw animated high-energy short-form video frame
    ctx.fillStyle = colorScheme.bg;
    ctx.fillRect(0, 0, width, height);

    // Dynamic gradient background pulse
    const grad = ctx.createRadialGradient(
      width / 2,
      height / 2 + Math.sin(time * 3) * 100,
      100,
      width / 2,
      height / 2,
      900
    );
    grad.addColorStop(0, colorScheme.accent);
    grad.addColorStop(1, colorScheme.bg);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative geometric grid/rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 4;
    for (let r = 150; r <= 600; r += 120) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2 - 80, r + Math.sin(time * 4 + r) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Avatar/Speaker circle simulation
    const speakerY = height * 0.45;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, speakerY, 180, 0, Math.PI * 2);
    ctx.fillStyle = colorScheme.text;
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Speaker face / icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '100px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎙️', width / 2, speakerY);
    ctx.restore();

    // Title and status text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title.toUpperCase(), width / 2, height * 0.65);

    // Live counter and timecode badge
    ctx.font = '900 72px "JetBrains Mono", monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(time.toFixed(2) + 's', width / 2, height * 0.74);

    // Energy pulse bar
    const barWidth = 600;
    const barHeight = 24;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect((width - barWidth) / 2, height * 0.82, barWidth, barHeight);

    const progressWidth = (time / durationSec) * barWidth;
    ctx.fillStyle = '#10b981';
    ctx.fillRect((width - barWidth) / 2, height * 0.82, progressWidth, barHeight);

    frame++;
    if (frame >= totalFrames) {
      clearInterval(intervalId);
      recorder.stop();
      try {
        audioCtx.close();
      } catch {
        // ignore
      }
    }
  }, 1000 / fps);

  const videoBlob = await clipBlobPromise;
  const sourceUrl = URL.createObjectURL(videoBlob);

  // Generate AudioBuffer for instant auto-transcription & voice analysis
  let audioBuffer: AudioBuffer | undefined;
  try {
    const arrayBuf = await videoBlob.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioBuffer = await ctx.decodeAudioData(arrayBuf);
  } catch {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioBuffer = ctx.createBuffer(1, Math.max(1, Math.round(durationSec * 44100)), 44100);
  }

  // Extract REAL waveform peaks from the audio buffer (high resolution, e.g. 50 peaks per sec)
  const waveform: number[] = audioBuffer
    ? generateWaveformPeaks(audioBuffer, Math.max(120, Math.floor(durationSec * 50)))
    : Array.from({ length: 80 }, () => 0.02);

  return {
    id: `clip-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: title,
    sourceUrl,
    blob: videoBlob,
    originalDuration: durationSec,
    inPoint: 0,
    outPoint: durationSec,
    duration: durationSec,
    startTimelineTime: 0,
    speed: 1.0,
    volume: 1.0,
    zoomScale: 1.0,
    zoomCenter: { x: 0.5, y: 0.45 },
    transitionIn: 'none',
    transitionDuration: 0.3,
    waveform,
    audioBuffer,
  };
}
