import React from 'react';
import { ViewMode } from '../../types';

interface NavbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ viewMode, setViewMode }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <span className="text-2xl">🏏</span>
        <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          eCricketCoach
        </span>

        {/* Navigation Mode Switcher for Desktop */}
        <div className="hidden sm:flex items-center rounded-lg bg-slate-800 p-1 border border-slate-700 ml-4">
          <button
            onClick={() => setViewMode('COACHING_PORTAL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              viewMode === 'COACHING_PORTAL' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Coaching & AI App
          </button>
          <button
            onClick={() => setViewMode('CLUB_PORTAL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'CLUB_PORTAL' ? 'bg-purple-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Club Portal</span>
            <span className="text-[10px] bg-purple-900/60 text-purple-200 px-1 rounded">Melbourne CA</span>
          </button>
          <button
            onClick={() => setViewMode('ADMIN_PANEL')}
            className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
              viewMode === 'ADMIN_PANEL' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Admin Panel</span>
            <span className="text-[10px] bg-cyan-900/60 text-cyan-200 px-1 rounded">Super-Admin</span>
          </button>
        </div>
      </div>

      {/* Mobile View Switcher & SSO Buttons */}
      <div className="flex items-center gap-2">
        <div className="flex sm:hidden rounded bg-slate-800 p-0.5 border border-slate-700">
          <button
            onClick={() => setViewMode('COACHING_PORTAL')}
            className={`px-2 py-1 rounded text-[11px] font-medium ${viewMode === 'COACHING_PORTAL' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'}`}
          >
            App
          </button>
          <button
            onClick={() => setViewMode('CLUB_PORTAL')}
            className={`px-2 py-1 rounded text-[11px] font-medium ${viewMode === 'CLUB_PORTAL' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400'}`}
          >
            Club
          </button>
          <button
            onClick={() => setViewMode('ADMIN_PANEL')}
            className={`px-2 py-1 rounded text-[11px] font-medium ${viewMode === 'ADMIN_PANEL' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
          >
            Admin
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <span className="text-xs text-slate-400">SSO:</span>
          <button className="text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">Google</button>
          <button className="text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">Microsoft</button>
          <button className="text-xs px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">Apple</button>
        </div>
      </div>
    </header>
  );
};
