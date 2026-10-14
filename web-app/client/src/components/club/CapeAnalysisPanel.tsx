import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Download, Images, Loader2, RotateCcw, Sparkles, Upload, UserPlus, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CapeContactCandidates, CapeFault, CapeJob, CapeResult, CapeTarget, PlayerDrillAssignment } from '../../types';

const SHOT_TYPES = ['front_foot_drive', 'back_foot_drive', 'forward_defence', 'backward_defence', 'pull', 'cut', 'sweep'];
const BOWLER_TYPES = ['pace', 'spin'];
const CORNER_LABELS = ['Batter-end left', 'Batter-end right', 'Bowler-end right', 'Bowler-end left'];
const SNAPSHOT_LABELS: Record<string, string> = {
  pre_contact_snapshot: 'Pre-contact',
  impact_snapshot: 'Point of contact',
  post_contact_snapshot: 'Post-contact',
  release_snapshot: 'Release',
  pitching_point_snapshot: 'Pitching point',
  pitch_map: 'Pitch map'
};
const POLL_MS = 3000;
const MAX_POLL_MS = 15000;

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const formatNumber = (value: number | null | undefined, digits = 1) => (value === null || value === undefined ? '—' : value.toFixed(digits));

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function expectedRange(fault: CapeFault) {
  const [lo, hi] = fault.expected;
  if (lo !== null && hi !== null) return `${lo}–${hi}`;
  if (lo !== null) return `≥ ${lo}`;
  if (hi !== null) return `≤ ${hi}`;
  return '—';
}

const severityStyle = (severity: CapeFault['severity'] | 'ok') =>
  severity === 'high' ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
    : severity === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : 'border-amber-500/40 bg-amber-500/20 text-amber-300';

export interface CapeVideoSource {
  name: string;
  file?: File;
  driveFileId?: string;
}

interface CapeAnalysisPanelProps {
  discipline: string;
  canSubmit: boolean;
  // Assessment mode: the panel has its own file picker and links the job to the assessment.
  assessmentId?: string;
  // Standalone mode: analyses `source` (chosen elsewhere on the page) for this club player.
  playerId?: string;
  source?: CapeVideoSource | null;
  startLabel?: string;
  onJobChange?: (job: CapeJob | null) => void;
  // Club staff can assign suggested drills to the analysed player.
  canAssignDrills?: boolean;
  // View mode: shows this existing job (read-only unless canSubmit).
  jobId?: string;
}

