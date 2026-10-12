import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Loader2, RotateCcw, Upload, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CapeFault, CapeJob, CapeResult, CapeTarget } from '../../types';

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
}

export const CapeAnalysisPanel: React.FC<CapeAnalysisPanelProps> = ({ assessmentId, playerId, source, discipline, canSubmit }) => {
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceKey = source ? `${source.driveFileId || ''}|${source.name}|${source.file?.size ?? ''}` : '';

  const resetFrame = () => {
    setError('');
    setPoints([]);
    setFrameReady(false);
    setFile(null);
    setVideoUrl('');
  };

  useEffect(() => {
    if (!target || (!assessmentId && !playerId)) return;
    let cancelled = false;
    setJob(null);
    const load = assessmentId ? api.getAssessmentCapeJob(assessmentId) : api.getLatestPlayerCapeJob(playerId!, target);
    load.then(found => { if (!cancelled) setJob(found); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [assessmentId, playerId, target]);

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

  const canAnalyse = points.length === 4 && (isStandalone ? Boolean(videoUrl && (source?.file || source?.driveFileId)) : Boolean(file));

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
        calibration_points: points
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
              ? (source ? `Run detailed analysis (${source.name})` : 'Choose a video above')
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

          {error && <p className="text-xs text-rose-300">{error}</p>}
          {!canAnalyse && !error && !isLoadingVideo && (
            <p className="text-xs text-amber-300">
              {!videoUrl ? (isStandalone ? 'Choose a video above first.' : 'Choose a video to analyse.')
                : !frameReady ? 'Waiting for the first frame of the video…'
                  : `Click ${4 - points.length} more pitch corner${4 - points.length === 1 ? '' : 's'} on the frame to enable Analyse.`}
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

      {!isSetup && job?.status === 'SUCCEEDED' && job.result && <CapeResultView result={job.result} />}
    </div>
  );
};

const CapeResultView: React.FC<{ result: CapeResult }> = ({ result }) => {
  const { coaching, delivery, analytics_payload: payload } = result;
  const [images, setImages] = useState<Record<string, string>>({});
  const [downloadError, setDownloadError] = useState('');
  const angles = payload.pre_contact?.batter_joint_angles || payload.release?.bowler_joint_angles || {};
  const faultByMetric = new Map(coaching.faults.map(fault => [fault.metric, fault]));
  const snapshots = Object.entries(result.download_endpoints).filter((entry): entry is [string, string] => entry[0] !== 'all_zip' && Boolean(entry[1]));
  const zipPath = result.download_endpoints.all_zip;

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

      {Object.keys(angles).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Pose</th><th className="py-1 pr-2 font-medium">Measured</th><th className="py-1 pr-2 font-medium">Expected</th><th className="py-1 font-medium">Status</th></tr></thead>
            <tbody>
              {Object.entries(angles).map(([metric, value]) => {
                const fault = faultByMetric.get(metric);
                return (
                  <tr key={metric} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2 text-slate-200">{label(metric)}</td>
                    <td className="py-1.5 pr-2 text-white">{formatNumber(value)}°</td>
                    <td className="py-1.5 pr-2 text-slate-400">{fault ? `${expectedRange(fault)}°` : 'In range'}</td>
                    <td className="py-1.5"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityStyle(fault ? fault.severity : 'ok')}`}>{fault ? label(fault.severity) : 'Good'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {coaching.strengths.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-white">Strengths</h5>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">{coaching.strengths.map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      )}

      {coaching.summary && <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">{coaching.summary}</p>}
      {coaching.unavailable.length > 0 && <p className="text-[11px] text-slate-500">Not measured: {coaching.unavailable.map(label).join(', ')}</p>}

      {snapshots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-white">Images</h5>
            {zipPath && <button type="button" onClick={() => download(zipPath)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-400"><Download size={13} /> Download all (ZIP)</button>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {snapshots.map(([key, path]) => (
              <figure key={key} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                {images[key] ? <img src={images[key]} alt={SNAPSHOT_LABELS[key] || label(key)} className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center text-[11px] text-slate-500">Loading…</div>}
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
