
import React, { useCallback, useEffect, useState } from 'react';
import {
  listLooks, deleteLook, setLookFavorite, saveLook,
  generateHairstyleTryOn, generateVirtualMakeup,
  type SavedLook,
} from '../services/geminiService';
import { friendlyError } from '../services/errorMessages';
import { downloadAsset } from '../services/downloadService';
import { track } from '../services/analytics';
import { generateShareCard } from '../services/share';

const urlToDataUrl = async (src: string): Promise<string> => {
  if (/^data:/i.test(src)) return src;
  const res = await fetch(src, { credentials: 'include' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const LooksGallery: React.FC = () => {
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listLooks();
      setLooks(result);
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (/unauthorized|failed to load/i.test(msg)) {
        setMessage('Sign in to view your saved looks.');
      } else {
        setMessage(friendlyError(msg));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFavorite = async (look: SavedLook) => {
    try {
      await setLookFavorite(look.id, !look.favorite);
      setLooks((prev) => prev.map((item) => item.id === look.id ? { ...item, favorite: !look.favorite } : item));
    } catch (error: any) {
      setMessage(friendlyError(String(error?.message || '')));
    }
  };

  const handleDelete = async (look: SavedLook) => {
    try {
      await deleteLook(look.id);
      setLooks((prev) => prev.filter((item) => item.id !== look.id));
    } catch (error: any) {
      setMessage(friendlyError(String(error?.message || '')));
    }
  };

  const handleDownload = (look: SavedLook) => {
    void downloadAsset(look.generatedImageUrl, `chromasnap-${look.type}-${Date.now()}.jpg`);
  };

  const handleShare = async (look: SavedLook) => {
    try {
      const shareCard = await generateShareCard(look.generatedImageUrl, {
        label: typeLabel(look.type),
      });
      const res = await fetch(shareCard);
      const blob = await res.blob();
      const file = new File([blob], `chromasnap-${look.type}.jpg`, { type: 'image/png' });

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'ChromaSnap',
          text: `My ${typeLabel(look.type)} look from ChromaSnap!`,
        });
      } else {
        await downloadAsset(shareCard, `chromasnap-${look.type}-${Date.now()}.png`);
      }
      track('look_shared', { type: look.type });
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      void downloadAsset(look.generatedImageUrl, `chromasnap-${look.type}-${Date.now()}.jpg`);
    }
  };

  const handleRegenerate = async (look: SavedLook) => {
    if (!look.originalImageUrl) {
      setMessage('Original image is not available to regenerate this look.');
      return;
    }
    setRegeneratingId(look.id);
    setMessage(null);
    try {
      const original = await urlToDataUrl(look.originalImageUrl);
      let newImage: string | null = null;

      if (look.type === 'hair' && look.hairstyle) {
        const res = await generateHairstyleTryOn(original, look.hairstyle, 'natural');
        newImage = res.editedImage;
      } else if (look.type === 'beauty' && look.beautyStyle) {
        const res = await generateVirtualMakeup(original, look.beautyStyle, 'natural/current', 'everyday');
        newImage = res.editedImage;
      }

      if (newImage) {
        await saveLook({
          type: look.type,
          originalImage: original,
          generatedImage: newImage,
          hairstyle: look.hairstyle ?? undefined,
          beautyStyle: look.beautyStyle ?? undefined,
          outfit: look.outfit ?? undefined,
        });
        setMessage('Regenerated a new variation!');
        await load();
      } else {
        setMessage('Regenerate is not available for this look type yet.');
      }
    } catch (error: any) {
      setMessage(friendlyError(String(error?.message || '')));
    } finally {
      setRegeneratingId(null);
    }
  };

  const typeLabel = (type: string) => {
    if (type === 'complete-look') return 'Complete Look';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">My Looks</h2>
        <button
          onClick={() => void load()}
          className="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 uppercase tracking-wider"
        >
          Refresh
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-300">{message}</div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading your looks...</div>
      ) : looks.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          No saved looks yet. Generate a look and tap "Save" to add it here.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {looks.map((look) => (
            <div
              key={look.id}
              className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/50 flex flex-col"
            >
              <img
                src={look.generatedImageUrl}
                alt={`${typeLabel(look.type)} look`}
                className="w-full h-40 object-cover bg-slate-950"
              />
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">{typeLabel(look.type)}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void handleFavorite(look)}
                      className={`text-sm ${look.favorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                      title={look.favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      {look.favorite ? '★' : '☆'}
                    </button>
                    <button onClick={() => void handleShare(look)} className="text-sm text-slate-500 hover:text-indigo-300" title="Share">↗</button>
                    <button onClick={() => handleDownload(look)} className="text-sm text-slate-500 hover:text-indigo-300" title="Download">↓</button>
                    <button
                      onClick={() => void handleDelete(look)}
                      className="text-sm text-slate-500 hover:text-red-400"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {look.hairstyle && <div className="text-[10px] text-slate-400 truncate">Hair: {look.hairstyle}</div>}
                {look.beautyStyle && <div className="text-[10px] text-slate-400 truncate">Beauty: {look.beautyStyle}</div>}
                <button
                  onClick={() => void handleRegenerate(look)}
                  disabled={regeneratingId === look.id}
                  className="w-full mt-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 py-1"
                >
                  {regeneratingId === look.id ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LooksGallery;
