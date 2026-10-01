import React, { useState } from 'react';
import { AuthUser, CustomerTenant, ClubMember } from '../../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  customers?: CustomerTenant[];
  clubMembers?: ClubMember[];
}

export const PRESET_USERS: Array<AuthUser & { passwordHint: string; description: string }> = [
  {
    id: 'usr-admin',
    name: 'Super Admin (Sarah Connor)',
    email: 'admin@ecricketcoach.com',
    roles: ['SUPER_ADMIN'],
    passwordHint: 'admin123',
    description: 'System-wide governance, customer tenancy approvals, subscriptions & drill curator'
  },
  {
    id: 'usr-club-coach',
    name: 'Shane Bond (Dual: Club Admin & Coach)',
    email: 'shane.b@mca.org',
    roles: ['CLUB_ADMIN', 'COACH'],
    clubName: 'Melbourne Cricket Academy',
    passwordHint: 'coach123',
    description: 'Multi-Role User: Head of Academy + Bowling Coach (Access to both Club Portal & Coach AI App)'
  },
  {
    id: 'usr-coach-only',
    name: 'Brendon McCullum (Coach)',
    email: 'brendon@mca.org',
    roles: ['COACH'],
    clubName: 'Melbourne Cricket Academy',
    passwordHint: 'coach123',
    description: 'Senior Coach: AI video analysis, session drill scheduler & player ratings'
  },
  {
    id: 'usr-player-only',
    name: 'Arjun Tendulkar (Player)',
    email: 'arjun.t@crick.com',
    roles: ['PLAYER'],
    clubName: 'Melbourne Cricket Academy',
    passwordHint: 'player123',
    description: 'Youth fast bowler: Personal AI kinematic pose analysis, drills roadmap & progression certs'
  }
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  customers = [],
  clubMembers = []
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: typeof PRESET_USERS[0]) => {
    setEmail(preset.email);
    setPassword(preset.passwordHint);
    setError(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user is in preset list
    const matchedPreset = PRESET_USERS.find(u => u.email.toLowerCase() === normalizedEmail);
    if (matchedPreset) {
      onLoginSuccess({
        id: matchedPreset.id,
        name: matchedPreset.name,
        email: matchedPreset.email,
        roles: matchedPreset.roles,
        clubName: matchedPreset.clubName
      });
      onClose();
      return;
    }

    // 2. Check if the user is registered as an onboarded Customer Tenant (e.g. Club Admin, Coach, or Player)
    const matchedCustomer = customers.find(c => c.email.toLowerCase() === normalizedEmail);
    if (matchedCustomer) {
      if (matchedCustomer.type === 'CLUB') {
        onLoginSuccess({
          id: matchedCustomer.id,
          name: matchedCustomer.name,
          email: matchedCustomer.email,
          roles: ['CLUB_ADMIN', 'COACH'],
          clubName: matchedCustomer.name
        });
        onClose();
        return;
      } else if (matchedCustomer.type === 'COACH') {
        onLoginSuccess({
          id: matchedCustomer.id,
          name: matchedCustomer.name,
          email: matchedCustomer.email,
          roles: ['COACH'],
          clubName: matchedCustomer.name
        });
        onClose();
        return;
      } else {
        onLoginSuccess({
          id: matchedCustomer.id,
          name: matchedCustomer.name,
          email: matchedCustomer.email,
          roles: ['PLAYER']
        });
        onClose();
        return;
      }
    }

    // 3. Check if the user is in Club Members (invited coaches/players)
    const matchedMember = clubMembers.find(m => m.email.toLowerCase() === normalizedEmail);
    if (matchedMember) {
      onLoginSuccess({
        id: matchedMember.id,
        name: matchedMember.name,
        email: matchedMember.email,
        roles: matchedMember.role === 'COACH' ? ['COACH'] : ['PLAYER'],
        clubName: 'Club Academy'
      });
      onClose();
      return;
    }

    // 4. Fallback heuristics for custom logins
    if (normalizedEmail.includes('admin')) {
      onLoginSuccess({
        id: 'custom-' + Date.now(),
        name: email.split('@')[0],
        email,
        roles: ['SUPER_ADMIN']
      });
      onClose();
      return;
    }
    if (normalizedEmail.includes('coach') || normalizedEmail.includes('club')) {
      onLoginSuccess({
        id: 'custom-' + Date.now(),
        name: email.split('@')[0],
        email,
        roles: ['CLUB_ADMIN', 'COACH'],
        clubName: 'Cricket Academy'
      });
      onClose();
      return;
    }

    onLoginSuccess({
      id: 'custom-' + Date.now(),
      name: email.split('@')[0],
      email,
      roles: ['PLAYER']
    });
    onClose();
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

        {/* Quick Persona Demo Switcher */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Quick Demo Logins (Click to autofill):
          </p>
          <div className="space-y-1.5">
            {PRESET_USERS.map(user => {
              const isSelected = email === user.email;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectPreset(user)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition flex flex-col gap-0.5 ${
                    isSelected
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{user.name}</span>
                    <div className="flex items-center gap-1">
                      {user.roles.map(r => (
                        <span
                          key={r}
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            r === 'SUPER_ADMIN' ? 'bg-cyan-900/60 text-cyan-300' :
                            r === 'CLUB_ADMIN' ? 'bg-purple-900/60 text-purple-300' :
                            r === 'COACH' ? 'bg-blue-900/60 text-blue-300' : 'bg-emerald-900/60 text-emerald-300'
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">{user.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3 pt-2 border-t border-slate-800">
          <div>
            <label className="text-[11px] font-semibold text-slate-400">Email Address</label>
            <input
              type="email"
              required
              placeholder="e.g. shane.b@mca.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
            >
              <span>Log In</span>
              <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
