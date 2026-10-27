import React from 'react';
import { Apple, Building2, Chrome } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleSocialLogin = (provider: 'google' | 'apple' | 'microsoft') => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg"
        >
          ✕
        </button>

        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              👤
            </div>
            <h3 className="text-lg font-bold text-white">Log in to eCricketCoach</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sign in with your account to access your assigned coach, club, player, or admin workspace.
          </p>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <button type="button" onClick={() => handleSocialLogin('google')} className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-100">
            <Chrome size={16} /> Continue with Google
          </button>
          <button type="button" onClick={() => handleSocialLogin('apple')} className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
            <Apple size={16} /> Continue with Apple
          </button>
          <button type="button" onClick={() => handleSocialLogin('microsoft')} className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-sky-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-600">
            <Building2 size={16} /> Continue with Microsoft
          </button>
        </div>
      </div>
    </div>
  );
};
