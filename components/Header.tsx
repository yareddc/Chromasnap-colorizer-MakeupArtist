
import React from 'react';

type HeaderProps = {
  tokenBalance?: number | null;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
};

const Header: React.FC<HeaderProps> = ({ tokenBalance, onMenuToggle, isMenuOpen = false }) => {
  return (
    <header className="py-4 px-4 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-50 backdrop-blur-md">
      <div className="w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/icon.png" alt="ChromaSnap logo" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20 object-contain" />
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-indigo-100 truncate">
                ChromaSnap
              </h1>
              {typeof tokenBalance === 'number' && (
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
                  {tokenBalance} tokens available
                </div>
              )}
            </div>
          </div>

          <button
            id="workspace-hamburger-trigger"
            type="button"
            onClick={onMenuToggle}
            className={`xl:hidden h-11 w-11 rounded-xl border transition-colors flex items-center justify-center ${
              isMenuOpen
                ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-indigo-400 hover:text-indigo-100'
            }`}
            aria-label="Toggle workspace menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
