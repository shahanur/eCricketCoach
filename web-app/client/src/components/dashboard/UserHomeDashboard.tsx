import React from 'react';
import { AuthUser, ViewMode, Drill, ClubMember, Squad, TrainingSession, Certificate } from '../../types';
import {
  Users,
  Calendar,
  Award,
  Video,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface UserHomeDashboardProps {
  currentUser: AuthUser;
  setViewMode: (mode: ViewMode) => void;
  drills: Drill[];
  clubMembers: ClubMember[];
  squads: Squad[];
  sessions: TrainingSession[];
  certificates: Certificate[];
}

export const UserHomeDashboard: React.FC<UserHomeDashboardProps> = ({
  currentUser,
  setViewMode,
  drills,
  clubMembers,
  squads,
  sessions,
  certificates
}) => {
  const isSuperAdmin = currentUser.roles.includes('SUPER_ADMIN');
  const isClubAdmin = currentUser.roles.includes('CLUB_ADMIN');
  const isCoach = currentUser.roles.includes('COACH');
  const isPlayer = currentUser.roles.includes('PLAYER');

  // Club context metrics
  const activeMembersCount = clubMembers.length || 8;
  const activeSquadsCount = squads.length || 3;
  const upcomingSessions = sessions.filter(s => !s.isPublished || new Date(s.sessionDate) >= new Date()).slice(0, 3);
  const relevantDrills = drills.slice(0, 4);

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
                  : isClubAdmin
                  ? `${currentUser.clubName || 'Club Academy'} Dashboard`
                  : isCoach
                  ? 'High Performance Coaching Hub'
                  : 'Athlete Training Center'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {currentUser.name}!
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              {isSuperAdmin &&
                'Global overview of active customer tenancies, recurring subscriptions, onboarding approvals, and system drill catalogs.'}
              {isClubAdmin &&
                `Manage your ${currentUser.clubName || 'Club'} athletes, organize age-group squads, publish practice itineraries, and review AI pose kinematics.`}
              {isCoach &&
                'Run computer vision biomechanical video analyses, adopt AI corrective routines into your catalog, and assess player progression.'}
              {isPlayer &&
                `Access your assigned batting and bowling drills, review practice session schedules, and track your verified certificates.`}
            </p>
          </div>

          {/* Quick Primary Action Button */}
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            {isSuperAdmin && (
              <button
                onClick={() => setViewMode('ADMIN_PANEL')}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Admin Panel</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {isClubAdmin && (
              <button
                onClick={() => setViewMode('CLUB_PORTAL')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch Club Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {(isCoach || isPlayer) && (
              <button
                onClick={() => setViewMode('COACHING_PORTAL')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isCoach ? 'Coaching & AI App' : 'My Training Drills'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setViewMode('HELP_SUPPORT')}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Help & Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isClubAdmin && (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Club Athletes</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeMembersCount}</div>
              <p className="text-[11px] text-slate-400">Coaches & Players on roster</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Squads</span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">{activeSquadsCount}</div>
              <p className="text-[11px] text-slate-400">Age groups & development</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Sessions Scheduled</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{sessions.length || 4}</div>
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
                <Video className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">24</div>
              <p className="text-[11px] text-slate-400">Kinematic evaluations run</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Training Sessions</span>
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{sessions.length || 4}</div>
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
                <span className="text-xs font-semibold uppercase tracking-wider">System Role</span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold text-white">Super Admin</div>
              <p className="text-[11px] text-slate-400">Full platform tenancy control</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Global Drills</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white">{drills.length || 14}</div>
              <p className="text-[11px] text-slate-400">Curated system exercises</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Registered Clubs</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">Active</div>
              <p className="text-[11px] text-slate-400">Multi-tenant instances</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Infrastructure</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400">Operational</div>
              <p className="text-[11px] text-slate-400">PostgreSQL + AI Microservices</p>
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
              {isClubAdmin && (
                <>
                  <button
                    onClick={() => setViewMode('CLUB_PORTAL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-purple-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <Users className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Roster & Member Invitations</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Invite coaches and athletes, assign multi-discipline tags, and filter active memberships.
                    </p>
                  </button>

                  <button
                    onClick={() => setViewMode('CLUB_PORTAL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-purple-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <Calendar className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" />
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
                    <h3 className="text-sm font-bold text-white">Technique Drills Catalog</h3>
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
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Tenancies & Onboarding Approvals</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Review paid academy signups, activate club accounts, and monitor subscription MRR.
                    </p>
                  </button>

                  <button
                    onClick={() => setViewMode('ADMIN_PANEL')}
                    className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-left transition group space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Global Drill Master Library</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Curate system-wide technical exercises available to all licensed academies.
                    </p>
                  </button>
                </>
              )}

              {/* Universal Support Box */}
              <button
                onClick={() => setViewMode('HELP_SUPPORT')}
                className="p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-teal-500/50 text-left transition group space-y-2 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 transition" />
                </div>
                <h3 className="text-sm font-bold text-white">Support & Team Help Desk</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Need billing help, AI troubleshooting, or system guidance? Reach out directly.
                </p>
              </button>
            </div>
          </div>

          {/* Curated Drills Preview for User */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Featured Skill Development Drills</span>
              </h3>
              <button
                onClick={() => setViewMode(isClubAdmin ? 'CLUB_PORTAL' : 'COACHING_PORTAL')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Catalog</span>
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
        </div>

        {/* Right Column (1 Col): Upcoming Schedule & Contact Widget */}
        <div className="space-y-6">
          {/* Practice Schedule Itinerary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>Upcoming Training Sessions</span>
            </h3>

            {upcomingSessions.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800/80 text-center text-xs text-slate-400 space-y-1">
                <p>No active sessions scheduled this week.</p>
                {isClubAdmin && (
                  <button
                    onClick={() => setViewMode('CLUB_PORTAL')}
                    className="text-purple-400 hover:underline font-semibold block mx-auto cursor-pointer"
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

          {/* Quick Support & Direct Assistance Card */}
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
        </div>
      </div>
    </div>
  );
};