export const CapeAnalysisPanel: React.FC<CapeAnalysisPanelProps> = ({ assessmentId, playerId, source, discipline, canSubmit, startLabel, onJobChange, canAssignDrills = false, jobId }) => {
  const target: CapeTarget | null = discipline === 'BATTING' ? 'batter' : discipline === 'BOWLING' ? 'bowler' : null;
  const isStandalone = !assessmentId;
  const [job, setJob] = useState<CapeJob | null>(null);
  const [isSetup, setIsSetup] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [handedness, setHandedness] = useState<'right' | 'left'>('right');
  const [shotType, setShotType] = useState(SHOT_TYPES[0]);
  const [bowlerType, setBowlerType] = useState(BOWLER_TYPES[0]);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [frameReady, setFrameReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualFrames, setManualFrames] = useState<ManualSelection>(EMPTY_SELECTION);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceKey = source ? `${source.driveFileId || ''}|${source.name}|${source.file?.size ?? ''}` : '';

  const resetFrame = () => {
    setError('');
    setPoints([]);
    setFrameReady(false);
    setFile(null);
    setVideoUrl('');
    setManualMode(false);
    setManualFrames(EMPTY_SELECTION);
  };

  useEffect(() => {
    if (!target || (!assessmentId && !playerId && !jobId)) return;
    let cancelled = false;
    setJob(null);
    const load = jobId ? api.getCapeJob(jobId)
      : assessmentId ? api.getAssessmentCapeJob(assessmentId) : api.getLatestPlayerCapeJob(playerId!, target);
    load.then(found => { if (!cancelled) setJob(found); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [assessmentId, playerId, target, jobId]);

  // A different video or player chosen above invalidates any corners already marked.
  useEffect(() => {
    if (!isStandalone) return;
    setIsSetup(false);
    resetFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, playerId, isStandalone]);

  // Poll while queued/running; backs off gradually so a long queue doesn't hammer the API.
  const pendingJobId = job && (job.status === 'QUEUED' || job.status === 'RUNNING') ? job.jobId : null;
  useEffect(() => {
    if (!pendingJobId) return;
    let cancelled = false;
    let delay = POLL_MS;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.getCapeJob(pendingJobId);
        if (cancelled) return;
        setJob(next);
        if (next.status === 'SUCCEEDED' || next.status === 'FAILED') return;
      } catch {
        // Transient failure: keep polling with a longer delay.
      }
      delay = Math.min(Math.round(delay * 1.3), MAX_POLL_MS);
      if (!cancelled) timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pendingJobId]);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const onJobChangeRef = useRef(onJobChange);
  onJobChangeRef.current = onJobChange;
  useEffect(() => { onJobChangeRef.current?.(job); }, [job]);

  const [assignments, setAssignments] = useState<PlayerDrillAssignment[]>([]);
  const [assigningCode, setAssigningCode] = useState('');
  const [assignError, setAssignError] = useState('');
  const succeededJobId = job?.status === 'SUCCEEDED' ? job.jobId : null;
  useEffect(() => {
    setAssignments([]);
    setAssignError('');
    if (!succeededJobId) return;
    let cancelled = false;
    api.getCapeJobDrillAssignments(succeededJobId)
      .then(found => { if (!cancelled) setAssignments(found); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [succeededJobId]);

  const assignDrill = async (faultCode: string) => {
    if (!succeededJobId) return;
    setAssigningCode(faultCode);
    setAssignError('');
    try {
      const assignment = await api.assignCapeGuidanceDrill(succeededJobId, faultCode);
      setAssignments(current => current.some(a => a.id === assignment.id) ? current : [...current, assignment]);
    } catch (assignFailure) {
      setAssignError(assignFailure instanceof Error ? assignFailure.message : 'Failed to assign the drill');
    } finally {
      setAssigningCode('');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !frameReady) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const radius = Math.max(6, canvas.width / 120);
    ctx.lineWidth = Math.max(2, radius / 3);
    ctx.strokeStyle = '#34d399';
    if (points.length > 1) {
      ctx.beginPath();
      points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      if (points.length === 4) ctx.closePath();
      ctx.stroke();
    }
    ctx.font = `bold ${radius * 2}px sans-serif`;
    points.forEach(([x, y], index) => {
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(index + 1), x + radius * 1.4, y - radius * 1.4);
    });
  }, [points, frameReady]);

  if (!target) return null;

  const chooseFile = (chosen: File | null) => {
    resetFrame();
    setFile(chosen);
    setVideoUrl(chosen ? URL.createObjectURL(chosen) : '');
  };

  // Standalone mode: load the video picked above so its first frame can be calibrated.
  const startSetup = async () => {
    setIsSetup(true);
    if (!isStandalone || !source) return;
    if (source.file) {
      chooseFile(source.file);
      return;
    }
    if (!source.driveFileId) return;
    resetFrame();
    setIsLoadingVideo(true);
    try {
      const blob = await api.fetchDriveVideo(source.driveFileId);
      setVideoUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The video could not be loaded from Google Drive.');
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const onFrameLoaded = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    setFrameReady(true);
  };

  const tapCorner = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length >= 4) return;
    const rect = canvas.getBoundingClientRect();
    // Map the tap from displayed size to the video's native pixel grid, which is what CAPE expects.
    const x = Math.round((event.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((event.clientY - rect.top) * (canvas.height / rect.height));
    setPoints(current => [...current, [x, y]]);
  };

  const manualSource = isStandalone
    ? (source?.file ? { file: source.file } : source?.driveFileId ? { driveFileId: source.driveFileId } : null)
    : (file ? { file } : null);
  const useManualFrames = target === 'batter' && manualMode;
  const manualComplete = isManualSelectionValid(manualFrames);
  const canAnalyse = points.length === 4
    && (isStandalone ? Boolean(videoUrl && (source?.file || source?.driveFileId)) : Boolean(file))
    && (!useManualFrames || manualComplete);

  const submit = async () => {
    if (!canAnalyse) return;
    setIsSubmitting(true);
    setError('');
    try {
      const input = {
        target,
        handedness,
        shot_type: target === 'batter' ? shotType : undefined,
        bowler_type: target === 'bowler' ? bowlerType : undefined,
        calibration_points: points,
        manual_frames: useManualFrames && manualComplete ? manualFrames : undefined
      };
      const created = assessmentId
        ? await api.analyzeAssessmentVideoWithCape(assessmentId, file!, input)
        : await api.analyzePlayerVideoWithCape(playerId!, source?.file ? { file: source.file } : { driveFileId: source!.driveFileId }, input);
      setJob({ jobId: created.jobId, status: created.status, queuePosition: null, attempts: 0, error: null, errorMessage: null, result: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      setIsSetup(false);
      chooseFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The video could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPending = job?.status === 'QUEUED' || job?.status === 'RUNNING';

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-emerald-200">Detailed {target === 'batter' ? 'batting' : 'bowling'} analysis{isStandalone ? ' (pose, ball & speed)' : ''}</h4>
        {canSubmit && !isSetup && !isPending && (
          <button type="button" disabled={isStandalone && !source} onClick={startSetup} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50">
            {job ? <RotateCcw size={13} /> : <Upload size={13} />}
            {isStandalone
              ? (source ? (startLabel || `Run detailed analysis (${source.name})`) : 'Choose a video above')
              : job ? 'Analyse another video' : 'Analyse a video'}
          </button>
        )}
      </div>

      {isSetup && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {isStandalone ? (
              <div className="text-xs text-slate-400">Video
                <p className="mt-1 truncate rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white" title={source?.name}>{source?.name || '—'}</p>
              </div>
            ) : (
              <label className="text-xs text-slate-400">Video
                <input type="file" accept="video/*" onChange={event => chooseFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-slate-200" />
              </label>
            )}
            <label className="text-xs text-slate-400">{target === 'batter' ? 'Batter' : 'Bowler'} hand
              <select value={handedness} onChange={event => setHandedness(event.target.value as 'right' | 'left')} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white">
                <option value="right">Right-handed</option>
                <option value="left">Left-handed</option>
              </select>
            </label>
            {target === 'batter' ? (
              <label className="text-xs text-slate-400">Shot
                <select value={shotType} onChange={event => setShotType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white">
                  {SHOT_TYPES.map(value => <option key={value} value={value}>{label(value)}</option>)}
                </select>
              </label>
            ) : (
              <label className="text-xs text-slate-400">Bowling type
                <select value={bowlerType} onChange={event => setBowlerType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white">
                  {BOWLER_TYPES.map(value => <option key={value} value={value}>{label(value)}</option>)}
                </select>
              </label>
            )}
          </div>

          {videoUrl && (
            <div className="space-y-2">
              <p className="text-xs text-slate-300">
                {points.length < 4
                  ? <>Tap the pitch corners in order: <strong className="text-white">{points.length + 1}. {CORNER_LABELS[points.length]}</strong> (left/right as seen from the bowler’s end).</>
                  : 'All four corners marked.'}
              </p>
              <video ref={videoRef} src={videoUrl} muted playsInline preload="auto" className="hidden" onLoadedMetadata={event => { event.currentTarget.currentTime = 0.05; }} onSeeked={onFrameLoaded} onError={() => setError('This video could not be played in the browser, so its corners cannot be marked. Try an MP4 (H.264) file.')} />
              <canvas ref={canvasRef} onClick={tapCorner} className={`w-full max-w-2xl rounded-lg border border-slate-700 ${points.length < 4 ? 'cursor-crosshair' : ''} ${frameReady ? '' : 'hidden'}`} />
              {!frameReady && <p className="text-xs text-slate-400">Loading the first frame…</p>}
              {points.length > 0 && <button type="button" onClick={() => setPoints([])} className="text-xs text-slate-400 underline">Reset corners</button>}
            </div>
          )}

          {isLoadingVideo && <p className="inline-flex items-center gap-2 text-xs text-slate-300"><Loader2 size={13} className="animate-spin" />Loading the video from Google Drive…</p>}

          {target === 'batter' && (
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={manualMode} onChange={event => { setManualMode(event.target.checked); setManualFrames(EMPTY_SELECTION); }} className="h-3.5 w-3.5 accent-emerald-500" />
                Select the contact frames manually (for poor-quality video)
              </label>
              {manualMode && (
                manualSource
                  ? <ManualFramePicker key={sourceKey || file?.name || ''} source={manualSource} selection={manualFrames} onChange={setManualFrames} />
                  : <p className="text-xs text-amber-300">Choose a video first to load its frames.</p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-rose-300">{error}</p>}
          {!canAnalyse && !error && !isLoadingVideo && (
            <p className="text-xs text-amber-300">
              {!videoUrl ? (isStandalone ? 'Choose a video above first.' : 'Choose a video to analyse.')
                : !frameReady ? 'Waiting for the first frame of the video…'
                  : points.length < 4 ? `Click ${4 - points.length} more pitch corner${4 - points.length === 1 ? '' : 's'} on the frame to enable Analyse.`
                    : 'Tag at least one contact frame (pre- and post-contact frames are optional, in time order) to enable Analyse.'}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!canAnalyse || isSubmitting} onClick={submit} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50">
              {isSubmitting && <Loader2 size={13} className="animate-spin" />} Analyse
            </button>
            <button type="button" onClick={() => { setIsSetup(false); resetFrame(); }} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {!isSetup && !job && (
        <p className="mt-1 text-xs text-slate-400">
          {!canSubmit ? 'No detailed analysis for this assessment.'
            : isStandalone ? 'Measures joint angles, ball speed, line and length from the selected video, with downloadable annotated images.'
              : 'Upload a clip to get pose, error and recommendation feedback with downloadable images.'}
        </p>
      )}

      {!isSetup && isPending && (
        <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-300">
          <Loader2 size={14} className="animate-spin text-emerald-300" />
          {job!.status === 'RUNNING' ? 'Analysing the video…' : job!.queuePosition ? `Queued – position ${job!.queuePosition}` : 'Queued…'} You can leave this page and come back.
        </p>
      )}

      {!isSetup && job?.status === 'FAILED' && (
        <p className="mt-2 flex items-start gap-2 text-xs text-rose-300"><XCircle size={14} className="mt-0.5 shrink-0" />{job.errorMessage || 'The analysis failed.'}</p>
      )}

      {!isSetup && job?.status === 'SUCCEEDED' && job.result && (
        <CapeResultView
          result={job.result}
          drillAssignment={{
            playerName: job.playerName || 'player',
            assignments,
            assigningCode,
            error: assignError,
            onAssign: canAssignDrills ? assignDrill : undefined
          }}
        />
      )}
    </div>
  );
};

type FrameRole = 'pre_contact' | 'point_of_contact' | 'post_contact';
type ManualSelection = Record<FrameRole, number[]>;

const EMPTY_SELECTION: ManualSelection = { pre_contact: [], point_of_contact: [], post_contact: [] };
const MAX_FRAMES_PER_ROLE = 20;

const FRAME_ROLES: { role: FrameRole; label: string; short: string; tone: string }[] = [
  { role: 'pre_contact', label: 'Pre-contact', short: 'PRE', tone: 'border-sky-400 bg-sky-500 text-slate-950' },
  { role: 'point_of_contact', label: 'Contact', short: 'CONTACT', tone: 'border-emerald-400 bg-emerald-500 text-slate-950' },
  { role: 'post_contact', label: 'Post-contact', short: 'POST', tone: 'border-violet-400 bg-violet-500 text-slate-950' }
];

// Only contact is required; empty pre/post sides are scanned automatically by CAPE.
const isManualSelectionComplete = (selection: ManualSelection) => selection.point_of_contact.length > 0;

const isManualSelectionValid = (selection: ManualSelection) => {
  const { pre_contact: pre, point_of_contact: contact, post_contact: post } = selection;
  return isManualSelectionComplete(selection)
    && (pre.length === 0 || Math.max(...pre) < Math.min(...contact))
    && (post.length === 0 || Math.max(...contact) < Math.min(...post));
};

const ManualFramePicker: React.FC<{
  source: { file?: File; driveFileId?: string };
  selection: ManualSelection;
  onChange: (selection: ManualSelection) => void;
}> = ({ source, selection, onChange }) => {
  const [candidates, setCandidates] = useState<CapeContactCandidates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeRole, setActiveRole] = useState<FrameRole>('pre_contact');

  const load = async (centerFrame?: number) => {
    setIsLoading(true);
    setLoadError('');
    try {
      setCandidates(await api.getCapeContactCandidates(source, { centerFrame }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'The video frames could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  const roleOf = (index: number) => FRAME_ROLES.find(({ role }) => selection[role].includes(index))?.role;

  // Clicking toggles the frame in the active role; a frame can belong to only one role.
  const pickFrame = (index: number) => {
    if (selection[activeRole].includes(index)) {
      onChange({ ...selection, [activeRole]: selection[activeRole].filter(frame => frame !== index) });
      return;
    }
    if (selection[activeRole].length >= MAX_FRAMES_PER_ROLE) return;
    const next = { ...selection };
    FRAME_ROLES.forEach(({ role }) => { next[role] = next[role].filter(frame => frame !== index); });
    next[activeRole] = [...next[activeRole], index].sort((a, b) => a - b);
    onChange(next);
  };

  const frames = candidates?.frames || [];
  const first = frames[0]?.index;
  const last = frames[frames.length - 1]?.index;
  const span = frames.length;
  const hasOrderProblem = isManualSelectionComplete(selection) && !isManualSelectionValid(selection);
  const hasSelection = FRAME_ROLES.some(({ role }) => selection[role].length > 0);

  if (!candidates) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-950/40 p-3">
        <p className="text-xs text-slate-400">Load frames around the bat-ball contact suggested by Gemini, then tag one or more contact frames, and optionally pre- and post-contact frames. This can take up to a couple of minutes.</p>
        <button type="button" disabled={isLoading} onClick={() => load()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Images size={13} />}
          {isLoading ? 'Finding the contact frame…' : 'Load frames'}
        </button>
        {loadError && <p className="mt-2 text-xs text-rose-300">{loadError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">Tag as:</span>
        {FRAME_ROLES.map(({ role, label: roleLabel, tone }) => (
          <button
            key={role}
            type="button"
            onClick={() => setActiveRole(role)}
            title={selection[role].length ? `Frames ${selection[role].map(frame => `#${frame}`).join(', ')}` : undefined}
            className={`rounded-full border px-2.5 py-0.5 font-semibold ${activeRole === role ? tone : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}
          >
            {roleLabel} · {selection[role].length}
          </button>
        ))}
        {hasSelection && (
          <button type="button" onClick={() => { onChange(EMPTY_SELECTION); setActiveRole('pre_contact'); }} className="text-slate-400 underline">Clear</button>
        )}
      </div>
      <p className="text-xs text-slate-400">
        {candidates.suggestion_source === 'gemini' && candidates.suggested_frame !== null
          ? <>Gemini suggests frame <strong className="text-emerald-200">#{candidates.suggested_frame}</strong> as the point of contact. </>
          : candidates.suggestion_note ? <>{candidates.suggestion_note} </> : null}
        Showing frames {first}–{last} of {candidates.frame_count} ({formatNumber(candidates.framerate_fps, 1)} fps).
      </p>
      <p className="text-xs text-slate-500">Only a contact frame is required. Pick several pre-contact frames to trace the bat swing and several post-contact frames to trace the follow-through; any side left empty is scanned automatically (about one second around contact). If you tag more than one contact frame, CAPE uses the clearest one.</p>
      <div className="flex items-stretch gap-2">
        <button type="button" disabled={isLoading || first === undefined || first <= 0} onClick={() => load(Math.max(0, first! - Math.ceil(span / 2)))} title="Earlier frames" className="shrink-0 rounded-lg border border-slate-700 px-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <div className={`flex flex-1 gap-2 overflow-x-auto pb-2 ${isLoading ? 'opacity-50' : ''}`}>
          {frames.map(frame => {
            const role = roleOf(frame.index);
            const roleInfo = FRAME_ROLES.find(item => item.role === role);
            const isSuggested = frame.index === candidates.suggested_frame;
            return (
              <button
                key={frame.index}
                type="button"
                disabled={isLoading}
                onClick={() => pickFrame(frame.index)}
                className={`relative w-28 shrink-0 overflow-hidden rounded-lg border-2 text-left ${roleInfo ? roleInfo.tone.split(' ')[0] : isSuggested ? 'border-amber-400/70' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <img src={`data:image/jpeg;base64,${frame.image_base64}`} alt={`Frame ${frame.index}`} className="block h-auto w-full" />
                {roleInfo && <span className={`absolute left-1 top-1 rounded px-1 text-[10px] font-bold ${roleInfo.tone}`}>{roleInfo.short}</span>}
                {isSuggested && <span className="absolute right-1 top-1 rounded bg-amber-400 px-1 text-[10px] font-bold text-slate-950">AI</span>}
                <span className="block bg-slate-900 px-1 py-0.5 text-[10px] text-slate-300">#{frame.index} · {frame.time_s.toFixed(2)}s</span>
              </button>
            );
          })}
        </div>
        <button type="button" disabled={isLoading || last === undefined || last >= candidates.frame_count - 1} onClick={() => load(Math.min(candidates.frame_count - 1, last! + Math.ceil(span / 2)))} title="Later frames" className="shrink-0 rounded-lg border border-slate-700 px-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
      </div>
      {isLoading && <p className="inline-flex items-center gap-2 text-xs text-slate-300"><Loader2 size={13} className="animate-spin" />Loading frames…</p>}
      {loadError && <p className="text-xs text-rose-300">{loadError}</p>}
      {hasOrderProblem && <p className="text-xs text-rose-300">The frames must be in time order: pre-contact before contact, and contact before post-contact.</p>}
    </div>
  );
};

interface DrillAssignmentState {
  playerName: string;
  assignments: PlayerDrillAssignment[];
  assigningCode: string;
  error: string;
  onAssign?: (faultCode: string) => void;
}

const CapeResultView: React.FC<{ result: CapeResult; drillAssignment: DrillAssignmentState }> = ({ result, drillAssignment }) => {
  const { coaching, delivery, analytics_payload: payload } = result;
  const assignedByFault = new Map(drillAssignment.assignments.map(assignment => [assignment.faultCode, assignment]));
  const [images, setImages] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState('');
  const contact = payload.point_of_contact;
  const postContact = payload.post_contact;
  const angles = contact?.batter_joint_angles || payload.pre_contact?.batter_joint_angles || payload.release?.bowler_joint_angles || {};
  const faultByMetric = new Map(coaching.faults.map(fault => [fault.metric, fault]));
  const snapshots = Object.entries(result.download_endpoints).filter((entry): entry is [string, string] => entry[0] !== 'all_zip' && Boolean(entry[1]));
  const impactSnapshot = snapshots.find(([key]) => key === 'impact_snapshot');
  const secondarySnapshots = snapshots.filter(([key]) => key !== 'impact_snapshot');
  const zipPath = result.download_endpoints.all_zip;
  const kinematicRows = [
    ...Object.entries(angles).map(([metric, value]) => ({ metric, value, unit: '°' })),
    ...(contact?.head_front_knee_offset_pct === null || contact?.head_front_knee_offset_pct === undefined
      ? [] : [{ metric: 'head_front_knee_offset_pct', value: contact.head_front_knee_offset_pct, unit: '%' }]),
    ...(contact?.bat_angle_degrees === null || contact?.bat_angle_degrees === undefined
      ? [] : [{ metric: 'bat_angle_deg', value: contact.bat_angle_degrees, unit: '°' }]),
    ...(contact?.stride_m === null || contact?.stride_m === undefined
      ? [] : [{ metric: 'stride_m', value: contact.stride_m, unit: ' m' }]),
    ...(contact?.front_foot_to_contact_angle_degrees === null || contact?.front_foot_to_contact_angle_degrees === undefined
      ? [] : [{ metric: 'front_foot_to_contact_angle', value: contact.front_foot_to_contact_angle_degrees, unit: '°' }]),
    ...(contact?.front_toe_contact_distance_cm === null || contact?.front_toe_contact_distance_cm === undefined
      ? [] : [{ metric: 'front_toe_contact_distance', value: contact.front_toe_contact_distance_cm, unit: ' cm' }])
  ];
  const alignmentRows = [
    { metric: 'chin_front_toe_offset_pct', name: 'Chin over front toe', value: contact?.chin_front_toe_offset_pct, unit: '%', expected: '≤ 20%' },
    { metric: 'front_shoulder_target_angle_deg', name: 'Front shoulder to target', value: contact?.front_shoulder_target_angle_degrees, unit: '°', expected: '≤ 25°' },
    { metric: 'back_foot_crease_angle_deg', name: 'Back foot to crease', value: contact?.back_foot_crease_angle_degrees, unit: '°', expected: '≤ 20°' },
    { metric: 'front_elbow_height_pct', name: 'Front elbow height', value: contact?.front_elbow_height_pct, unit: '%', expected: '≥ -5%' }
  ];
  const kineticRows = [
    { name: 'Incoming ball speed', value: contact?.ball_velocity_kmh, unit: ' km/h' },
    { name: 'Incoming momentum', value: contact?.estimated_ball_momentum_kg_m_s, unit: ' kg m/s' },
    { name: 'Incoming kinetic energy', value: contact?.estimated_ball_kinetic_energy_j, unit: ' J' },
    { name: 'Exit speed', value: postContact?.exit_velocity_kmh, unit: ' km/h' },
    { name: 'Exit momentum', value: postContact?.estimated_ball_momentum_kg_m_s, unit: ' kg m/s' },
    { name: 'Exit kinetic energy', value: postContact?.estimated_ball_kinetic_energy_j, unit: ' J' },
    { name: 'Launch angle', value: postContact?.launch_angle_degrees, unit: '°' },
    { name: 'Bat swing speed before contact (est.)', value: payload.pre_contact?.bat_swing_speed_kmh, unit: ' km/h' },
    { name: `Bat swing arc${payload.pre_contact?.bat_swing_estimated ? ' (est. from forearms)' : ''}${payload.pre_contact?.swing_frames_auto ? ' · auto-detected frames' : ''}`, value: payload.pre_contact?.bat_swing_arc_degrees, unit: '°' },
    { name: `Follow-through arc${postContact?.follow_through_estimated ? ' (est. from forearms)' : ''}${postContact?.follow_through_frames_auto ? ' · auto-detected frames' : ''}`, value: postContact?.follow_through_arc_degrees, unit: '°' }
  ].filter((row): row is { name: string; value: number; unit: string } => row.value !== null && row.value !== undefined);
  const contactCandidates = contact?.candidate_frames || [];

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    Promise.all(snapshots.map(async ([key, path]) => {
      try {
        const { blob } = await api.fetchCapeArtifact(path);
        const url = URL.createObjectURL(blob);
        created.push(url);
        return [key, url] as const;
      } catch {
        return null;
      }
    })).then(entries => {
      if (!cancelled) setImages(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    });
    return () => { cancelled = true; created.forEach(url => URL.revokeObjectURL(url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.session_id]);

  const download = async (path: string) => {
    setDownloadError('');
    try {
      const { blob, fileName } = await api.fetchCapeArtifact(path);
      saveBlob(blob, fileName);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'The download failed.');
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${severityStyle(coaching.score >= 70 ? 'ok' : coaching.score >= 40 ? 'medium' : 'high')}`}>{coaching.score}</div>
        <div>
          <p className="text-sm font-semibold text-white">{coaching.verdict}</p>
          <p className="text-[11px] text-slate-400">{label(result.metadata.shot_type || result.metadata.bowler_type || result.metadata.target)} · {result.metadata.handedness}-handed</p>
          {contact?.selection_source === 'manual' && (
            <p className="text-[11px] text-slate-400">
              Contact frame #{contact.milestone_frame}{contactCandidates.length > 1 ? ` chosen from ${contactCandidates.length} selected frames` : ' selected manually'}
            </p>
          )}
        </div>
      </div>

      {delivery && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-200">Speed {delivery.speed_kmh === null ? '—' : `${formatNumber(delivery.speed_kmh, 0)} ± ${formatNumber(delivery.speed_tolerance_kmh, 0)} km/h`}</span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-200">Length: {label(delivery.length_zone)} ({formatNumber(delivery.length_m)} m)</span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-200">Line: {label(delivery.line_zone)}</span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${severityStyle(delivery.is_good_ball ? 'ok' : 'medium')}`}>
            {delivery.is_good_ball ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {delivery.is_good_ball ? 'Good ball' : 'Not a good ball'}
          </span>
        </div>
      )}

      {kinematicRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Kinematics</th><th className="py-1 pr-2 font-medium">Measured</th><th className="py-1 pr-2 font-medium">Expected</th><th className="py-1 font-medium">Status</th></tr></thead>
            <tbody>
              {kinematicRows.map(({ metric, value, unit }) => {
                const fault = faultByMetric.get(metric);
                return (
                  <tr key={metric} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2 text-slate-200">{label(metric)}</td>
                    <td className="py-1.5 pr-2 text-white">{formatNumber(value)}{unit}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{fault ? `${expectedRange(fault)}${unit}` : 'Observed'}</td>
                    <td className="py-1.5"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityStyle(fault ? fault.severity : 'ok')}`}>{fault ? label(fault.severity) : 'Measured'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {contact && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Alignment checklist</th><th className="py-1 pr-2 font-medium">Measured</th><th className="py-1 pr-2 font-medium">Expected</th><th className="py-1 font-medium">Status</th></tr></thead>
            <tbody>
              {alignmentRows.map(row => {
                const fault = faultByMetric.get(row.metric);
                return (
                  <tr key={row.metric} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2 text-slate-200">{row.name}</td>
                    <td className="py-1.5 pr-2 text-white">{formatNumber(row.value)}{row.unit}</td>
                    <td className="py-1.5 pr-2 text-slate-400">{row.expected}</td>
                    <td className="py-1.5">
                      {row.value === null || row.value === undefined
                        ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">Unavailable</span>
                        : <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityStyle(fault ? fault.severity : 'ok')}`}>{fault ? label(fault.severity) : 'Aligned'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">Chin alignment uses the detected face centre as a 2D chin-line proxy.</p>
        </div>
      )}

      {kineticRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Kinetics</th><th className="py-1 font-medium">Estimated</th></tr></thead>
            <tbody>
              {kineticRows.map(row => (
                <tr key={row.name} className="border-t border-slate-800">
                  <td className="py-1.5 pr-2 text-slate-200">{row.name}</td>
                  <td className="py-1.5 text-white">{formatNumber(row.value)}{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">Momentum and energy use the calibrated 2D track and an assumed 156 g cricket ball.</p>
        </div>
      )}

      {coaching.faults.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-white">What to fix</h5>
          {coaching.faults.map(fault => (
            <div key={fault.code} className={`rounded-lg border p-3 ${severityStyle(fault.severity)}`}>
              <p className="text-xs font-semibold">{fault.message} <span className="font-normal opacity-80">({label(fault.severity)})</span></p>
              <p className="mt-1 text-[11px] text-slate-300">{label(fault.metric)}: {formatNumber(fault.value)} · expected {expectedRange(fault)} · {label(fault.milestone)}</p>
              <p className="mt-1 text-xs text-slate-200">{fault.recommendation}</p>
              {fault.drill && <p className="mt-1 text-[11px] text-slate-400">Drill: {fault.drill}</p>}
            </div>
          ))}
        </div>
      )}

      {coaching.ai_guidance && (
        <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
          <div>
            <h5 className="flex items-center gap-1.5 text-xs font-semibold text-violet-200">
              <Sparkles size={14} /> Coaching guidance
            </h5>
            <p className="mt-1 text-xs text-slate-200">{coaching.ai_guidance.summary}</p>
            <p className="mt-1 text-[11px] text-slate-500">Generated by Gemini from CAPE’s measured findings; Gemini does not change measurements or severity.</p>
          </div>
          {coaching.ai_guidance.items.map(item => (
            <div key={item.fault_code} className="rounded-lg border border-violet-400/20 bg-slate-950/40 p-3">
              <p className="text-xs font-semibold text-violet-200">{item.title}</p>
              <p className="mt-1 text-[11px] text-slate-300">{item.why_it_matters}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Coaching cues</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-200">
                {item.coaching_cues.map(cue => <li key={cue}>{cue}</li>)}
              </ul>
              <p className="mt-2 text-xs font-semibold text-emerald-300">Drill: {item.drill.name}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[11px] text-slate-300">
                {item.drill.instructions.map(step => <li key={step}>{step}</li>)}
              </ol>
              {item.drill.equipment.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">Equipment: {item.drill.equipment.join(', ')}</p>
              )}
              {assignedByFault.has(item.fault_code) ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 size={13} /> Assigned to {assignedByFault.get(item.fault_code)!.playerName}
                </p>
              ) : drillAssignment.onAssign && (
                <button
                  type="button"
                  disabled={Boolean(drillAssignment.assigningCode)}
                  onClick={() => drillAssignment.onAssign!(item.fault_code)}
                  title="Assigns this drill to the player and adds it to the club and system drill catalogues"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
                >
                  {drillAssignment.assigningCode === item.fault_code ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  Assign to {drillAssignment.playerName}
                </button>
              )}
            </div>
          ))}
          {drillAssignment.error && <p role="alert" className="text-xs text-rose-300">{drillAssignment.error}</p>}
          {drillAssignment.assignments.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <h5 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                <ClipboardCheck size={14} /> Assigned drills
              </h5>
              <ul className="mt-1 space-y-1 text-xs text-slate-200">
                {drillAssignment.assignments.map(assignment => (
                  <li key={assignment.id}>
                    {assignment.title} <span className="text-[11px] text-slate-400">· {assignment.details.correction || label(assignment.faultCode || '')} · {new Date(assignment.createdAt).toLocaleDateString()}{assignment.assignedByName ? ` · by ${assignment.assignedByName}` : ''}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-slate-500">Also added to the club and system drill catalogues.</p>
            </div>
          )}
        </div>
      )}

      {coaching.strengths.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-white">Strengths</h5>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">{coaching.strengths.map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {coaching.summary && coaching.summary !== coaching.ai_guidance?.summary && (
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">{coaching.summary}</p>
      )}
      {coaching.unavailable.length > 0 && <p className="text-[11px] text-slate-500">Not measured: {coaching.unavailable.map(label).join(', ')}</p>}

      {snapshots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-white">Images</h5>
            {zipPath && <button type="button" onClick={() => download(zipPath)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-400"><Download size={13} /> Download all (ZIP)</button>}
          </div>
          {impactSnapshot && (
            <figure className="overflow-hidden rounded-lg border border-emerald-500/20 bg-slate-950/50">
              {images[impactSnapshot[0]]
                ? <img src={images[impactSnapshot[0]]} alt="Point of contact" className="max-h-[85vh] w-full bg-black object-contain" />
                : <div className="flex min-h-96 items-center justify-center text-[11px] text-slate-500">Loading…</div>}
              <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
                Point of contact · geometry overlay
                <button type="button" onClick={() => download(impactSnapshot[1])} aria-label="Download Point of contact" className="text-slate-400 hover:text-emerald-300"><Download size={14} /></button>
              </figcaption>
            </figure>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {secondarySnapshots.map(([key, path]) => (
              <figure key={key} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                {images[key] ? <img src={images[key]} alt={SNAPSHOT_LABELS[key] || label(key)} className="max-h-[55vh] w-full bg-black object-contain" /> : <div className="flex aspect-video items-center justify-center text-[11px] text-slate-500">Loading…</div>}
                <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-slate-300">
                  {SNAPSHOT_LABELS[key] || label(key)}
                  <button type="button" onClick={() => download(path)} aria-label={`Download ${SNAPSHOT_LABELS[key] || key}`} className="text-slate-400 hover:text-emerald-300"><Download size={13} /></button>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
      {downloadError && <p className="text-xs text-rose-300">{downloadError}</p>}
    </div>
  );
};
