
import React, { useState } from 'react';

type ViewMode = 'slider' | 'side';

interface BeforeAfterViewerProps {
  beforeImage: string;
  afterImage: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  emptyText?: string;
  /** Tailwind text color class for the labels (e.g. "text-indigo-300"). */
  accentClass?: string;
  /** Optional custom content for the "after" pane in side-by-side mode (e.g. multi-angle preview). */
  afterContent?: React.ReactNode;
}

const prefersSideBySide = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 768px)').matches
    : false;

/**
 * Reusable before/after view used across hairstyle, beauty, barbershop, outfit,
 * and enhancement features. Phones default to a drag-to-compare slider so both
 * images stay visible inside the fixed-height canvas; tablets default to side by side.
 */
const BeforeAfterViewer: React.FC<BeforeAfterViewerProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Before',
  afterLabel = 'After',
  emptyText = 'Generate to preview your result.',
  accentClass = 'text-indigo-300',
  afterContent,
}) => {
  const [mode, setMode] = useState<ViewMode>(() => (prefersSideBySide() ? 'side' : 'slider'));
  const [position, setPosition] = useState(50);
  const labelCls = `text-[10px] uppercase tracking-wider font-bold ${accentClass}`;
  const chipCls = `absolute top-2 rounded-full bg-slate-950/80 px-2.5 py-1 backdrop-blur ${labelCls}`;

  if (!afterImage) {
    return (
      <div className="relative w-full h-full min-w-0 min-h-0 bg-slate-950">
        <img src={beforeImage} alt={beforeLabel} className="absolute inset-0 w-full h-full object-contain" />
        <span className={`${chipCls} left-2`}>{beforeLabel}</span>
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/85 px-3 py-2 text-center text-[11px] text-slate-300 backdrop-blur">
          {emptyText}
        </div>
      </div>
    );
  }

  const modeButton = (value: ViewMode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
        mode === value ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full h-full min-w-0 min-h-0 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800">
        <span className={labelCls}>{beforeLabel} / {afterLabel}</span>
        <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/80 p-0.5">
          {modeButton('slider', 'Slide')}
          {modeButton('side', 'Side by side')}
        </div>
      </div>

      {mode === 'slider' ? (
        <div className="relative flex-1 min-h-0 select-none overflow-hidden">
          <img src={beforeImage} alt={beforeLabel} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
          <img
            src={afterImage}
            alt={afterLabel}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ clipPath: `inset(0 0 0 ${position}%)` }}
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow" style={{ left: `${position}%` }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-900 text-xs font-bold shadow-lg">
              ⇆
            </div>
          </div>
          <span className={`${chipCls} left-2`}>{beforeLabel}</span>
          <span className={`${chipCls} right-2`}>{afterLabel}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            aria-label={`Drag to compare ${beforeLabel} and ${afterLabel}`}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
            style={{ touchAction: 'pan-y' }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-[minmax(0,1fr)] gap-px bg-slate-800/60">
          <div className="relative min-h-0 bg-slate-950">
            <img src={beforeImage} alt={beforeLabel} className="absolute inset-0 w-full h-full object-contain" />
            <span className={`${chipCls} left-2`}>{beforeLabel}</span>
          </div>
          <div className="relative min-h-0 bg-slate-950">
            {afterContent ?? <img src={afterImage} alt={afterLabel} className="absolute inset-0 w-full h-full object-contain" />}
            {!afterContent && <span className={`${chipCls} left-2`}>{afterLabel}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default BeforeAfterViewer;
