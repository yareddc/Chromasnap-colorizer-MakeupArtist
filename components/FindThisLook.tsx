
import React, { useState } from 'react';
import { findThisLook, type FindThisLookResult, type ProductRecommendation, type ServiceRecommendation } from '../services/geminiService';
import { friendlyError } from '../services/errorMessages';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Fashion + Services' },
  { value: 'fashion', label: 'Fashion Products' },
  { value: 'services', label: 'Local Services' },
];

const serviceTypeLabel = (type: string) => {
  if (type === 'hair-salon') return 'Hair Salon';
  if (type === 'beauty-salon') return 'Beauty Salon';
  if (type === 'barber') return 'Barber';
  return 'Stylist';
};

const CATEGORY_ICONS: Record<string, string> = {
  shoes: '👟',
  clothing: '👕',
  bag: '👜',
  jewelry: '💍',
  sunglasses: '🕶️',
  hat: '🧢',
  beauty: '💄',
  accessory: '⌚',
};

// The AI provider never fabricates product URLs, so fall back to a real shopping search.
const productShopUrl = (item: ProductRecommendation) =>
  item.affiliateUrl || item.productUrl ||
  `https://www.google.com/search?tbm=shop&q=${encodeURIComponent([item.brand, item.name].filter(Boolean).join(' '))}`;

const serviceMapUrl = (service: ServiceRecommendation, location: string) =>
  `https://www.google.com/maps/search/${encodeURIComponent([serviceTypeLabel(service.type), service.location || location].filter(Boolean).join(' near '))}`;

const FindThisLook: React.FC = () => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FindThisLookResult | null>(null);

  const handleFind = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setMessage(null);
    setResult(null);
    try {
      const data = await findThisLook({
        lookDescription: description,
        category,
        location: location.trim() || undefined,
      });
      setResult(data);
    } catch (error: any) {
      setMessage(friendlyError(error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-4 py-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">Find This Look</h2>
      <p className="text-[11px] text-slate-400 mt-1 mb-4">Describe a look to find similar products and local services.</p>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Look Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. A sharp navy suit with brown leather shoes and a silver watch for a wedding"
            rows={3}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">What to find</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400">
              {CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Location (optional)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Brooklyn, NY"
              className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        <button
          onClick={() => void handleFind()}
          disabled={loading || !description.trim()}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-3 disabled:opacity-50"
        >
          {loading ? 'Finding…' : 'Find This Look'}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-200">{message}</div>
      )}

      {result && result.fashion.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Similar Products</h3>
          <div className="grid gap-3 md:grid-cols-2">
          {result.fashion.map((item, idx) => (
            <div key={idx} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800 flex items-center justify-center text-2xl">
                {item.image
                  ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  : <span aria-hidden="true">{CATEGORY_ICONS[item.category.toLowerCase()] || '🛍️'}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">{item.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-indigo-300 mt-0.5">{item.category}</div>
                  </div>
                  {item.price && <div className="shrink-0 text-xs font-semibold text-emerald-300">{item.price}</div>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.brand && <span className="text-[10px] rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{item.brand}</span>}
                  {item.retailer && <span className="text-[10px] rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">{item.retailer}</span>}
                  <a
                    href={productShopUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/25"
                  >
                    Shop
                  </a>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {result && result.services.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Local Services</h3>
          {result.services.map((service, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="text-xs font-semibold text-slate-100">{service.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-fuchsia-300 mt-0.5">{serviceTypeLabel(service.type)}</div>
              {service.description && <div className="text-[11px] text-slate-400 mt-1">{service.description}</div>}
              <a
                href={serviceMapUrl(service, location.trim())}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-500/25"
              >
                Find nearby
              </a>
            </div>
          ))}
        </div>
      )}

      {result && result.fashion.length === 0 && result.services.length === 0 && (
        <div className="mt-4 text-xs text-slate-400">No recommendations returned. Try a more specific look description.</div>
      )}
    </div>
  );
};

export default FindThisLook;
