
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
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
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
