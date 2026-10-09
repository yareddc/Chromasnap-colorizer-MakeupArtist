
import React from 'react';
import type { WorkspaceTab } from '../types';

type Variant = 'sidebar' | 'menu';

interface WorkspaceNavProps {
  variant: Variant;
  activeTab: WorkspaceTab;
  onNavigate: (tab: WorkspaceTab) => void;
  createMenuOpen: boolean;
  onToggleCreate: () => void;
}

/**
 * Shared workspace navigation (Home / Create / Tools / Discover).
 * Rendered by both the desktop sidebar and the mobile hamburger menu so the
 * navigation stays in sync from a single source of truth.
 */
const WorkspaceNav: React.FC<WorkspaceNavProps> = ({
  variant,
  activeTab,
  onNavigate,
  createMenuOpen,
  onToggleCreate,
}) => {
  const isSidebar = variant === 'sidebar';
  const size = isSidebar ? 'text-sm' : 'text-xs';
  const activeShadow = isSidebar ? ' shadow-sm' : '';
  const section = `rounded-${isSidebar ? '2xl' : 'xl'} border p-${isSidebar ? '2' : '1.5'} space-y-1${isSidebar ? '' : ' mb-2'} ${isSidebar ? 'bg-slate-950/60' : 'bg-slate-900/45'}`;
  const header = `px-2 ${isSidebar ? 'pt-1 pb-1' : 'py-1'} text-[10px] uppercase tracking-widest font-bold`;

  const buttonClass = (isActive: boolean, activeCls: string, hoverCls: string) =>
    `w-full rounded-full px-3 py-2 text-left ${size} font-semibold transition-all ${
      isActive
        ? `${activeCls}${activeShadow}`
        : `text-slate-300 border border-transparent ${hoverCls} hover:text-white`
    }`;

  return (
    <>
      <div className={`${section} border-indigo-400/20`}>
        <div className={`${header} text-indigo-200/75`}>Home</div>
        <button
          onClick={() => onNavigate('dashboard')}
          className={buttonClass(activeTab === 'dashboard', 'bg-indigo-500/25 text-indigo-100 border border-indigo-400/50', 'hover:bg-indigo-500/10 hover:border-indigo-400/30')}
        >
          Dashboard
        </button>
      </div>

      <div className={`${section} border-fuchsia-400/20`}>
        <button
          onClick={onToggleCreate}
          className={`w-full rounded-full px-3 py-2 text-left ${size} font-bold uppercase tracking-widest text-fuchsia-200 flex items-center justify-between hover:bg-fuchsia-500/10 transition-all`}
        >
          <span>Create</span>
          <span className="text-fuchsia-300">{createMenuOpen ? '▾' : '▸'}</span>
        </button>
        {createMenuOpen && (
          <>
            <button onClick={() => onNavigate('create-look')} className={buttonClass(activeTab === 'create-look', 'bg-gradient-to-r from-indigo-500/40 to-fuchsia-500/40 text-white border border-fuchsia-400/50', 'hover:bg-indigo-500/10 hover:border-indigo-400/30')}>✨ Create My Look</button>
            <button onClick={() => onNavigate('hairstyle')} className={buttonClass(activeTab === 'hairstyle', 'bg-indigo-500/25 text-indigo-100 border border-indigo-400/50', 'hover:bg-indigo-500/10 hover:border-indigo-400/30')}>Hairstyle Try-On</button>
            <button onClick={() => onNavigate('beauty-lab')} className={buttonClass(activeTab === 'beauty-lab', 'bg-rose-500/25 text-rose-100 border border-rose-400/50', 'hover:bg-rose-500/10 hover:border-rose-400/30')}>Beauty Lab</button>
            <button onClick={() => onNavigate('barbershop')} className={buttonClass(activeTab === 'barbershop', 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/50', 'hover:bg-emerald-500/10 hover:border-emerald-400/30')}>Barbershop</button>
            <button onClick={() => onNavigate('outfit')} className={buttonClass(activeTab === 'outfit', 'bg-fuchsia-500/25 text-fuchsia-100 border border-fuchsia-400/50', 'hover:bg-fuchsia-500/10 hover:border-fuchsia-400/30')}>Outfit Studio</button>
          </>
        )}
      </div>

      <div className={`${section} border-cyan-400/20`}>
        <div className={`${header} text-cyan-200/75`}>Tools</div>
        <button onClick={() => onNavigate('animate')} className={buttonClass(activeTab === 'animate', 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50', 'hover:bg-cyan-500/10 hover:border-cyan-400/30')}>Animate</button>
        <button onClick={() => onNavigate('enhance')} className={buttonClass(activeTab === 'enhance', 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50', 'hover:bg-cyan-500/10 hover:border-cyan-400/30')}>Photo Enhance</button>
      </div>

      <div className={`${section} border-teal-400/20`}>
        <div className={`${header} text-teal-200/75`}>Discover</div>
        <button onClick={() => onNavigate('stylist')} className={buttonClass(activeTab === 'stylist', 'bg-teal-500/25 text-teal-100 border border-teal-400/50', 'hover:bg-teal-500/10 hover:border-teal-400/30')}>AI Stylist</button>
        <button onClick={() => onNavigate('find-this-look')} className={buttonClass(activeTab === 'find-this-look', 'bg-purple-500/25 text-purple-100 border border-purple-400/50', 'hover:bg-purple-500/10 hover:border-purple-400/30')}>Find This Look</button>
      </div>
    </>
  );
};

export default WorkspaceNav;
