import React, { useState, useRef, useEffect } from 'react';
import { AuthUser, Discipline, ContextType, Drill, TrainingSession, VideoAnalysisResult, DriveVideoFile } from '../../types';
import { api } from '../../services/api';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';
import { GoogleDriveConnectModal } from '../common/GoogleDriveConnectModal';
import { VideoAnalysisDetailModal } from '../common/VideoAnalysisDetailModal';
import { CoachOperations } from './CoachOperations';
import { Upload, Cloud, Play, Check, AlertCircle, RefreshCw, Folder, ExternalLink } from 'lucide-react';

interface CoachingPortalProps {
  currentUser: AuthUser;
  drills: Drill[];
  onAddAiDrill: (drill: Drill) => void;
  onScheduleSession: (session: TrainingSession) => void;
  onUpdateSession: (sessionId: string, updates: Partial<TrainingSession>) => void;
  onDeleteSession: (sessionId: string) => void;
}

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

export const CoachingPortal: React.FC<CoachingPortalProps> = ({
  currentUser,
  drills,
  onAddAiDrill,
  onScheduleSession,
  onUpdateSession,
  onDeleteSession
}) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline>('BATTING');
  const [selectedContext, setSelectedContext] = useState<ContextType>('INDIVIDUAL');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<VideoAnalysisResult | null>(null);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    id: string;
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

  // Ingestion Source Mode & Upload State
  const [sourceMode, setSourceMode] = useState<'LOCAL_UPLOAD' | 'GOOGLE_DRIVE'>('LOCAL_UPLOAD');
  const [selectedLocalVideo, setSelectedLocalVideo] = useState<{ name: string; size: string; file: File } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isBackingUpToDrive, setIsBackingUpToDrive] = useState(false);
  const [driveBackupStatus, setDriveBackupStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Google Drive Connection State (real OAuth status, fetched from the backend)
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string>('');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveVideos, setDriveVideos] = useState<DriveVideoFile[]>([]);
  const [selectedDriveVideoId, setSelectedDriveVideoId] = useState<string>('');
  const [driveVideosError, setDriveVideosError] = useState<string | null>(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type?: ConfirmationType;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Check real Google Drive connection status on mount
  useEffect(() => {
    api.getGoogleDriveStatus().then(status => {
      setIsDriveConnected(status.connected);
      setDriveEmail(status.email || '');
    }).catch(() => {});
  }, []);

  const fetchAnalysisHistory = () => {
    setIsHistoryLoading(true);
    api.getVideoAnalysisHistory()
      .then(res => setAnalysisHistory(res.history || []))
      .catch(() => {})
      .finally(() => setIsHistoryLoading(false));
  };

  // Load the coach's previously saved real Gemini analyses on mount.
  useEffect(() => {
    fetchAnalysisHistory();
  }, []);

  const fetchDriveVideos = async () => {
    setIsSyncingDrive(true);
    setDriveVideosError(null);
    try {
      const { files } = await api.listGoogleDriveVideos();
      setDriveVideos(files);
      if (files.length > 0) {
        setSelectedDriveVideoId(prev => (files.some(f => f.id === prev) ? prev : files[0].id));
      }
      setConfirmModal({
        isOpen: true,
        title: 'Google Drive Synced',
        message: `${files.length} video file${files.length === 1 ? '' : 's'} found in ${driveEmail || 'your'} Google Drive and ready for AI kinematic analysis.`,
        type: 'success',
        confirmLabel: 'Ready to Analyse',
        onConfirm: () => setConfirmModal(null)
      });
    } catch (err: any) {
      setDriveVideosError(err?.message || 'Failed to fetch videos from Google Drive.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleSimulateAnalysis = async () => {
    // If using Google Drive and not connected, prompt user to connect first
    if (sourceMode === 'GOOGLE_DRIVE' && !isDriveConnected) {
      setIsDriveModalOpen(true);
      return;
    }

    setAnalyzing(true);
    setAiFeedback(null);
    setUploadError(null);
    setLastAnalysisId(null);
    try {
      const res = sourceMode === 'LOCAL_UPLOAD'
        ? await api.analyzeVideo({
            discipline: selectedDiscipline,
            context: selectedContext,
            videoFile: selectedLocalVideo?.file
          })
        : await api.analyzeVideo({
            discipline: selectedDiscipline,
            context: selectedContext,
            driveFileId: selectedDriveVideoId
          });
      if (res?.analysis) {
        setAiFeedback(res.analysis);
        setLastAnalysisId(res.analysisId || null);
        fetchAnalysisHistory();
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to analyze the video. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict validation: Video files only
    if (!file.type.startsWith('video/')) {
      setUploadError('Invalid file type! Please select a valid video file (MP4, MOV, WEBM, AVI, M4V).');
      setSelectedLocalVideo(null);
      return;
    }

    setUploadError(null);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setSelectedLocalVideo({
      name: file.name,
      size: `${sizeMb} MB`,
      file
    });

    // Automatically back the device-uploaded clip up into the coach's connected Google Drive,
    // organized under eCricketCoach/My Training Videos/{Discipline}.
    if (isDriveConnected) {
      setIsBackingUpToDrive(true);
      setDriveBackupStatus('IDLE');
      api.uploadVideoToGoogleDrive(file, 'My Training Videos', selectedDiscipline)
        .then(driveFile => {
          setDriveVideos(prev => [driveFile, ...prev.filter(f => f.id !== driveFile.id)]);
          setDriveBackupStatus('SUCCESS');
        })
        .catch(() => setDriveBackupStatus('ERROR'))
        .finally(() => setIsBackingUpToDrive(false));
    }
  };

  const handleSyncDriveVault = () => {
    if (!isDriveConnected) {
      setIsDriveModalOpen(true);
      return;
    }
    fetchDriveVideos();
  };

  const handleDriveConnected = (email: string) => {
    setIsDriveConnected(true);
    setDriveEmail(email);
    fetchDriveVideos();
  };

  const handleDisconnectDrive = async () => {
    try {
      await api.disconnectGoogleDrive();
    } catch {}
    setIsDriveConnected(false);
    setDriveEmail('');
    setDriveVideos([]);
    setSelectedDriveVideoId('');
    setDriveBackupStatus('IDLE');
  };

  const handleAddRecommended = (drillItem?: any) => {
    const drillToAdopt = drillItem || aiFeedback?.recommendedDrills?.[0];
    if (!drillToAdopt) return;
    const newDrill: Drill = {
      id: 'drill-ai-' + Date.now(),
      title: drillToAdopt.title,
      discipline: selectedDiscipline,
      skillSet: 'AI Biomechanical Correction',
      contextType: selectedContext,
      duration: drillToAdopt.durationMinutes || 20,
      source: 'AI_RECOMMENDED',
      instructions: 'Custom corrective drill generated via computer vision pose analysis.'
    };
    onAddAiDrill(newDrill);
    setConfirmModal({
      isOpen: true,
      title: 'Drill Adopted into Catalogue',
      message: `AI Recommended Drill "${newDrill.title}" has been successfully added to your training catalogue!`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setConfirmModal(null)
    });
  };

  const filteredDrills = drills.filter(
    d => d.discipline === selectedDiscipline && d.contextType === selectedContext
  );

  return (
    <div className="space-y-6">
      {currentUser.roles.includes('COACH') && currentUser.coachContext === 'CLUB' && (
        <CoachOperations
          currentUser={currentUser}
          drills={drills}
          onScheduleSession={onScheduleSession}
          onUpdateSession={onUpdateSession}
          onDeleteSession={onDeleteSession}
        />
      )}

      {currentUser.coachContext !== 'CLUB' && (
        <>
          <div className="border-t border-slate-800 pt-6">
            <p className="text-xs font-semibold text-cyan-400 uppercase">AI coaching lab</p>
            <h2 className="text-xl font-bold text-white">Video analysis and drill design</h2>
          </div>

      {/* Discipline & Context Selector */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Discipline</h2>
          <div className="flex flex-wrap gap-2">
            {(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'] as Discipline[]).map(discipline => (
              <button
                key={discipline}
                onClick={() => setSelectedDiscipline(discipline)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedDiscipline === discipline
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {discipline}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Training Context</h2>
          <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => setSelectedContext('INDIVIDUAL')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedContext === 'INDIVIDUAL' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Solo / 1-on-1
            </button>
            <button
              onClick={() => setSelectedContext('GROUP')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedContext === 'GROUP' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Squad / Group
            </button>
          </div>
        </div>
      </section>

      {/* 2-Column Grid: AI Video Analysis & Drill Tailoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Analysis Panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg text-white">AI Video Biomechanics</h3>
              <p className="text-xs text-slate-400">Upload or sync video to analyse posture and receive drill recommendations</p>
            </div>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full font-semibold">
              Pose Engine v2.4
            </span>
          </div>

          {/* Source Toggle: Device Video vs Google Drive */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSourceMode('LOCAL_UPLOAD');
                setUploadError(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
                sourceMode === 'LOCAL_UPLOAD'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Video File</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('GOOGLE_DRIVE');
                setUploadError(null);
                if (!isDriveConnected) {
                  setIsDriveModalOpen(true);
                }
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 ${
                sourceMode === 'GOOGLE_DRIVE'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Sync from Google Drive</span>
              {isDriveConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              )}
            </button>
          </div>

          {/* Ingestion Area based on selected Source */}
          {sourceMode === 'LOCAL_UPLOAD' ? (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/70 group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2 transition">
                  <Upload className="w-6 h-6" />
                </div>
                {selectedLocalVideo ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Ready for AI: {selectedLocalVideo.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Size: {selectedLocalVideo.size} • Click to replace file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Click to choose video or drag file here
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Strictly video only: MP4, MOV, WEBM, AVI (up to 60s)
                    </p>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              {selectedLocalVideo && isDriveConnected && (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs flex items-center gap-2">
                  {isBackingUpToDrive ? (
                    <>
                      <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-cyan-400" />
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
                      <Cloud className="w-4 h-4 shrink-0 text-cyan-400" />
                      <span className="text-slate-400">Will be backed up to Google Drive.</span>
                    </>
                  )}
                </div>
              )}
              {selectedLocalVideo && !isDriveConnected && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
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
            /* Google Drive Mode */
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      Google Drive Cloud Vault
                      {isDriveConnected ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                          Connected
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                          Not Connected
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {isDriveConnected ? driveEmail : 'Connect your account to access and sync videos'}
                    </p>
                  </div>
                </div>

                {isDriveConnected ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncDriveVault}
                      disabled={isSyncingDrive}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                      <span>{isSyncingDrive ? 'Syncing...' : 'Sync Vault'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium cursor-pointer transition shrink-0"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDriveModalOpen(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Connect Drive</span>
                  </button>
                )}
              </div>

              {/* Video Selector from Connected Drive */}
              {isDriveConnected ? (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-cyan-400" />
                    Select Video from your Google Drive ({driveVideos.length} found):
                  </label>
                  {driveVideosError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{driveVideosError}</span>
                    </div>
                  )}
                  {driveVideos.length === 0 && !driveVideosError ? (
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                      No video files found yet. Click "Sync Vault" to load videos from your Google Drive.
                    </div>
                  ) : (
                    <select
                      value={selectedDriveVideoId}
                      onChange={e => setSelectedDriveVideoId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      {driveVideos.map(vf => (
                        <option key={vf.id} value={vf.id}>
                          {vf.name} ({formatBytes(vf.sizeBytes)} • {formatRelativeTime(vf.modifiedTime)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                  <span>Please connect your Google Drive to pick footage directly from your cloud archive.</span>
                  <button
                    type="button"
                    onClick={() => setIsDriveModalOpen(true)}
                    className="text-xs font-bold underline cursor-pointer hover:text-white shrink-0 ml-2"
                  >
                    Connect Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Button: Run AI Kinematic Pose Analysis */}
          <button
            onClick={handleSimulateAnalysis}
            disabled={analyzing || (sourceMode === 'LOCAL_UPLOAD' && !selectedLocalVideo) || (sourceMode === 'GOOGLE_DRIVE' && isDriveConnected && driveVideos.length === 0)}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {analyzing
                ? 'Analysing Biomechanics...'
                : 'Run AI Kinematic Pose Analysis'}
            </span>
          </button>

          {/* AI Feedback Result Panel */}
          {aiFeedback && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Overall Technique Score</p>
                <span className="text-lg font-bold text-emerald-400">{aiFeedback.overallScore}/100</span>
              </div>

              {aiFeedback.detectedIssues?.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{aiFeedback.detectedIssues[0]}</span>
                </div>
              )}

              {/* Biomechanical Telemetry */}
              {aiFeedback.biomechanicalMetrics && (
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-400 block">Head Position</span>
                    <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.headPosition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Foot Alignment</span>
                    <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.footAlignment}</span>
                  </div>
                  {aiFeedback.biomechanicalMetrics.backliftAngle && (
                    <div>
                      <span className="text-slate-400 block">Backlift Angle</span>
                      <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.backliftAngle}</span>
                    </div>
                  )}
                  {aiFeedback.biomechanicalMetrics.releasePoint && (
                    <div>
                      <span className="text-slate-400 block">Release Point</span>
                      <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.releasePoint}</span>
                    </div>
                  )}
                </div>
              )}

              {aiFeedback.recommendedDrills?.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Recommended Corrective Drill:</p>
                  {aiFeedback.recommendedDrills.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/50 p-2 rounded border border-slate-800">
                      <div>
                        <p className="text-xs font-medium text-white">{d.title}</p>
                        <p className="text-xs text-slate-400">{d.durationMinutes} mins • {d.context}</p>
                      </div>
                      <button
                        onClick={() => {
                          handleAddRecommended(d);
                          if (lastAnalysisId) {
                            api.markVideoAnalysisDrillAdopted(lastAnalysisId)
                              .then(() => fetchAnalysisHistory())
                              .catch(() => {});
                          }
                        }}
                        className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded transition cursor-pointer"
                      >
                        Add to Plans
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Past Analysis History (persisted AI results) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-sm text-white">Past AI Video Analyses</h3>
              <p className="text-xs text-slate-400">Your saved biomechanical analysis history</p>
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
            <p className="text-xs text-slate-500 py-4 text-center">No saved analyses yet. Run an AI analysis above to build your history.</p>
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
        </section>

        {/* Video Analysis Detail Modal (full saved result + drill adoption status) */}
        {viewingAnalysisId && (
          <VideoAnalysisDetailModal
            analysisId={viewingAnalysisId}
            onClose={() => setViewingAnalysisId(null)}
            onAdopt={(drill) => {
              handleAddRecommended(drill);
              fetchAnalysisHistory();
            }}
          />
        )}

        {/* Drills & Training Plan Tailoring */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg text-white">Drill Library & Custom Plan</h3>
              <p className="text-xs text-slate-400">Filtered for {selectedDiscipline} ({selectedContext})</p>
            </div>
            <span className="text-xs bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              {filteredDrills.length} Drills
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {filteredDrills.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No drills found for this filter. Try AI analysis to generate one.
              </div>
            ) : (
              filteredDrills.map(drill => (
                <div
                  key={drill.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-medium text-slate-200">{drill.title}</h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold">
                        {drill.source === 'SYSTEM_PREDEFINED' ? 'Official' : drill.source === 'CLUB_CUSTOM' ? 'Club' : 'AI'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {drill.duration} mins • {drill.discipline} • {drill.contextType} • {drill.skillSet}
                    </p>
                  </div>
                  <button className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                    Tailor
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
        </>
      )}

      {/* Multi-Tenant Subscription Tiers */}
      {currentUser.coachContext !== 'CLUB' && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold text-lg text-white mb-1">Multi-Tenant Subscription Plans</h3>
        <p className="text-xs text-slate-400 mb-4">Choose your tenancy tier (Player, Coach, or Club / Academy)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-400">Individual</span>
              <h4 className="text-xl font-bold text-white mt-1">£14.99 <span className="text-xs font-normal text-slate-400">/mo</span></h4>
              <p className="text-xs text-slate-400 mt-2">Solo training, 5 AI video analyses/month, personal skill levels.</p>
            </div>
            <button className="mt-4 w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium border border-slate-700">
              Choose Individual
            </button>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border-2 border-emerald-500/50 flex flex-col justify-between relative">
            <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase">
              Popular
            </span>
            <div>
              <span className="text-xs font-semibold uppercase text-emerald-400">Coach Pro</span>
              <h4 className="text-xl font-bold text-white mt-1">£49.99 <span className="text-xs font-normal text-slate-400">/mo</span></h4>
              <p className="text-xs text-slate-400 mt-2">Manage up to 25 players, group/squad modeling, assessments & promotion approvals.</p>
            </div>
            <button className="mt-4 w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold">
              Choose Coach
            </button>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-400">Club / Academy</span>
              <h4 className="text-xl font-bold text-white mt-1">£199.99 <span className="text-xs font-normal text-slate-400">/mo</span></h4>
              <p className="text-xs text-slate-400 mt-2">Multi-coach seats, squad segmentation, club-wide drill library & centralized billing.</p>
            </div>
            <button className="mt-4 w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium border border-slate-700">
              Choose Club
            </button>
          </div>
        </div>
        </section>
      )}

      {/* Confirmation & Info Modal */}
      {confirmModal && (
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Google Drive Connection Modal */}
      <GoogleDriveConnectModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onConnected={handleDriveConnected}
        initialEmail={driveEmail}
        userRoleLabel="Coaching / Player"
      />
    </div>
  );
};
