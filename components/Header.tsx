
import React from 'react';

type WorkspaceTab = 'colorizer' | 'beauty-lab';

type HeaderProps = {
  tokenBalance?: number | null;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
};

const Header: React.FC<HeaderProps> = ({ tokenBalance, activeTab, onTabChange }) => {
  const handleBadgeClick = () => {
    const target = document.getElementById('account-panel');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="py-6 px-4 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <img src="/icon.png" alt="ChromaSnap logo" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20 object-contain" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-indigo-400">
                ChromaSnap
              </h1>
              {typeof tokenBalance === 'number' && (
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
                  {tokenBalance} tokens available
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onTabChange('colorizer')}
              className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                activeTab === 'colorizer'
                  ? 'bg-indigo-500/20 border-indigo-400 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-indigo-400 hover:text-white'
              }`}
              aria-pressed={activeTab === 'colorizer'}
            >
              Colorizer
            </button>
            <button
              type="button"
              onClick={() => onTabChange('beauty-lab')}
              className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                activeTab === 'beauty-lab'
                  ? 'bg-rose-500/20 border-rose-400 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-rose-400 hover:text-white'
              }`}
              aria-pressed={activeTab === 'beauty-lab'}
            >
              Beauty Lab
            </button>
            <button
              type="button"
              onClick={handleBadgeClick}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-950/70 border border-slate-800 text-slate-300 hover:border-indigo-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              aria-label="Jump to account panel"
            >
              Account
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
