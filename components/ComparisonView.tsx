
import React, { useState, useRef } from 'react';

interface ComparisonViewProps {
  original: string;
  colorized: string;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ original, colorized }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(position);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl px-4 animate-in fade-in duration-700">
      <div 
        ref={containerRef}
        className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-700 cursor-ew-resize select-none bg-slate-900"
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
      >
        {/* Background (After) */}
        <img 
          src={colorized} 
          alt="Colorized" 
          className="w-full h-auto block"
        />

        {/* Overlay (Before) */}
        <div 
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img 
            src={original} 
            alt="Original B&W" 
            className="absolute inset-y-0 left-0 h-full max-w-none object-cover"
            style={{ width: containerRef.current?.offsetWidth || '100%' }}
          />
        </div>

        {/* Slider Line */}
        <div 
          className="absolute inset-y-0 w-1 bg-white/80 shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-200">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8M8 12h8m-8 5h8" />
             </svg>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute bottom-4 left-4 z-20 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-xs font-bold text-white/80 border border-white/10 uppercase tracking-wider">
          B&W
        </div>
        <div className="absolute bottom-4 right-4 z-20 px-3 py-1 bg-indigo-500/60 backdrop-blur-md rounded-full text-xs font-bold text-white border border-white/10 uppercase tracking-wider">
          Colorized
        </div>
      </div>

      <div className="w-full px-2">
        <label htmlFor="comparison-slider" className="sr-only">Adjust before and after comparison</label>
        <input
          id="comparison-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderPos}
          onChange={(event) => setSliderPos(Number(event.target.value))}
          className="w-full accent-indigo-500"
          aria-label="Before and after slider"
        />
        <p className="text-[11px] text-slate-400 leading-relaxed mt-2">
          Keyboard: use Left and Right arrow keys to move the before/after slider.
        </p>
      </div>
      
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-2">
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">Slide to compare</p>
        <button 
          onClick={() => {
            const link = document.createElement('a');
            link.href = colorized;
            link.download = `chromasnap-${Date.now()}.png`;
            link.click();
          }}
          className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border border-slate-700 text-indigo-400 font-semibold hover:text-indigo-300 hover:border-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Save Result
        </button>
      </div>
    </div>
  );
};

export default ComparisonView;
