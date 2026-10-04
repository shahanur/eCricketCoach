import React from 'react';
import { ViewMode, AuthUser, ThemeMode } from '../../types';

interface NavbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentUser: AuthUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  pendingApprovalsCount?: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSelectTheme?: (mode: ThemeMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  setViewMode,
  currentUser,
  onOpenLogin,
  onLogout,
  pendingApprovalsCount = 0,
  theme,
  onToggleTheme,
  onSelectTheme
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
      {/* Left: Brand Logo & Navigation (Context-Aware) */}
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

        {/* Unauthenticated Marketing Navigation Links */}
        {!currentUser && (
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
            <button
              onClick={() => setViewMode('HELP_SUPPORT')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'HELP_SUPPORT' ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Help & Support
            </button>
          </nav>
        )}

        {/* Authenticated Persona Navigation Links (Clean & Scoped) */}
        {currentUser && (
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => {
                setViewMode('HOME');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'HOME'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700/80 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>🏠</span>
              <span>
                {hasSuperAdmin
                  ? 'Admin Home'
                  : hasClubAdmin
                  ? `${currentUser.clubName?.split(' ')[0] || 'Club'} Home`
                  : hasCoachOrPlayer
                  ? currentUser.roles.includes('COACH') ? 'Coach Home' : 'Player Home'
                  : 'My Home'}
              </span>
            </button>

            {/* Scoped Help & Support Navigation Button */}
            <button
              onClick={() => {
                setViewMode('HELP_SUPPORT');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'HELP_SUPPORT'
                  ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700/80 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>❓</span>
              <span>Help & Support</span>
            </button>
          </nav>
        )}
      </div>

      {/* Right Side: Conditional Multi-Role Persona Tabs OR Clean Login Button */}
      <div className="flex items-center gap-3">
        {currentUser ? (
          // Authenticated State: Show persona-specific tabs according to the user's role(s)
          <div className="flex items-center gap-3">
            {/* Persona Switcher Tabs */}
            <div className="flex items-center rounded-xl bg-slate-800/90 p-1 border border-slate-700/80 h-10 box-border">
              {/* Coach / Player AI Video Biomechanics Portal (Hidden from pure Club Admin who has it integrated in Club Portal) */}
              {hasCoachOrPlayer && !hasClubAdmin && (
                <button
                  onClick={() => setViewMode('COACHING_PORTAL')}
                  className={`h-full px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'COACHING_PORTAL'
                      ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>📹</span>
                  <span>
                    {currentUser.roles.includes('COACH')
                      ? 'AI Video & Coaching'
                      : 'My Video & AI'}
                  </span>
                </button>
              )}

              {/* Club Portal */}
              {hasClubAdmin && (
                <button
                  onClick={() => setViewMode('CLUB_PORTAL')}
                  className={`h-full px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
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
                  className={`h-full px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
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

            {/* Mobile / Compact Help button */}
            <button
              onClick={() => setViewMode('HELP_SUPPORT')}
              title="Help & Support"
              className={`md:hidden h-10 w-10 flex items-center justify-center rounded-xl border border-slate-700/80 text-xs font-bold transition cursor-pointer box-border ${
                viewMode === 'HELP_SUPPORT' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-800/80 text-slate-300'
              }`}
            >
              ❓
            </button>

            {/* Logged-in User Profile Name & Log Out Button */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2 px-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 h-10 box-border">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-left flex flex-col justify-center">
                  <span className="text-xs font-bold text-white block leading-tight truncate max-w-[140px] sm:max-w-[200px]">
                    {currentUser.name}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {hasSuperAdmin ? (
                      <span className="text-[9px] px-1 rounded bg-cyan-900/60 text-cyan-300 font-semibold font-mono leading-none py-0.5">
                        Super-Admin
                      </span>
                    ) : (
                      currentUser.roles.map(r => (
                        <span
                          key={r}
                          className="text-[9px] px-1 rounded bg-slate-700 text-slate-300 font-mono leading-none py-0.5"
                        >
                          {r.replace('_', ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Log Out Button (replaces the Log In button) */}
              <button
                onClick={onLogout}
                title="Log out"
                className="flex items-center gap-1.5 px-3.5 h-10 box-border rounded-xl bg-gradient-to-r from-rose-500/20 to-red-500/20 hover:from-rose-500/30 hover:to-red-500/30 border border-rose-500/40 text-rose-200 hover:text-white font-bold text-xs shadow-sm transition cursor-pointer"
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
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        ) : (
          // Unauthenticated State: Clean Login Button with Icon
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-4 h-10 box-border rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
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

        {/* Theme Selector (Dark / Soft Light / Pure White) */}
        <div className="flex items-center rounded-xl bg-slate-800/90 border border-slate-700/80 p-1 h-10 box-border ml-1 shadow-sm">
          <button
            onClick={() => (onSelectTheme ? onSelectTheme('dark') : onToggleTheme())}
            title="Dark Theme (Night Nets)"
            className={`h-full px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              theme === 'dark'
                ? 'bg-slate-700 text-amber-400 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🌙</span>
            <span className="hidden sm:inline text-[10px]">Dark</span>
          </button>
          <button
            onClick={() => (onSelectTheme ? onSelectTheme('light') : onToggleTheme())}
            title="Soft Slate Light Theme"
            className={`h-full px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              theme === 'light'
                ? 'bg-white text-slate-900 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>⛅</span>
            <span className="hidden sm:inline text-[10px]">Soft</span>
          </button>
          <button
            onClick={() => (onSelectTheme ? onSelectTheme('pure-light') : onToggleTheme())}
            title="Pure White Theme (Cricket Whites / Daylight)"
            className={`h-full px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
              theme === 'pure-light'
                ? 'bg-white text-emerald-600 font-bold shadow-sm border border-emerald-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>☀️</span>
            <span className="hidden sm:inline text-[10px]">Pure</span>
          </button>
        </div>
      </div>
    </header>
  );
};
