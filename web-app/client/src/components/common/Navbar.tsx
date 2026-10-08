import React, { useState } from 'react';
import { ViewMode, AuthUser, ThemeMode } from '../../types';
import { Menu, X, Home, HelpCircle, Shield, LogOut, Video, Building2 } from 'lucide-react';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (!currentUser) {
      window.location.hash = id;
      setViewMode('HOME');
      return;
    }
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

  const handleNavClick = (mode: ViewMode) => {
    if (!currentUser && mode === 'HOME') window.location.hash = 'home';
    setViewMode(mode);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check roles available to the logged-in user
  const hasSuperAdmin = currentUser?.roles.includes('SUPER_ADMIN');
  const hasClubAdmin = currentUser?.roles.includes('CLUB_ADMIN');
  const hasCoachOrPlayer = currentUser?.roles.some(r => r === 'COACH' || r === 'PLAYER');
  const isClubCoach = currentUser?.roles.includes('COACH') && currentUser.coachContext === 'CLUB';
  const hasClubPortal = hasClubAdmin || isClubCoach;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 px-3 py-2.5 shadow-lg shadow-slate-950/20 backdrop-blur sm:px-4">
      <div className="flex items-center justify-between">
        {/* Left: Brand Logo & Desktop Navigation */}
        <div className="flex items-center space-x-3 sm:space-x-6">
          <button
            onClick={() => handleNavClick('HOME')}
            className="flex shrink-0 items-center space-x-2 rounded-sm text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            <span className="text-2xl">🏏</span>
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent sm:text-xl">
              eCricketCoach
            </span>
          </button>

          {/* Unauthenticated Marketing Navigation Links (Desktop) */}
          {!currentUser && (
            <nav className="hidden lg:flex items-center space-x-1">
              <button
                onClick={() => handleNavClick('HOME')}
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
                onClick={() => handleNavClick('HELP_SUPPORT')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  viewMode === 'HELP_SUPPORT' ? 'text-emerald-400 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Help & Support
              </button>
            </nav>
          )}

          {/* Authenticated Persona Navigation Links (Desktop) */}
          {currentUser && (
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => handleNavClick('HOME')}
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
                    ? currentUser.roles.includes('COACH') ? isClubCoach ? 'Club Coach Home' : 'Coach Home' : 'Player Home'
                    : 'My Home'}
                </span>
              </button>

              <button
                onClick={() => handleNavClick('HELP_SUPPORT')}
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

        {/* Right Side: Desktop Nav Buttons + Mobile Hamburger Trigger */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {currentUser ? (
            <>
              {/* Desktop-only Action Buttons */}
              <div className="hidden sm:flex items-center gap-2 sm:gap-2.5">
                {/* Coaching Portal */}
                {hasCoachOrPlayer && !hasClubAdmin && (
                  <button
                    onClick={() => handleNavClick('COACHING_PORTAL')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                      viewMode === 'COACHING_PORTAL'
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm font-bold'
                        : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📹</span>
                    <span>
                      {currentUser.roles.includes('COACH')
                        ? isClubCoach ? 'Club Coaching Workspace' : 'AI Video & Coaching'
                        : 'My Video & AI'}
                    </span>
                  </button>
                )}

                {/* Club Portal */}
                {hasClubPortal && (
                  <button
                    onClick={() => handleNavClick('CLUB_PORTAL')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                      viewMode === 'CLUB_PORTAL'
                        ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-sm font-bold'
                        : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Club Portal</span>
                    {currentUser.clubName && (
                      <span className="text-[10px] bg-sky-900/60 text-sky-200 px-1.5 py-0.5 rounded font-mono">
                        {currentUser.clubName.split(' ')[0]}
                      </span>
                    )}
                  </button>
                )}

                {/* Super Admin Panel */}
                {hasSuperAdmin && (
                  <button
                    onClick={() => handleNavClick('ADMIN_PANEL')}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                      viewMode === 'ADMIN_PANEL'
                        ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-sm font-bold'
                        : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Admin Panel</span>
                    <span className="text-[10px] bg-sky-900/60 text-sky-200 px-1 rounded">Super-Admin</span>
                    {pendingApprovalsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-slate-950 font-extrabold animate-pulse">
                        {pendingApprovalsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* User Profile Badge (Desktop) */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                  <div className="flex items-center gap-2 px-2.5 rounded-lg bg-slate-800/90 border border-slate-700/80 h-8">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="text-left flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white block leading-none truncate max-w-[120px] sm:max-w-[160px]">
                        {currentUser.name}
                      </span>
                      {hasSuperAdmin ? (
                        <span className="text-[9px] px-1 rounded bg-sky-900/60 text-sky-300 font-semibold font-mono leading-tight">
                          Super-Admin
                        </span>
                      ) : (
                        currentUser.roles.slice(0, 1).map(r => (
                          <span
                            key={r}
                            className="text-[9px] px-1 rounded bg-slate-700 text-slate-300 font-mono leading-tight"
                          >
                            {r.replace('_', ' ')}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Desktop Log Out Button */}
                  <button
                    onClick={onLogout}
                    title="Log out"
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-gradient-to-r from-rose-500/20 to-red-500/20 hover:from-rose-500/30 hover:to-red-500/30 border border-rose-500/40 text-rose-200 hover:text-white font-semibold text-xs shadow-sm transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>

              {/* Mobile Compact User Pill */}
              <div className="flex sm:hidden items-center gap-1.5 px-2 rounded-lg bg-slate-800/90 border border-slate-700/80 h-8">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-[11px] font-bold text-white truncate max-w-[90px]">
                  {currentUser.name?.split(' ')[0]}
                </span>
              </div>
            </>
          ) : (
            // Unauthenticated: Clean Login Button
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-sm transition cursor-pointer"
            >
              <span>Log In</span>
            </button>
          )}

          {/* Theme Selector (Desktop) */}
          <div className="hidden sm:flex items-center rounded-lg bg-slate-800/90 border border-slate-700/80 p-0.5 h-8 ml-1 shadow-sm">
            <button
              onClick={() => (onSelectTheme ? onSelectTheme('dark') : onToggleTheme())}
              title="Dark Theme"
              className={`h-full px-2 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
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
              className={`h-full px-2 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
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
              title="Pure White Theme"
              className={`h-full px-2 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                theme === 'pure-light'
                  ? 'bg-white text-emerald-600 font-bold shadow-sm border border-emerald-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>☀️</span>
              <span className="hidden sm:inline text-[10px]">Pure</span>
            </button>
          </div>

          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden mt-3 pt-3 border-t border-slate-800 space-y-3 pb-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Profile Card (Mobile) */}
          {currentUser && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    {hasSuperAdmin ? (
                      <span className="px-1 rounded bg-sky-900/60 text-sky-300 font-mono">Super-Admin</span>
                    ) : (
                      currentUser.roles.map(r => (
                        <span key={r} className="px-1 rounded bg-slate-700 text-slate-300 font-mono">
                          {r.replace('_', ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}

          {/* Navigation Items (Mobile) */}
          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('HOME')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'HOME'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4 text-emerald-400" />
              <span>
                {currentUser
                  ? hasSuperAdmin
                    ? 'Admin Dashboard'
                    : hasClubAdmin
                    ? `${currentUser.clubName?.split(' ')[0] || 'Club'} Home`
                    : hasCoachOrPlayer
                    ? currentUser.roles.includes('COACH') ? isClubCoach ? 'Club Coach Home' : 'Coach Home' : 'Player Home'
                    : 'My Home'
                  : 'Home'}
              </span>
            </button>

            {/* Portal Action Buttons inside mobile menu */}
            {currentUser && hasClubPortal && (
              <button
                onClick={() => handleNavClick('CLUB_PORTAL')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'CLUB_PORTAL'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-sky-300 hover:bg-sky-950/40 border border-sky-500/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4" />
                  <span>Club Portal</span>
                </div>
                {currentUser.clubName && (
                  <span className="text-[10px] bg-sky-900/60 text-sky-200 px-1.5 py-0.5 rounded font-mono">
                    {currentUser.clubName.split(' ')[0]}
                  </span>
                )}
              </button>
            )}

            {currentUser && hasCoachOrPlayer && !hasClubAdmin && (
              <button
                onClick={() => handleNavClick('COACHING_PORTAL')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'COACHING_PORTAL'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>
                  {currentUser.roles.includes('COACH')
                    ? isClubCoach ? 'Club Coaching Workspace' : 'AI Video & Coaching Studio'
                    : 'My Video & AI Practice'}
                </span>
              </button>
            )}

            {currentUser && hasSuperAdmin && (
              <button
                onClick={() => handleNavClick('ADMIN_PANEL')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'ADMIN_PANEL'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-sky-300 hover:bg-sky-950/40 border border-sky-500/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </div>
                {pendingApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-extrabold">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => handleNavClick('HELP_SUPPORT')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'HELP_SUPPORT'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Help & Support Desk</span>
            </button>

            {/* Unauthenticated Links in Hamburger */}
            {!currentUser && (
              <>
                <button
                  onClick={() => scrollToSection('pricing')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Plans & Pricing
                </button>
                <button
                  onClick={() => scrollToSection('about-us')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  About Us
                </button>
                <button
                  onClick={() => scrollToSection('faqs')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  FAQs
                </button>
                <button
                  onClick={() => scrollToSection('contact-us')}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  Contact Us
                </button>
              </>
            )}
          </div>

          {/* Theme Selector inside Mobile Menu */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between px-1">
            <span className="text-[11px] font-medium text-slate-400">Appearance Theme</span>
            <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700/80 p-0.5">
              <button
                onClick={() => (onSelectTheme ? onSelectTheme('dark') : onToggleTheme())}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  theme === 'dark' ? 'bg-slate-700 text-amber-400 font-bold' : 'text-slate-400'
                }`}
              >
                <span>🌙</span>
                <span className="text-[10px]">Dark</span>
              </button>
              <button
                onClick={() => (onSelectTheme ? onSelectTheme('light') : onToggleTheme())}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  theme === 'light' ? 'bg-white text-slate-900 font-bold' : 'text-slate-400'
                }`}
              >
                <span>⛅</span>
                <span className="text-[10px]">Soft</span>
              </button>
              <button
                onClick={() => (onSelectTheme ? onSelectTheme('pure-light') : onToggleTheme())}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  theme === 'pure-light' ? 'bg-white text-emerald-600 font-bold' : 'text-slate-400'
                }`}
              >
                <span>☀️</span>
                <span className="text-[10px]">Pure</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
