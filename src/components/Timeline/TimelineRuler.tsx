import React, { useRef, useState } from 'react';
import { Clock, Flag } from 'lucide-react';

interface TimelineRulerProps {
  totalDuration: number;
  projectEndSec: number;
  pixelsPerSecond: number;
  currentTime: number;
  onSeek: (time: number) => void;
  headerWidth: number;
  timecodeMode: 'standard' | 'smpte';
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  totalDuration,
  projectEndSec,
  pixelsPerSecond,
  currentTime,
  onSeek,
  headerWidth,
  timecodeMode,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isRulerDragging, setIsRulerDragging] = useState(false);

  // Format time display for ruler ticks
  const formatTickTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (timecodeMode === 'smpte') {
      const frames = Math.floor((seconds % 1) * 30);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames
        .toString()
        .padStart(2, '0')}`;
    }
    const ms = Math.floor((seconds % 1) * 10);
    if (pixelsPerSecond > 100) {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert mouse X to time in seconds
  const getTimeFromEvent = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!rulerRef.current) return 0;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const relativeX = clickX - headerWidth;
    return Math.max(0, relativeX / pixelsPerSecond);
  };

  const rafRef = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromEvent(e);
    onSeek(time);
    setIsRulerDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const moveTime = getTimeFromEvent(moveEvent);
        onSeek(moveTime);
      });
    };

    const handleMouseUp = () => {
      setIsRulerDragging(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromEvent(e);
    setHoverTime(time);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  // Determine tick interval based on zoom
  let majorTickInterval = 1;
  if (pixelsPerSecond < 40) majorTickInterval = 5;
  else if (pixelsPerSecond < 70) majorTickInterval = 2;
  else if (pixelsPerSecond > 160) majorTickInterval = 0.5;

  const totalTicks = Math.ceil(totalDuration / majorTickInterval) + 2;
  const ticks = Array.from({ length: totalTicks }, (_, i) => i * majorTickInterval);

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-7 bg-slate-900 border-b border-slate-700/90 select-none cursor-pointer flex items-center overflow-visible"
    >
      {/* Sticky Header Corner aligned with Track Headers */}
      <div
        style={{ width: `${headerWidth}px` }}
        className="sticky left-0 z-30 shrink-0 h-full bg-slate-900 border-r border-slate-700/80 px-3 flex items-center justify-between text-[11px] font-mono font-semibold text-slate-400 select-none shadow-md"
      >
        <div className="flex items-center gap-1 text-indigo-400">
          <Clock className="w-3 h-3" />
          <span className="tracking-wider text-[10px] text-slate-300">RULER</span>
        </div>
        <span className="text-[9px] text-slate-400">00:00.00</span>
      </div>

      {/* Ruler Seconds & Subdivision Ticks */}
      <div className="relative h-full flex-1">
        {ticks.map((timeSec) => {
          const leftPx = timeSec * pixelsPerSecond;
          return (
            <div
              key={timeSec}
              style={{ left: `${leftPx}px` }}
              className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
            >
              {/* Major Tick Mark */}
              <div className="w-px h-2.5 bg-slate-500/80" />
              {/* Timecode Label */}
              <span className="text-[9px] font-mono text-slate-400 pl-1 leading-none -translate-y-0.5">
                {formatTickTime(timeSec)}
              </span>
              {/* Bottom Tick Mark */}
              <div className="w-px h-1 bg-slate-600/50" />
            </div>
          );
        })}

        {/* Project End Boundary Badge on Ruler */}
        {projectEndSec > 0 && (
          <div
            style={{ left: `${projectEndSec * pixelsPerSecond}px` }}
            className="absolute top-0 bottom-0 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none"
          >
            <div className="flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 font-mono font-bold text-[9px] rounded-b shadow-md shadow-amber-950/60 border-b border-x border-amber-300">
              <Flag className="w-2.5 h-2.5 fill-current" />
              <span>END: {formatTickTime(projectEndSec)}</span>
            </div>
            <div className="w-0.5 h-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
          </div>
        )}

        {/* Hover Time Indicator Bubble */}
        {hoverTime !== null && !isRulerDragging && (
          <div
            style={{ left: `${hoverTime * pixelsPerSecond}px` }}
            className="absolute top-0 bottom-0 w-px bg-indigo-400/80 pointer-events-none z-30"
          >
            <div className="absolute top-0 -translate-x-1/2 -translate-y-6 px-1.5 py-0.5 bg-indigo-900 text-indigo-200 text-[9px] font-mono font-bold rounded shadow-lg border border-indigo-500/50 whitespace-nowrap">
              {formatTickTime(hoverTime)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
