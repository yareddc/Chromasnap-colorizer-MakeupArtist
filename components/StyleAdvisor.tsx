
import React, { useRef, useState } from 'react';
import { askStyleAdvisor } from '../services/geminiService';
import { friendlyError } from '../services/errorMessages';
import type { WorkspaceTab } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface StyleAdvisorProps {
  onNavigate?: (tab: WorkspaceTab) => void;
}

const SUGGESTED_PROMPTS = [
  'What should I wear to a wedding?',
  'What hairstyle fits this outfit?',
  'Give me a professional look for an interview.',
  'Create a date-night look.',
  'Give me a complete outfit under $200.',
];

const StyleAdvisor: React.FC<StyleAdvisorProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hi! I\'m your AI stylist. Ask me what to wear, how to style your hair, or which beauty look suits you.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const reply = await askStyleAdvisor(trimmed);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply || 'Here are some style ideas for you!' }]);
    } catch (err: any) {
      const msg = String(err?.message || '');
      setError(/out of tokens|not enough tokens|insufficient/i.test(msg)
        ? 'You\'re out of tokens. Top up or upgrade to keep chatting.'
        : friendlyError(msg));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  };

  return (
    <div className="w-full px-3 sm:px-4 py-4 flex flex-col" style={{ height: '72vh' }}>
      <div className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">AI Stylist</h2>
        <p className="text-[11px] text-slate-400 mt-1">Your personal styling assistant — ask me anything about hair, beauty, or outfits.</p>
      </div>

      {onNavigate && (
        <div className="mb-3 flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
          {[
            { tab: 'create-look' as WorkspaceTab, label: '✨ Create My Look' },
            { tab: 'hairstyle' as WorkspaceTab, label: 'Try Hairstyle' },
            { tab: 'beauty-lab' as WorkspaceTab, label: 'Try Beauty' },
            { tab: 'outfit' as WorkspaceTab, label: 'Try Outfit' },
          ].map((a) => (
            <button
              key={a.tab}
              onClick={() => onNavigate(a.tab)}
              className="inline-flex shrink-0 items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-200'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-800 px-3 py-2 text-xs text-slate-400">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mt-2 rounded-xl border border-red-500/35 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>
      )}

      <div className="mt-2 space-y-2">
        <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void send(prompt)}
              disabled={loading}
              className="inline-flex shrink-0 items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[10px] text-slate-300 hover:border-indigo-400 hover:text-indigo-200 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(input); }}
            placeholder="Ask about hair, beauty, or outfits…"
            className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => void send(input)}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider px-4 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default StyleAdvisor;
