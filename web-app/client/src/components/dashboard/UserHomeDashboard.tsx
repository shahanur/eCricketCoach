import React from 'react';
import {
  AuthUser,
  ViewMode,
  Drill,
  ClubMember,
  Squad,
  TrainingSession,
  Certificate,
  CustomerTenant,
  ClubApproval,
  SupportTicket
} from '../../types';
import {
  Users,
  Calendar,
  Award,
  Video,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  LifeBuoy
} from 'lucide-react';

interface UserHomeDashboardProps {
  currentUser: AuthUser;
  setViewMode: (mode: ViewMode) => void;
  drills: Drill[];
  clubMembers: ClubMember[];
  squads: Squad[];
  sessions: TrainingSession[];
  certificates: Certificate[];
  customers?: CustomerTenant[];
  clubApprovals?: ClubApproval[];
  supportTickets?: SupportTicket[];
}

export const UserHomeDashboard: React.FC<UserHomeDashboardProps> = ({
  currentUser,
  setViewMode,
  drills,
  clubMembers,
  squads,
  sessions,
  certificates,
  customers = [],
  clubApprovals = [],
  supportTickets = []
}) => {
  const isSuperAdmin = currentUser.roles.includes('SUPER_ADMIN');
  const isClubAdmin = currentUser.roles.includes('CLUB_ADMIN');
  const isCoach = currentUser.roles.includes('COACH');
  const isClubCoach = isCoach && currentUser.coachContext === 'CLUB';
  const hasClubPortal = isClubAdmin || isClubCoach;
  const isPlayer = currentUser.roles.includes('PLAYER');

  // Club context metrics
  const activeMembersCount = clubMembers.length;
  const activeSquadsCount = squads.length;
  const upcomingSessions = sessions.filter(s => !s.isPublished || new Date(s.sessionDate) >= new Date()).slice(0, 3);
  const relevantDrills = drills.slice(0, 4);

  // Admin platform metrics
  const pendingApprovalsCount = clubApprovals.filter(a => a.status === 'AWAITING_APPROVAL').length;
  const openTicketsCount = supportTickets.filter(t => t.status === 'OPEN').length;
  const totalMrr = customers.reduce((sum, c) => sum + (c.mrr || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Personalized Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span>🏏</span>
              <span>
                {isSuperAdmin
                  ? 'System Administration Portal'
                  : hasClubPortal
                  ? `${currentUser.clubName || 'Club Academy'} Dashboard`
                  : isCoach
                  ? isClubCoach ? `${currentUser.clubName || 'Club'} Coaching Hub` : 'High Performance Coaching Hub'
                  : 'Athlete Training Center'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {currentUser.name}!
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              {isSuperAdmin &&
                'Global overview of active customer tenancies, recurring subscriptions, onboarding approvals, and system drill catalogues.'}
              {hasClubPortal &&
                `Manage your ${currentUser.clubName || 'Club'} athletes, organise age-group squads, publish practice itineraries, and review AI pose kinematics.`}
              {isCoach &&
                (isClubCoach
                  ? `Manage ${currentUser.clubName || 'club'} sessions, participants, development goals, attendance, communication, and AI-supported coaching plans.`
                  : 'Run computer vision biomechanical video analyses, adopt AI corrective routines into your catalogue, and assess player progression.')}
              {isPlayer &&
                `Access your assigned batting and bowling drills, review practice session schedules, and track your verified certificates.`}
            </p>
          </div>

          {/* Quick Primary Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {isSuperAdmin && (
              <button
                onClick={() => setViewMode('ADMIN_PANEL')}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Admin Panel</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {hasClubPortal && (
              <button
                onClick={() => setViewMode('CLUB_PORTAL')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch Club Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {(isCoach || isPlayer) && (
              <button
                onClick={() => setViewMode('COACHING_PORTAL')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isCoach ? isClubCoach ? 'Open Club Coaching Workspace' : 'Coaching & AI App' : 'My Training Drills'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setViewMode('HELP_SUPPORT')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 via-sky-950/60 to-slate-800 hover:from-sky-900/60 hover:via-sky-900/50 hover:to-sky-900/60 border border-sky-500/30 hover:border-sky-400/60 text-slate-100 hover:text-white font-semibold text-xs shadow-md shadow-sky-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Help & Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {hasClubPortal && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Club Athletes</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeMembersCount}</div>
              <p className="text-[11px] text-slate-400">Coaches & Players on roster</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Squads</span>
                <ShieldCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeSquadsCount}</div>
              <p className="text-[11px] text-slate-400">Age groups & development</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Sessions Scheduled</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{sessions.length}</div>
              <p className="text-[11px] text-slate-400">Practice itineraries on calendar</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Certificates Issued</span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">{certificates.length || 3}</div>
              <p className="text-[11px] text-slate-400">Verified skill level badges</p>
            </div>
          </>
        )}

        {(isCoach || isPlayer) && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Master Drills</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{drills.length || 12}</div>
              <p className="text-[11px] text-slate-400">Technical drill library</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">AI Pose Analyses</span>
                <Video className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">24</div>
              <p className="text-[11px] text-slate-400">Kinematic evaluations run</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Training Sessions</span>
                <Calendar className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">{sessions.length}</div>
              <p className="text-[11px] text-slate-400">Published squad workouts</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Certificates</span>
                <Award className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-white">{certificates.length || 2}</div>
              <p className="text-[11px] text-slate-400">Player milestones</p>
            </div>
          </>
        )}

        {isSuperAdmin && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Total MRR</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">£{totalMrr.toFixed(2)}</div>
              <p className="text-[11px] text-slate-400">Monthly recurring subscriptions</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Pending Approvals</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400">{pendingApprovalsCount}</div>
              <p className="text-[11px] text-slate-400">Paid club/coach onboarding</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Open Tickets</span>
                <LifeBuoy className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-sky-400">{openTicketsCount}</div>
              <p className="text-[11px] text-slate-400">Tenant support queue</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Customers</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white">{customers.length || 3}</div>
              <p className="text-[11px] text-slate-400">Clubs, coaches & players</p>
            </div>
          </>
        )}
      </div>

      {/* Main Role-Specific Interactive Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Action Cards & Itineraries */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Hub Navigation Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center justify-between">
              <span>Quick Action Workflows</span>
              <span className="text-xs font-normal text-slate-400">Select a workflow to begin</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hasClubPortal && (
                <>
                  {isClubAdmin && (
                  <button
                    onClick={() => setViewMode('CLUB_PORTAL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <Users className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      Roster & Member Invitations
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Invite coaches and athletes, assign multi-discipline tags, and filter active memberships.
                    </p>
                  </button>
                  )}

                  <button
                    onClick={() => setViewMode('CLUB_PORTAL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <Calendar className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Squad Practice Sessions</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Schedule weekly academy training, attach drills, and publish to squad members.
                    </p>
                  </button>
                </>
              )}

              {(isCoach || isPlayer) && (
                <>
                  <button
                    onClick={() => setViewMode('COACHING_PORTAL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Video className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">AI Kinematic Pose Analysis</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Upload delivery footage and extract computer-vision biomechanical recommendations.
                    </p>
                  </button>

                  <button
                    onClick={() => setViewMode('COACHING_PORTAL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Technique Drills Catalogue</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Filter tailored batting, bowling, wicket-keeping, and fielding routines.
                    </p>
                  </button>
                </>
              )}

              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => setViewMode('ADMIN_PANEL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Pending Club Approvals</h3>
                      {pendingApprovalsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30">
                          {pendingApprovalsCount} queue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Review newly registered club and academy tenancies and approve their subscription licenses.
                    </p>
                  </button>

                  <button
                    onClick={() => setViewMode('ADMIN_PANEL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <LifeBuoy className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">Support Tickets Desk</h3>
                      {openTicketsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/20 text-sky-300 font-extrabold border border-sky-500/30">
                          {openTicketsCount} active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Review and resolve support tickets submitted by club admins, coaches, and players.
                    </p>
                  </button>

                  <button
                    onClick={() => setViewMode('ADMIN_PANEL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <DollarSign className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Billing & Customer Tenancies</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Track subscription health, manage plans, and inspect invoice statuses across accounts.
                    </p>
                  </button>

                  <button
                    onClick={() => setViewMode('ADMIN_PANEL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">System Drill Curator</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Curate the system-wide predefined cricket curriculum available to all tenancies.
                    </p>
                  </button>
                </>
              )}

              {/* Tenant Help Support Box (Only shown to Club Admin, Coach, Player) */}
              {!isSuperAdmin && (
                <button
                  onClick={() => setViewMode('HELP_SUPPORT')}
                  className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group space-y-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Support & Team Help Desk</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Need billing help, AI troubleshooting, or system guidance? Reach out directly.
                  </p>
                </button>
              )}
            </div>
          </div>

          {/* Super-Admin Platform Health & Recent Tenancies Table */}
          {isSuperAdmin ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <span>Recent Tenancies & License Status</span>
                  </h3>
                  <p className="text-xs text-slate-400">Platform customer organisations</p>
                </div>
                <button
                  onClick={() => setViewMode('ADMIN_PANEL')}
                  className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage All Tenancies</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-2.5 rounded-l">Customer / Club</th>
                      <th className="p-2.5">Tier</th>
                      <th className="p-2.5">Plan MRR</th>
                      <th className="p-2.5 rounded-r">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {customers.slice(0, 4).map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-2.5">
                          <p className="font-semibold text-white">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.email}</p>
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                            {c.subscriptionPlan}
                          </span>
                        </td>
                        <td className="p-2.5 text-emerald-400 font-bold">£{c.mrr?.toFixed(2) || '0.00'}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Curated Drills Preview for Club, Coach and Player */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Featured Skill Development Drills</span>
                </h3>
                <button
                  onClick={() => setViewMode(hasClubPortal ? 'CLUB_PORTAL' : 'COACHING_PORTAL')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Catalogue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {relevantDrills.map(d => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {d.discipline}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {d.duration} mins
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white line-clamp-1">{d.title}</h4>
                    <p className="text-[11px] text-slate-400">{d.skillSet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Role-Specific Context Side Panel */}
        <div className="space-y-6">
          {isSuperAdmin ? (
            /* Super-Admin Platform Queue Widget */
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Onboarding & Approvals Queue</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                  {clubApprovals.length} pending
                </span>
              </div>

              {clubApprovals.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-400">
                  <p className="text-emerald-400 font-semibold mb-1">Queue is clear</p>
                  <p>All newly registered club and coach tenancies have been approved.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clubApprovals.slice(0, 3).map(appr => (
                    <div
                      key={appr.id}
                      className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">{appr.clubName}</span>
                        <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          {appr.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{appr.adminName} ({appr.adminEmail})</p>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80">
                        <span className="text-emerald-400 font-bold">£{appr.amountPaid}</span>
                        <button
                          onClick={() => setViewMode('ADMIN_PANEL')}
                          className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                        >
                          Review in Admin Panel →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Open Support Tickets Widget */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <LifeBuoy className="w-3.5 h-3.5 text-sky-400" />
                    <span>Recent Support Inquiries</span>
                  </h4>
                  <button
                    onClick={() => setViewMode('ADMIN_PANEL')}
                    className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  {supportTickets.slice(0, 2).map(tkt => (
                    <div
                      key={tkt.id}
                      className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sky-400 font-mono text-[10px] font-bold">#{tkt.ticketRef}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          tkt.status === 'OPEN' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {tkt.status}
                        </span>
                      </div>
                      <p className="text-slate-200 font-medium line-clamp-1">{tkt.subject}</p>
                      <p className="text-[10px] text-slate-500">{tkt.name} • {tkt.category}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Practice Schedule Itinerary for Clubs, Coaches, Players */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-400" />
                  <span>Upcoming Training Sessions</span>
                </h3>

                {upcomingSessions.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-400 space-y-1">
                    <p>No active sessions scheduled this week.</p>
                    {hasClubPortal && (
                      <button
                        onClick={() => setViewMode('CLUB_PORTAL')}
                        className="text-sky-400 hover:underline font-semibold block mx-auto cursor-pointer"
                      >
                        Schedule a practice now
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingSessions.map(s => (
                      <div
                        key={s.id}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{s.squadName}</span>
                          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {s.sessionDate}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">{s.title}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>{s.durationMinutes} mins duration</span>
                          <span>{s.drillCount || 3} assigned drills</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Support & Direct Assistance Card for Tenants */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-sm font-bold">
                    🎧
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Need Platform Assistance?</h4>
                    <p className="text-[11px] text-slate-400">Technical, billing or coach setup</p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Our eCricketCoach technical engineers and coaching specialists can help you fine-tune your club drills, pose analysis, and subscription billing.
                </p>
                <button
                  onClick={() => setViewMode('HELP_SUPPORT')}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Contact eCricketCoach Team</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
