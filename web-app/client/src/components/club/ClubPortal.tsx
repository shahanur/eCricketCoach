import React, { useState } from 'react';
import { ClubMember, Squad, TrainingSession, Certificate, Drill, Discipline, ContextType } from '../../types';

interface ClubPortalProps {
  clubMembers: ClubMember[];
  squads: Squad[];
  sessions: TrainingSession[];
  certificates: Certificate[];
  drills: Drill[];
  clubName?: string;
  onInviteMember: (member: ClubMember) => void;
  onAcceptMemberInvite: (id: string) => void;
  onPromotePlayer: (id: string) => void;
  onAddSquad: (squad: Squad) => void;
  onScheduleSession: (session: TrainingSession) => void;
  onPublishSession: (id: string) => void;
  onAddClubDrill: (drill: Drill) => void;
  onSimulateDriveUpload: (playerName: string) => void;
  uploadingDriveVideo: boolean;
  driveUploadSuccess: any;
}

export const ClubPortal: React.FC<ClubPortalProps> = ({
  clubMembers,
  squads,
  sessions,
  certificates,
  drills,
  clubName = 'Melbourne Cricket Academy',
  onInviteMember,
  onAcceptMemberInvite,
  onPromotePlayer,
  onAddSquad,
  onScheduleSession,
  onPublishSession,
  onAddClubDrill,
  onSimulateDriveUpload,
  uploadingDriveVideo,
  driveUploadSuccess
}) => {
  const [clubTab, setClubTab] = useState<'ROSTER' | 'SQUADS' | 'SESSIONS' | 'CLUB_DRILLS' | 'PROGRESSION'>('ROSTER');

  // Drill form state for club coaches
  const [newDrillTitle, setNewDrillTitle] = useState('');
  const [newDrillDiscipline, setNewDrillDiscipline] = useState<Discipline>('BATTING');
  const [newDrillSkillSet, setNewDrillSkillSet] = useState('');
  const [newDrillContext, setNewDrillContext] = useState<ContextType>('INDIVIDUAL');
  const [newDrillDuration, setNewDrillDuration] = useState(20);
  const [newDrillInstructions, setNewDrillInstructions] = useState('');

  // Post Session Notes Evaluation State
  const [activeSessionNotes, setActiveSessionNotes] = useState('');
  const [evaluatingSession, setEvaluatingSession] = useState(false);
  const [sessionAiResult, setSessionAiResult] = useState<any>(null);

  const handleCreateClubDrill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrillTitle || !newDrillSkillSet) return;
    const drill: Drill = {
      id: 'club-' + Date.now(),
      title: newDrillTitle,
      discipline: newDrillDiscipline,
      skillSet: newDrillSkillSet,
      contextType: newDrillContext,
      duration: newDrillDuration,
      source: 'CLUB_CUSTOM',
      clubName: clubName,
      instructions: newDrillInstructions
    };
    onAddClubDrill(drill);
    setNewDrillTitle('');
    setNewDrillSkillSet('');
    setNewDrillInstructions('');
    alert(`Club Custom Drill "${drill.title}" saved to ${clubName} library!`);
  };

  const handleEvaluatePostSession = () => {
    if (!activeSessionNotes) {
      alert('Please enter coach observations or notes first.');
      return;
    }
    setEvaluatingSession(true);
    setSessionAiResult(null);
    setTimeout(() => {
      setEvaluatingSession(false);
      setSessionAiResult({
        summary: 'Technical variance identified in front-foot drive balance & seam release height.',
        gaps: ['Weight transfer stalling prematurely', 'Lateral head tilt at impact'],
        recommendedDrills: [
          {
            title: 'Stationary Cone Head-Over-Ball Transfer Drill',
            duration: 20,
            discipline: 'BATTING',
            context: 'GROUP',
            reason: 'Locks head directly over impact line before follow-through.'
          },
          {
            title: 'Low Full Toss Drive & Follow-Through Extension',
            duration: 25,
            discipline: 'BATTING',
            context: 'INDIVIDUAL',
            reason: 'Encourages full weight transfer through the shot.'
          }
        ],
        readiness: 'CONSOLIDATE_CURRENT_STAGE',
        commendation: 'High intensity shown. Complete recommended top-up drills before next match simulation.'
      });
    }, 1000);
  };

  const handleAdoptEvaluationDrill = (drillItem: any) => {
    const newDrill: Drill = {
      id: 'drill-rec-' + Date.now(),
      title: drillItem.title,
      discipline: drillItem.discipline,
      skillSet: 'Post-Session Remediation',
      contextType: drillItem.context,
      duration: drillItem.duration,
      source: 'AI_RECOMMENDED',
      instructions: drillItem.reason
    };
    onAddClubDrill(newDrill);
    alert(`Drill "${drillItem.title}" adopted into your club training catalog!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{clubName}</h1>
            <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
              Club Admin & Coaching Hub
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage roster invitations, squad formation, session-based plans, post-session AI evaluations, Google Drive video uploads, and achievement certificates.
          </p>
        </div>

        {/* Club Sub Tabs */}
        <div className="flex flex-wrap rounded-lg bg-slate-900 border border-slate-800 p-1 gap-1">
          <button
            onClick={() => setClubTab('ROSTER')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              clubTab === 'ROSTER' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Roster & Invites ({clubMembers.length})
          </button>
          <button
            onClick={() => setClubTab('SQUADS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              clubTab === 'SQUADS' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Squads ({squads.length})
          </button>
          <button
            onClick={() => setClubTab('SESSIONS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              clubTab === 'SESSIONS' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Training Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setClubTab('CLUB_DRILLS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              clubTab === 'CLUB_DRILLS' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Club Drills
          </button>
          <button
            onClick={() => setClubTab('PROGRESSION')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              clubTab === 'PROGRESSION' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Certificates ({certificates.length})
          </button>
        </div>
      </div>

      {/* Club Sub-tab 1: Roster & Invitations */}
      {clubTab === 'ROSTER' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base text-white">Club Roster (Coaches & Players)</h3>
              <p className="text-xs text-slate-400">
                Club admin invites coaches and players by age group. Users log in once they accept the invite.
              </p>
            </div>
            <button
              onClick={() => {
                const name = prompt('Enter Member Name:');
                const email = prompt('Enter Email:');
                const role = prompt('Role (COACH or PLAYER):', 'PLAYER') as 'COACH' | 'PLAYER';
                const ageGroup = prompt('Age Group (e.g. U13, U15, Senior):', 'U15');
                if (name && email) {
                  const newMem: ClubMember = {
                    id: 'mem-' + Date.now(),
                    name,
                    email,
                    role: role === 'COACH' ? 'COACH' : 'PLAYER',
                    ageGroup: ageGroup || 'U15',
                    discipline: 'BATTING',
                    invitationStatus: 'PENDING_ACCEPTANCE',
                    currentLevel: 'FOUNDATION',
                    squad: 'Unassigned'
                  };
                  onInviteMember(newMem);
                  alert(`Invitation link emailed to ${email}!`);
                }
              }}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded transition"
            >
              + Invite New Coach / Player
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Name / Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Age Group</th>
                  <th className="py-3 px-3">Assigned Squad</th>
                  <th className="py-3 px-3">Current Level</th>
                  <th className="py-3 px-3">Invite Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clubMembers.map(mem => (
                  <tr key={mem.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-white">{mem.name}</p>
                      <p className="text-[11px] text-slate-400">{mem.email}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        mem.role === 'COACH' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {mem.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{mem.ageGroup}</td>
                    <td className="py-3 px-3 text-slate-400">{mem.squad}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-semibold border border-slate-700">
                        {mem.currentLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {mem.invitationStatus === 'ACTIVE' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active (Accepted)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Pending Acceptance
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      {mem.invitationStatus === 'PENDING_ACCEPTANCE' && (
                        <button
                          onClick={() => onAcceptMemberInvite(mem.id)}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px]"
                        >
                          Accept Invite
                        </button>
                      )}
                      {mem.role === 'PLAYER' && (
                        <>
                          <button
                            onClick={() => onSimulateDriveUpload(mem.name)}
                            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[11px]"
                          >
                            Upload Video (Drive)
                          </button>
                          <button
                            onClick={() => onPromotePlayer(mem.id)}
                            className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded text-[11px]"
                          >
                            Assess & Promote
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Google Drive Video Upload Feedback Display */}
          {uploadingDriveVideo && (
            <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs text-cyan-300 animate-pulse">
              Connecting to Google Drive API and storing player footage for AI pose analysis...
            </div>
          )}
          {driveUploadSuccess && (
            <div className="p-4 rounded-lg bg-slate-950 border border-cyan-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400">Google Drive Video Saved & AI Analyzed</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
                  {driveUploadSuccess.player}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono text-[11px]">📁 {driveUploadSuccess.drivePath}</p>
              <p className="text-xs text-slate-300">💡 <span className="font-semibold text-white">AI Finding:</span> {driveUploadSuccess.aiSummary}</p>
              <p className="text-xs text-emerald-400">🎯 <span className="font-semibold text-white">Recommended Tailored Drill:</span> {driveUploadSuccess.prescribedDrill}</p>
            </div>
          )}
        </div>
      )}

      {/* Club Sub-tab 2: Squads Formation */}
      {clubTab === 'SQUADS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-white">Club Squads & Player Groups</h3>
              <p className="text-xs text-slate-400">
                Coaches organize players into discipline-based squads to model training plans.
              </p>
            </div>
            <button
              onClick={() => {
                const name = prompt('Squad Name:');
                const ageGroup = prompt('Age Group:', 'U15');
                const discipline = prompt('Discipline (BATTING, BOWLING, etc.):', 'BOWLING') as Discipline;
                if (name) {
                  onAddSquad({
                    id: 'sq-' + Date.now(),
                    name,
                    ageGroup: ageGroup || 'U15',
                    coachName: 'Shane Bond',
                    discipline: discipline || 'BOWLING',
                    memberCount: 0
                  });
                  alert(`Squad "${name}" created!`);
                }
              }}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded transition"
            >
              + Form New Squad
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {squads.map(sq => (
              <div key={sq.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{sq.name}</h4>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
                    {sq.ageGroup}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Head Coach: <span className="text-white font-medium">{sq.coachName}</span></p>
                <p className="text-xs text-slate-400">Primary Focus: <span className="text-emerald-400">{sq.discipline}</span></p>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{sq.memberCount} Squad Members</span>
                  <button className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700">
                    Manage Players
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Club Sub-tab 3: Session-Based Training Plans & Post-Session AI Notes */}
      {clubTab === 'SESSIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Published / Scheduled Sessions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-white">Session-Based Training Schedule</h3>
                <p className="text-xs text-slate-400">Publish training to notify squad athletes.</p>
              </div>
              <button
                onClick={() => {
                  const title = prompt('Session Title:');
                  const date = prompt('Session Date (YYYY-MM-DD):', '2026-10-05');
                  if (title && date) {
                    onScheduleSession({
                      id: 'sess-' + Date.now(),
                      squadName: 'U15 Pace & Power Squad',
                      title,
                      sessionDate: date,
                      durationMinutes: 90,
                      isPublished: false,
                      drillCount: 3
                    });
                    alert('New training session scheduled!');
                  }
                }}
                className="px-2.5 py-1 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded transition"
              >
                + Schedule Session
              </button>
            </div>

            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm">{s.title}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      s.isPublished ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {s.isPublished ? 'Published & Players Notified' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Squad: <span className="text-white">{s.squadName}</span></p>
                  <p className="text-xs text-slate-400">Date: <span className="text-cyan-400 font-semibold">{s.sessionDate}</span> • Duration: {s.durationMinutes} mins</p>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{s.drillCount} Planned Drills</span>
                    {!s.isPublished ? (
                      <button
                        onClick={() => onPublishSession(s.id)}
                        className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
                      >
                        Publish & Notify Squad
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-semibold">Active & Notified</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Post-Session Notes & AI Evaluation Loop */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-base text-white">Post-Session Coach Notes & AI Review</h3>
              <p className="text-xs text-slate-400">
                Enter notes on squad or individual player performance. AI evaluates notes and recommends tailored drill top-ups.
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                rows={4}
                value={activeSessionNotes}
                onChange={e => setActiveSessionNotes(e.target.value)}
                placeholder="e.g. Arjun Tendulkar seam presentation was consistent, but front-foot drive balance had head falling over to off-side during simulation..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-purple-500"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleEvaluatePostSession}
                  disabled={evaluatingSession}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-50"
                >
                  {evaluatingSession ? 'AI Evaluating Notes...' : 'Run Post-Session AI Assessment'}
                </button>
                <button
                  onClick={() => setActiveSessionNotes('Arjun Tendulkar bowling run-up cadence was clean, but front foot drive balance lacked head alignment over ball on full tosses.')}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Load Sample Notes
                </button>
              </div>

              {sessionAiResult && (
                <div className="p-4 rounded-lg bg-slate-950 border border-purple-500/40 space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 uppercase">AI Diagnosis</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
                      {sessionAiResult.readiness}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{sessionAiResult.summary}</p>

                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-1">Recommended Tailored Top-Up Drills:</p>
                    <div className="space-y-2">
                      {sessionAiResult.recommendedDrills.map((d: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-white">{d.title}</p>
                            <p className="text-[11px] text-slate-400">{d.duration} mins • {d.reason}</p>
                          </div>
                          <button
                            onClick={() => handleAdoptEvaluationDrill(d)}
                            className="text-xs px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded"
                          >
                            Accept & Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                    💬 <span className="font-semibold text-white">AI Commendation:</span> {sessionAiResult.commendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Club Sub-tab 4: Club Custom Drills */}
      {clubTab === 'CLUB_DRILLS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-base text-white">Add Club Custom Drill</h3>
            <p className="text-xs text-slate-400">
              Coaches can model proprietary drills tailored to {clubName} athletes.
            </p>
            <form onSubmit={handleCreateClubDrill} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Drill Title</label>
                <input
                  type="text"
                  required
                  value={newDrillTitle}
                  onChange={e => setNewDrillTitle(e.target.value)}
                  placeholder="e.g. MCA Powerplay Slips Reaction"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Discipline</label>
                  <select
                    value={newDrillDiscipline}
                    onChange={e => setNewDrillDiscipline(e.target.value as Discipline)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="BATTING">Batting</option>
                    <option value="BOWLING">Bowling</option>
                    <option value="KEEPING">Keeping</option>
                    <option value="FIELDING">Fielding</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Context</label>
                  <select
                    value={newDrillContext}
                    onChange={e => setNewDrillContext(e.target.value as ContextType)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="INDIVIDUAL">Individual (1-on-1)</option>
                    <option value="GROUP">Group (Squad)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Skill Set Focus</label>
                <input
                  type="text"
                  required
                  value={newDrillSkillSet}
                  onChange={e => setNewDrillSkillSet(e.target.value)}
                  placeholder="e.g. Death Bowling, Slip Catching"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={newDrillDuration}
                  onChange={e => setNewDrillDuration(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Instructions / Notes</label>
                <textarea
                  rows={2}
                  value={newDrillInstructions}
                  onChange={e => setNewDrillInstructions(e.target.value)}
                  placeholder="Equipment needed, station rotation cues..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded transition"
              >
                Save Club Drill
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-white">Available Drill Catalog</h3>
                <p className="text-xs text-slate-400">Includes official pre-defined drills & MCA custom drills.</p>
              </div>
              <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full font-semibold">
                {drills.length} Total Drills
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {drills.map(drill => (
                <div key={drill.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{drill.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        drill.source === 'SYSTEM_PREDEFINED' ? 'bg-emerald-500/20 text-emerald-300' :
                        drill.source === 'CLUB_CUSTOM' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {drill.source === 'SYSTEM_PREDEFINED' ? 'Pre-defined' : drill.source === 'CLUB_CUSTOM' ? 'Club Custom' : 'AI Ingested'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{drill.instructions}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {drill.duration} mins • {drill.discipline} • {drill.skillSet} • {drill.contextType}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Club Sub-tab 5: Progression & Certificates */}
      {clubTab === 'PROGRESSION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-white">Player Progression & Certificates</h3>
              <p className="text-xs text-slate-400">
                Printable achievement certificates generated when players pass competency assessments and level promotions.
              </p>
            </div>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded font-bold border border-purple-500/30">
              {certificates.length} Issued Certificates
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map(cert => (
              <div key={cert.id} className="p-5 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-amber-500/40 relative shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                    Certificate of Achievement
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">#{cert.certificateNumber}</span>
                </div>

                <div className="text-center py-2 border-y border-slate-800/80">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">This certifies that</p>
                  <h4 className="text-xl font-extrabold text-white mt-0.5">{cert.playerName}</h4>
                  <p className="text-xs text-emerald-400 font-semibold mt-1">
                    Has successfully advanced to <span className="underline">{cert.achievedLevel}</span> in {cert.discipline}
                  </p>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1">
                  <p><span className="font-semibold text-slate-400">Coach Notes:</span> {cert.coachNotes}</p>
                  <p><span className="font-semibold text-slate-400">AI Verification:</span> {cert.aiCommendation}</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Issued: {cert.issuedDate}</span>
                  <span>Certified by Coach: {cert.coachName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
