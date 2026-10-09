
import React, { useRef, useState } from 'react';
import { generateHairstyleTryOn, saveLook } from '../services/geminiService';
import { friendlyError } from '../services/errorMessages';
import { downloadAsset } from '../services/downloadService';
import { track } from '../services/analytics';
import { validateImageFile, readImageFileAsDataUrl } from '../services/imageUtils';
import BeforeAfterViewer from './BeforeAfterViewer';
import {
  HAIRSTYLE_CATEGORIES,
  HAIR_COLOR_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  getHairstylesByCategory,
  getHairstylesByLength,
  getHairstyleLabel,
  getHairColorLabel,
  type HairCategory,
  type HairColorValue,
  type HairLengthValue,
} from '../services/hairstyleCatalog';

const HairTryOn: React.FC = () => {
  const [selfie, setSelfie] = useState<string | null>(null);
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [category, setCategory] = useState<HairCategory>('women');
  const [selectedStyle, setSelectedStyle] = useState<string>('long-wavy');
  const [hairColor, setHairColor] = useState<HairColorValue>('natural');
  const [hairLength, setHairLength] = useState<HairLengthValue>('any');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const readImage = async (file: File | undefined) => {
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setMessage(validation.error || 'Invalid image.');
      return;
    }
    try {
      const result = await readImageFileAsDataUrl(file);
      setSelfie(result);
      setAfterImage(null);
      setMessage(null);
      track('photo_uploaded', { feature: 'hairstyle' });
    } catch {
      setMessage('Could not read that photo. Please try another.');
    }
  };

  const visibleStyles = getHairstylesByLength(hairLength).filter(
    (style) => style.category === category
  );

  const handleGenerate = async () => {
    if (!selfie || !selectedStyle) return;
    setLoading(true);
    setMessage(null);
    track('hairstyle_started', { style: selectedStyle, color: hairColor });
    try {
      const result = await generateHairstyleTryOn(selfie, selectedStyle, hairColor);
      setAfterImage(result.editedImage);
      track('hairstyle_generated', { style: selectedStyle });
    } catch (error: any) {
      setMessage(friendlyError(error?.message || String(error)));
      track('generation_failed', { feature: 'hairstyle' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!afterImage) return;
    setMessage(null);
    try {
      await saveLook({
        type: 'hair',
        originalImage: selfie ?? undefined,
        generatedImage: afterImage,
        hairstyle: selectedStyle,
        prompt: `Hairstyle: ${getHairstyleLabel(selectedStyle)}${hairColor !== 'natural' ? `, color: ${getHairColorLabel(hairColor)}` : ''}`,
      });
      setMessage('Saved to My Looks!');
      track('look_saved', { type: 'hair' });
    } catch (error: any) {
      const msg = String(error?.message || '');
      setMessage(/unauthorized|sign in|failed to save/i.test(msg)
        ? 'Sign in to save this look.'
        : friendlyError(msg));
    }
  };

  const handleDownload = () => {
    if (!afterImage) return;
    void downloadAsset(afterImage, `chromasnap-hairstyle-${Date.now()}.png`);
  };

  const reset = () => {
    setSelfie(null);
    setAfterImage(null);
    setMessage(null);
  };

  const isError = !!message && /error|failed|unavailable|try again|reach/i.test(message);

  return (
    <div
      id="hairtryon-panel"
      className="studio-shell-enter w-full min-w-0 rounded-3xl border transition-all border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/10 overflow-hidden"
    >
      <div className="h-[52vh] sm:h-[62vh] lg:h-[70vh] bg-slate-950/70 flex items-center justify-center min-w-0">
        {selfie ? (
          <BeforeAfterViewer
            beforeImage={selfie}
            afterImage={afterImage}
            beforeLabel="Original"
            afterLabel="AI Result"
            emptyText="Select a hairstyle and generate to preview your new look."
            accentClass="text-indigo-300"
          />
        ) : (
          <div className="text-center px-6 text-slate-400">
            <div className="text-sm font-semibold uppercase tracking-widest text-indigo-200">Hairstyle Try-On</div>
            <p className="mt-3 text-xs">Upload a clear, front-facing photo to preview hairstyles.</p>
          </div>
        )}
      </div>

      <div className="h-[48vh] sm:h-[38vh] lg:h-[30vh] border-t border-indigo-400/20 bg-slate-900/65 backdrop-blur-xl p-3 sm:p-4 space-y-3 overflow-y-auto min-w-0">
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2 md:overflow-x-auto md:whitespace-nowrap md:pb-1">
          <button type="button" onClick={() => uploadRef.current?.click()} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-indigo-400 md:shrink-0">Upload</button>
          <button type="button" onClick={() => cameraRef.current?.click()} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-200 hover:border-indigo-400 md:shrink-0">Camera</button>
          <button onClick={handleGenerate} disabled={loading || !selfie || !selectedStyle} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50 md:shrink-0">
            {loading ? 'Generating...' : 'Generate'}
          </button>
          <button onClick={handleSave} disabled={!afterImage} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 md:shrink-0">Save</button>
          <button onClick={handleDownload} disabled={!afterImage} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500 disabled:opacity-50 md:shrink-0">Download</button>
          {selfie && (
            <button onClick={reset} className="studio-action-compact inline-flex min-w-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-slate-500 md:shrink-0">Reset</button>
          )}
        </div>

        <input ref={uploadRef} type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0])} className="hidden" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => readImage(e.target.files?.[0])} className="hidden" />

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Style Category</label>
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
            {HAIRSTYLE_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => {
                  setCategory(cat.value);
                  const first = getHairstylesByCategory(cat.value)[0];
                  if (first) setSelectedStyle(first.value);
                }}
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                  category === cat.value
                    ? 'border-indigo-300/70 bg-indigo-500/25 text-indigo-100'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Hair Length</label>
            <select
              value={hairLength}
              onChange={(e) => {
                const next = e.target.value as HairLengthValue;
                setHairLength(next);
                const first = getHairstylesByLength(next).filter((s) => s.category === category)[0];
                if (first) setSelectedStyle(first.value);
              }}
              className="w-full rounded-xl bg-slate-950/60 border border-indigo-400/40 px-3 py-3 text-xs text-indigo-100 focus:outline-none focus:border-indigo-300"
            >
              {HAIR_LENGTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Hair Color</label>
            <select
              value={hairColor}
              onChange={(e) => setHairColor(e.target.value as HairColorValue)}
              className="w-full rounded-xl bg-slate-950/60 border border-indigo-400/40 px-3 py-3 text-xs text-indigo-100 focus:outline-none focus:border-indigo-300"
            >
              {HAIR_COLOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
            {category === 'women' ? "Women's" : category === 'men' ? "Men's" : 'Unisex'} Styles
          </label>
          <div className="flex flex-wrap gap-2">
            {visibleStyles.map((style) => (
              <button
                key={style.value}
                onClick={() => setSelectedStyle(style.value)}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                  selectedStyle === style.value
                    ? 'border-indigo-300/70 bg-indigo-500/25 text-indigo-100'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {selectedStyle && (
          <div className="text-[10px] text-slate-400">
            Selected: <span className="text-indigo-200 font-semibold">{getHairstyleLabel(selectedStyle)}</span>
            {hairColor !== 'natural' && <> · <span className="text-indigo-200 font-semibold">{getHairColorLabel(hairColor)}</span></>}
          </div>
        )}

        {message && (
          <div className={`rounded-xl border p-3 text-xs ${isError ? 'border-red-500/35 bg-red-500/10 text-red-200' : 'border-indigo-500/35 bg-indigo-500/10 text-indigo-100'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default HairTryOn;

