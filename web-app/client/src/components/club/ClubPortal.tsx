import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AuthUser, ClubMember, Squad, TrainingSession, Certificate, Drill, Discipline, ContextType, VideoAnalysisResult, DriveVideoFile } from '../../types';
import { api } from '../../services/api';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { GoogleDriveConnectModal } from '../common/GoogleDriveConnectModal';
import { VideoAnalysisDetailModal } from '../common/VideoAnalysisDetailModal';
import { PlayerAssessments } from './PlayerAssessments';
import { UserPlus, Users, Calendar, X, Search, Filter, Video, Award, CheckCircle2, Play, Upload, Cloud, Check, AlertCircle, RefreshCw, Folder, Star, Pencil, Trash2, Download, Settings } from 'lucide-react';
import { downloadCertificatePdf } from '../../utils/certificatePdf';
import { TrainingTemplatePicker } from '../common/TrainingTemplatePicker';

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDisciplines(disciplines: Discipline[]): string {
  const labels: Record<Discipline, string> = {
    BATTING: 'Batting',
    BOWLING: 'Bowling',
    KEEPING: 'Wicketkeeping',
    FIELDING: 'Fielding'
  };
  return disciplines.map(discipline => labels[discipline]).join(', ');
}

interface ClubPortalProps {
  currentUser: AuthUser;
  isClubCoach?: boolean;
  clubMembers: ClubMember[];
  squads: Squad[];
  sessions: TrainingSession[];
  certificates: Certificate[];
  drills: Drill[];
  clubName?: string;
  onDeleteCertificate: (certificateId: string) => Promise<void>;
  onInviteMember: (member: ClubMember) => void;
  onAcceptMemberInvite: (id: string) => void;
  onPromotePlayer: (id: string) => void;
  onAddSquad: (squad: Squad) => void;
  onUpdateSquad?: (squadId: string, updates: Partial<Squad>) => void;
  onDeleteSquad?: (squadId: string) => void;
  onUpdateMemberSquad?: (memberId: string, squadName: string) => void;
  onUpdateMember?: (memberId: string, updates: Partial<ClubMember>) => void;
  onScheduleSession: (session: TrainingSession) => Promise<void>;
  onUpdateSession?: (sessionId: string, updates: Partial<TrainingSession>) => void;
  onSessionUpdated?: (session: TrainingSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onPublishSession: (id: string) => void;
  onAddDrillToSession?: (sessionId: string, drillId?: string) => void;
  onRemoveDrillFromSession?: (sessionId: string, drillId: string) => void;
  onAddClubDrill: (drill: Drill) => void;
  onDeleteDrill?: (drillId: string) => void;
  onUpdateDrill?: (drillId: string, updates: Partial<Drill>) => void;
}

export const ClubPortal: React.FC<ClubPortalProps> = ({
  currentUser,
  isClubCoach = false,
  clubMembers,
  squads,
  sessions,
  certificates,
  drills,
  clubName = 'Marylebone Cricket Club Academy',
  onDeleteCertificate,
  onInviteMember,
  onAcceptMemberInvite,
  onPromotePlayer,
  onAddSquad,
  onUpdateSquad,
  onDeleteSquad,
  onUpdateMemberSquad,
  onUpdateMember,
  onScheduleSession,
  onUpdateSession,
  onSessionUpdated,
  onDeleteSession,
  onPublishSession,
  onAddDrillToSession,
  onRemoveDrillFromSession,
  onAddClubDrill,
  onDeleteDrill,
  onUpdateDrill,
}) => {
  const [clubTab, setClubTab] = useState<'ROSTER' | 'SQUADS' | 'SESSIONS' | 'ASSESSMENTS' | 'CLUB_DRILLS' | 'PROGRESSION' | 'VIDEO_ANALYSIS' | 'SETTINGS'>(isClubCoach ? 'SQUADS' : 'ROSTER');

  useEffect(() => {
    if (isClubCoach && clubTab === 'ROSTER') setClubTab('SQUADS');
  }, [isClubCoach, clubTab]);

  const [latestRatings, setLatestRatings] = useState<Record<string, { average: number; date: string; assessmentId: string }>>({});
  const [openAssessmentId, setOpenAssessmentId] = useState<string | undefined>(undefined);
  const [clubLogo, setClubLogo] = useState<string | null>(null);
  const [brandingMessage, setBrandingMessage] = useState('');
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [certificateNameFilter, setCertificateNameFilter] = useState('');
  const [certificateStartDateFilter, setCertificateStartDateFilter] = useState('');
  const [certificateEndDateFilter, setCertificateEndDateFilter] = useState('');
  const [sessionNameFilter, setSessionNameFilter] = useState('');
  const [sessionStartDateFilter, setSessionStartDateFilter] = useState('');
  const [sessionEndDateFilter, setSessionEndDateFilter] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL');
  const isSessionDateRangeInvalid = Boolean(
    sessionStartDateFilter && sessionEndDateFilter && sessionStartDateFilter > sessionEndDateFilter
  );
  const filteredSessions = sessions.filter(session => {
    const matchesName = session.title.toLowerCase().includes(sessionNameFilter.trim().toLowerCase());
    const matchesStartDate = !sessionStartDateFilter || session.sessionDate >= sessionStartDateFilter;
    const matchesEndDate = !sessionEndDateFilter || session.sessionDate <= sessionEndDateFilter;
    const matchesStatus = sessionStatusFilter === 'ALL'
      || (sessionStatusFilter === 'DRAFT' && !session.isPublished && !session.isExecuted)
      || (sessionStatusFilter === 'PUBLISHED' && session.isPublished && !session.isExecuted)
      || (sessionStatusFilter === 'EXECUTED' && session.isExecuted);
    return matchesName && matchesStartDate && matchesEndDate && matchesStatus;
  });
  const clearSessionFilters = () => {
    setSessionNameFilter('');
    setSessionStartDateFilter('');
    setSessionEndDateFilter('');
    setSessionStatusFilter('ALL');
  };
  const filteredCertificates = certificates.filter(certificate => {
    const matchesName = certificate.playerName.toLowerCase().includes(certificateNameFilter.trim().toLowerCase());
    const matchesStartDate = !certificateStartDateFilter || certificate.issuedDate >= certificateStartDateFilter;
    const matchesEndDate = !certificateEndDateFilter || certificate.issuedDate <= certificateEndDateFilter;
    return matchesName && matchesStartDate && matchesEndDate;
  });

  const confirmDeleteCertificate = (certificate: Certificate) => {
    setPortalModal({
      isOpen: true,
      title: 'Delete Certificate',
      message: `Permanently delete certificate #${certificate.certificateNumber} for ${certificate.playerName}? This cannot be undone.`,
      type: 'danger',
      confirmLabel: 'Delete Certificate',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: async () => {
        setPortalModal(null);
        try {
          await onDeleteCertificate(certificate.id);
        } catch (error) {
          setPortalModal({
            isOpen: true,
            title: 'Certificate Could Not Be Deleted',
            message: error instanceof Error ? error.message : 'Unable to delete this certificate.',
            type: 'danger',
            confirmLabel: 'Close',
            onConfirm: () => setPortalModal(null)
          });
        }
      }
    });
  };

  useEffect(() => {
    if (isClubCoach || !currentUser.tenantId) return;
    let cancelled = false;
    api.getClubBranding()
      .then(({ logoUrl }) => {
        if (!cancelled) setClubLogo(logoUrl);
      })
      .catch(error => {
        if (!cancelled) setBrandingMessage(error instanceof Error ? error.message : 'Unable to load club branding.');
      });
    return () => { cancelled = true; };
  }, [currentUser.tenantId, isClubCoach]);

  const saveClubLogo = async (logoUrl: string | null) => {
    setIsSavingBranding(true);
    setBrandingMessage('');
    try {
      const saved = await api.updateClubBranding(logoUrl);
      setClubLogo(saved.logoUrl);
      setBrandingMessage(logoUrl ? 'Club logo saved. New certificates will include it.' : 'Club logo removed.');
    } catch (error) {
      setBrandingMessage(error instanceof Error ? error.message : 'Unable to save the club logo.');
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleClubLogoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1024 * 1024) {
      setBrandingMessage('Choose a PNG or JPEG image smaller than 1 MB.');
      return;
    }
    try {
      const logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the selected image.'));
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });
      await saveClubLogo(logoDataUrl);
    } catch (error) {
      setBrandingMessage(error instanceof Error ? error.message : 'Unable to read the selected image.');
    }
  };

  useEffect(() => {
    if (clubTab !== 'ROSTER') return;
    let cancelled = false;
    api.getPlayerAssessments()
      .then(assessments => {
        if (cancelled) return;
        const latest: Record<string, { average: number; date: string; assessmentId: string; at: number }> = {};
        for (const a of assessments) {
          if (a.status !== 'COMPLETED') continue;
          const scores = a.metrics.map(m => m.score).filter((s): s is number => typeof s === 'number');
          if (!scores.length) continue;
          const date = a.completedAt || a.scheduledDate;
          const at = new Date(date).getTime() || 0;
          if (!latest[a.playerId] || at > latest[a.playerId].at) {
            latest[a.playerId] = {             average: scores.reduce((s, n) => s + n, 0) / scores.length, date, assessmentId: a.id, at };
          }
        }
                    setLatestRatings(Object.fromEntries(Object.entries(latest).map(([id, v]) => [id, { average: v.average, date: v.date, assessmentId: v.assessmentId }])));
      })
      .catch(() => { if (!cancelled) setLatestRatings({}); });
    return () => { cancelled = true; };
  }, [clubTab]);

  // Video Analysis State in Club Portal
  const [selectedAnalysisPlayer, setSelectedAnalysisPlayer] = useState<string>('mem-4');
  const [analysisDiscipline, setAnalysisDiscipline] = useState<Discipline>('BATTING');
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [clubAnalysisResult, setClubAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    id: string;
    playerId: string | null;
    playerName: string | null;
    discipline: string;
    context: string;
    sourceType: string;
    overallScore: number;
    analysis: VideoAnalysisResult;
    drillAdopted: boolean;
    createdAt: string;
  }>>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [viewingAnalysisId, setViewingAnalysisId] = useState<string | null>(null);
  const [videoSourceMode, setVideoSourceMode] = useState<'LOCAL_UPLOAD' | 'GOOGLE_DRIVE'>('LOCAL_UPLOAD');
  const [uploadedVideoName, setUploadedVideoName] = useState<string | null>(null);
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isBackingUpToDrive, setIsBackingUpToDrive] = useState(false);
  const [driveBackupStatus, setDriveBackupStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real Google Drive video files, fetched from the connected account via the backend Drive API.
  const [driveVideoFiles, setDriveVideoFiles] = useState<DriveVideoFile[]>([]);
  const [modalDriveVideoFiles, setModalDriveVideoFiles] = useState<DriveVideoFile[]>([]);
  const [selectedDriveVideo, setSelectedDriveVideo] = useState<string>('');
  const [driveVideosError, setDriveVideosError] = useState<string | null>(null);
  const [modalDriveVideosError, setModalDriveVideosError] = useState<string | null>(null);
  const [isSyncingDriveTab, setIsSyncingDriveTab] = useState(false);
  const [isSyncingDriveModal, setIsSyncingDriveModal] = useState(false);

  // Google Drive Connection State (shared across Video Analysis tab & Roster upload modal)
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string>('');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  const handleDisconnectDrive = async () => {
    try {
      await api.disconnectGoogleDrive();
    } catch {}
    setIsDriveConnected(false);
    setDriveEmail('');
    setDriveVideoFiles([]);
    setModalDriveVideoFiles([]);
    setSelectedDriveVideo('');
    setModalSelectedDriveVideo('');
    setDriveBackupStatus('IDLE');
    setModalDriveBackupStatus('IDLE');
  };

  // Check real Google Drive connection status on mount
  useEffect(() => {
    api.getGoogleDriveStatus().then(status => {
      setIsDriveConnected(status.connected);
      setDriveEmail(status.email || '');
    }).catch(() => {});
  }, []);

  const fetchAnalysisHistory = () => {
    setIsHistoryLoading(true);
    api.getVideoAnalysisHistory(selectedAnalysisPlayer || undefined)
      .then(res => setAnalysisHistory(res.history || []))
      .catch(() => {})
      .finally(() => setIsHistoryLoading(false));
  };

  // Load previously saved real Gemini analyses for the currently selected player on mount,
  // and whenever a different player is selected from the dropdown.
  useEffect(() => {
    fetchAnalysisHistory();
  }, [selectedAnalysisPlayer]);

  // Full (unfiltered) video analysis history across all players, used to cross-reference
  // AI-recommended drills for whichever squad/players a training session targets.
  const [allAnalysisHistoryForSession, setAllAnalysisHistoryForSession] = useState<Array<{
    playerId: string | null;
    analysis: VideoAnalysisResult;
  }>>([]);

  const fetchDriveVideos = async (target: 'TAB' | 'MODAL' = 'TAB') => {
    try {
      const { files } = await api.listGoogleDriveVideos();
      if (target === 'TAB') {
        setDriveVideoFiles(files);
        setDriveVideosError(null);
        if (files.length > 0) {
          setSelectedDriveVideo(prev => (files.length === 1 ? files[0].id : (files.some(f => f.id === prev) ? prev : files[0].id)));
        }
      } else {
        setModalDriveVideoFiles(files);
        setModalDriveVideosError(null);
        if (files.length > 0) {
          setModalSelectedDriveVideo(prev => (files.length === 1 ? files[0].id : (files.some(f => f.id === prev) ? prev : files[0].id)));
        }
      }
      return files;
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch videos from Google Drive.';
      if (target === 'TAB') setDriveVideosError(message);
      else setModalDriveVideosError(message);
      return [];
    }
  };

  const handleDriveConnected = (email: string) => {
    setIsDriveConnected(true);
    setDriveEmail(email);
    fetchDriveVideos('TAB');
  };

  // When a device video is selected while Google Drive is connected, automatically back it up
  // to the user's real Google Drive so every uploaded clip is safely stored in the cloud vault,
  // organized as eCricketCoach/{Player Name}/{Discipline}.
  const backupLocalVideoToDrive = async (file: File, target: 'TAB' | 'MODAL') => {
    if (!isDriveConnected) return;
    const setBusy = target === 'TAB' ? setIsBackingUpToDrive : setIsModalBackingUpToDrive;
    const setStatus = target === 'TAB' ? setDriveBackupStatus : setModalDriveBackupStatus;
    const playerName = target === 'TAB'
      ? (clubMembers.find(m => m.id === selectedAnalysisPlayer)?.name || 'Unassigned Player')
      : (uploadModalPlayer?.name || 'Unassigned Player');
    const discipline = target === 'TAB' ? analysisDiscipline : modalUploadDiscipline;
    setBusy(true);
    setStatus('IDLE');
    try {
      const driveFile = await api.uploadVideoToGoogleDrive(file, playerName, discipline);
      if (target === 'TAB') {
        setDriveVideoFiles(prev => {
          const updated = [driveFile, ...prev.filter(f => f.id !== driveFile.id)];
          if (updated.length === 1) {
            setSelectedDriveVideo(updated[0].id);
          }
          return updated;
        });
      } else {
        setModalDriveVideoFiles(prev => {
          const updated = [driveFile, ...prev.filter(f => f.id !== driveFile.id)];
          if (updated.length === 1) {
            setModalSelectedDriveVideo(updated[0].id);
          }
          return updated;
        });
      }
      setStatus('SUCCESS');
    } catch {
      setStatus('ERROR');
    } finally {
      setBusy(false);
    }
  };

  // Player Video Upload / Analysis Modal State
  const [uploadModalPlayer, setUploadModalPlayer] = useState<ClubMember | null>(null);
  const [modalUploadDiscipline, setModalUploadDiscipline] = useState<Discipline>('BATTING');
  const [modalUploadSource, setModalUploadSource] = useState<'LOCAL_UPLOAD' | 'GOOGLE_DRIVE'>('LOCAL_UPLOAD');
  const [modalUploadedFileName, setModalUploadedFileName] = useState<string | null>(null);
  const [modalUploadedFile, setModalUploadedFile] = useState<File | null>(null);
  const [modalUploadError, setModalUploadError] = useState<string | null>(null);
  const [isModalBackingUpToDrive, setIsModalBackingUpToDrive] = useState(false);
  const [modalDriveBackupStatus, setModalDriveBackupStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [modalSelectedDriveVideo, setModalSelectedDriveVideo] = useState<string>('');
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
  const [inviteCoachLevel, setInviteCoachLevel] = useState<'SUPPORT_COACH' | 'FOUNDATION_COACH' | 'CORE_COACH' | 'ADVANCED_COACH' | 'SPECIALIST_COACH'>('SUPPORT_COACH');
  const [inviteDisciplines, setInviteDisciplines] = useState<Discipline[]>(['BATTING']);
  const [inviteSquad, setInviteSquad] = useState('Unassigned');

  // Club Roster Filtering & Search State
  const [rosterRoleFilter, setRosterRoleFilter] = useState<'COACH' | 'PLAYER'>('COACH');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING'>('ALL');
  const [rosterAgeGroupFilter, setRosterAgeGroupFilter] = useState<string>('ALL');
  const [rosterDisciplineFilter, setRosterDisciplineFilter] = useState<string>('ALL');
  const [rosterSearchTerm, setRosterSearchTerm] = useState('');

  // Edit Member Modal Form State
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<'COACH' | 'PLAYER'>('PLAYER');
  const [editMemberAgeGroup, setEditMemberAgeGroup] = useState('U15');
  const [editMemberDisciplines, setEditMemberDisciplines] = useState<Discipline[]>(['BATTING']);
  const [editMemberCurrentLevel, setEditMemberCurrentLevel] = useState<ClubMember['currentLevel']>('FOUNDATION');

  const openEditMemberModal = (mem: ClubMember) => {
    setEditingMember(mem);
    setEditMemberName(mem.name);
    setEditMemberEmail(mem.email);
    setEditMemberRole(mem.role);
    setEditMemberAgeGroup(mem.ageGroup);
    const discs = (mem.discipline || 'BATTING').split(',').map(d => d.trim().toUpperCase()).filter(Boolean) as Discipline[];
    setEditMemberDisciplines(discs.length ? discs : ['BATTING']);
    setEditMemberCurrentLevel(mem.currentLevel);
  };

  const handleSubmitEditMember = () => {
    if (!editingMember) return;
    onUpdateMember?.(editingMember.id, {
      name: editMemberName.trim(),
      email: editMemberEmail.trim(),
      role: editMemberRole,
      ageGroup: editMemberAgeGroup,
      discipline: editMemberDisciplines.join(','),
      currentLevel: editMemberCurrentLevel,
    });
    setEditingMember(null);
  };

  // Form New Squad Modal Form
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null);
  const [squadFormName, setSquadFormName] = useState('');
  const [squadFormAgeGroup, setSquadFormAgeGroup] = useState('U15');
  const [squadFormDisciplines, setSquadFormDisciplines] = useState<Discipline[]>(['BOWLING']);
  const activeClubCoaches = useMemo(
    () => clubMembers.filter(member => member.role === 'COACH' && member.invitationStatus === 'ACTIVE'),
    [clubMembers]
  );

  // Player selection panel shown alongside the squad form (filter + search for assigning/removing players)
  const [squadPanelAgeGroupFilter, setSquadPanelAgeGroupFilter] = useState<string>('ALL');
  const [squadPanelDisciplineFilter, setSquadPanelDisciplineFilter] = useState<'ALL' | Discipline>('ALL');
  const [squadPanelSearchTerm, setSquadPanelSearchTerm] = useState('');

  // Schedule Session Modal Form
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionFormTitle, setSessionFormTitle] = useState('');
  const [sessionFormTargetType, setSessionFormTargetType] = useState<'SQUAD' | 'PLAYERS'>('SQUAD');
  const [sessionFormSquad, setSessionFormSquad] = useState('U15 Pace & Power Squad');
  const [sessionFormSquadId, setSessionFormSquadId] = useState('');
  const [sessionFormCoachId, setSessionFormCoachId] = useState('');
  const [sessionFormCoordinatorId, setSessionFormCoordinatorId] = useState('');
  const [sessionFormAssistantId, setSessionFormAssistantId] = useState('');
  const [sessionFormPlayerIds, setSessionFormPlayerIds] = useState<string[]>([]);
  const [sessionFormDate, setSessionFormDate] = useState('2026-10-05');
  const [sessionFormDuration, setSessionFormDuration] = useState(90);
  const [sessionFormDrillIds, setSessionFormDrillIds] = useState<string[]>([]);
  const [isSessionSaving, setIsSessionSaving] = useState(false);
  const [sessionSaveError, setSessionSaveError] = useState('');

  // Drill selection panel shown alongside the session form (create & edit)
  const [sessionDrillFilterDiscipline, setSessionDrillFilterDiscipline] = useState<'ALL' | Discipline>('ALL');
  const [squadAiRecommendedDrillTitles, setSquadAiRecommendedDrillTitles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isSessionModalOpen) return;
    api.getVideoAnalysisHistory()
      .then(res => setAllAnalysisHistoryForSession(res.history || []))
      .catch(() => {});
  }, [isSessionModalOpen]);

  // Recompute AI-recommended drill titles (lowercased, for case-insensitive matching) whenever
  // the session's target squad/players change, by scanning video analysis history for those members.
  useEffect(() => {
    if (!isSessionModalOpen) {
      return;
    }
    const targetMemberIds = sessionFormTargetType === 'SQUAD'
      ? clubMembers.filter(m => m.squad === sessionFormSquad).map(m => m.id)
      : sessionFormPlayerIds;

    const titles = new Set<string>();
    allAnalysisHistoryForSession.forEach(entry => {
      if (!entry.playerId || !targetMemberIds.includes(entry.playerId)) return;
      (entry.analysis?.recommendedDrills || []).forEach(rec => {
        if (rec?.title) titles.add(rec.title.trim().toLowerCase());
      });
    });
    setSquadAiRecommendedDrillTitles(titles);
  }, [isSessionModalOpen, sessionFormTargetType, sessionFormSquad, sessionFormPlayerIds, clubMembers, allAnalysisHistoryForSession]);

  // Drill form state for club coaches
  const [newDrillTitle, setNewDrillTitle] = useState('');
  const [newDrillDiscipline, setNewDrillDiscipline] = useState<Discipline>('BATTING');
  const [newDrillSkillSet, setNewDrillSkillSet] = useState('');
  const [newDrillContext, setNewDrillContext] = useState<ContextType>('INDIVIDUAL');
  const [newDrillDuration, setNewDrillDuration] = useState(20);
  const [newDrillInstructions, setNewDrillInstructions] = useState('');
  const [newDrillImage, setNewDrillImage] = useState<string | null>(null);
  const newDrillImageInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Drill Modal state (setup instructions + setup reference image are editable here too)
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [editDrillTitle, setEditDrillTitle] = useState('');
  const [editDrillDiscipline, setEditDrillDiscipline] = useState<Discipline>('BATTING');
  const [editDrillSkillSet, setEditDrillSkillSet] = useState('');
  const [editDrillContext, setEditDrillContext] = useState<ContextType>('INDIVIDUAL');
  const [editDrillDuration, setEditDrillDuration] = useState(20);
  const [editDrillInstructions, setEditDrillInstructions] = useState('');
  const [editDrillImage, setEditDrillImage] = useState<string | null>(null);
  const editDrillImageInputRef = useRef<HTMLInputElement | null>(null);

  const readImageFileAsDataUrl = (file: File, onLoaded: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onLoaded(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const openEditDrill = (drill: Drill) => {
    setEditingDrill(drill);
    setEditDrillTitle(drill.title);
    setEditDrillDiscipline(drill.discipline);
    setEditDrillSkillSet(drill.skillSet);
    setEditDrillContext(drill.contextType);
    setEditDrillDuration(drill.duration);
    setEditDrillInstructions(drill.instructions || '');
    setEditDrillImage(drill.imageUrl || null);
  };

  const closeEditDrill = () => {
    setEditingDrill(null);
  };

  const handleUpdateDrillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDrill || !editDrillTitle || !editDrillSkillSet) return;
    const updates: Partial<Drill> = {
      title: editDrillTitle,
      discipline: editDrillDiscipline,
      skillSet: editDrillSkillSet,
      contextType: editDrillContext,
      duration: editDrillDuration,
      instructions: editDrillInstructions,
      imageUrl: editDrillImage
    };
    onUpdateDrill?.(editingDrill.id, updates);
    closeEditDrill();
    setPortalModal({
      isOpen: true,
      title: 'Drill Updated',
      message: `"${updates.title}" has been updated successfully.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  // Post Session Notes Evaluation State
  const [activeSessionNotes, setActiveSessionNotes] = useState('');
  const [evaluatingSession, setEvaluatingSession] = useState(false);
  const [selectedExecutedSessionId, setSelectedExecutedSessionId] = useState('');
  const [isSessionReviewOpen, setIsSessionReviewOpen] = useState(false);
  const sessionReviewRef = useRef<HTMLDivElement>(null);
  const [playerNoteDrafts, setPlayerNoteDrafts] = useState<Record<string, string>>({});
  const [savingPlayerNoteId, setSavingPlayerNoteId] = useState<string | null>(null);
  const [savedPlayerNoteId, setSavedPlayerNoteId] = useState<string | null>(null);
  const [sessionNotesError, setSessionNotesError] = useState<string | null>(null);
  const [executingSessionId, setExecutingSessionId] = useState<string | null>(null);
  const [legacyPlayerId, setLegacyPlayerId] = useState('');
  const [focusedSessionPlayerId, setFocusedSessionPlayerId] = useState<string | null>(null);
  const [attachingLegacyPlayer, setAttachingLegacyPlayer] = useState(false);

  const todayLocal = new Date();
  const todayDate = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
  const executedSessions = useMemo(
    () => sessions.filter(session => session.isExecuted || session.sessionDate < todayDate),
    [sessions, todayDate]
  );
  const selectedExecutedSession = executedSessions.find(session => session.id === selectedExecutedSessionId)
    || executedSessions[0];
  const sessionAiResult = selectedExecutedSession?.aiEvaluation?.squadSummary ? selectedExecutedSession.aiEvaluation : null;

  useEffect(() => {
    if (!executedSessions.some(session => session.id === selectedExecutedSessionId)) {
      setIsSessionReviewOpen(false);
      setSelectedExecutedSessionId(executedSessions[0]?.id || '');
    }
  }, [executedSessions, selectedExecutedSessionId]);

  useEffect(() => {
    setActiveSessionNotes('');
    setPlayerNoteDrafts({});
    setSavedPlayerNoteId(null);
    setSessionNotesError(null);
    setLegacyPlayerId('');
  }, [selectedExecutedSession?.id]);

  useEffect(() => {
    if (!isSessionReviewOpen || portalModal?.isOpen) return;
    const modal = sessionReviewRef.current;
    if (!modal) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsSessionReviewOpen(false);
      } else if (event.key === 'Tab') {
        const controls = modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    modal.addEventListener('keydown', handleKeyDown);
    return () => {
      modal.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isSessionReviewOpen, portalModal?.isOpen]);

  const allSelectedSessionPlayers = useMemo(() => {
    if (!selectedExecutedSession) return [];
    const historicalPlayerIds = selectedExecutedSession.assignedPlayerIds?.length
      ? selectedExecutedSession.assignedPlayerIds
      : Object.keys(selectedExecutedSession.playerNotes || {});
    if (historicalPlayerIds.length) {
      const assignedPlayerIds = new Set(historicalPlayerIds);
      return clubMembers.filter(member => member.role === 'PLAYER' && assignedPlayerIds.has(member.id));
    }
    const individualNames = selectedExecutedSession.squadName.startsWith('Individual: ')
      ? selectedExecutedSession.squadName.slice('Individual: '.length).split(',').map(name => name.trim())
      : null;

    return clubMembers.filter(member =>
      member.role === 'PLAYER' &&
      (individualNames
        ? individualNames.includes(member.name)
        : member.squad === selectedExecutedSession.squadName)
    );
  }, [clubMembers, selectedExecutedSession]);

  const selectedSessionPlayers = useMemo(() => {
    const all = allSelectedSessionPlayers;
    return focusedSessionPlayerId ? all.filter(p => p.id === focusedSessionPlayerId) : all;
  }, [allSelectedSessionPlayers, focusedSessionPlayerId]);
  const focusedSessionPlayer = focusedSessionPlayerId ? clubMembers.find(m => m.id === focusedSessionPlayerId) : undefined;

  const handleMarkSessionExecuted = async (session: TrainingSession) => {
    setExecutingSessionId(session.id);
    setSessionNotesError(null);
    try {
      const updated = await api.updateSession(session.id, { isExecuted: true });
      onSessionUpdated?.(updated);
      setSelectedExecutedSessionId(updated.id);
    } catch (error) {
      setSessionNotesError(error instanceof Error ? error.message : 'Failed to mark the session as executed.');
    } finally {
      setExecutingSessionId(null);
    }
  };

  const handleSavePlayerNote = async (playerId: string) => {
    if (!selectedExecutedSession) return;
    const playerNotes = {
      ...(selectedExecutedSession.playerNotes || {}),
      [playerId]: playerNoteDrafts[playerId] || ''
    };
    setSavingPlayerNoteId(playerId);
    setSessionNotesError(null);
    try {
      const updated = await api.updateSession(selectedExecutedSession.id, { playerNotes });
      onSessionUpdated?.(updated);
      setSavedPlayerNoteId(playerId);
    } catch (error) {
      setSessionNotesError(error instanceof Error ? error.message : 'Failed to save the player note.');
    } finally {
      setSavingPlayerNoteId(null);
    }
  };

  const handleAttachLegacyPlayer = async () => {
    if (!selectedExecutedSession || !legacyPlayerId) return;
    setAttachingLegacyPlayer(true);
    setSessionNotesError(null);
    try {
      const updated = await api.updateSession(selectedExecutedSession.id, {
        assignedPlayerIds: [
          ...(selectedExecutedSession.assignedPlayerIds || []),
          legacyPlayerId
        ]
      });
      onSessionUpdated?.(updated);
      setLegacyPlayerId('');
    } catch (error) {
      setSessionNotesError(error instanceof Error ? error.message : 'Failed to attach the player to this session.');
    } finally {
      setAttachingLegacyPlayer(false);
    }
  };

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
      instructions: newDrillInstructions,
      imageUrl: newDrillImage
    };
    onAddClubDrill(drill);
    setNewDrillTitle('');
    setNewDrillSkillSet('');
    setNewDrillInstructions('');
    setNewDrillImage(null);
    if (newDrillImageInputRef.current) newDrillImageInputRef.current.value = '';
    setPortalModal({
      isOpen: true,
      title: 'Club Drill Saved',
      message: `Club Custom Drill "${drill.title}" has been successfully added to the ${clubName} proprietary training catalogue.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  const handleEvaluatePostSession = async () => {
    if (!selectedExecutedSession?.isExecuted) return;
    const unsavedPlayerNotes = selectedSessionPlayers
      .map(player => {
        const draft = playerNoteDrafts[player.id];
        return draft !== undefined && draft.trim() && draft !== (selectedExecutedSession.playerNotes?.[player.id] || '')
          ? `${player.name}: ${draft.trim()}`
          : '';
      })
      .filter(Boolean);
    const savedPlayerNotes = selectedSessionPlayers
      .map(player => selectedExecutedSession.playerNotes?.[player.id] || '')
      .filter(note => note.trim());
    const observations = [activeSessionNotes, selectedExecutedSession.postNotes || '', ...savedPlayerNotes, ...unsavedPlayerNotes]
      .filter(note => note.trim());
    if (!observations.length) {
      setPortalModal({
        isOpen: true,
        title: 'Observations Required',
        message: 'Please add player notes, a session summary, or session-wide observations before requesting AI biomechanical diagnosis.',
        type: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setPortalModal(null)
      });
      return;
    }
    setEvaluatingSession(true);
    setSessionNotesError(null);
    try {
      const extraNotes = [activeSessionNotes.trim(), ...unsavedPlayerNotes].filter(Boolean).join('\n');
      const updated = await api.assessSessionWithAi(selectedExecutedSession.id, extraNotes);
      onSessionUpdated?.(updated);
    } catch (err) {
      setPortalModal({
        isOpen: true,
        title: 'AI Assessment Failed',
        message: err instanceof Error ? err.message : 'AI assessment failed. Please try again.',
        type: 'warning',
        confirmLabel: 'OK',
        onConfirm: () => setPortalModal(null)
      });
    } finally {
      setEvaluatingSession(false);
    }
  };
  const handleAdoptEvaluationDrill = (drillItem: any) => {
    const newDrill: Drill = {
      id: 'drill-rec-' + Date.now(),
      title: drillItem.title,
      discipline: drillItem.discipline,
      skillSet: 'Post-Session Remediation',
      contextType: drillItem.context,
      duration: drillItem.durationMinutes,
      source: 'AI_RECOMMENDED',
      instructions: drillItem.reason
    };
    onAddClubDrill(newDrill);
    setPortalModal({
      isOpen: true,
      title: 'Drill Adopted into Academy',
      message: `Drill "${drillItem.title}" has been successfully adopted into your club training catalogue!`,
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
      ageGroup: inviteRole === 'COACH' ? '' : inviteAgeGroup,
      discipline: chosenDisciplines.join(', '),
      invitationStatus: 'PENDING_ACCEPTANCE',
      currentLevel: inviteRole === 'COACH' ? inviteCoachLevel : 'FOUNDATION',
      squad: inviteRole === 'COACH' ? 'Unassigned' : inviteSquad
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
          <p>An official onboarding link has been dispatched via email to <strong className="text-sky-400">{newMem.email}</strong>.</p>
          <p className="text-xs text-slate-400">
            Role: <strong className="text-white">{newMem.role}</strong> • Disciplines: <strong className="text-sky-300">{newMem.discipline}</strong>
            {newMem.role === 'COACH'
              ? <> • Level: <strong className="text-emerald-300">{newMem.currentLevel}</strong></>
              : <> • Age Group: {newMem.ageGroup} • Assigned Squad: {newMem.squad}</>}
          </p>
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

  const toggleEditMemberDiscipline = (disc: Discipline) => {
    setEditMemberDisciplines(prev => {
      if (prev.includes(disc)) {
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
      if (mem.role !== rosterRoleFilter) return false;
      // Status filter
      if (rosterStatusFilter === 'ACTIVE' && mem.invitationStatus !== 'ACTIVE') return false;
      if (rosterStatusFilter === 'PENDING' && mem.invitationStatus !== 'PENDING_ACCEPTANCE') return false;
      // Age group filter
      if (rosterAgeGroupFilter !== 'ALL' && mem.role === 'PLAYER' && mem.ageGroup !== rosterAgeGroupFilter) return false;
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

  // Adopts an AI-recommended drill from a video analysis result into the club's drill catalogue,
  // AND automatically incorporates it into the player's actual squad training plan: it's tagged
  // with the player's current squad, and (if that squad has an upcoming/unpublished session)
  // it's counted into that session's drill itinerary rather than just sitting in a generic list.
  const adoptAiDrillForPlayer = (
    playerId: string | null,
    aiDrill: { title: string; discipline: string; durationMinutes: number; context: string }
  ) => {
    const player = playerId ? clubMembers.find(m => m.id === playerId) : undefined;
    const squad = player ? squads.find(sq => sq.name === player.squad) : undefined;
    const targetSession = squad
      ? sessions
          .filter(s => s.squadName === squad.name && !s.isPublished)
          .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))[0]
      : undefined;

    const newDrill: Drill = {
      id: 'drill-club-ai-' + Date.now(),
      title: aiDrill.title,
      discipline: aiDrill.discipline as Discipline,
      skillSet: 'Biomechanical Correction',
      contextType: aiDrill.context as ContextType,
      duration: aiDrill.durationMinutes,
      source: 'AI_RECOMMENDED',
      clubName,
      squadId: squad?.id || null,
      squadName: squad?.name || null,
      instructions: 'Generated via Club AI video pose analysis.'
    };
    onAddClubDrill(newDrill);
    if (targetSession) {
      onAddDrillToSession?.(targetSession.id);
    }

    const message = squad
      ? (targetSession
          ? `"${aiDrill.title}" has been added to ${clubName}'s drill catalogue for ${squad.name} and incorporated into the upcoming "${targetSession.title}" session (${targetSession.sessionDate}).`
          : `"${aiDrill.title}" has been added to ${clubName}'s drill catalogue for ${squad.name}. There's no upcoming unpublished session for this squad yet — it will be ready to include next time you schedule one.`)
      : `"${aiDrill.title}" has been added to ${clubName}'s drill catalogue. This player isn't assigned to a squad yet, so assign one to automatically incorporate future drills into their squad's sessions.`;

    return message;
  };

  const openEditSquad = (sq: Squad) => {
    setEditingSquadId(sq.id);
    setSquadFormName(sq.name);
    setSquadFormAgeGroup(sq.ageGroup);
    setSquadFormDisciplines(sq.discipline.length ? sq.discipline : ['BOWLING']);
    setSquadPanelAgeGroupFilter('ALL');
    setSquadPanelDisciplineFilter('ALL');
    setSquadPanelSearchTerm('');
    setIsSquadModalOpen(true);
  };

  const closeSquadModal = () => {
    setIsSquadModalOpen(false);
    setEditingSquadId(null);
    setSquadFormName('');
  };

  const promptDeleteSquad = (squad: Squad) => {
    setPortalModal({
      isOpen: true,
      title: 'Delete Squad',
      message: (
        <div className="space-y-2">
          <p>Delete squad <strong className="text-white">"{squad.name}"</strong> ({squad.ageGroup} • {formatDisciplines(squad.discipline)})?</p>
          <p className="text-xs text-slate-400">
            This action cannot be undone. {squad.memberCount > 0 ? `${squad.memberCount} assigned player(s) will become unassigned.` : ''}
          </p>
        </div>
      ),
      type: 'danger',
      confirmLabel: 'Delete Squad',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setPortalModal(null);
        clubMembers
          .filter(m => m.squad === squad.name)
          .forEach(m => onUpdateMemberSquad?.(m.id, 'Unassigned'));
        onDeleteSquad?.(squad.id);
        if (editingSquadId === squad.id) {
          closeSquadModal();
        }
      }
    });
  };

  const handleSquadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadFormName.trim() || squadFormDisciplines.length === 0) return;

    if (editingSquadId) {
      const updates: Partial<Squad> = {
        name: squadFormName.trim(),
        ageGroup: squadFormAgeGroup,
        discipline: squadFormDisciplines
      };
      onUpdateSquad?.(editingSquadId, updates);
      closeSquadModal();
      setPortalModal({
        isOpen: true,
        title: 'Squad Updated Successfully',
        message: `Squad "${updates.name}" (${updates.ageGroup} - ${updates.discipline?.join(', ')}) has been updated.`,
        type: 'success',
        confirmLabel: 'Done',
        onConfirm: () => setPortalModal(null)
      });
      return;
    }

    const newSquad: Squad = {
      id: 'sq-' + Date.now(),
      name: squadFormName.trim(),
      ageGroup: squadFormAgeGroup,
      discipline: squadFormDisciplines,
      memberCount: 0
    };
    onAddSquad(newSquad);
    closeSquadModal();
    setPortalModal({
      isOpen: true,
      title: 'Squad Created Successfully',
      message: `Squad "${newSquad.name}" (${newSquad.ageGroup} - ${newSquad.discipline.join(', ')}) is now active.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSessionSaving) return;
    setSessionSaveError('');
    if (!sessionFormTitle.trim() || !sessionFormDate) return;
    if (sessionFormTargetType === 'PLAYERS' && sessionFormPlayerIds.length === 0) return;

    const targetLabel = sessionFormTargetType === 'SQUAD'
      ? sessionFormSquad
      : `Individual: ${sessionFormPlayerIds
          .map(id => clubMembers.find(m => m.id === id)?.name)
          .filter(Boolean)
          .join(', ')}`;
    const assignedPlayerIds = sessionFormTargetType === 'SQUAD'
      ? clubMembers
          .filter(member => member.role === 'PLAYER' && member.squad === sessionFormSquad)
          .map(member => member.id)
      : sessionFormPlayerIds;
    const headCoach = activeClubCoaches.find(coach => coach.id === sessionFormCoachId);
    const coordinatorCoach = activeClubCoaches.find(coach => coach.id === sessionFormCoordinatorId);
    const assistantCoach = activeClubCoaches.find(coach => coach.id === sessionFormAssistantId);
    if (!headCoach) return;
    const selectedSquad = squads.find(squad => squad.id === sessionFormSquadId)
      || squads.find(squad => squad.name === sessionFormSquad);

    if (editingSessionId) {
      const updates: Partial<TrainingSession> = {
        squadId: sessionFormTargetType === 'SQUAD' ? selectedSquad?.id || null : null,
        squadName: targetLabel,
        coachId: headCoach.id,
        coachName: headCoach.name,
        coordinatorCoachId: coordinatorCoach?.id || null,
        coordinatorCoachName: coordinatorCoach?.name || null,
        assistantCoachId: assistantCoach?.id || null,
        assistantCoachName: assistantCoach?.name || null,
        assignedPlayerIds,
        title: sessionFormTitle.trim(),
        sessionDate: sessionFormDate,
        durationMinutes: Number(sessionFormDuration) || 90
      };
      onUpdateSession?.(editingSessionId, updates);
      closeSessionModal();
      setPortalModal({
        isOpen: true,
        title: 'Training Session Updated',
        message: `Session "${updates.title}" for ${updates.squadName} on ${updates.sessionDate} (${updates.durationMinutes} mins) has been updated.`,
        type: 'success',
        confirmLabel: 'Done',
        onConfirm: () => setPortalModal(null)
      });
      return;
    }

    const newSession: TrainingSession = {
      id: 'sess-' + Date.now(),
      squadId: sessionFormTargetType === 'SQUAD' ? selectedSquad?.id || null : null,
      squadName: targetLabel,
      coachId: headCoach.id,
      coachName: headCoach.name,
      coordinatorCoachId: coordinatorCoach?.id || null,
      coordinatorCoachName: coordinatorCoach?.name || null,
      assistantCoachId: assistantCoach?.id || null,
      assistantCoachName: assistantCoach?.name || null,
      assignedPlayerIds,
      title: sessionFormTitle.trim(),
      sessionDate: sessionFormDate,
      durationMinutes: Number(sessionFormDuration) || 90,
      isPublished: false,
      drillCount: sessionFormDrillIds.length,
      drillIds: sessionFormDrillIds
    };
    setIsSessionSaving(true);
    try {
      await onScheduleSession(newSession);
    } catch (error) {
      setSessionSaveError(error instanceof Error ? error.message : 'Unable to schedule training session.');
      return;
    } finally {
      setIsSessionSaving(false);
    }
    closeSessionModal();
    setPortalModal({
      isOpen: true,
      title: 'Training Session Scheduled',
      message: `Session "${newSession.title}" for ${newSession.squadName} on ${newSession.sessionDate} (${newSession.durationMinutes} mins) has been added to drafts.`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setPortalModal(null)
    });
  };

  const openEditSession = (s: TrainingSession) => {
    setEditingSessionId(s.id);
    setSessionFormTitle(s.title);
    setSessionFormCoachId(s.coachId || activeClubCoaches.find(coach => coach.name === s.coachName)?.id || '');
    setSessionFormCoordinatorId(s.coordinatorCoachId || '');
    setSessionFormAssistantId(s.assistantCoachId || '');
    if (s.squadName.startsWith('Individual: ')) {
      const names = s.squadName.replace('Individual: ', '').split(',').map(n => n.trim());
      const ids = clubMembers.filter(m => names.includes(m.name)).map(m => m.id);
      setSessionFormTargetType('PLAYERS');
      setSessionFormSquadId('');
      setSessionFormPlayerIds(ids);
    } else {
      setSessionFormTargetType('SQUAD');
      setSessionFormSquad(s.squadName);
      setSessionFormSquadId(s.squadId || squads.find(squad => squad.name === s.squadName)?.id || '');
      setSessionFormPlayerIds([]);
    }
    setSessionFormDate(s.sessionDate);
    setSessionFormDuration(s.durationMinutes);
    setSessionFormDrillIds(s.drillIds || []);
    setIsSessionModalOpen(true);
  };

  const closeSessionModal = () => {
    setIsSessionModalOpen(false);
    setSessionSaveError('');
    setEditingSessionId(null);
    setSessionFormTitle('');
    setSessionFormCoachId('');
    setSessionFormCoordinatorId('');
    setSessionFormAssistantId('');
    setSessionFormPlayerIds([]);
    setSessionFormDrillIds([]);
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
          <p>Publish session <strong className="text-white">"{session.title}"</strong> scheduled for <span className="text-sky-400 font-medium">{session.sessionDate}</span>?</p>
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

  const promptDeleteSession = (session: TrainingSession) => {
    setPortalModal({
      isOpen: true,
      title: 'Delete Training Session',
      message: (
        <div className="space-y-2">
          <p>Delete session <strong className="text-white">"{session.title}"</strong> scheduled for <span className="text-sky-400 font-medium">{session.sessionDate}</span>?</p>
          <p className="text-xs text-slate-400">This action cannot be undone{session.isPublished ? ' and squad athletes who were already notified will no longer see this session' : ''}.</p>
        </div>
      ),
      type: 'danger',
      confirmLabel: 'Delete Session',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setPortalModal(null);
        onDeleteSession?.(session.id);
      }
    });
  };

  const promptDeleteDrill = (drill: Drill) => {
    setPortalModal({
      isOpen: true,
      title: 'Delete Drill',
      message: (
        <div className="space-y-2">
          <p>Delete drill <strong className="text-white">"{drill.title}"</strong> from the {clubName} catalogue?</p>
          <p className="text-xs text-slate-400">This action cannot be undone. Sessions already referencing this drill count will not be affected.</p>
        </div>
      ),
      type: 'danger',
      confirmLabel: 'Delete Drill',
      cancelLabel: 'Cancel',
      showCancel: true,
      onConfirm: () => {
        setPortalModal(null);
        onDeleteDrill?.(drill.id);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Club Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">{clubName}</h1>
          <span className="text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold">
            {isClubCoach ? 'Club Coach Workspace' : 'Club Admin & Coaching Hub'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {isClubCoach
            ? 'Manage squads, session-based plans, post-session AI evaluations, Google Drive video uploads, and achievement certificates.'
            : 'Manage roster invitations, squad formation, session-based plans, post-session AI evaluations, Google Drive video uploads, and achievement certificates.'}
        </p>
      </div>

      {/* Full-width Navigation Bar directly above the content panel */}
      <div className="w-full rounded-xl bg-slate-900 border border-slate-800 p-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2 shadow-sm">
        {!isClubCoach && (
        <button
          onClick={() => setClubTab('ROSTER')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            clubTab === 'ROSTER' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Roster & Invites</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            clubTab === 'ROSTER' ? 'bg-sky-950 text-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
          }`}>
            {clubMembers.length}
          </span>
        </button>
        )}
        <button
          onClick={() => setClubTab('SQUADS')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            clubTab === 'SQUADS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Squads</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            clubTab === 'SQUADS' ? 'bg-sky-950 text-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
          }`}>
            {squads.length}
          </span>
        </button>
        <button
          onClick={() => setClubTab('SESSIONS')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            clubTab === 'SESSIONS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Training Sessions</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            clubTab === 'SESSIONS' ? 'bg-emerald-950 text-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            {sessions.length}
          </span>
        </button>
        <button
          onClick={() => setClubTab('CLUB_DRILLS')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'CLUB_DRILLS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Club Drills</span>
        </button>
        <button
          onClick={() => setClubTab('ASSESSMENTS')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'ASSESSMENTS' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Assessments</span>
        </button>
        <button
          onClick={() => setClubTab('PROGRESSION')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
            clubTab === 'PROGRESSION' ? 'bg-sky-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>Certificates</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-extrabold ${
            clubTab === 'PROGRESSION' ? 'bg-amber-950 text-amber-200' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            {certificates.length}
          </span>
        </button>
        {!isClubCoach && (
          <button
            onClick={() => setClubTab('SETTINGS')}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              clubTab === 'SETTINGS' ? 'bg-slate-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Club Settings</span>
          </button>
        )}
        <button
          onClick={() => setClubTab('VIDEO_ANALYSIS')}
          className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            clubTab === 'VIDEO_ANALYSIS' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>AI Video Analysis</span>
        </button>
      </div>

      {/* Club Sub-tab 1: Roster & Invitations */}
      {!isClubCoach && clubTab === 'ROSTER' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base text-white">Club Roster (Coaches & Players)</h3>
              <p className="text-xs text-slate-400">
                {isClubCoach
                  ? 'View and manage your club coaches and players.'
                  : 'Club admin invites coaches and players by age group. Users log in once they accept the invite.'}
              </p>
            </div>
            {!isClubCoach && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <UserPlus size={14} />
                <span>+ Invite New Coach / Player</span>
              </button>
            )}
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
                      { key: 'COACH', label: 'Staff', count: clubMembers.filter(m => m.role === 'COACH').length, color: 'bg-sky-500/20 text-sky-300 border border-sky-500/30' },
                      { key: 'PLAYER', label: 'Players', count: clubMembers.filter(m => m.role === 'PLAYER').length, color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' }
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setRosterRoleFilter(tab.key as 'COACH' | 'PLAYER');
                          setRosterAgeGroupFilter('ALL');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          rosterRoleFilter === tab.key
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[9px] font-bold ${
                          rosterRoleFilter === tab.key ? 'bg-sky-900 text-sky-200' : tab.color
                        }`}>
                          {tab.count}
                        </span>
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
                            ? 'bg-sky-600 text-white shadow-sm'
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
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
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
                <Filter size={13} className="text-sky-400" />
                <span className="text-xs text-slate-300 font-medium">Discipline:</span>
                <select
                  value={rosterDisciplineFilter}
                  onChange={e => setRosterDisciplineFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="ALL">All Disciplines</option>
                  <option value="BATTING">Batting</option>
                  <option value="BOWLING">Bowling</option>
                  <option value="KEEPING">Wicketkeeping</option>
                  <option value="FIELDING">Fielding</option>
                </select>
              </div>

              {rosterRoleFilter === 'PLAYER' && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300 font-medium">Age Group:</span>
                <select
                  value={rosterAgeGroupFilter}
                  onChange={e => setRosterAgeGroupFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="ALL">All Age Groups</option>
                  {uniqueAgeGroups.map(ag => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>
              )}

              {(rosterRoleFilter !== 'COACH' || rosterStatusFilter !== 'ALL' || rosterAgeGroupFilter !== 'ALL' || rosterDisciplineFilter !== 'ALL' || rosterSearchTerm) && (
                <button
                  onClick={() => {
                    setRosterRoleFilter('COACH');
                    setRosterStatusFilter('ALL');
                    setRosterAgeGroupFilter('ALL');
                    setRosterDisciplineFilter('ALL');
                    setRosterSearchTerm('');
                  }}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 underline cursor-pointer ml-auto"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {[
                { key: 'STAFF', title: 'Club Members (Coaches & Staff)', isPlayers: false, rows: filteredClubMembers.filter(m => m.role !== 'PLAYER') },
                { key: 'PLAYERS', title: 'Players', isPlayers: true, rows: filteredClubMembers.filter(m => m.role === 'PLAYER') }
              ]
                .filter(section => (rosterRoleFilter === 'PLAYER') === section.isPlayers)
                .map(section => (
              <div key={section.key} className="w-full space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">{section.title}</h4>
                  <span className="text-[10px] font-bold text-slate-400">{section.rows.length}</span>
                </div>
                <table className="w-full text-left text-[11px] xl:text-xs border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                      <th className="py-2.5 px-2">Name / Email</th>
                      <th className="py-2.5 px-1.5">Role</th>
                      <th className="py-2.5 px-1.5">Discipline</th>
                      {section.isPlayers && <th className="py-2.5 px-1.5">Age</th>}
                      {section.isPlayers && <th className="py-2.5 px-2">Assigned Squad</th>}
                      <th className="py-2.5 px-1.5">Level</th>
                      {section.isPlayers && <th className="py-2.5 px-1.5 whitespace-nowrap">Latest Rating</th>}
                      <th className="py-2.5 px-1.5">Status</th>
                      <th className="py-2.5 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {section.rows.length === 0 ? (
                      <tr>
                        <td colSpan={section.isPlayers ? 9 : 6} className="py-6 text-center text-slate-400">
                          {section.isPlayers ? 'No players match' : 'No club members match'} the selected filters or search terms.
                        </td>
                      </tr>
                    ) : (
                      section.rows.map(mem => (
                    <tr key={mem.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-2">
                        <p className="font-semibold text-white leading-tight">{mem.name}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px] xl:max-w-none">{mem.email}</p>
                      </td>
                      <td className="py-2 px-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          mem.role === 'COACH' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {mem.role}
                        </span>
                      </td>
                      <td className="py-2 px-1.5">
                        <div className="flex flex-wrap gap-0.5">
                          {(mem.discipline || 'BATTING').split(',').map((d, i) => {
                            const trimmed = d.trim().toUpperCase();
                            const discColor =
                              trimmed === 'BATTING' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                              trimmed === 'BOWLING' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' :
                              trimmed === 'KEEPING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                              'bg-sky-500/20 text-sky-300 border-sky-500/30';
                            return (
                              <span
                                key={i}
                                className={`px-1 py-0.5 rounded text-[9px] font-medium border leading-none ${discColor}`}
                              >
                                {trimmed}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      {section.isPlayers && <td className="py-2 px-1.5 text-slate-300 text-[10px] whitespace-nowrap">{mem.ageGroup}</td>}
                      {section.isPlayers && <td className="py-2 px-2 text-slate-400 text-[10px] max-w-[130px] truncate" title={mem.squad}>{mem.squad}</td>}
                      <td className="py-2 px-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[9px] font-medium border border-slate-700 whitespace-nowrap">
                          {mem.currentLevel}
                        </span>
                      </td>
                      {section.isPlayers && <td className="py-2 px-1.5 whitespace-nowrap">
                        {latestRatings[mem.id] ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenAssessmentId(latestRatings[mem.id].assessmentId);
                              setClubTab('ASSESSMENTS');
                            }}
                            title={`View assessment details (${latestRatings[mem.id].date.slice(0, 10)})`}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer hover:brightness-125 transition ${
                              latestRatings[mem.id].average >= 4 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                              latestRatings[mem.id].average >= 3 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                              'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            <Star className="h-3 w-3" />
                            {latestRatings[mem.id].average.toFixed(1)}/5
                          </button>
                        ) : (
                          <span className="text-slate-500">Not rated</span>
                        )}
                      </td>}
                      <td className="py-2 px-1.5">
                        {mem.invitationStatus === 'ACTIVE' ? (
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                            Accepted
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditMemberModal(mem)}
                            title="Edit member details"
                            aria-label="Edit member details"
                            className="inline-flex items-center justify-center h-6 w-6 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded cursor-pointer transition shrink-0"
                          >
                            <Pencil size={11} />
                          </button>
                          {!isClubCoach && mem.invitationStatus === 'PENDING_ACCEPTANCE' && (
                            <button
                              onClick={() => promptAcceptInvite(mem)}
                              className="inline-flex items-center justify-center gap-1 h-6 px-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-semibold cursor-pointer transition shadow-sm whitespace-nowrap"
                            >
                              <CheckCircle2 size={11} />
                              <span>Accept</span>
                            </button>
                          )}
                          {mem.role === 'PLAYER' && (
                            <>
                              <button
                                onClick={() => promptPromotePlayer(mem)}
                                title="Promote player to next competency level and issue certificate"
                                className="inline-flex items-center justify-center gap-1 h-6 px-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded text-[10px] font-semibold cursor-pointer transition shadow-sm whitespace-nowrap"
                              >
                                <Award size={11} />
                                <span>Promote</span>
                              </button>
                            </>
                          )}
                          {mem.role === 'COACH' && mem.invitationStatus === 'ACTIVE' && (
                            <span className="inline-flex items-center justify-center h-6 px-1.5 text-[10px] text-slate-500 font-medium whitespace-nowrap">
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
            ))}
        </div>
      )}

      {/* Club Sub-tab 2: Squads Formation */}
      {clubTab === 'SQUADS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-white">Club Squads & Player Groups</h3>
              <p className="text-xs text-slate-400">
                Coaches organise players into discipline-based squads to model training plans.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSquadId(null);
                setSquadFormName('');
                setSquadFormAgeGroup('U15');
                setSquadFormDisciplines(['BOWLING']);
                setSquadPanelAgeGroupFilter('ALL');
                setSquadPanelDisciplineFilter('ALL');
                setSquadPanelSearchTerm('');
                setIsSquadModalOpen(true);
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
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
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-bold">
                    {sq.ageGroup}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Disciplines: <span className="text-emerald-400">{formatDisciplines(sq.discipline)}</span></p>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{sq.memberCount} Squad Members</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditSquad(sq)}
                      type="button"
                      title="Edit squad"
                      aria-label="Edit squad"
                      className="inline-flex h-7 w-7 items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 transition cursor-pointer"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => promptDeleteSquad(sq)}
                      type="button"
                      title="Delete squad"
                      aria-label="Delete squad"
                      className="inline-flex h-7 w-7 items-center justify-center bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded border border-rose-500/30 transition cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Club Sub-tab 3: Session-Based Training Plans & Post-Session AI Notes */}
      {clubTab === 'SESSIONS' && (
        <div className="space-y-6">
          {/* Published / Scheduled Sessions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-white">Session-Based Training Schedule</h3>
                <p className="text-xs text-slate-400">Publish training to notify squad athletes.</p>
              </div>
              <button
                onClick={() => {
                  setEditingSessionId(null);
                  setSessionFormTitle('');
                  setSessionFormTargetType('SQUAD');
                  setSessionFormSquad(squads[0]?.name || '');
                  setSessionFormSquadId(squads[0]?.id || '');
                  setSessionFormCoachId(activeClubCoaches[0]?.id || '');
                  setSessionFormCoordinatorId('');
                  setSessionFormAssistantId('');
                  setSessionFormPlayerIds([]);
                  setSessionFormDrillIds([]);
                  setIsSessionModalOpen(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Calendar size={14} />
                <span>+ Schedule Session</span>
              </button>
            </div>

            {sessionNotesError && !isSessionReviewOpen && (
              <p role="alert" className="text-xs text-rose-400">{sessionNotesError}</p>
            )}
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="session-name-filter" className="block text-xs font-semibold text-slate-300 mb-1.5">Session name</label>
                  <input
                    id="session-name-filter"
                    type="search"
                    value={sessionNameFilter}
                    onChange={event => setSessionNameFilter(event.target.value)}
                    placeholder="Search session name..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="session-start-date-filter" className="block text-xs font-semibold text-slate-300 mb-1.5">From date</label>
                  <input
                    id="session-start-date-filter"
                    type="date"
                    value={sessionStartDateFilter}
                    onChange={event => setSessionStartDateFilter(event.target.value)}
                    aria-invalid={isSessionDateRangeInvalid}
                    aria-describedby={isSessionDateRangeInvalid ? 'session-date-filter-error' : undefined}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="session-end-date-filter" className="block text-xs font-semibold text-slate-300 mb-1.5">To date</label>
                  <input
                    id="session-end-date-filter"
                    type="date"
                    value={sessionEndDateFilter}
                    onChange={event => setSessionEndDateFilter(event.target.value)}
                    aria-invalid={isSessionDateRangeInvalid}
                    aria-describedby={isSessionDateRangeInvalid ? 'session-date-filter-error' : undefined}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label htmlFor="session-status-filter" className="block text-xs font-semibold text-slate-300 mb-1.5">Status</label>
                  <select
                    id="session-status-filter"
                    value={sessionStatusFilter}
                    onChange={event => setSessionStatusFilter(event.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published (not executed)</option>
                    <option value="EXECUTED">Executed</option>
                  </select>
                </div>
              </div>
              {isSessionDateRangeInvalid && (
                <p id="session-date-filter-error" role="alert" className="text-xs text-rose-400">From date must be on or before To date.</p>
              )}
              <div className="flex items-center justify-between gap-3">
                <p role="status" className="text-xs text-slate-400">Showing {filteredSessions.length} of {sessions.length} sessions</p>
                <button type="button" onClick={clearSessionFilters} className="text-xs font-semibold text-sky-400 hover:text-sky-300 underline cursor-pointer">Clear filters</button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {sessions.length === 0 && (
                <div className="lg:col-span-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center space-y-1">
                  <p className="text-sm font-semibold text-white">No training sessions scheduled yet</p>
                  <p className="text-xs text-slate-400">Use “+ Schedule Session” above to create the first one.</p>
                </div>
              )}
              {sessions.length > 0 && filteredSessions.length === 0 && !isSessionDateRangeInvalid && (
                <div className="lg:col-span-2 rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center space-y-1">
                  <p className="text-sm font-semibold text-white">No training sessions match these filters</p>
                  <p className="text-xs text-slate-400">Try a different name, date range, or status, or clear the filters.</p>
                </div>
              )}
              {filteredSessions.map(s => (
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
                  {s.coachName && <p className="text-xs text-slate-400">Head Coach: <span className="text-white">{s.coachName}</span></p>}
                  {s.coordinatorCoachName && <p className="text-xs text-slate-400">Coordinator: <span className="text-white">{s.coordinatorCoachName}</span></p>}
                  {s.assistantCoachName && <p className="text-xs text-slate-400">Assistant Coach: <span className="text-white">{s.assistantCoachName}</span></p>}
                  <p className="text-xs text-slate-400">Date: <span className="text-sky-400 font-semibold">{s.sessionDate}</span> • Duration: {s.durationMinutes} mins</p>
                  {s.drillIds && s.drillIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {s.drillIds.map((drillId, idx) => {
                        const d = drills.find(dr => dr.id === drillId);
                        return (
                          <span
                            key={`${drillId}-${idx}`}
                            className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/30 pl-2 pr-1 py-0.5 rounded-full"
                          >
                            {d?.title || 'Unknown Drill'}
                            <button
                              type="button"
                              onClick={() => onRemoveDrillFromSession?.(s.id, drillId)}
                              title="Remove this drill from the session"
                              aria-label="Remove this drill from the session"
                              className="hover:bg-rose-500 hover:text-white rounded-full p-0.5 transition cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-slate-500">{s.drillCount} Planned Drills</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openEditSession(s)}
                        type="button"
                        title="Edit training session"
                        aria-label="Edit training session"
                        className="inline-flex h-7 w-7 items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 transition cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => promptDeleteSession(s)}
                        type="button"
                        title="Delete training session"
                        aria-label="Delete training session"
                        className="inline-flex h-7 w-7 items-center justify-center bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded border border-rose-500/40 transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
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
                      {s.isExecuted ? (
                        <span className="text-xs text-sky-300 font-semibold">Executed</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkSessionExecuted(s)}
                          disabled={executingSessionId === s.id}
                          className="text-xs px-3 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-semibold rounded border border-sky-500/30 disabled:opacity-50"
                        >
                          {executingSessionId === s.id ? 'Saving...' : 'Mark as Executed'}
                        </button>
                      )}
                      {(s.isExecuted || s.sessionDate < todayDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExecutedSessionId(s.id);
                            setFocusedSessionPlayerId(null);
                            setIsSessionReviewOpen(true);
                          }}
                          aria-label={`Review ${s.title}`}
                          className="text-xs px-3 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-semibold rounded border border-sky-500/30 cursor-pointer"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isSessionReviewOpen && selectedExecutedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div
            ref={sessionReviewRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-review-title"
            tabIndex={-1}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsSessionReviewOpen(false)}
              aria-label="Close session review"
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="pr-8">
              <h3 id="session-review-title" className="font-semibold text-base text-white">Executed Session Player Notes & AI Review</h3>
              <p className="text-xs text-slate-400">
                Review and save notes for each assigned player. You can also run the session-wide AI review once the session is completed.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="text-sm font-semibold text-white">{selectedExecutedSession.title}</p>
                <p className="text-xs text-slate-400">{selectedExecutedSession.squadName} · {selectedExecutedSession.sessionDate}</p>
              </div>

              {focusedSessionPlayer && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                  <p className="text-xs text-sky-300">
                    Showing <span className="font-bold">{focusedSessionPlayer.name}</span>'s notes and feedback only
                  </p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { setIsSessionReviewOpen(false); setClubTab('ASSESSMENTS'); }} className="text-xs font-semibold text-sky-400 underline hover:text-sky-300">Back to assessment</button>
                    <button type="button" onClick={() => setFocusedSessionPlayerId(null)} className="text-xs font-semibold text-sky-400 underline hover:text-sky-300">Show all players</button>
                  </div>
                </div>
              )}

              {sessionNotesError && (
                <p role="alert" className="text-xs text-rose-400">{sessionNotesError}</p>
              )}

              {selectedExecutedSession && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">
                    Player notes — {selectedExecutedSession.squadName}
                  </h4>
                  {selectedSessionPlayers.length === 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                      <p className="text-xs text-amber-200">
                        This legacy session has no saved player assignment. Attach a roster player to add their session notes.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={legacyPlayerId}
                          onChange={event => setLegacyPlayerId(event.target.value)}
                          className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                        >
                          <option value="">Select a player</option>
                          {clubMembers.filter(member => member.role === 'PLAYER').map(player => (
                            <option key={player.id} value={player.id}>{player.name} — {player.squad}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAttachLegacyPlayer}
                          disabled={!legacyPlayerId || attachingLegacyPlayer}
                          className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs font-semibold rounded-lg border border-amber-500/30 disabled:opacity-50"
                        >
                          {attachingLegacyPlayer ? 'Attaching...' : 'Attach player'}
                        </button>
                      </div>
                    </div>
                  ) : selectedSessionPlayers.map(player => (
                    <div key={player.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                      <label htmlFor={`session-note-${player.id}`} className="block text-xs font-semibold text-white">
                        {player.name}
                      </label>
                      <textarea
                        id={`session-note-${player.id}`}
                        rows={2}
                        value={playerNoteDrafts[player.id] ?? selectedExecutedSession.playerNotes?.[player.id] ?? ''}
                        onChange={event => {
                          setSavedPlayerNoteId(null);
                          setPlayerNoteDrafts(previous => ({
                            ...previous,
                            [player.id]: event.target.value
                          }));
                        }}
                        placeholder={`Add post-session notes for ${player.name}...`}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleSavePlayerNote(player.id)}
                          disabled={savingPlayerNoteId === player.id}
                          className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-xs font-semibold rounded border border-sky-500/30 disabled:opacity-50"
                        >
                          {savingPlayerNoteId === player.id ? 'Saving...' : savedPlayerNoteId === player.id ? 'Saved' : 'Save note'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label htmlFor="session-wide-ai-notes" className="block text-xs font-semibold text-slate-300">
                Optional session-wide notes for AI review
              </label>
              <textarea
                id="session-wide-ai-notes"
                rows={4}
                value={activeSessionNotes}
                onChange={e => setActiveSessionNotes(e.target.value)}
                placeholder="e.g. Arjun Tendulkar seam presentation was consistent, but front-foot drive balance had head falling over to off-side during simulation..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500"
              />

              <div className="flex items-center gap-2">
                <button
                  onClick={handleEvaluatePostSession}
                  disabled={evaluatingSession || !selectedExecutedSession?.isExecuted}
                  title={selectedExecutedSession?.isExecuted ? undefined : 'The session must be completed first'}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {evaluatingSession ? 'AI Evaluating Notes...' : sessionAiResult ? 'Re-run Post-Session AI Assessment' : 'Run Post-Session AI Assessment'}
                </button>
                {!selectedExecutedSession?.isExecuted && (
                  <span className="text-xs text-slate-500">Available once the coach completes the session.</span>
                )}
              </div>

              {sessionAiResult && (
                <div className="p-4 rounded-lg bg-slate-950 border border-sky-500/40 space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400 uppercase">AI Diagnosis</span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-bold">
                      {String(sessionAiResult.progressionReadiness || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{sessionAiResult.squadSummary}</p>
                  {sessionAiResult.generatedAt && (
                    <p className="text-[10px] text-slate-500">Generated by Gemini on {new Date(sessionAiResult.generatedAt).toLocaleString()}</p>
                  )}

                  {Array.isArray(sessionAiResult.identifiedGaps) && sessionAiResult.identifiedGaps.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-1">Identified Gaps:</p>
                      <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                        {sessionAiResult.identifiedGaps.map((gap: string, idx: number) => <li key={idx}>{gap}</li>)}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(sessionAiResult.playerFeedback) && sessionAiResult.playerFeedback.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-1">Player Focus:</p>
                      <ul className="text-[11px] text-slate-300 space-y-0.5">
                        {sessionAiResult.playerFeedback
                          .filter((item: any) => !focusedSessionPlayer || item.playerName === focusedSessionPlayer.name)
                          .map((item: any, idx: number) => (
                          <li key={idx}><span className="font-semibold text-white">{item.playerName}:</span> {item.focus}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(sessionAiResult.sessionImprovements) && sessionAiResult.sessionImprovements.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 mb-1">Improve the Next Session:</p>
                      <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                        {sessionAiResult.sessionImprovements.map((item: string, idx: number) => <li key={idx}>{item}</li>)}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-1">Recommended Tailored Top-Up Drills:</p>
                    <div className="space-y-2">
                      {(sessionAiResult.tailoredRecommendedDrills || []).map((d: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-white">{d.title}</p>
                            <p className="text-[11px] text-slate-400 mt-1">{d.durationMinutes} mins • {d.reason}</p>
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
                    💬 <span className="font-semibold text-white">AI Commendation:</span> {sessionAiResult.aiCommendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {clubTab === 'ASSESSMENTS' && (
        <PlayerAssessments currentUser={currentUser} members={clubMembers} sessions={sessions} initialAssessmentId={openAssessmentId}
          onViewTrainingSession={(sessionId, playerId) => {
            setSelectedExecutedSessionId(sessionId);
            setFocusedSessionPlayerId(playerId);
            setClubTab('SESSIONS');
            setIsSessionReviewOpen(true);
          }}
        />
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
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
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
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
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
                <label className="text-xs text-slate-400">Setup Instructions</label>
                <textarea
                  rows={2}
                  value={newDrillInstructions}
                  onChange={e => setNewDrillInstructions(e.target.value)}
                  placeholder="Equipment needed, cone/marker placement, station rotation cues..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Setup Image (optional)</label>
                <input
                  ref={newDrillImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) readImageFileAsDataUrl(file, setNewDrillImage);
                  }}
                  className="w-full mt-1 text-[11px] text-slate-400 file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
                {newDrillImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={newDrillImage} alt="Drill setup preview" className="max-h-28 rounded-lg border border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setNewDrillImage(null);
                        if (newDrillImageInputRef.current) newDrillImageInputRef.current.value = '';
                      }}
                      className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-400 text-white rounded-full p-1 transition cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded transition"
              >
                Save Club Drill
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-white">Available Drill Catalogue</h3>
                <p className="text-xs text-slate-400">Includes official pre-defined drills & MCA custom drills.</p>
              </div>
              <span className="text-xs bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded-full font-semibold">
                {drills.length} Total Drills
              </span>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {drills.map(drill => (
                <div key={drill.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3">
                  {drill.imageUrl && (
                    <img
                      src={drill.imageUrl}
                      alt={`${drill.title} setup`}
                      className="w-14 h-14 object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{drill.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        drill.source === 'SYSTEM_PREDEFINED' ? 'bg-emerald-500/20 text-emerald-300' :
                        drill.source === 'CLUB_CUSTOM' ? 'bg-sky-500/20 text-sky-300' :
                        'bg-sky-500/20 text-sky-300'
                      }`}>
                        {drill.source === 'SYSTEM_PREDEFINED' ? 'Pre-defined' : drill.source === 'CLUB_CUSTOM' ? 'Club Custom' : 'AI Ingested'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{drill.instructions}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {drill.duration} mins • {drill.discipline} • {drill.skillSet} • {drill.contextType}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditDrill(drill)}
                      title="Edit drill"
                      aria-label="Edit drill"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 transition cursor-pointer"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => promptDeleteDrill(drill)}
                      title="Delete drill"
                      aria-label="Delete drill"
                      className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white rounded border border-rose-500/40 transition cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Drill Modal: update any drill's details, setup instructions, and setup reference image. */}
      {editingDrill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeEditDrill}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white">Edit Drill</h3>
              <p className="text-xs text-slate-400 mt-1">Update this drill's details, setup instructions, and reference image.</p>
            </div>
            <form onSubmit={handleUpdateDrillSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-xs text-slate-400">Drill Title</label>
                <input
                  type="text"
                  required
                  value={editDrillTitle}
                  onChange={e => setEditDrillTitle(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Discipline</label>
                  <select
                    value={editDrillDiscipline}
                    onChange={e => setEditDrillDiscipline(e.target.value as Discipline)}
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
                    value={editDrillContext}
                    onChange={e => setEditDrillContext(e.target.value as ContextType)}
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
                  value={editDrillSkillSet}
                  onChange={e => setEditDrillSkillSet(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={editDrillDuration}
                  onChange={e => setEditDrillDuration(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Setup Instructions</label>
                <textarea
                  rows={2}
                  value={editDrillInstructions}
                  onChange={e => setEditDrillInstructions(e.target.value)}
                  placeholder="Equipment needed, cone/marker placement, station rotation cues..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Setup Image (optional)</label>
                <input
                  ref={editDrillImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) readImageFileAsDataUrl(file, setEditDrillImage);
                  }}
                  className="w-full mt-1 text-[11px] text-slate-400 file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
                {editDrillImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={editDrillImage} alt="Drill setup preview" className="max-h-28 rounded-lg border border-slate-800" />
                    <button
                      type="button"
                      onClick={() => {
                        setEditDrillImage(null);
                        if (editDrillImageInputRef.current) editDrillImageInputRef.current.value = '';
                      }}
                      className="absolute -top-2 -right-2 bg-rose-500 hover:bg-rose-400 text-white rounded-full p-1 transition cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeEditDrill}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
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
            <span className="text-xs bg-sky-500/20 text-sky-300 px-2.5 py-1 rounded font-bold border border-sky-500/30">
              {filteredCertificates.length} of {certificates.length} Certificates
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-3">
            <div>
              <label htmlFor="certificate-name-filter" className="mb-1 block text-[11px] font-semibold text-slate-400">Player name</label>
              <input
                id="certificate-name-filter"
                type="search"
                value={certificateNameFilter}
                onChange={event => setCertificateNameFilter(event.target.value)}
                placeholder="Search player name"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="certificate-start-date" className="mb-1 block text-[11px] font-semibold text-slate-400">Issued from</label>
              <input
                id="certificate-start-date"
                type="date"
                value={certificateStartDateFilter}
                onChange={event => setCertificateStartDateFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="certificate-end-date" className="mb-1 block text-[11px] font-semibold text-slate-400">Issued through</label>
              <input
                id="certificate-end-date"
                type="date"
                value={certificateEndDateFilter}
                onChange={event => setCertificateEndDateFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCertificates.map(cert => (
              <div key={cert.id} className="p-5 rounded-xl bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-amber-500/40 relative shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                    Certificate of Achievement
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono">#{cert.certificateNumber}</span>
                    <button
                      type="button"
                      onClick={() => downloadCertificatePdf(cert)}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20"
                      aria-label={`Download ${cert.playerName}'s certificate PDF`}
                    >
                      <Download size={12} />
                      PDF
                    </button>
                    {!isClubCoach && (
                      <button
                        type="button"
                        onClick={() => confirmDeleteCertificate(cert)}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20"
                        aria-label={`Delete ${cert.playerName}'s certificate`}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-center py-2 border-y border-slate-800/80">
                  {cert.clubLogo && <img src={cert.clubLogo} alt={`${cert.clubName || clubName} logo`} className="mx-auto mb-2 h-12 max-w-24 object-contain" />}
                  <p className="text-xs font-semibold text-slate-300">{cert.clubName || clubName}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">This certifies that</p>
                  <h4 className="text-xl font-extrabold text-white mt-0.5">{cert.playerName}</h4>
                  <p className="text-xs text-emerald-400 font-semibold mt-1">
                    Has successfully advanced to <span className="underline">{cert.achievedLevel}</span> in {cert.discipline}
                  </p>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1">
                  <p><span className="font-semibold text-slate-400">Coach Notes:</span> {cert.coachNotes}</p>
                  {cert.aiCommendation && <p><span className="font-semibold text-slate-400">AI Verification:</span> {cert.aiCommendation}</p>}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Issued: {cert.issuedDate}</span>
                  <span>Certified by Coach: {cert.coachName}</span>
                </div>
              </div>
            ))}
          </div>
          {filteredCertificates.length === 0 && (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-xs text-slate-400">
              {certificates.length ? 'No certificates match these filters.' : 'No certificates have been issued yet.'}
            </p>
          )}
        </div>
      )}

      {!isClubCoach && clubTab === 'SETTINGS' && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-base text-white">Club Branding</h3>
            <p className="text-xs text-slate-400 mt-1">The saved logo appears on certificates issued from this point onward.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex h-24 w-36 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900 p-2">
              {clubLogo
                ? <img src={clubLogo} alt={`${clubName} logo preview`} className="max-h-full max-w-full object-contain" />
                : <span className="text-xs text-slate-500">No club logo uploaded</span>}
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400">
                <Upload size={14} />
                {clubLogo ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/png,image/jpeg" onChange={handleClubLogoSelected} className="sr-only" disabled={isSavingBranding} />
              </label>
              {clubLogo && (
                <button type="button" onClick={() => void saveClubLogo(null)} disabled={isSavingBranding} className="ml-2 text-xs font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-50">
                  Remove logo
                </button>
              )}
              <p className="text-[11px] text-slate-500">PNG or JPEG, maximum 1 MB. Logo changes apply to newly issued certificates.</p>
              {isSavingBranding && <p role="status" className="text-xs text-sky-300">Saving club logo...</p>}
              {brandingMessage && <p role="status" className="text-xs text-slate-300">{brandingMessage}</p>}
            </div>
          </div>
        </section>
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
                Analyse batting & bowling actions across {clubName} athletes to detect flaws and prescribe corrective drills.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sync with Athlete Vault:</span>
              <button
                onClick={async () => {
                  if (!isDriveConnected) {
                    setIsDriveModalOpen(true);
                    return;
                  }
                  setIsSyncingDriveTab(true);
                  await fetchDriveVideos('TAB');
                  setIsSyncingDriveTab(false);
                }}
                disabled={isSyncingDriveTab}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
              >
                <Cloud className="w-4 h-4 text-sky-400" />
                <span>{isDriveConnected ? 'Sync with Google Drive' : 'Connect Google Drive'}</span>
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
                    setUploadedVideoFile(null);
                    setUploadError(null);
                    setDriveBackupStatus('IDLE');
                    setClubAnalysisResult(null);
                    setLastAnalysisId(null);
                    setViewingAnalysisId(null);
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
                    onClick={() => {
                      setVideoSourceMode('LOCAL_UPLOAD');
                      setUploadError(null);
                    }}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      videoSourceMode === 'LOCAL_UPLOAD'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Device Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadError(null);
                      if (!isDriveConnected) {
                        setIsDriveModalOpen(true);
                        return;
                      }
                      setVideoSourceMode('GOOGLE_DRIVE');
                    }}
                    className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      videoSourceMode === 'GOOGLE_DRIVE'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Sync from Google Drive</span>
                    {isDriveConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                  </button>
                </div>
              </div>

              {videoSourceMode === 'LOCAL_UPLOAD' ? (
                /* Direct Video Upload Dropzone */
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('video/')) {
                        setUploadError('Invalid file type! Please select a valid video file (MP4, MOV, WEBM, AVI, M4V).');
                        setUploadedVideoName(null);
                        setUploadedVideoFile(null);
                        return;
                      }
                      setUploadError(null);
                      setUploadedVideoName(file.name);
                      setUploadedVideoFile(file);
                      backupLocalVideoToDrive(file, 'TAB');
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
                        <p className="text-xs font-bold text-emerald-400 flex itemscenter justify-center gap-1.5">
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
                          Strictly video only: MP4, MOV, or WEBM clips up to 60 seconds (Front, Side, or 45° angle)
                        </p>
                      </div>
                    )}
                  </div>
                  {uploadError && (
                    <div className="mt-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                  {uploadedVideoName && isDriveConnected && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex items-center gap-2">
                      {isBackingUpToDrive ? (
                        <>
                          <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-sky-400" />
                          <span className="text-slate-300">Backing up to Google Drive{driveEmail ? ` (${driveEmail})` : ''}…</span>
                        </>
                      ) : driveBackupStatus === 'SUCCESS' ? (
                        <>
                          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span className="text-emerald-400">Saved to your connected Google Drive.</span>
                        </>
                      ) : driveBackupStatus === 'ERROR' ? (
                        <>
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span className="text-rose-400">Could not back up to Google Drive. Analysis will still proceed locally.</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-4 h-4 shrink-0 text-sky-400" />
                          <span className="text-slate-400">Will be backed up to Google Drive.</span>
                        </>
                      )}
                    </div>
                  )}
                  {uploadedVideoName && !isDriveConnected && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Not backed up to the cloud.{' '}
                        <button type="button" className="underline font-semibold" onClick={() => setIsDriveModalOpen(true)}>
                          Connect Google Drive
                        </button>{' '}
                        to automatically save device uploads.
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Google Drive Sync Option */
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-sky-400" />
                      <span className="text-xs font-semibold text-white">Google Drive Cloud Vault</span>
                    </div>
                    <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded">
                      {isDriveConnected ? (driveEmail || 'Connected') : 'Not Connected'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsSyncingDriveModal(true);
                        await fetchDriveVideos('MODAL');
                        setIsSyncingDriveModal(false);
                      }}
                      disabled={isSyncingDriveModal}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDriveModal ? 'animate-spin' : ''}`} />
                      <span>{isSyncingDriveModal ? 'Syncing...' : 'Sync Latest Clips from Vault'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium cursor-pointer transition shrink-0"
                      title="Disconnect account to switch accounts or refresh permissions"
                    >
                      Disconnect
                    </button>
                  </div>

                  {driveVideosError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{driveVideosError}</span>
                    </div>
                  )}

                  {/* Video Picker from Connected Drive */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-sky-400" />
                      Select Video from Drive ({driveVideoFiles.length} found):
                    </label>
                    {driveVideoFiles.length === 0 && !driveVideosError ? (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                        No video files loaded yet. Click "Sync Vault" to fetch videos from your Google Drive.
                      </div>
                    ) : (
                      <select
                        value={selectedDriveVideo}
                        onChange={e => setSelectedDriveVideo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500 cursor-pointer"
                      >
                        {driveVideoFiles.map(vf => (
                          <option key={vf.id} value={vf.id}>
                            {vf.name} ({formatBytes(vf.sizeBytes)} • {formatRelativeTime(vf.modifiedTime)})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Run Analysis Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isAnalyzingVideo || (videoSourceMode === 'LOCAL_UPLOAD' && !uploadedVideoName)}
                onClick={async () => {
                  setIsAnalyzingVideo(true);
                  setClubAnalysisResult(null);
                  setLastAnalysisId(null);
                  const selectedMember = clubMembers.find(m => m.id === selectedAnalysisPlayer);
                  try {
                    const res = videoSourceMode === 'LOCAL_UPLOAD'
                      ? await api.analyzeVideo({
                          discipline: analysisDiscipline,
                          context: 'INDIVIDUAL',
                          videoFile: uploadedVideoFile || undefined,
                          playerId: selectedAnalysisPlayer,
                          playerName: selectedMember?.name
                        })
                      : await api.analyzeVideo({
                          discipline: analysisDiscipline,
                          context: 'INDIVIDUAL',
                          driveFileId: selectedDriveVideo,
                          playerId: selectedAnalysisPlayer,
                          playerName: selectedMember?.name
                        });
                    if (res?.analysis) {
                      setClubAnalysisResult(res.analysis);
                      setLastAnalysisId(res.analysisId || null);
                      fetchAnalysisHistory();
                    }
                  } catch (err: any) {
                    setUploadError(err?.message || 'Failed to analyze the video. Please try again.');
                  } finally {
                    setIsAnalyzingVideo(false);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {isAnalyzingVideo
                    ? 'Running Computer Vision Kinematic Pose Estimation...'
                    : `Run Biomechanical AI Analysis (${videoSourceMode === 'LOCAL_UPLOAD' ? (uploadedVideoName ? `File: ${uploadedVideoName}` : 'Local Device Video') : `Drive: ${driveVideoFiles.find(f => f.id === selectedDriveVideo)?.name || 'Select a video'}`})`}
                </span>
              </button>
            </div>
          </div>

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
                      <p className="text-xs font-bold text-sky-400 mt-0.5">{clubAnalysisResult.biomechanicalMetrics.releasePoint}</p>
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
                            const message = adoptAiDrillForPlayer(selectedAnalysisPlayer || null, drill);
                            if (lastAnalysisId) {
                              api.markVideoAnalysisDrillAdopted(lastAnalysisId)
                                .then(() => fetchAnalysisHistory())
                                .catch(() => {});
                            }
                            setPortalModal({
                              isOpen: true,
                              title: 'Drill Added to Club Catalogue',
                              message,
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

          {/* Past Analysis History (persisted AI results, filtered to selected player) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm text-white">Past AI Video Analyses</h3>
                <p className="text-xs text-slate-400">
                  Saved biomechanical analysis history for <strong className="text-white">{clubMembers.find(m => m.id === selectedAnalysisPlayer)?.name || 'Selected Player'}</strong>
                </p>
              </div>
              <button
                onClick={fetchAnalysisHistory}
                title="Refresh history"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isHistoryLoading && analysisHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Loading history...</p>
            ) : analysisHistory.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No saved analyses yet for this player. Run an AI analysis above to build their history.</p>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {analysisHistory.map(entry => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setViewingAnalysisId(entry.id)}
                    className="w-full text-left p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                          {entry.overallScore}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-white">{entry.discipline} • {entry.context}</p>
                          <p className="text-[10px] text-slate-500">{formatRelativeTime(entry.createdAt)} • {entry.sourceType === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Device Upload'}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${entry.drillAdopted ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {entry.drillAdopted ? 'Drill Adopted' : 'Not Adopted'}
                      </span>
                    </div>
                    {entry.analysis?.detectedIssues?.length > 0 && (
                      <p className="text-[11px] text-slate-300 mt-2 flex items-start gap-1.5">
                        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                        <span>{entry.analysis.detectedIssues[0]}</span>
                      </p>
                    )}
                    {entry.analysis?.recommendedDrills?.length > 0 && (
                      <p className="text-[11px] text-emerald-400 mt-1">
                        🎯 {entry.analysis.recommendedDrills[0].title}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Analysis Detail Modal (full saved result + drill adoption status) */}
      {viewingAnalysisId && (
        <VideoAnalysisDetailModal
          analysisId={viewingAnalysisId}
          onClose={() => setViewingAnalysisId(null)}
          onAdopt={(drill, playerId) => {
            adoptAiDrillForPlayer(playerId, drill);
            fetchAnalysisHistory();
          }}
        />
      )}

      {/* 1. Invite Coach / Player Modal Form */}
      {!isClubCoach && isInviteModalOpen && (
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
                <UserPlus size={18} className="text-sky-400" />
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
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Role</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'COACH' | 'PLAYER')}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="PLAYER">Player</option>
                    <option value="COACH">Coach</option>
                  </select>
                </div>
                {inviteRole === 'PLAYER' ? <div>
                  <label className="text-[11px] font-semibold text-slate-400">Age Group</label>
                  <select
                    value={inviteAgeGroup}
                    onChange={e => setInviteAgeGroup(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="U9">Under-9</option>
                    <option value="U11">Under-11</option>
                    <option value="U13">Under-13</option>
                    <option value="U15">Under-15</option>
                    <option value="U19">Under-19</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div> : <div>
                  <label className="text-[11px] font-semibold text-slate-400">Coach Level *</label>
                  <select
                    required
                    value={inviteCoachLevel}
                    onChange={e => setInviteCoachLevel(e.target.value as typeof inviteCoachLevel)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="SUPPORT_COACH">Support Coach</option>
                    <option value="FOUNDATION_COACH">Foundation Coach</option>
                    <option value="CORE_COACH">Core Coach</option>
                    <option value="ADVANCED_COACH">Advanced Coach</option>
                    <option value="SPECIALIST_COACH">Specialist Coach</option>
                  </select>
                </div>}
              </div>
              {inviteRole === 'PLAYER' && <div>
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
                            ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border ${
                          isSelected ? 'bg-white text-sky-700 border-white' : 'border-slate-600'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>}
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Assign Squad</label>
                <input
                  type="text"
                  placeholder="e.g. U15 Pace Squad"
                  value={inviteSquad}
                  onChange={e => setInviteSquad(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingMember(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Pencil size={18} className="text-sky-400" />
                <span>Edit {editingMember.role === 'COACH' ? 'Coach' : 'Player'} Details</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Update roster details for {editingMember.name}.</p>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); handleSubmitEditMember(); }}
              className="space-y-3 pt-2 border-t border-slate-800"
            >
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editMemberName}
                  onChange={e => setEditMemberName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editMemberEmail}
                  onChange={e => setEditMemberEmail(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Role</label>
                  <select
                    value={editMemberRole}
                    onChange={e => setEditMemberRole(e.target.value as 'COACH' | 'PLAYER')}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="PLAYER">Player</option>
                    <option value="COACH">Coach</option>
                  </select>
                </div>
                {editingMember.role === 'PLAYER' && <div>
                  <label className="text-[11px] font-semibold text-slate-400">Age Group</label>
                  <select
                    value={editMemberAgeGroup}
                    onChange={e => setEditMemberAgeGroup(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="U9">Under-9</option>
                    <option value="U11">Under-11</option>
                    <option value="U13">Under-13</option>
                    <option value="U15">Under-15</option>
                    <option value="U19">Under-19</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>}
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
                    const isSelected = editMemberDisciplines.includes(d.id as Discipline);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleEditMemberDiscipline(d.id as Discipline)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] border ${
                          isSelected ? 'bg-white text-sky-700 border-white' : 'border-slate-600'
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
                <label className="text-[11px] font-semibold text-slate-400">Current Level</label>
                <select
                  value={editMemberCurrentLevel}
                  onChange={e => setEditMemberCurrentLevel(e.target.value as any)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  {editingMember?.role === 'COACH' ? <>
                    <option value="SUPPORT_COACH">Support Coach</option>
                    <option value="FOUNDATION_COACH">Foundation Coach</option>
                    <option value="CORE_COACH">Core Coach</option>
                    <option value="ADVANCED_COACH">Advanced Coach</option>
                    <option value="SPECIALIST_COACH">Specialist Coach</option>
                  </> : <>
                    <option value="FOUNDATION">Foundation</option>
                    <option value="DEVELOPING">Developing</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                    <option value="ELITE">Elite</option>
                  </>}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Form New Squad Modal Form */}
      {isSquadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeSquadModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-sky-400" />
                <span>{editingSquadId ? 'Edit Squad' : 'Form New Squad'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {editingSquadId
                  ? 'Update this squad\'s name, age bracket, disciplines, and assigned players.'
                  : 'Create an age-bracket squad for organizing participants.'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5 pt-2">
              <form onSubmit={handleSquadSubmit} id="squad-form" className="space-y-3 border-t border-slate-800 pt-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Squad Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. U13 Spin & Flight Unit"
                    value={squadFormName}
                    onChange={e => setSquadFormName(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Age Bracket</label>
                    <select
                      value={squadFormAgeGroup}
                      onChange={e => setSquadFormAgeGroup(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="U9">Under-9</option>
                      <option value="U11">Under-11</option>
                      <option value="U13">Under-13</option>
                      <option value="U15">Under-15</option>
                      <option value="U19">Under-19</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-[11px] font-semibold text-slate-400">Disciplines *</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ['BATTING', 'Batting'],
                        ['BOWLING', 'Bowling'],
                        ['KEEPING', 'Wicketkeeping'],
                        ['FIELDING', 'Fielding']
                      ] as const).map(([discipline, label]) => (
                        <label key={discipline} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={squadFormDisciplines.includes(discipline)}
                            onChange={() => setSquadFormDisciplines(current =>
                              current.includes(discipline)
                                ? current.filter(selected => selected !== discipline)
                                : [...current, discipline]
                            )}
                            className="accent-sky-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500">Select every discipline covered by this squad. At least one is required.</p>
                  </fieldset>
                </div>
                <p className="text-[11px] text-slate-500">Assign coaches when scheduling a training session.</p>

                {editingSquadId && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <label className="text-[11px] font-semibold text-slate-400">Current Squad Members</label>
                    {(() => {
                      const currentSquadName = squads.find(s => s.id === editingSquadId)?.name;
                      const members = clubMembers.filter(m => m.role === 'PLAYER' && m.squad === currentSquadName);
                      return members.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {members.map(m => (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/30 pl-2 pr-1 py-0.5 rounded-full"
                            >
                              {m.name}
                              <button
                                type="button"
                                onClick={() => onUpdateMemberSquad?.(m.id, 'Unassigned')}
                                title="Remove from this squad"
                                aria-label={`Remove ${m.name} from this squad`}
                                className="hover:bg-rose-500 hover:text-white rounded-full p-0.5 transition cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">No players assigned yet — pick from the panel on the right.</p>
                      );
                    })()}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  {editingSquadId ? (
                    <button
                      type="button"
                      onClick={() => {
                        const sq = squads.find(s => s.id === editingSquadId);
                        if (sq) promptDeleteSquad(sq);
                      }}
                      title="Delete squad"
                      aria-label="Delete squad"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-rose-400 hover:text-white hover:bg-rose-500 transition cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : <span />}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeSquadModal}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition"
                      disabled={squadFormDisciplines.length === 0}
                    >
                      {editingSquadId ? 'Save Changes' : 'Create Squad'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Right-side player selection panel: assign/remove players for this squad (edit mode only),
                  with age group, discipline, and search filters. */}
              <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 space-y-2">
                <h4 className="text-xs font-bold text-white">Squad Players</h4>
                {!editingSquadId ? (
                  <p className="text-[11px] text-slate-500">Save the squad first, then edit it to assign players here.</p>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search players..."
                      value={squadPanelSearchTerm}
                      onChange={e => setSquadPanelSearchTerm(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={squadPanelAgeGroupFilter}
                        onChange={e => setSquadPanelAgeGroupFilter(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-[11px] text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="ALL">All Age Groups</option>
                        <option value="U9">Under-9</option>
                        <option value="U11">Under-11</option>
                        <option value="U13">Under-13</option>
                        <option value="U15">Under-15</option>
                        <option value="U19">Under-19</option>
                        <option value="Senior">Senior</option>
                      </select>
                      <select
                        value={squadPanelDisciplineFilter}
                        onChange={e => setSquadPanelDisciplineFilter(e.target.value as 'ALL' | Discipline)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-[11px] text-white focus:outline-none focus:border-sky-500"
                      >
                        <option value="ALL">All Disciplines</option>
                        <option value="BATTING">Batting</option>
                        <option value="BOWLING">Bowling</option>
                        <option value="KEEPING">Wicketkeeping</option>
                        <option value="FIELDING">Fielding</option>
                      </select>
                    </div>
                    {(() => {
                      const currentSquadName = squads.find(s => s.id === editingSquadId)?.name;
                      const term = squadPanelSearchTerm.trim().toLowerCase();
                      const filteredPlayers = clubMembers
                        .filter(m => m.role === 'PLAYER')
                        .filter(m => {
                          if (squadPanelAgeGroupFilter !== 'ALL' && m.ageGroup !== squadPanelAgeGroupFilter) return false;
                          if (squadPanelDisciplineFilter !== 'ALL' && !(m.discipline || '').toUpperCase().includes(squadPanelDisciplineFilter)) return false;
                          if (term && !m.name.toLowerCase().includes(term)) return false;
                          return true;
                        });

                      if (filteredPlayers.length === 0) {
                        return <p className="text-[11px] text-slate-500">No players match these filters.</p>;
                      }

                      return (
                        <div className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1">
                          {filteredPlayers.map(player => {
                            const isInSquad = player.squad === currentSquadName;
                            return (
                              <button
                                type="button"
                                key={player.id}
                                onClick={() => onUpdateMemberSquad?.(player.id, isInSquad ? 'Unassigned' : (currentSquadName || ''))}
                                className={`w-full text-left p-2 rounded-lg border transition cursor-pointer ${
                                  isInSquad
                                    ? 'bg-sky-500/10 border-sky-500/40'
                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="text-[11px] font-semibold text-white truncate">{player.name}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    isInSquad ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {isInSquad ? 'In Squad' : '+ Add'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {player.ageGroup} • {player.discipline} • {player.squad || 'Unassigned'}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Schedule Session Modal Form */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeSessionModal}
              disabled={isSessionSaving}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="text-sky-400" />
                <span>{editingSessionId ? 'Edit Training Session' : 'Schedule Training Session'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Assign date, squad, and duration for practice drills.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-5 pt-2">
              <form onSubmit={handleSessionSubmit} id="session-form" className="space-y-3 border-t border-slate-800 pt-3">
                {sessionSaveError && <p role="alert" className="text-xs text-rose-300">{sessionSaveError}</p>}
                {!editingSessionId && (
                  <TrainingTemplatePicker onApply={template => {
                    setSessionFormTitle(template.title);
                    setSessionFormDuration(template.durationMinutes);
                    setSessionFormDrillIds([...template.drillIds]);
                  }} />
                )}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Session Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Death Bowling & Yorker Execution Circuit"
                    value={sessionFormTitle}
                    onChange={e => setSessionFormTitle(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Assign Training To</label>
                  <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 w-full">
                    <button
                      type="button"
                      onClick={() => setSessionFormTargetType('SQUAD')}
                      className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                        sessionFormTargetType === 'SQUAD'
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Existing Squad
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionFormTargetType('PLAYERS')}
                      className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                        sessionFormTargetType === 'PLAYERS'
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Individual Player(s)
                    </button>
                  </div>
                </div>

                {sessionFormTargetType === 'SQUAD' ? (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Target Squad</label>
                    {squads.length > 0 ? (
                      <select
                        value={sessionFormSquadId}
                        onChange={e => {
                          const selected = squads.find(squad => squad.id === e.target.value);
                          setSessionFormSquadId(e.target.value);
                          setSessionFormSquad(selected?.name || '');
                        }}
                        className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                      >
                        {squads.map(sq => (
                          <option key={sq.id} value={sq.id}>
                            {sq.name} ({sq.ageGroup} • {formatDisciplines(sq.discipline)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-500">
                        No squads formed yet. Switch to "Individual Player(s)" or form a squad first in the Squads tab.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      Select Player(s) {sessionFormPlayerIds.length > 0 && `(${sessionFormPlayerIds.length} selected)`}
                    </label>
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-950 border border-slate-800 rounded-lg p-2">
                      {clubMembers.filter(m => m.role === 'PLAYER').length === 0 && (
                        <p className="text-[11px] text-slate-500 px-1 py-1">No players in roster yet.</p>
                      )}
                      {clubMembers.filter(m => m.role === 'PLAYER').map(p => {
                        const checked = sessionFormPlayerIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-900 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSessionFormPlayerIds(prev =>
                                  checked ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              }}
                              className="accent-sky-500"
                            />
                            <span className="text-xs text-slate-200">{p.name}</span>
                            <span className="text-[10px] text-slate-500">({p.ageGroup} • {p.discipline})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Head Coach *</label>
                    <select
                      required
                      value={sessionFormCoachId}
                      onChange={e => setSessionFormCoachId(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Select an active coach</option>
                      {activeClubCoaches.map(coach => <option key={coach.id} value={coach.id} disabled={coach.id === sessionFormCoordinatorId || coach.id === sessionFormAssistantId}>{coach.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Coordinator</label>
                      <select value={sessionFormCoordinatorId} onChange={e => setSessionFormCoordinatorId(e.target.value)} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500">
                        <option value="">None</option>
                        {activeClubCoaches.map(coach => <option key={coach.id} value={coach.id} disabled={coach.id === sessionFormCoachId || coach.id === sessionFormAssistantId}>{coach.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Assistant Coach</label>
                      <select value={sessionFormAssistantId} onChange={e => setSessionFormAssistantId(e.target.value)} className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500">
                        <option value="">None</option>
                        {activeClubCoaches.map(coach => <option key={coach.id} value={coach.id} disabled={coach.id === sessionFormCoachId || coach.id === sessionFormCoordinatorId}>{coach.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {activeClubCoaches.length === 0 && <p role="alert" className="text-xs text-amber-400">No active coaches are available. Activate a coach invitation before scheduling a session.</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Date (YYYY-MM-DD)</label>
                    <input
                      type="date"
                      required
                      value={sessionFormDate}
                      onChange={e => setSessionFormDate(e.target.value)}
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
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
                      className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {(() => {
                  const drillIds = editingSessionId
                    ? (sessions.find(s => s.id === editingSessionId)?.drillIds || [])
                    : sessionFormDrillIds;
                  return (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Planned Drills {drillIds.length > 0 && `(${drillIds.length})`}
                      </label>
                      {drillIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {drillIds.map((drillId, idx) => {
                            const d = drills.find(dr => dr.id === drillId);
                            return (
                              <span
                                key={`${drillId}-${idx}`}
                                className="inline-flex items-center gap-1 text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/30 pl-2 pr-1 py-0.5 rounded-full"
                              >
                                {d?.title || 'Unknown Drill'}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingSessionId) {
                                      onRemoveDrillFromSession?.(editingSessionId, drillId);
                                    } else {
                                      setSessionFormDrillIds(prev => {
                                        const next = [...prev];
                                        const removeIdx = next.indexOf(drillId);
                                        if (removeIdx !== -1) next.splice(removeIdx, 1);
                                        return next;
                                      });
                                    }
                                  }}
                                  title="Remove this drill from the session"
                                  aria-label="Remove this drill from the session"
                                  className="hover:bg-rose-500 hover:text-white rounded-full p-0.5 transition cursor-pointer"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">No drills added yet — pick from the panel on the right.</p>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={closeSessionModal}
                    disabled={isSessionSaving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSessionSaving || !sessionFormCoachId || (sessionFormTargetType === 'PLAYERS' && sessionFormPlayerIds.length === 0)}
                    className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSessionSaving ? 'Scheduling...' : editingSessionId ? 'Save Changes' : 'Schedule Session'}
                  </button>
                </div>
              </form>

              {/* Right-side drill selection panel: system & club drills, starred when AI-recommended
                  for a player in the targeted squad/selection based on their video analysis history. */}
              <div className="border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">Available Drills</h4>
                  {squadAiRecommendedDrillTitles.size > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                      <Star size={10} fill="currentColor" /> AI Recommended
                    </span>
                  )}
                </div>
                <select
                  value={sessionDrillFilterDiscipline}
                  onChange={e => setSessionDrillFilterDiscipline(e.target.value as 'ALL' | Discipline)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">All Disciplines</option>
                  <option value="BATTING">Batting</option>
                  <option value="BOWLING">Bowling</option>
                  <option value="KEEPING">Wicketkeeping</option>
                  <option value="FIELDING">Fielding</option>
                </select>
                {(() => {
                  const currentDrillIds = editingSessionId
                    ? (sessions.find(s => s.id === editingSessionId)?.drillIds || [])
                    : sessionFormDrillIds;
                  const filteredDrills = sessionDrillFilterDiscipline === 'ALL'
                    ? drills
                    : drills.filter(d => d.discipline === sessionDrillFilterDiscipline);
                  const sortedDrills = [...filteredDrills].sort((a, b) => {
                    const aRec = squadAiRecommendedDrillTitles.has(a.title.trim().toLowerCase()) ? 1 : 0;
                    const bRec = squadAiRecommendedDrillTitles.has(b.title.trim().toLowerCase()) ? 1 : 0;
                    return bRec - aRec;
                  });

                  if (sortedDrills.length === 0) {
                    return <p className="text-[11px] text-slate-500">No drills available for this discipline.</p>;
                  }

                  return (
                    <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
                      {sortedDrills.map(d => {
                        const isRecommended = squadAiRecommendedDrillTitles.has(d.title.trim().toLowerCase());
                        const isAdded = currentDrillIds.includes(d.id);
                        return (
                          <button
                            type="button"
                            key={d.id}
                            onClick={() => {
                              if (isAdded) {
                                if (editingSessionId) {
                                  onRemoveDrillFromSession?.(editingSessionId, d.id);
                                } else {
                                  setSessionFormDrillIds(prev => {
                                    const next = [...prev];
                                    const idx2 = next.indexOf(d.id);
                                    if (idx2 !== -1) next.splice(idx2, 1);
                                    return next;
                                  });
                                }
                              } else if (editingSessionId) {
                                onAddDrillToSession?.(editingSessionId, d.id);
                              } else {
                                setSessionFormDrillIds(prev => [...prev, d.id]);
                              }
                            }}
                            className={`w-full text-left p-2 rounded-lg border transition cursor-pointer ${
                              isAdded
                                ? 'bg-sky-500/10 border-sky-500/40'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex items-center gap-1 min-w-0">
                                {isRecommended && (
                                  <Star size={11} className="text-amber-400 shrink-0" fill="currentColor" />
                                )}
                                <span className="text-[11px] font-semibold text-white truncate">{d.title}</span>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                isAdded ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isAdded ? 'Added' : '+ Add'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {d.discipline} • {d.duration} mins
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
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
                setModalUploadError(null);
                setModalAnalysisResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={18} />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-1">
                <span>📹</span>
                <span>Computer Vision Biomechanics Engine</span>
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Upload & Analyse Footage: {uploadModalPlayer.name}</span>
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
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Device Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalUploadError(null);
                        if (!isDriveConnected) {
                          setIsDriveModalOpen(true);
                          return;
                        }
                        setModalUploadSource('GOOGLE_DRIVE');
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        modalUploadSource === 'GOOGLE_DRIVE'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>Sync from Google Drive</span>
                      {isDriveConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                    </button>
                  </div>
                </div>

                {modalUploadSource === 'LOCAL_UPLOAD' ? (
                  <div>
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('video/')) {
                          setModalUploadError('Invalid file type! Please select a valid video file (MP4, MOV, WEBM, AVI, M4V).');
                          setModalUploadedFileName(null);
                          setModalUploadedFile(null);
                          return;
                        }
                        setModalUploadError(null);
                        setModalUploadedFileName(file.name);
                        setModalUploadedFile(file);
                        backupLocalVideoToDrive(file, 'MODAL');
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
                            Strictly video only: MP4, MOV, or WEBM up to 60s
                          </p>
                        </div>
                      )}
                    </div>
                    {modalUploadError && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{modalUploadError}</span>
                      </div>
                    )}
                    {modalUploadedFileName && isDriveConnected && (
                      <div className="mt-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex items-center gap-2">
                        {isModalBackingUpToDrive ? (
                          <>
                            <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-sky-400" />
                            <span className="text-slate-300">Backing up to Google Drive…</span>
                          </>
                        ) : modalDriveBackupStatus === 'SUCCESS' ? (
                          <>
                            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span className="text-emerald-400">Saved to your connected Google Drive.</span>
                          </>
                        ) : modalDriveBackupStatus === 'ERROR' ? (
                          <>
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span className="text-rose-400">Could not back up to Google Drive. Analysis will still proceed locally.</span>
                          </>
                        ) : (
                          <>
                            <Cloud className="w-4 h-4 shrink-0 text-sky-400" />
                            <span className="text-slate-400">Will be backed up to Google Drive.</span>
                          </>
                        )}
                      </div>
                    )}
                    {modalUploadedFileName && !isDriveConnected && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>
                          Not backed up to the cloud.{' '}
                          <button type="button" className="underline font-semibold" onClick={() => setIsDriveModalOpen(true)}>
                            Connect Google Drive
                          </button>{' '}
                          to automatically save device uploads.
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-sky-400" />
                        <span className="text-xs font-semibold text-white">Google Drive Cloud Vault</span>
                      </div>
                      <span className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded">
                        {isDriveConnected ? (driveEmail || 'Connected') : 'Not Connected'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setIsSyncingDriveModal(true);
                          await fetchDriveVideos('MODAL');
                          setIsSyncingDriveModal(false);
                        }}
                        disabled={isSyncingDriveModal}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDriveModal ? 'animate-spin' : ''}`} />
                        <span>{isSyncingDriveModal ? 'Syncing with Google Drive...' : 'Sync Latest Clips from Vault'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnectDrive}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium cursor-pointer transition shrink-0"
                        title="Disconnect account to switch accounts or refresh permissions"
                      >
                        Disconnect
                      </button>
                    </div>

                    {driveVideosError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{driveVideosError}</span>
                      </div>
                    )}

                    {/* Video Picker from Connected Drive */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-sky-400" />
                        Select Video from Drive ({modalDriveVideoFiles.length} found):
                      </label>
                      {modalDriveVideoFiles.length === 0 && !modalDriveVideosError ? (
                        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                          No video files loaded yet. Click "Sync Latest Clips from Vault" to fetch videos from your Google Drive.
                        </div>
                      ) : (
                        <select
                          value={modalSelectedDriveVideo}
                          onChange={e => setModalSelectedDriveVideo(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500 cursor-pointer"
                        >
                          {modalDriveVideoFiles.map(vf => (
                            <option key={vf.id} value={vf.id}>
                              {vf.name} ({formatBytes(vf.sizeBytes)} • {formatRelativeTime(vf.modifiedTime)})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Run Analysis Button */}
              <button
                type="button"
                disabled={modalIsAnalyzing || (modalUploadSource === 'LOCAL_UPLOAD' && !modalUploadedFileName)}
                onClick={async () => {
                  setModalIsAnalyzing(true);
                  setModalAnalysisResult(null);
                  try {
                    const res = modalUploadSource === 'LOCAL_UPLOAD'
                      ? await api.analyzeVideo({
                          discipline: modalUploadDiscipline,
                          context: 'INDIVIDUAL',
                          videoFile: modalUploadedFile || undefined
                        })
                      : await api.analyzeVideo({
                          discipline: modalUploadDiscipline,
                          context: 'INDIVIDUAL',
                          driveFileId: modalSelectedDriveVideo
                        });
                    if (res?.analysis) {
                      setModalAnalysisResult(res.analysis);
                    }
                  } catch (err: any) {
                    setModalUploadError(err?.message || 'Failed to analyze the video. Please try again.');
                  } finally {
                    setModalIsAnalyzing(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {modalIsAnalyzing
                    ? 'Running Computer Vision Kinematics...'
                    : `Analyze Video Clip (${modalUploadSource === 'LOCAL_UPLOAD' ? (modalUploadedFileName || 'Uploaded Video') : `Drive: ${modalDriveVideoFiles.find(f => f.id === modalSelectedDriveVideo)?.name || 'Select a video'}`})`}
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
                                title: 'Drill Adopted to Club Catalogue',
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

      {/* Google Drive Connection Modal */}
      {isDriveModalOpen && (
        <GoogleDriveConnectModal
          isOpen={isDriveModalOpen}
          onClose={() => setIsDriveModalOpen(false)}
          onConnected={(email: string) => {
            handleDriveConnected(email);
            setIsDriveModalOpen(false);
          }}
          initialEmail={driveEmail}
          userRoleLabel="Club Admin"
        />
      )}
    </div>
  );
};
