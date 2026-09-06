import { TransitionType } from '../../types/timeline';

/**
 * Renders a transition effect between two video frames/canvases on the destination context.
 * 
 * @param ctx Destination CanvasRenderingContext2D
 * @param outgoingCanvas Outgoing clip frame
 * @param incomingCanvas Incoming clip frame
 * @param progress 0 (start of transition) to 1 (end of transition)
 * @param type TransitionType ('whip-pan', 'dissolve', 'zoom-in', 'zoom-out', 'glitch')
 * @param width Canvas width
 * @param height Canvas height
 */
export function renderTransition(
  ctx: CanvasRenderingContext2D,
  outgoingCanvas: CanvasImageSource,
  incomingCanvas: CanvasImageSource,
  progress: number,
  type: TransitionType,
  width: number,
  height: number
) {
  const p = Math.max(0, Math.min(1, progress));

  // Cubic easing
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeProgress = easeInOutCubic(p);

  ctx.save();

  switch (type) {
    case 'dissolve': {
      // Outgoing at 1 - p alpha
      ctx.globalAlpha = 1;
      ctx.drawImage(outgoingCanvas, 0, 0, width, height);

      // Incoming at p alpha
      ctx.globalAlpha = p;
      ctx.drawImage(incomingCanvas, 0, 0, width, height);
      break;
    }

    case 'whip-pan': {
      // Fast directional sweep to the left
      const offset = easeProgress * width;

      // Draw outgoing moving left
      ctx.save();
      ctx.translate(-offset, 0);
      ctx.globalAlpha = 1 - p * 0.4;
      ctx.drawImage(outgoingCanvas, 0, 0, width, height);
      
      // Speed blur streak simulation
      if (p > 0.1 && p < 0.9) {
        ctx.globalAlpha = 0.25;
        ctx.drawImage(outgoingCanvas, -25, 0, width, height);
        ctx.drawImage(outgoingCanvas, 25, 0, width, height);
      }
      ctx.restore();

      // Draw incoming sliding in from right
      ctx.save();
      ctx.translate(width - offset, 0);
      ctx.globalAlpha = 0.6 + p * 0.4;
      ctx.drawImage(incomingCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'zoom-in': {
      // Outgoing expands outwards from 1.0 to 1.7x and fades
      const outScale = 1.0 + easeProgress * 0.7;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(outScale, outScale);
      ctx.translate(-width / 2, -height / 2);
      ctx.globalAlpha = Math.max(0, 1 - easeProgress * 1.5);
      ctx.drawImage(outgoingCanvas, 0, 0, width, height);
      ctx.restore();

      // Incoming starts from 0.7x and scales up to 1.0x
      if (easeProgress > 0.3) {
        const inP = (easeProgress - 0.3) / 0.7;
        const inScale = 0.7 + inP * 0.3;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(inScale, inScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.globalAlpha = Math.min(1, inP * 1.5);
        ctx.drawImage(incomingCanvas, 0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'zoom-out': {
      // Outgoing shrinks from 1.0 to 0.7
      const outScale = 1.0 - easeProgress * 0.3;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(outScale, outScale);
      ctx.translate(-width / 2, -height / 2);
      ctx.globalAlpha = Math.max(0, 1 - easeProgress * 1.2);
      ctx.drawImage(outgoingCanvas, 0, 0, width, height);
      ctx.restore();

      // Incoming expands from 1.4 down to 1.0
      const inScale = 1.4 - easeProgress * 0.4;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(inScale, inScale);
      ctx.translate(-width / 2, -height / 2);
      ctx.globalAlpha = Math.min(1, easeProgress * 1.5);
      ctx.drawImage(incomingCanvas, 0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'glitch': {
      // Draw base
      const isFirstHalf = p < 0.5;
      const baseSource = isFirstHalf ? outgoingCanvas : incomingCanvas;
      ctx.drawImage(baseSource, 0, 0, width, height);

      // Random glitch slice displacement
      const numSlices = 10;
      const sliceHeight = height / numSlices;
      const maxJitter = 40 * Math.sin(p * Math.PI);

      for (let i = 0; i < numSlices; i++) {
        if (Math.random() > 0.3) {
          const jitterX = (Math.random() - 0.5) * maxJitter;
          const sy = i * sliceHeight;

          // Draw displaced horizontal band
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, sy, width, sliceHeight);
          ctx.clip();
          ctx.drawImage(incomingCanvas, jitterX, 0, width, height);

          // Chromatic aberration tint (cyan/magenta)
          ctx.globalCompositeOperation = 'screen';
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0, 255, 255, 0.25)' : 'rgba(255, 0, 128, 0.25)';
          ctx.fillRect(0, sy, width, sliceHeight);
          ctx.restore();
        }
      }
      break;
    }

    default: {
      // Immediate cut
      ctx.drawImage(p < 0.5 ? outgoingCanvas : incomingCanvas, 0, 0, width, height);
      break;
    }
  }

  ctx.restore();
}
