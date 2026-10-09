
import React from 'react';

interface BeforeAfterViewerProps {
  beforeImage: string;
  afterImage: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  emptyText?: string;
  /** Tailwind text color class for the labels (e.g. "text-indigo-300"). */
  accentClass?: string;
}

/**
 * Reusable before/after split view used across hairstyle, beauty, and
 * enhancement features.
 */
const BeforeAfterViewer: React.FC<BeforeAfterViewerProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Original',
  afterLabel = 'AI Result',
  emptyText = 'Generate to preview your result.',
  accentClass = 'text-indigo-300',
}) => {
  return (
    <div className="w-full h-full min-w-0 grid md:grid-cols-2 gap-px bg-slate-800/60">
      <div className="flex flex-col bg-slate-950/70">
        <div className={`px-3 py-2 text-[10px] uppercase tracking-wider font-bold ${accentClass} border-b border-slate-800`}>{beforeLabel}</div>
        <img src={beforeImage} alt={beforeLabel} className="w-full h-full object-contain bg-slate-950" />
      </div>
      <div className="flex flex-col bg-slate-950/70">
        <div className={`px-3 py-2 text-[10px] uppercase tracking-wider font-bold ${accentClass} border-b border-slate-800`}>{afterLabel}</div>
        {afterImage ? (
          <img src={afterImage} alt={afterLabel} className="w-full h-full object-contain bg-slate-950" />
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-slate-400 px-3 text-center">{emptyText}</div>
        )}
      </div>
    </div>
  );
};

export default BeforeAfterViewer;
