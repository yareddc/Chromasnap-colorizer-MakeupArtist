
import React from 'react';

type HeaderProps = {
  tokenBalance?: number | null;
};

const Header: React.FC<HeaderProps> = () => {
  const handleBadgeClick = () => {
    const target = document.getElementById('account-panel');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="py-6 px-4 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-4xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-center gap-3">
          <img src="/icon.png" alt="ChromaSnap logo" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20 object-contain" />
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-indigo-400">
            ChromaSnap
          </h1>
          <button
            type="button"
            onClick={handleBadgeClick}
            className="ml-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-950/70 border border-slate-800 text-slate-300 hover:border-indigo-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Jump to account panel"
          >
            Account
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
