
import React, { useRef, useState } from 'react';
import { enhancePhoto, saveLook } from '../services/geminiService';
import { friendlyError } from '../services/errorMessages';
import { downloadAsset } from '../services/downloadService';
import BeforeAfterViewer from './BeforeAfterViewer';

const ENHANCEMENT_OPTIONS = [
  { value: 'quality', label: 'Improve Quality' },
  { value: 'lighting', label: 'Improve Lighting' },
  { value: 'background', label: 'Clean Background' },
  { value: 'portrait', label: 'Professional Portrait' },
  { value: 'social', label: 'Social-Media Ready' },
];

const PhotoEnhancer: React.FC = () => {
  const [selfie, setSelfie] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [enhancementType, setEnhancementType] = useState('quality');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const readImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setSelfie(result);
        setAfterImage(null);
        setMessage(null);
      }
    };
    reader.onerror = () => setMessage('Could not read that photo. Please try another.');
    reader.readAsDataURL(file);
  };

  const handleEnhance = async () => {
    if (!selfie) return;
    setLoading(true);
    setMessage(null);
    try {
      const result = await enhancePhoto(selfie, enhancementType);
      setAfterImage(result);
    } catch (error: any) {
      setMessage(friendlyError(error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!afterImage) return;
    setMessage(null);
    try {
      await saveLook({
        type: 'beauty',
        originalImage: selfie ?? undefined,
        generatedImage: afterImage,
        prompt: `Photo enhancement: ${enhancementType}`,
      });
      setMessage('Saved to My Looks!');
    } catch (error: any) {
      setMessage(/unauthorized|sign in/i.test(String(error?.message || ''))
        ? 'Sign in to save this photo.'
        : friendlyError(String(error?.message || '')));
    }
  };

  const handleDownload = () => {
    if (!afterImage) return;
    void downloadAsset(afterImage, `chromasnap-enhanced-${Date.now()}.png`);
  };

  const reset = () => {
    setSelfie(null);
    setAfterImage(null);
    setMessage(null);
  };

  const isError = !!message && /error|failed|unavailable|try again|reach/i.test(message);

  return (
    <div
      id="photoenhancer-panel"
      className="studio-shell-enter w-full min-w-0 rounded-3xl border transition-all border-cyan-500/50 bg-cyan-500/5 shadow-lg shadow-cyan-500/10 overflow-hidden"
    >
      <div className="h-[52vh] sm:h-[62vh] lg:h-[70vh] bg-slate-950/70 flex items-center justify-center min-w-0">
        {selfie ? (
          <BeforeAfterViewer
            beforeImage={selfie}
            afterImage={afterImage}
            beforeLabel="Original"
            afterLabel="Enhanced"
            emptyText="Choose an enhancement and generate to preview."
            accentClass="text-cyan-300"
          />
        ) : (
          <div className="text-center px-6 text-slate-400">
            <div className="text-sm font-semibold uppercase tracking-widest text-cyan-200">Photo Enhancement</div>
            <p className="mt-3 text-xs">Upload a photo to improve quality, lighting, or make it social-ready.</p>
          </div>
        )}
      </div>

      <div className="h-[48vh] sm:h-[38vh] lg:h-[30vh] border-t border-cyan-400/20 bg-slate-900/65 backdrop-blur-xl p-3 sm:p-4 space-y-3 overflow-y-auto min-w-0">
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:overflow-x-auto md:whitespace-nowrap md:pb-1">
          <button type="button" onClick={() => uploadRef.current?.click()} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-cyan-400 md:shrink-0">Upload</button>
          <button type="button" onClick={() => cameraRef.current?.click()} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-cyan-400 md:shrink-0">Camera</button>
          <button onClick={() => void handleEnhance()} disabled={loading || !selfie} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50 md:shrink-0">
            {loading ? 'Enhancing...' : 'Enhance'}
          </button>
          <button onClick={() => void handleSave()} disabled={!afterImage} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 md:shrink-0">Save</button>
          <button onClick={handleDownload} disabled={!afterImage} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500 disabled:opacity-50 md:shrink-0">Download</button>
          {selfie && (
            <button onClick={reset} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500 md:shrink-0">Reset</button>
          )}
        </div>

        <input ref={uploadRef} type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0])} className="hidden" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => readImage(e.target.files?.[0])} className="hidden" />

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Enhancement Type</label>
          <div className="flex flex-wrap gap-2">
            {ENHANCEMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEnhancementType(opt.value)}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                  enhancementType === opt.value
                    ? 'border-cyan-300/70 bg-cyan-500/25 text-cyan-100'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className={`rounded-xl border p-3 text-xs ${isError ? 'border-red-500/35 bg-red-500/10 text-red-200' : 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoEnhancer;
