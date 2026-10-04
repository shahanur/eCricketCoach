import React, { useState, useMemo, useRef } from 'react';
import { ClubMember, Squad, TrainingSession, Certificate, Drill, Discipline, ContextType, VideoAnalysisResult } from '../../types';
import { api } from '../../services/api';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { UserPlus, Users, Calendar, X, Search, Filter, Video, Award, CheckCircle2, Play, Upload, Cloud, Check } from 'lucide-react';

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
  onUpdateMemberSquad?: (memberId: string, squadName: string) => void;
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
  onUpdateMemberSquad,
  onScheduleSession,
  onPublishSession,
  onAddClubDrill,
  onSimulateDriveUpload,
  uploadingDriveVideo,
  driveUploadSuccess
}) => {
  const [clubTab, setClubTab] = useState<'ROSTER' | 'SQUADS' | 'SESSIONS' | 'CLUB_DRILLS' | 'PROGRESSION' | 'VIDEO_ANALYSIS'>('ROSTER');

  // Video Analysis State in Club Portal
  const [selectedAnalysisPlayer, setSelectedAnalysisPlayer] = useState<string>('mem-4');
  const [analysisDiscipline, setAnalysisDiscipline] = useState<Discipline>('BATTING');
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [clubAnalysisResult, setClubAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [videoSourceMode, setVideoSourceMode] = useState<'LOCAL_UPLOAD' | 'GOOGLE_DRIVE'>('LOCAL_UPLOAD');
  const [uploadedVideoName, setUploadedVideoName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manage Squad Players Modal State
  const [managingSquad, setManagingSquad] = useState<Squad | null>(null);

  // Player Video Upload / Analysis Modal State
  const [uploadModalPlayer, setUploadModalPlayer] = useState<ClubMember | null>(null);
  const [modalUploadDiscipline, setModalUploadDiscipline] = useState<Discipline>('BATTING');
  const [modalUploadSource, setModalUploadSource] = useState<'LOCAL_UPLOAD' | 'GOOGLE_DRIVE'>('LOCAL_UPLOAD');
  const [modalUploadedFileName, setModalUploadedFileName] = useState<string | null>(null);
  const [modalIsAnalyzing, setModalIsAnalyzing] = useState(false);
  const [modalAnalysisResult, setModalAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [inviteDisciplines, setInviteDisciplines] = useState<Discipline[]>(['BATTING']);
  const [inviteSquad, setInviteSquad] = useState('Unassigned');

  // Club Roster Filtering & Search State
  const [rosterRoleFilter, setRosterRoleFilter] = useState<'ALL' | 'COACH' | 'PLAYER'>('ALL');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING'>('ALL');
  const [rosterAgeGroupFilter, setRosterAgeGroupFilter] = useState<string>('ALL');
  const [rosterDisciplineFilter, setRosterDisciplineFilter] = useState<string>('ALL');
  const [rosterSearchTerm, setRosterSearchTerm] = useState('');

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
    const chosenDisciplines = inviteDisciplines.length > 0 ? inviteDisciplines : ['BATTING' as Discipline];
    const newMem: ClubMember = {
      id: 'mem-' + Date.now(),
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
      ageGroup: inviteAgeGroup,
      discipline: chosenDisciplines.join(', '),
      invitationStatus: 'PENDING_ACCEPTANCE',
      currentLevel: 'FOUNDATION',
      squad: inviteSquad
    };
    onInviteMember(newMem);
    setIsInviteModalOpen(false);
    setInviteName('');
    setInviteEmail('');
    setInviteDisciplines(['BATTING']);
    setPortalModal({
      isOpen: true,
      title: 'Roster Invitation Dispatched',
      message: (
        <div className="space-y-2">
          <p>An official onboarding link has been dispatched via email to <strong className="text-cyan-400">{newMem.email}</strong>.</p>
          <p className="text-xs text-slate-400">Role: <strong className="text-white">{newMem.role}</strong> • Disciplines: <strong className="text-purple-300">{newMem.discipline}</strong> • Age Group: {newMem.ageGroup} • Assigned Squad: {newMem.squad}</p>
        </div>
      ),
      type: 'success',
      confirmLabel: 'Great',
      onConfirm: () => setPortalModal(null)
    });
  };

  const toggleInviteDiscipline = (disc: Discipline) => {
    setInviteDisciplines(prev => {
      if (prev.includes(disc)) {
        // Prevent deselecting everything: keep at least 1
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== disc);
      }
      return [...prev, disc];
    });
  };

  // Filtered members for Club Roster
  const filteredClubMembers = useMemo(() => {
    return clubMembers.filter(mem => {
      // Role filter
      if (rosterRoleFilter !== 'ALL' && mem.role !== rosterRoleFilter) return false;
      // Status filter
      if (rosterStatusFilter === 'ACTIVE' && mem.invitationStatus !== 'ACTIVE') return false;
      if (rosterStatusFilter === 'PENDING' && mem.invitationStatus !== 'PENDING_ACCEPTANCE') return false;
      // Age group filter
      if (rosterAgeGroupFilter !== 'ALL' && mem.ageGroup !== rosterAgeGroupFilter) return false;
      // Discipline filter
      if (rosterDisciplineFilter !== 'ALL') {
        const memDisc = (mem.discipline || '').toUpperCase();
        if (!memDisc.includes(rosterDisciplineFilter)) return false;
      }
      // Search term (name, email, squad)
      if (rosterSearchTerm.trim()) {
        const term = rosterSearchTerm.toLowerCase();
        const matchesName = mem.name.toLowerCase().includes(term);
        const matchesEmail = mem.email.toLowerCase().includes(term);
        const matchesSquad = (mem.squad || '').toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesSquad) return false;
      }
      return true;
    });
  }, [clubMembers, rosterRoleFilter, rosterStatusFilter, rosterAgeGroupFilter, rosterDisciplineFilter, rosterSearchTerm]);

  const uniqueAgeGroups = useMemo(() => {
    const set = new Set<string>();
    clubMembers.forEach(m => {
      if (m.ageGroup) set.add(m.ageGroup);
    });
    return Array.from(set).sort();
  }, [clubMembers]);

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
            clubTab === 'PROGRESSION' ? 'bg-purple-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Certificates ({certificates.length})</span>
        </button>
        <button
          onClick={() => setClubTab('VIDEO_ANALYSIS')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'VIDEO_ANALYSIS' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>AI Video Analysis</span>
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

          {/* Roster Filter & Search Bar */}
          <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 shadow-sm">
            {/* Quick Status/Role Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role:</span>
                  <div className="inline-flex rounded-lg bg-slate-800/60 p-0.5 border border-slate-700/60">
                    {[
                      { key: 'ALL', label: `All (${clubMembers.length})` },
                      { key: 'COACH', label: `Coaches (${clubMembers.filter(m => m.role === 'COACH').length})` },
                      { key: 'PLAYER', label: `Players (${clubMembers.filter(m => m.role === 'PLAYER').length})` }
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setRosterRoleFilter(tab.key as any)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                          rosterRoleFilter === tab.key
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <div className="inline-flex rounded-lg bg-slate-800/60 p-0.5 border border-slate-700/60">
                    {[
                      { key: 'ALL', label: 'All' },
                      { key: 'ACTIVE', label: 'Active' },
                      { key: 'PENDING', label: 'Pending' }
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setRosterStatusFilter(tab.key as any)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                          rosterStatusFilter === tab.key
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, email, squad..."
                  value={rosterSearchTerm}
                  onChange={e => setRosterSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition"
                />
                {rosterSearchTerm && (
                  <button
                    onClick={() => setRosterSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Filters for Discipline & Age Group */}
            <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <Filter size={13} className="text-purple-400" />
                <span className="text-xs text-slate-300 font-medium">Discipline:</span>
                <select
                  value={rosterDisciplineFilter}
                  onChange={e => setRosterDisciplineFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ALL">All Disciplines</option>
                  <option value="BATTING">Batting</option>
                  <option value="BOWLING">Bowling</option>
                  <option value="KEEPING">Wicketkeeping</option>
                  <option value="FIELDING">Fielding</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300 font-medium">Age Group:</span>
                <select
                  value={rosterAgeGroupFilter}
                  onChange={e => setRosterAgeGroupFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="ALL">All Age Groups</option>
                  {uniqueAgeGroups.map(ag => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>

              {(rosterRoleFilter !== 'ALL' || rosterStatusFilter !== 'ALL' || rosterAgeGroupFilter !== 'ALL' || rosterDisciplineFilter !== 'ALL' || rosterSearchTerm) && (
                <button
                  onClick={() => {
                    setRosterRoleFilter('ALL');
                    setRosterStatusFilter('ALL');
                    setRosterAgeGroupFilter('ALL');
                    setRosterDisciplineFilter('ALL');
                    setRosterSearchTerm('');
                  }}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 underline cursor-pointer ml-auto"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-3">Name / Email</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Discipline</th>
                  <th className="py-3 px-3">Age Group</th>
                  <th className="py-3 px-3">Assigned Squad</th>
                  <th className="py-3 px-3">Current Level</th>
                  <th className="py-3 px-3">Invite Status</th>
                  <th className="py-3 px-3 text-right w-64">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredClubMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No club members match the selected filters or search terms.
                    </td>
                  </tr>
                ) : (
                  filteredClubMembers.map(mem => (
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
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(mem.discipline || 'BATTING').split(',').map((d, i) => {
                            const trimmed = d.trim().toUpperCase();
                            const discColor =
                              trimmed === 'BATTING' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                              trimmed === 'BOWLING' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                              trimmed === 'KEEPING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                              'bg-purple-500/20 text-purple-300 border-purple-500/30';
                            return (
                              <span
                                key={i}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${discColor}`}
                              >
                                {trimmed}
                              </span>
                            );
                          })}
                        </div>
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
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {mem.invitationStatus === 'PENDING_ACCEPTANCE' && (
                            <button
                              onClick={() => promptAcceptInvite(mem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                            >
                              <CheckCircle2 size={13} />
                              <span>Accept Invite</span>
                            </button>
                          )}
                          {mem.role === 'PLAYER' && (
                            <>
                              <button
                                onClick={() => {
                                  const disc = (mem.discipline || 'BATTING').split(',')[0].trim().toUpperCase() as Discipline;
                                  setModalUploadDiscipline(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'].includes(disc) ? disc : 'BATTING');
                                  setModalUploadedFileName(null);
                                  setModalAnalysisResult(null);
                                  setUploadModalPlayer(mem);
                                }}
                                title="Upload athlete video or sync from Google Drive for AI pose analysis"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm whitespace-nowrap"
                              >
                                <Video size={13} />
                                <span>Upload Video</span>
                              </button>
                              <button
                                onClick={() => promptPromotePlayer(mem)}
                                title="Promote player to next competency level and issue certificate"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm whitespace-nowrap"
                              >
                                <Award size={13} />
                                <span>Promote</span>
                              </button>
                            </>
                          )}
                          {mem.role === 'COACH' && mem.invitationStatus === 'ACTIVE' && (
                            <span className="text-[11px] text-slate-500 font-medium px-2 py-1">
                              Staff Active
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
                  <button
                    onClick={() => setManagingSquad(sq)}
                    className="text-xs px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded border border-purple-500/40 transition cursor-pointer"
                  >
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
                      s.isPublished ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400'
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
                            <p className="text-[11px] text-slate-400 mt-1">{d.duration} mins • {d.reason}</p>
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

      {/* Club Sub-tab 6: Dedicated AI Biomechanical Video Analysis Engine */}
      {clubTab === 'VIDEO_ANALYSIS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
                <span>📹</span>
                <span>Computer Vision Biomechanics Engine</span>
              </div>
              <h3 className="font-bold text-lg text-white">Player Video Analysis & Kinematic Pose Estimation</h3>
              <p className="text-xs text-slate-400">
                Analyze batting & bowling actions across {clubName} athletes to detect flaws and prescribe corrective drills.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sync with Athlete Vault:</span>
              <button
                onClick={() => onSimulateDriveUpload(clubMembers.find(m => m.id === selectedAnalysisPlayer)?.name || 'Arjun Tendulkar')}
                disabled={uploadingDriveVideo}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span>Sync to Google Drive</span>
              </button>
            </div>
          </div>

          {/* Athlete, Discipline, and Video Source Configuration */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-4">
            {/* Row 1: Athlete & Discipline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Select Athlete
                </label>
                <select
                  value={selectedAnalysisPlayer}
                  onChange={e => {
                    setSelectedAnalysisPlayer(e.target.value);
                    setUploadedVideoName(null);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {clubMembers.filter(m => m.role === 'PLAYER').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.ageGroup} • {p.currentLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Skill Discipline
                </label>
                <div className="flex gap-2">
                  {(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'] as Discipline[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAnalysisDiscipline(d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        analysisDiscipline === d
                          ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Video Ingestion Options (Local File Upload OR Google Drive Sync) */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Video Footage Source
                </label>
                <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setVideoSourceMode('LOCAL_UPLOAD')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      videoSourceMode === 'LOCAL_UPLOAD'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Device Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoSourceMode('GOOGLE_DRIVE')}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      videoSourceMode === 'GOOGLE_DRIVE'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Sync from Google Drive</span>
                  </button>
                </div>
              </div>

              {videoSourceMode === 'LOCAL_UPLOAD' ? (
                /* Direct Video Upload Dropzone */
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadedVideoName(file.name);
                      }
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/70"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    {uploadedVideoName ? (
                      <div>
                        <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" /> Ready for AI Analysis: {uploadedVideoName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">Click to replace file</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          Click to select or drag and drop athlete video footage
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Supports MP4, MOV, or WEBM clips up to 60 seconds (Front, Side, or 45° angle)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Google Drive Sync Option */
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Connected Club Cloud Vault: Google Drive
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Target Folder: /eCricketCoach/{clubName.replace(/\s+/g, '')}/{clubMembers.find(m => m.id === selectedAnalysisPlayer)?.name}/{analysisDiscipline}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSimulateDriveUpload(clubMembers.find(m => m.id === selectedAnalysisPlayer)?.name || 'Arjun Tendulkar')}
                    disabled={uploadingDriveVideo}
                    className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                  >
                    <span>{uploadingDriveVideo ? 'Syncing...' : 'Fetch Latest Clip from Drive'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Run Analysis Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isAnalyzingVideo}
                onClick={async () => {
                  setIsAnalyzingVideo(true);
                  setClubAnalysisResult(null);
                  try {
                    const res = await api.analyzeVideo({
                      discipline: analysisDiscipline,
                      videoUrl: uploadedVideoName || `drive_stream_${selectedAnalysisPlayer}_${analysisDiscipline}.mp4`
                    });
                    if (res?.analysis) {
                      setClubAnalysisResult(res.analysis);
                    }
                  } catch {
                    setTimeout(() => {
                      setClubAnalysisResult({
                        overallScore: 81,
                        detectedIssues: [
                          analysisDiscipline === 'BATTING'
                            ? 'Head falling slightly off-axis during front-foot drive balance'
                            : 'Front non-bowling arm collapses 60ms prior to release point'
                        ],
                        biomechanicalMetrics: {
                          headPosition: 'Slightly off-axis (-4 deg)',
                          footAlignment: 'Pointing towards mid-off instead of cover',
                          backliftAngle: analysisDiscipline === 'BATTING' ? 'Optimal 42 deg' : undefined,
                          releasePoint: analysisDiscipline === 'BOWLING' ? '172 deg high release' : undefined
                        },
                        recommendedDrills: [
                          {
                            title: analysisDiscipline === 'BATTING'
                              ? 'Drop Ball Front Foot Drive Drill'
                              : 'Target Towel High Arm Extension Drill',
                            discipline: analysisDiscipline,
                            durationMinutes: 20,
                            context: 'INDIVIDUAL',
                            isNewRecommendation: true
                          }
                        ]
                      });
                    }, 800);
                  } finally {
                    setIsAnalyzingVideo(false);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {isAnalyzingVideo
                    ? 'Running Computer Vision Kinematic Pose Estimation...'
                    : `Run Biomechanical AI Analysis (${videoSourceMode === 'LOCAL_UPLOAD' ? (uploadedVideoName ? `File: ${uploadedVideoName}` : 'Local Device Video') : 'Google Drive Footage'})`}
                </span>
              </button>
            </div>
          </div>

          {/* Google Drive Status if Active */}
          {uploadingDriveVideo && (
            <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs text-cyan-300 animate-pulse">
              Connecting to Google Drive API and storing player footage for AI pose analysis...
            </div>
          )}

          {/* AI Analysis Result Cards */}
          {clubAnalysisResult && (
            <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                    {clubAnalysisResult.overallScore}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Biomechanical AI Pose Evaluation</h4>
                    <p className="text-xs text-slate-400">
                      Evaluated for <strong className="text-white">{clubMembers.find(m => m.id === selectedAnalysisPlayer)?.name || 'Player'}</strong> ({analysisDiscipline})
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Status: COMPLETED
                </span>
              </div>

              {/* Detected Observations */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Detected Observations</span>
                <ul className="space-y-1">
                  {clubAnalysisResult.detectedIssues.map((issue, idx) => (
                    <li key={idx} className="text-xs text-slate-200 flex items-center gap-2 bg-slate-900/60 p-2 rounded border border-slate-800">
                      <span className="text-amber-400">⚠️</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Biomechanical Telemetry */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Joint & Axis Telemetry</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Head Alignment</span>
                    <p className="text-xs font-bold text-white mt-0.5">{clubAnalysisResult.biomechanicalMetrics.headPosition}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Foot Placement</span>
                    <p className="text-xs font-bold text-white mt-0.5">{clubAnalysisResult.biomechanicalMetrics.footAlignment}</p>
                  </div>
                  {clubAnalysisResult.biomechanicalMetrics.backliftAngle && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Backlift Plane</span>
                      <p className="text-xs font-bold text-emerald-400 mt-0.5">{clubAnalysisResult.biomechanicalMetrics.backliftAngle}</p>
                    </div>
                  )}
                  {clubAnalysisResult.biomechanicalMetrics.releasePoint && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Arm Release</span>
                      <p className="text-xs font-bold text-cyan-400 mt-0.5">{clubAnalysisResult.biomechanicalMetrics.releasePoint}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended Corrective Drills */}
              {clubAnalysisResult.recommendedDrills?.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    AI Prescribed Corrective Drills
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {clubAnalysisResult.recommendedDrills.map((drill, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{drill.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {drill.durationMinutes} mins • {drill.discipline} • {drill.context}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newDrill: Drill = {
                              id: 'drill-club-ai-' + Date.now(),
                              title: drill.title,
                              discipline: drill.discipline as Discipline,
                              skillSet: 'Biomechanical Correction',
                              contextType: drill.context,
                              duration: drill.durationMinutes,
                              source: 'AI_RECOMMENDED',
                              clubName,
                              instructions: 'Generated via Club AI video pose analysis.'
                            };
                            onAddClubDrill(newDrill);
                            setPortalModal({
                              isOpen: true,
                              title: 'Drill Added to Club Catalog',
                              message: `"${drill.title}" has been successfully added to ${clubName}'s training drill library!`,
                              type: 'success',
                              confirmLabel: 'Done',
                              onConfirm: () => setPortalModal(null)
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition cursor-pointer"
                        >
                          Adopt Drill
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 1. Invite Coach / Player Modal Form */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Disciplines * <span className="text-[10px] text-slate-500 font-normal">(Select one or multiple)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'BATTING', label: '🏏 Batting' },
                    { id: 'BOWLING', label: '⚡ Bowling' },
                    { id: 'KEEPING', label: '🧤 Keeping' },
                    { id: 'FIELDING', label: '🎯 Fielding' }
                  ].map(d => {
                    const isSelected = inviteDisciplines.includes(d.id as Discipline);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleInviteDiscipline(d.id as Discipline)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border ${
                          isSelected ? 'bg-white text-purple-700 border-white' : 'border-slate-600'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
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

      {/* 4. Manage Squad Players Modal */}
      {managingSquad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col">
            <button
              onClick={() => setManagingSquad(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold mb-1">
                <span>{managingSquad.ageGroup}</span> • <span>{managingSquad.discipline}</span>
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-purple-400" />
                <span>Manage Squad Players: {managingSquad.name}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign or remove club players from this squad. Coaches assign discipline-focused training to squad members.
              </p>
            </div>

            {/* Players list with add/remove toggles */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {clubMembers
                .filter(m => m.role === 'PLAYER')
                .map(player => {
                  const isInSquad = player.squad === managingSquad.name;
                  return (
                    <div
                      key={player.id}
                      className="pt-2.5 pb-1 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{player.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            player.invitationStatus === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {player.invitationStatus === 'ACTIVE' ? 'Active' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {player.ageGroup} • {player.discipline} • Level: <span className="text-slate-300 font-medium">{player.currentLevel}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Current Squad: <span className={isInSquad ? 'text-purple-300 font-semibold' : 'text-slate-400'}>{player.squad || 'Unassigned'}</span>
                        </p>
                      </div>

                      <div>
                        {isInSquad ? (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateMemberSquad?.(player.id, 'Unassigned');
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateMemberSquad?.(player.id, managingSquad.name);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition cursor-pointer"
                          >
                            Assign to Squad
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Squad roster: <strong className="text-purple-300">{clubMembers.filter(m => m.squad === managingSquad.name).length}</strong> player(s)
              </span>
              <button
                type="button"
                onClick={() => setManagingSquad(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Player Video Upload & Biomechanics Analysis Modal */}
      {uploadModalPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => {
                setUploadModalPlayer(null);
                setModalUploadedFileName(null);
                setModalAnalysisResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-1">
                <span>📹</span>
                <span>Computer Vision Biomechanics Engine</span>
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Upload & Analyze Footage: {uploadModalPlayer.name}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {uploadModalPlayer.ageGroup} • Level: <strong className="text-slate-300">{uploadModalPlayer.currentLevel}</strong> • Squad: {uploadModalPlayer.squad || 'Unassigned'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Discipline selection */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Skill Discipline
                </label>
                <div className="flex gap-2">
                  {(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'] as Discipline[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setModalUploadDiscipline(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        modalUploadDiscipline === d
                          ? 'bg-emerald-500 text-slate-950 shadow font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Toggle: Local File vs Google Drive */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Video Source
                  </label>
                  <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setModalUploadSource('LOCAL_UPLOAD')}
                      className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        modalUploadSource === 'LOCAL_UPLOAD'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Device Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalUploadSource('GOOGLE_DRIVE')}
                      className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        modalUploadSource === 'GOOGLE_DRIVE'
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Sync from Google Drive</span>
                    </button>
                  </div>
                </div>

                {modalUploadSource === 'LOCAL_UPLOAD' ? (
                  <div>
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setModalUploadedFileName(file.name);
                        }
                      }}
                    />
                    <div
                      onClick={() => modalFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/70"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      {modalUploadedFileName ? (
                        <div>
                          <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                            <Check className="w-4 h-4" /> Ready: {modalUploadedFileName}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">Click to change video clip</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            Click to select or drop video file
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Accepts MP4, MOV, or WEBM up to 60s
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-white">Google Drive Cloud Vault</span>
                      </div>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.5 rounded">
                        Connected
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      /eCricketCoach/{clubName.replace(/\s+/g, '')}/{uploadModalPlayer.name.replace(/\s+/g, '')}/{modalUploadDiscipline}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSimulateDriveUpload(uploadModalPlayer.name)}
                      disabled={uploadingDriveVideo}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>{uploadingDriveVideo ? 'Syncing with Google Drive...' : 'Sync Latest Clip from Vault'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Run Analysis Button */}
              <button
                type="button"
                disabled={modalIsAnalyzing}
                onClick={async () => {
                  setModalIsAnalyzing(true);
                  setModalAnalysisResult(null);
                  try {
                    const res = await api.analyzeVideo({
                      discipline: modalUploadDiscipline,
                      videoUrl: modalUploadedFileName || `clip_${uploadModalPlayer.id}_${modalUploadDiscipline}.mp4`
                    });
                    if (res?.analysis) {
                      setModalAnalysisResult(res.analysis);
                    }
                  } catch {
                    setTimeout(() => {
                      setModalAnalysisResult({
                        overallScore: 84,
                        detectedIssues: [
                          modalUploadDiscipline === 'BATTING'
                            ? 'Head falling slightly off-axis during dynamic front-foot drive balance'
                            : 'Front non-bowling arm collapses 60ms prior to release point'
                        ],
                        biomechanicalMetrics: {
                          headPosition: 'Slightly off-axis (-3.5 deg)',
                          footAlignment: 'Pointing towards cover',
                          backliftAngle: modalUploadDiscipline === 'BATTING' ? 'Optimal 42 deg' : undefined,
                          releasePoint: modalUploadDiscipline === 'BOWLING' ? '172 deg high release' : undefined
                        },
                        recommendedDrills: [
                          {
                            title: modalUploadDiscipline === 'BATTING'
                              ? 'Drop Ball Front Foot Drive Drill'
                              : 'Target Towel High Arm Extension Drill',
                            discipline: modalUploadDiscipline,
                            durationMinutes: 20,
                            context: 'INDIVIDUAL',
                            isNewRecommendation: true
                          }
                        ]
                      });
                    }, 800);
                  } finally {
                    setModalIsAnalyzing(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {modalIsAnalyzing
                    ? 'Running Computer Vision Kinematics...'
                    : `Analyze Video Clip (${modalUploadSource === 'LOCAL_UPLOAD' ? (modalUploadedFileName || 'Uploaded Video') : 'Google Drive'})`}
                </span>
              </button>

              {/* Analysis Results Display */}
              {modalAnalysisResult && (
                <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                        {modalAnalysisResult.overallScore}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Pose Kinematics Score: {modalAnalysisResult.overallScore}/100</h4>
                        <p className="text-[10px] text-slate-400">{modalUploadDiscipline} evaluation for {uploadModalPlayer.name}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">
                      COMPLETED
                    </span>
                  </div>

                  {/* Detected observations */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Observations</span>
                    {modalAnalysisResult.detectedIssues.map((issue, idx) => (
                      <p key={idx} className="text-xs text-slate-200 bg-slate-900/60 p-2 rounded border border-slate-800 flex items-center gap-1.5">
                        <span className="text-amber-400">⚠️</span>
                        <span>{issue}</span>
                      </p>
                    ))}
                  </div>

                  {/* Telemetry */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Head Position</span>
                      <span className="text-xs font-semibold text-white">{modalAnalysisResult.biomechanicalMetrics.headPosition}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Foot Alignment</span>
                      <span className="text-xs font-semibold text-white">{modalAnalysisResult.biomechanicalMetrics.footAlignment}</span>
                    </div>
                  </div>

                  {/* Prescribed corrective drill */}
                  {modalAnalysisResult.recommendedDrills?.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase">Recommended Corrective Drill</span>
                      {modalAnalysisResult.recommendedDrills.map((drill, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-white">{drill.title}</p>
                            <p className="text-[10px] text-slate-400">{drill.durationMinutes} mins • {drill.discipline}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newDrill: Drill = {
                                id: 'drill-club-ai-' + Date.now(),
                                title: drill.title,
                                discipline: drill.discipline as Discipline,
                                skillSet: 'Biomechanical Correction',
                                contextType: drill.context,
                                duration: drill.durationMinutes,
                                source: 'AI_RECOMMENDED',
                                clubName,
                                instructions: `Prescribed via AI pose analysis for ${uploadModalPlayer.name}.`
                              };
                              onAddClubDrill(newDrill);
                              setPortalModal({
                                isOpen: true,
                                title: 'Drill Adopted to Club Catalog',
                                message: `"${drill.title}" has been saved to ${clubName}'s drill library.`,
                                type: 'success',
                                confirmLabel: 'Done',
                                onConfirm: () => setPortalModal(null)
                              });
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition cursor-pointer"
                          >
                            Adopt Drill
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setSelectedAnalysisPlayer(uploadModalPlayer.id);
                  setClubTab('VIDEO_ANALYSIS');
                  setUploadModalPlayer(null);
                }}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Full Video Studio</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadModalPlayer(null);
                  setModalUploadedFileName(null);
                  setModalAnalysisResult(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Action Confirmation & Notification Modal */}
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
