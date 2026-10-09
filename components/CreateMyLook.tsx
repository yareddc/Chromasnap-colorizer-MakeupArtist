
import React, { useRef, useState } from 'react';
import {
  generateCreateMyLookPlan,
  generateHairstyleTryOn,
  generateVirtualMakeup,
  saveLook,
  type CreateMyLookPlan,
} from '../services/geminiService';
import { friendlyError } from '../services/errorMessages';

const OCCASION_OPTIONS = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'party', label: 'Party / Night Out' },
  { value: 'business', label: 'Business' },
  { value: 'interview', label: 'Interview' },
  { value: 'date-night', label: 'Date Night' },
  { value: 'casual', label: 'Casual' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'formal', label: 'Formal Event' },
];

const STYLE_OPTIONS = [
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
  { value: 'bold', label: 'Bold' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'edgy', label: 'Edgy' },
];

const BUDGET_OPTIONS = [
  { value: '', label: 'No budget limit' },
  { value: 'under $100', label: 'Under $100' },
  { value: '$100 - $300', label: '$100 - $300' },
  { value: '$300 - $1000', label: '$300 - $1000' },
  { value: 'premium', label: 'Premium' },
];

const CreateMyLook: React.FC = () => {
  const [selfie, setSelfie] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('wedding');
  const [style, setStyle] = useState('classic');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<CreateMyLookPlan | null>(null);
  const [hairImage, setHairImage] = useState<string | null>(null);
  const [beautyImage, setBeautyImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'hair' | 'beauty' | null>(null);
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
        setPlan(null);
        setHairImage(null);
        setBeautyImage(null);
        setMessage(null);
      }
    };
    reader.onerror = () => setMessage('Could not read that photo. Please try another.');
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!selfie) return;
    setLoading(true);
    setMessage(null);
    setPlan(null);
    setHairImage(null);
    setBeautyImage(null);
    try {
      const result = await generateCreateMyLookPlan({ selfie, occasion, style, budget: budget || undefined });
      setPlan(result);

      // Auto-generate hair + beauty previews from the plan.
      if (result.hairstyle) {
        setGenerating('hair');
        try {
          const hair = await generateHairstyleTryOn(selfie, result.hairstyle, result.hairColor);
          setHairImage(hair.editedImage);
        } catch { /* non-fatal */ }
        setGenerating(null);
      }
      if (result.beautyLook) {
        setGenerating('beauty');
        try {
          const beauty = await generateVirtualMakeup(selfie, result.beautyLook, result.hairstyle || 'natural/current', occasion);
          setBeautyImage(beauty.editedImage);
        } catch { /* non-fatal */ }
        setGenerating(null);
      }
    } catch (error: any) {
      setMessage(friendlyError(error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hairImage && !beautyImage) return;
    setMessage(null);
    try {
      await saveLook({
        type: 'complete-look',
        originalImage: selfie ?? undefined,
        generatedImage: hairImage || beautyImage || '',
        hairstyle: plan?.hairstyle,
        beautyStyle: plan?.beautyLook,
        outfit: plan?.outfit,
        accessories: plan?.accessories?.map((a) => a.name).join(', '),
        prompt: `Complete look for ${occasion}${style ? ` (${style})` : ''}`,
      });
      setMessage('Saved to My Looks!');
    } catch (error: any) {
      setMessage(/unauthorized|sign in/i.test(String(error?.message || ''))
        ? 'Sign in to save this look.'
        : friendlyError(String(error?.message || '')));
    }
  };

  const handleRegenerateHair = async () => {
    if (!selfie || !plan?.hairstyle) return;
    setGenerating('hair');
    try {
      const hair = await generateHairstyleTryOn(selfie, plan.hairstyle, plan.hairColor);
      setHairImage(hair.editedImage);
    } catch (error: any) {
      setMessage(friendlyError(error?.message || String(error)));
    } finally {
      setGenerating(null);
    }
  };

  const handleRegenerateBeauty = async () => {
    if (!selfie || !plan?.beautyLook) return;
    setGenerating('beauty');
    try {
      const beauty = await generateVirtualMakeup(selfie, plan.beautyLook, plan.hairstyle || 'natural/current', occasion);
      setBeautyImage(beauty.editedImage);
    } catch (error: any) {
      setMessage(friendlyError(error?.message || String(error)));
    } finally {
      setGenerating(null);
    }
  };

  const isError = !!message && /error|failed|unavailable|try again|reach|tokens/i.test(message);

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-black uppercase tracking-widest bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-rose-300 bg-clip-text text-transparent">Create My Look</h2>
        <p className="text-[11px] text-slate-400 mt-1">One tap. A complete, coordinated look — hair, beauty, outfit, and accessories.</p>
      </div>

      {!selfie ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-center">
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-300">Upload a photo to begin</div>
          <p className="mt-2 text-xs text-slate-400">A clear, front-facing photo works best for the complete look preview.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => uploadRef.current?.click()} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider px-5 py-3">Upload Photo</button>
            <button onClick={() => cameraRef.current?.click()} className="rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-bold uppercase tracking-wider px-5 py-3 hover:border-indigo-400">Use Camera</button>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <img src={selfie} alt="Your photo" className="w-16 h-16 rounded-xl object-cover bg-slate-950" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-slate-200">Your photo</div>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => uploadRef.current?.click()} className="text-[10px] text-indigo-300 hover:text-indigo-200">Change</button>
                  <button onClick={() => { setSelfie(null); setPlan(null); setHairImage(null); setBeautyImage(null); }} className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Occasion</label>
                <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400">
                  {OCCASION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Style</label>
                <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400">
                  {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Budget</label>
                <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400">
                  {BUDGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={() => void handleCreate()}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white text-sm font-black uppercase tracking-widest py-4 disabled:opacity-50"
            >
              {loading ? 'Creating your look…' : 'Create My Look'}
            </button>
          </div>

          {message && (
            <div className={`mt-4 rounded-xl border p-3 text-xs ${isError ? 'border-red-500/35 bg-red-500/10 text-red-200' : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'}`}>{message}</div>
          )}

          {plan && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Your Complete Look</h3>
                <PlanRow label="Hairstyle" value={plan.hairstyle} />
                <PlanRow label="Hair Color" value={plan.hairColor !== 'natural' ? plan.hairColor : 'Natural'} />
                <PlanRow label="Beauty Look" value={plan.beautyLook} />
                <PlanRow label="Outfit" value={plan.outfit} />
                {plan.accessories.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Accessories</div>
                    <ul className="mt-1 space-y-1">
                      {plan.accessories.map((a, i) => (
                        <li key={i} className="text-[11px] text-slate-300"><span className="text-indigo-300 font-semibold">{a.category}:</span> {a.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-indigo-300 border-b border-slate-800">Hair Preview</div>
                  {generating === 'hair' ? (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-400">Generating…</div>
                  ) : hairImage ? (
                    <img src={hairImage} alt="Hairstyle preview" className="w-full h-56 object-contain bg-slate-950" />
                  ) : (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-500">—</div>
                  )}
                  <div className="p-2">
                    <button onClick={() => void handleRegenerateHair()} disabled={generating === 'hair'} className="w-full rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 py-1.5">
                      Change Hair
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-rose-300 border-b border-slate-800">Beauty Preview</div>
                  {generating === 'beauty' ? (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-400">Generating…</div>
                  ) : beautyImage ? (
                    <img src={beautyImage} alt="Beauty preview" className="w-full h-56 object-contain bg-slate-950" />
                  ) : (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-500">—</div>
                  )}
                  <div className="p-2">
                    <button onClick={() => void handleRegenerateBeauty()} disabled={generating === 'beauty'} className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 text-[10px] font-semibold uppercase tracking-wider text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 py-1.5">
                      Change Beauty
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => void handleSave()}
                disabled={!hairImage && !beautyImage}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest py-3 disabled:opacity-50"
              >
                Save This Look
              </button>
            </div>
          )}
        </>
      )}

      <input ref={uploadRef} type="file" accept="image/*" onChange={(e) => readImage(e.target.files?.[0])} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => readImage(e.target.files?.[0])} className="hidden" />
    </div>
  );
};

const PlanRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-[11px]">
    <span className="text-slate-400">{label}: </span>
    <span className="text-slate-200">{value || '—'}</span>
  </div>
);

export default CreateMyLook;

