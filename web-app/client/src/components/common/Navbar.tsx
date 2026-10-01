import React from 'react';
import { ViewMode, AuthUser } from '../../types';

interface NavbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentUser: AuthUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  pendingApprovalsCount?: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  currentUser,
  onOpenLogin,
  onLogout,
  pendingApprovalsCount = 0,
  theme,
  onToggleTheme
}) => {
  const scrollToSection = (id: string) => {
    if (viewMode !== 'HOME') {
      setViewMode('HOME');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Check roles available to the logged-in user
  const hasSuperAdmin = currentUser?.roles.includes('SUPER_ADMIN');
  const hasClubAdmin = currentUser?.roles.includes('CLUB_ADMIN');
  const hasCoachOrPlayer = currentUser?.roles.some(r => r === 'COACH' || r === 'PLAYER');

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
      {/* Left: Brand Logo & Public Marketing Navigation */}
      <div className="flex items-center space-x-6">
        <button
          onClick={() => {
            setViewMode('HOME');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center space-x-2 focus:outline-none text-left cursor-pointer"
        >
          <span className="text-2xl">🏏</span>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            eCricketCoach
          </span>
        </button>

        {/* Public Home Page Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1">
          <button
            onClick={() => {
              setViewMode('HOME');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              viewMode === 'HOME' ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => scrollToSection('pricing')}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
          >
            Plans & Pricing
          </button>
          <button
            onClick={() => scrollToSection('about-us')}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
          >
            About Us
          </button>
          <button
            onClick={() => scrollToSection('faqs')}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
          >
            FAQs
          </button>
          <button
            onClick={() => scrollToSection('contact-us')}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition cursor-pointer"
          >
            Contact Us
          </button>
        </nav>
      </div>

      {/* Right Side: Conditional Multi-Role Persona Tabs OR Clean Login Button */}
      <div className="flex items-center gap-3">
        {currentUser ? (
          // Authenticated State: Show persona-specific tabs according to the user's role(s)
          <div className="flex items-center gap-3">
            {/* Persona Switcher Tabs */}
            <div className="flex items-center rounded-lg bg-slate-800/90 p-1 border border-slate-700/80">
              {/* Home shortcut */}
              <button
                onClick={() => setViewMode('HOME')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'HOME'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Home
              </button>

              {/* Coach / Player Training Portal */}
              {hasCoachOrPlayer && (
                <button
                  onClick={() => setViewMode('COACHING_PORTAL')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    viewMode === 'COACHING_PORTAL'
                      ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {currentUser.roles.includes('COACH') ? 'Coaching & AI App' : 'My Training & AI'}
                </button>
              )}

              {/* Club Portal */}
              {hasClubAdmin && (
                <button
                  onClick={() => setViewMode('CLUB_PORTAL')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'CLUB_PORTAL'
                      ? 'bg-purple-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Club Portal</span>
                  {currentUser.clubName && (
                    <span className="text-[10px] bg-purple-900/60 text-purple-200 px-1 rounded">
                      {currentUser.clubName.split(' ')[0]}
                    </span>
                  )}
                </button>
              )}

              {/* Super Admin Panel */}
              {hasSuperAdmin && (
                <button
                  onClick={() => setViewMode('ADMIN_PANEL')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'ADMIN_PANEL'
                      ? 'bg-cyan-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Admin Panel</span>
                  <span className="text-[10px] bg-cyan-900/60 text-cyan-200 px-1 rounded">Super-Admin</span>
                  {pendingApprovalsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-extrabold animate-pulse">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* User Profile Badge & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-white leading-none">{currentUser.name}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  {currentUser.roles.map(r => (
                    <span
                      key={r}
                      className="text-[9px] px-1 rounded bg-slate-800 text-slate-300 font-mono"
                    >
                      {r.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Log out"
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 border border-slate-700 text-slate-300 text-xs transition cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          // Unauthenticated State: Clean Login Button with Icon
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>Log In</span>
            </button>
          </div>
        )}

        {/* Theme Toggle Button (Dark / Light) */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-amber-400 transition cursor-pointer flex items-center justify-center ml-1"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            // Sun Icon for switching to Light mode
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-amber-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            // Moon Icon for switching to Dark mode
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-cyan-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};
