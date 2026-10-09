
import React from 'react';

interface LoadingOverlayProps {
  message: string;
  type?: 'animating' | 'editing';
}

type LoadingOverlayType = 'animating' | 'editing';

const stepsByType: Record<LoadingOverlayType, string[]> = {
  animating: ['Preparing frames', 'Generating motion', 'Rendering final video'],
  editing: ['Reading image', 'Applying enhancement', 'Finalizing output'],
};

const estimateByType: Record<LoadingOverlayType, string> = {
  animating: '~45-90 seconds',
  editing: '~3-8 seconds',
};

const detectStepIndex = (message: string, type: LoadingOverlayType) => {
  const normalized = message.toLowerCase();

  if (type === 'animating') {
    if (normalized.includes('start') || normalized.includes('prepar') || normalized.includes('process')) return 0;
    if (normalized.includes('generat') || normalized.includes('motion')) return 1;
    return 2;
  }

  if (normalized.includes('enhanc') || normalized.includes('sharpen') || normalized.includes('vibran') || normalized.includes('upscale')) return 1;
  return 2;
};

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message, type = 'editing' }) => {
  const normalizedType: LoadingOverlayType =
    type === 'animating' ? 'animating' : 'editing';
  const steps = stepsByType[normalizedType];
  const activeIndex = detectStepIndex(message, normalizedType);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
        <div className="absolute inset-0 rounded-full border-t-4 border-indigo-500 animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </div>
        </div>
      </div>
      <h3 className="text-lg sm:text-xl leading-snug font-bold text-white mb-2 text-center px-6">{message}</h3>
      <p className="text-slate-400 text-xs sm:text-sm mb-4">Estimated time: {estimateByType[normalizedType]}</p>
      <div className="w-full max-w-sm px-6 space-y-2">
        {steps.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <div
              key={step}
              className={`text-xs sm:text-sm leading-relaxed rounded-xl border px-3 py-2 transition-colors ${
                isDone
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : isActive
                    ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
              }`}
            >
              {step}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoadingOverlay;
