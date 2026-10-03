import React, { useState } from 'react';
import { ClubMember, Squad, TrainingSession, Certificate, Drill, Discipline, ContextType } from '../../types';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { UserPlus, Users, Calendar, X } from 'lucide-react';

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

  // General Notification / Action Confirmation Modal State
  const [portalModal, setPortalModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type?: ConfirmationType;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  // Invite Member Modal Form State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'COACH' | 'PLAYER'>('PLAYER');
  const [inviteAgeGroup, setInviteAgeGroup] = useState('U15');
  const [inviteDiscipline, setInviteDiscipline] = useState<Discipline>('BATTING');
  const [inviteSquad, setInviteSquad] = useState('Unassigned');

  // Form New Squad Modal Form State
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [squadFormName, setSquadFormName] = useState('');
  const [squadFormAgeGroup, setSquadFormAgeGroup] = useState('U15');
  const [squadFormDiscipline, setSquadFormDiscipline] = useState<Discipline>('BOWLING');
  const [squadFormCoach, setSquadFormCoach] = useState('Shane Bond');

  // Schedule Session Modal Form State
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionFormTitle, setSessionFormTitle] = useState('');
  const [sessionFormSquad, setSessionFormSquad] = useState('U15 Pace & Power Squad');
  const [sessionFormDate, setSessionFormDate] = useState('2026-10-05');
  const [sessionFormDuration, setSessionFormDuration] = useState(90);

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
    setPortalModal({
      isOpen: true,
      title: 'Club Drill Saved',
      message: `Club Custom Drill "${drill.title}" has been successfully added to the ${clubName} proprietary training catalog.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  const handleEvaluatePostSession = () => {
    if (!activeSessionNotes) {
      setPortalModal({
        isOpen: true,
        title: 'Observations Required',
        message: 'Please enter coach observations or post-session technical notes before requesting AI biomechanical diagnosis.',
        type: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setPortalModal(null)
      });
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
    setPortalModal({
      isOpen: true,
      title: 'Drill Adopted into Academy',
      message: `Drill "${drillItem.title}" has been successfully adopted into your club training catalog!`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  // Form submit handlers for modals
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const newMem: ClubMember = {
      id: 'mem-' + Date.now(),
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      ageGroup: inviteAgeGroup,
      discipline: inviteDiscipline,
      invitationStatus: 'PENDING_ACCEPTANCE',
      currentLevel: 'FOUNDATION',
      squad: inviteSquad
    };
    onInviteMember(newMem);
    setIsInviteModalOpen(false);
    setInviteName('');
    setInviteEmail('');
    setPortalModal({
      isOpen: true,
      title: 'Roster Invitation Dispatched',
      message: (
        <div className="space-y-2">
          <p>An official onboarding link has been dispatched via email to <strong className="text-cyan-400">{newMem.email}</strong>.</p>
          <p className="text-xs text-slate-400">Role: <strong className="text-white">{newMem.role}</strong> • Age Group: {newMem.ageGroup} • Assigned Squad: {newMem.squad}</p>
        </div>
      ),
      type: 'success',
      confirmLabel: 'Great',
      onConfirm: () => setPortalModal(null)
    });
  };

  const handleSquadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadFormName.trim()) return;
    const newSquad: Squad = {
      id: 'sq-' + Date.now(),
      name: squadFormName.trim(),
      ageGroup: squadFormAgeGroup,
      coachName: squadFormCoach.trim() || 'Shane Bond',
      discipline: squadFormDiscipline,
      memberCount: 0
    };
    onAddSquad(newSquad);
    setIsSquadModalOpen(false);
    setSquadFormName('');
    setPortalModal({
      isOpen: true,
      title: 'Squad Created Successfully',
      message: `Squad "${newSquad.name}" (${newSquad.ageGroup} - ${newSquad.discipline}) is now active under Coach ${newSquad.coachName}.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionFormTitle.trim() || !sessionFormDate) return;
    const newSession: TrainingSession = {
      id: 'sess-' + Date.now(),
      squadName: sessionFormSquad,
      title: sessionFormTitle.trim(),
      sessionDate: sessionFormDate,
      durationMinutes: Number(sessionFormDuration) || 90,
      isPublished: false,
      drillCount: 3
    };
    onScheduleSession(newSession);
    setIsSessionModalOpen(false);
    setSessionFormTitle('');
    setPortalModal({
      isOpen: true,
      title: 'Training Session Scheduled',
      message: `Session "${newSession.title}" for ${newSession.squadName} on ${newSession.sessionDate} (${newSession.durationMinutes} mins) has been added to drafts.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  // Confirmation prompts for actions
  const promptAcceptInvite = (mem: ClubMember) => {
    setPortalModal({
      isOpen: true,
      title: 'Accept Roster Invitation',
      message: `Confirm invitation acceptance for ${mem.name} (${mem.email})? This activates their athlete profile.`,
      type: 'confirm',
      confirmLabel: 'Accept Invitation',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setPortalModal(null);
        onAcceptMemberInvite(mem.id);
      }
    });
  };

  const promptPromotePlayer = (mem: ClubMember) => {
    const nextLevel =
      mem.currentLevel === 'FOUNDATION' ? 'DEVELOPING' :
      mem.currentLevel === 'DEVELOPING' ? 'INTERMEDIATE' :
      mem.currentLevel === 'INTERMEDIATE' ? 'ADVANCED' : 'ELITE';

    setPortalModal({
      isOpen: true,
      title: 'Promote Player & Issue Certificate',
      message: (
        <div className="space-y-2">
          <p>Are you sure you want to promote <strong className="text-white">{mem.name}</strong> from <span className="underline">{mem.currentLevel}</span> to <strong className="text-emerald-400">{nextLevel}</strong>?</p>
          <p className="text-xs text-slate-400">An official verifiable certificate of skill achievement will be generated and signed by the coaching staff.</p>
        </div>
      ),
      type: 'confirm',
      confirmLabel: `Promote to ${nextLevel}`,
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setPortalModal(null);
        onPromotePlayer(mem.id);
      }
    });
  };

  const promptPublishSession = (session: TrainingSession) => {
    setPortalModal({
      isOpen: true,
      title: 'Publish Training Session',
      message: (
        <div className="space-y-2">
          <p>Publish session <strong className="text-white">"{session.title}"</strong> scheduled for <span className="text-cyan-400 font-medium">{session.sessionDate}</span>?</p>
          <p className="text-xs text-slate-400">This will immediately notify registered squad athletes in <strong className="text-slate-200">{session.squadName}</strong> with planned drill routines.</p>
        </div>
      ),
      type: 'confirm',
      confirmLabel: 'Publish & Notify Squad',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setPortalModal(null);
        onPublishSession(session.id);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Club Header */}
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

      {/* Full-width Navigation Bar directly above the content panel */}
      <div className="w-full rounded-xl bg-slate-900 border border-slate-800 p-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 shadow-sm">
        <button
          onClick={() => setClubTab('ROSTER')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'ROSTER' ? 'bg-purple-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Roster & Invites ({clubMembers.length})</span>
        </button>
        <button
          onClick={() => setClubTab('SQUADS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'SQUADS' ? 'bg-purple-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Squads ({squads.length})</span>
        </button>
        <button
          onClick={() => setClubTab('SESSIONS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'SESSIONS' ? 'bg-purple-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Training Sessions ({sessions.length})</span>
        </button>
        <button
          onClick={() => setClubTab('CLUB_DRILLS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'CLUB_DRILLS' ? 'bg-purple-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Club Drills</span>
        </button>
        <button
          onClick={() => setClubTab('PROGRESSION')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'PROGRESSION' ? 'bg-purple-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Certificates ({certificates.length})</span>
        </button>
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
              onClick={() => setIsInviteModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <UserPlus size={14} />
              <span>+ Invite New Coach / Player</span>
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
                          onClick={() => promptAcceptInvite(mem)}
                          className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] cursor-pointer"
                        >
                          Accept Invite
                        </button>
                      )}
                      {mem.role === 'PLAYER' && (
                        <>
                          <button
                            onClick={() => onSimulateDriveUpload(mem.name)}
                            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[11px] cursor-pointer"
                          >
                            Upload Video (Drive)
                          </button>
                          <button
                            onClick={() => promptPromotePlayer(mem)}
                            className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded text-[11px] cursor-pointer"
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
              onClick={() => setIsSquadModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Users size={14} />
              <span>+ Form New Squad</span>
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
                onClick={() => setIsSessionModalOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Calendar size={14} />
                <span>+ Schedule Session</span>
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
                        onClick={() => promptPublishSession(s)}
                        className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded cursor-pointer"
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

      {/* 1. Invite Coach / Player Modal Form */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus size={18} className="text-purple-400" />
                <span>Invite New Coach or Player</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Send an official invitation link to join {clubName}.</p>
            </div>
            <form onSubmit={handleInviteSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jasprit Bumrah"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jasprit@cricket.org"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'COACH' | 'PLAYER')}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="PLAYER">Player</option>
                    <option value="COACH">Coach</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Age Group</label>
                  <select
                    value={inviteAgeGroup}
                    onChange={e => setInviteAgeGroup(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="U9">Under-9</option>
                    <option value="U11">Under-11</option>
                    <option value="U13">Under-13</option>
                    <option value="U15">Under-15</option>
                    <option value="U19">Under-19</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Discipline</label>
                  <select
                    value={inviteDiscipline}
                    onChange={e => setInviteDiscipline(e.target.value as Discipline)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="BATTING">Batting</option>
                    <option value="BOWLING">Bowling</option>
                    <option value="KEEPING">Wicketkeeping</option>
                    <option value="FIELDING">Fielding</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Assign Squad</label>
                  <input
                    type="text"
                    placeholder="e.g. U15 Pace Squad"
                    value={inviteSquad}
                    onChange={e => setInviteSquad(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Form New Squad Modal Form */}
      {isSquadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsSquadModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-purple-400" />
                <span>Form New Squad</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Create an age-bracket squad under an assigned head coach.</p>
            </div>
            <form onSubmit={handleSquadSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Squad Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. U13 Spin & Flight Unit"
                  value={squadFormName}
                  onChange={e => setSquadFormName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Age Bracket</label>
                  <select
                    value={squadFormAgeGroup}
                    onChange={e => setSquadFormAgeGroup(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="U9">Under-9</option>
                    <option value="U11">Under-11</option>
                    <option value="U13">Under-13</option>
                    <option value="U15">Under-15</option>
                    <option value="U19">Under-19</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Discipline</label>
                  <select
                    value={squadFormDiscipline}
                    onChange={e => setSquadFormDiscipline(e.target.value as Discipline)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="BATTING">Batting</option>
                    <option value="BOWLING">Bowling</option>
                    <option value="KEEPING">Wicketkeeping</option>
                    <option value="FIELDING">Fielding</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Head Coach Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shane Bond"
                  value={squadFormCoach}
                  onChange={e => setSquadFormCoach(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSquadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Create Squad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Schedule Session Modal Form */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsSessionModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="text-purple-400" />
                <span>Schedule Training Session</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Assign date, squad, and duration for practice drills.</p>
            </div>
            <form onSubmit={handleSessionSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Session Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Death Bowling & Yorker Execution Circuit"
                  value={sessionFormTitle}
                  onChange={e => setSessionFormTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Target Squad</label>
                <input
                  type="text"
                  value={sessionFormSquad}
                  onChange={e => setSessionFormSquad(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    required
                    value={sessionFormDate}
                    onChange={e => setSessionFormDate(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="240"
                    value={sessionFormDuration}
                    onChange={e => setSessionFormDuration(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Action Confirmation & Notification Modal */}
      {portalModal && (
        <ConfirmationModal
          isOpen={portalModal.isOpen}
          title={portalModal.title}
          message={portalModal.message}
          type={portalModal.type}
          confirmLabel={portalModal.confirmLabel}
          cancelLabel={portalModal.cancelLabel}
          showCancel={portalModal.showCancel}
          onConfirm={portalModal.onConfirm}
          onCancel={portalModal.onCancel || (() => setPortalModal(null))}
          onClose={() => setPortalModal(null)}
        />
      )}
    </div>
  );
};
