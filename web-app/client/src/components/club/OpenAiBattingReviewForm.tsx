import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OpenAiBattingAnalysis } from '../../types';
import { api } from '../../services/api';
import { OpenAiCapeCalibrationPicker } from './OpenAiCapeCalibrationPicker';

export const OPENAI_BATTING_PRIORITIES = [
  ['footwork', 'Footwork'], ['head_alignment', 'Head alignment'], ['contact', 'Contact'],
  ['joint_angles', 'Joint angles'], ['bat_path', 'Bat path'], ['extension', 'Extension'], ['follow_through', 'Follow-through']
] as const;

export interface OpenAiBattingVideoSource {
  file?: File;
  driveFileId?: string;
}

interface OpenAiBattingReviewFormProps {
  source: OpenAiBattingVideoSource | null;
  playerId?: string;
  assessmentId?: string;
  // Extra conditions (outside the form) that block a run, e.g. a non-batting discipline.
  disabled?: boolean;
  onStart?: () => void;
  onComplete: (analysis: OpenAiBattingAnalysis) => void;
  onRunningChange?: (running: boolean) => void;
  // Rendered under the header, e.g. a video file picker.
  sourcePicker?: React.ReactNode;
  children?: React.ReactNode;
}

const formatTime = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(2).padStart(5, '0')}`;

// Batting video review settings (shot, camera, priorities, contact point, kinetics) and the run button.
export const OpenAiBattingReviewForm: React.FC<OpenAiBattingReviewFormProps> = ({
  source, playerId, assessmentId, disabled = false, onStart, onComplete, onRunningChange, sourcePicker, children
}) => {
  const sourceFile = source?.file;
  const sourceDriveFileId = source?.driveFileId;
  const stableSource = useMemo<OpenAiBattingVideoSource | null>(
    () => sourceFile ? { file: sourceFile } : sourceDriveFileId ? { driveFileId: sourceDriveFileId } : null,
    [sourceFile, sourceDriveFileId]
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shotType, setShotType] = useState<'front_foot_drive' | 'front_foot_defence' | 'unknown'>('unknown');
  const [batterHandedness, setBatterHandedness] = useState<'right' | 'left' | 'unknown'>('unknown');
  const [cameraView, setCameraView] = useState<'front_on' | 'side_on' | 'three_quarter' | 'unknown'>('unknown');
  const [playbackSpeed, setPlaybackSpeed] = useState<'real_time' | 'slow_motion' | 'unknown'>('unknown');
  const [captureFps, setCaptureFps] = useState('');
  const [priorities, setPriorities] = useState<string[]>(OPENAI_BATTING_PRIORITIES.map(([key]) => key));
  const [contactSelectionMode, setContactSelectionMode] = useState<'AI' | 'MANUAL'>('AI');
  const [useCapeKinetics, setUseCapeKinetics] = useState(false);
  const [capeCalibrationPoints, setCapeCalibrationPoints] = useState<[number, number][]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [contactTimestamp, setContactTimestamp] = useState<number | null>(null);
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setPreviewUrl(null);
    setVideoDuration(0);
    setContactTimestamp(null);
    setStartSeconds(0);
    setEndSeconds(0);
    setPreviewError(null);
    if (contactSelectionMode !== 'MANUAL') {
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    const setPreview = (blob: Blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
      setPreviewLoading(false);
    };

    setPreviewLoading(true);
    if (sourceFile) {
      setPreview(sourceFile);
    } else if (sourceDriveFileId) {
      api.fetchDriveVideo(sourceDriveFileId)
        .then(setPreview)
        .catch((err: any) => {
          if (cancelled) return;
          setPreviewError(err?.message || 'Could not load this Drive video preview.');
          setPreviewLoading(false);
        });
    } else {
      setPreviewLoading(false);
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contactSelectionMode, sourceFile, sourceDriveFileId]);

  useEffect(() => {
    setCapeCalibrationPoints([]);
  }, [sourceFile, sourceDriveFileId]);

  const setRunning = (running: boolean) => {
    setIsRunning(running);
    onRunningChange?.(running);
  };

  const runReview = async () => {
    setRunning(true);
    setError(null);
    onStart?.();
    try {
      const result = await api.analyzeOpenAiBatting({
        videoFile: sourceFile,
        driveFileId: sourceFile ? undefined : sourceDriveFileId,
        playerId: playerId || undefined,
        assessmentId,
        shotType,
        batterHandedness,
        cameraView,
        playbackSpeed,
        captureFps: captureFps ? Number(captureFps) : null,
        priorities,
        capeCalibrationPoints: useCapeKinetics ? capeCalibrationPoints : undefined,
        contactTimestampSeconds: contactSelectionMode === 'MANUAL' ? contactTimestamp ?? undefined : undefined,
        startTimeSeconds: contactSelectionMode === 'MANUAL' ? startSeconds : undefined,
        endTimeSeconds: contactSelectionMode === 'MANUAL' ? endSeconds : undefined
      });
      onComplete(result.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The batting review could not be completed. Please try again.');
    } finally {
      setRunning(false);
    }
  };

  const cannotRun = isRunning || disabled || !stableSource ||
    (useCapeKinetics && capeCalibrationPoints.length !== 4) ||
    (contactSelectionMode === 'MANUAL' &&
      (previewLoading || !previewUrl || videoDuration <= 0 || endSeconds <= startSeconds || contactTimestamp === null ||
        contactTimestamp < startSeconds || contactTimestamp > endSeconds));

  return (
    <div className="rounded-xl border border-violet-400/25 bg-violet-500/5 p-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-xs font-bold text-violet-200">Batting video review</h4>
          <p className="text-[11px] text-slate-400">Review a shot, choose the contact point, and get clear feedback to guide the next practice session.</p>
        </div>
        <button
          type="button"
          disabled={cannotRun}
          onClick={() => void runReview()}
          className="shrink-0 rounded-lg bg-violet-400 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? 'Preparing your review…' : 'Review batting'}
        </button>
      </div>
      {sourcePicker}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-[11px] text-slate-400">Shot type
          <select value={shotType} onChange={event => setShotType(event.target.value as typeof shotType)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
            <option value="unknown">Identify if visible</option><option value="front_foot_drive">Front-foot drive</option><option value="front_foot_defence">Front-foot defence</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400">Batter handedness
          <select value={batterHandedness} onChange={event => setBatterHandedness(event.target.value as typeof batterHandedness)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
            <option value="unknown">Unknown</option><option value="right">Right-handed</option><option value="left">Left-handed</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400">Camera view
          <select value={cameraView} onChange={event => setCameraView(event.target.value as typeof cameraView)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
            <option value="unknown">Unknown</option><option value="front_on">Front-on</option><option value="side_on">Side-on</option><option value="three_quarter">Three-quarter</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400">Playback speed
          <select value={playbackSpeed} onChange={event => setPlaybackSpeed(event.target.value as typeof playbackSpeed)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
            <option value="unknown">Unknown</option><option value="real_time">Real-time</option><option value="slow_motion">Slow motion</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-400">Video frame rate (optional)
          <input type="number" min="1" max="1000" step="any" value={captureFps} onChange={event => setCaptureFps(event.target.value)} placeholder="Unknown" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white placeholder:text-slate-600" />
        </label>
      </div>
      <fieldset className="rounded-md border border-slate-800 px-3 py-2">
        <legend className="px-1 text-[11px] font-semibold text-slate-400">Coaching priorities</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {OPENAI_BATTING_PRIORITIES.map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <input type="checkbox" checked={priorities.includes(key)} onChange={event => setPriorities(current => event.target.checked ? [...current, key] : current.filter(item => item !== key))} className="accent-violet-400" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2 rounded-lg border border-violet-400/15 bg-slate-950/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-300">Contact point:</span>
          <button
            type="button"
            aria-pressed={contactSelectionMode === 'AI'}
            onClick={() => setContactSelectionMode('AI')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${contactSelectionMode === 'AI' ? 'bg-violet-400 text-slate-950' : 'border border-slate-700 text-slate-300 hover:text-white'}`}
          >
            Suggest contact point
          </button>
          <button
            type="button"
            aria-pressed={contactSelectionMode === 'MANUAL'}
            onClick={() => setContactSelectionMode('MANUAL')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${contactSelectionMode === 'MANUAL' ? 'bg-violet-400 text-slate-950' : 'border border-slate-700 text-slate-300 hover:text-white'}`}
          >
            Choose manually
          </button>
        </div>
        {contactSelectionMode === 'MANUAL' && (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400">Set the shot start and end, then choose the contact point inside that range. Drag the video timeline or the Contact point slider.</p>
            {previewLoading && <p role="status" className="text-xs text-violet-200">Loading video preview…</p>}
            {previewError && <p role="alert" className="text-xs text-rose-300">{previewError}</p>}
            {previewUrl && (
              <>
                <video
                  ref={videoRef}
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="max-h-72 w-full rounded-lg bg-black"
                  onLoadedMetadata={event => {
                    const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                    setVideoDuration(duration);
                    setEndSeconds(duration);
                    setContactTimestamp(event.currentTarget.currentTime || 0);
                  }}
                  onTimeUpdate={event => {
                    const time = event.currentTarget.currentTime;
                    if (time >= startSeconds && time <= endSeconds) setContactTimestamp(time);
                  }}
                  onError={() => setPreviewError('This video format cannot be previewed in the browser. Try MP4 or WEBM.')}
                />
                {videoDuration > 0 && (
                  <div>
                    <div className="space-y-2 mb-3 rounded-md border border-slate-800 bg-slate-900/70 p-2">
                      <p className="text-[11px] font-semibold text-slate-300">Shot range to analyse</p>
                      {([
                        { kind: 'start', label: 'Start', value: startSeconds, update: setStartSeconds, min: 0, max: endSeconds },
                        { kind: 'end', label: 'End', value: endSeconds, update: setEndSeconds, min: startSeconds, max: videoDuration }
                      ] as const).map(range => (
                        <label key={range.kind} className="block text-[10px] text-slate-400">
                          <span className="flex justify-between"><span>{range.label} frame</span><span className="font-mono text-violet-200">{formatTime(range.value)}</span></span>
                          <input type="range" min={range.min} max={range.max} step="0.01" value={range.value}
                            onChange={event => {
                              const time = Number(event.target.value);
                              range.update(time);
                              if (range.kind === 'start' && (contactTimestamp ?? 0) < time) setContactTimestamp(time);
                              if (range.kind === 'end' && (contactTimestamp ?? 0) > time) setContactTimestamp(time);
                            }}
                            className="w-full accent-violet-400" />
                        </label>
                      ))}
                    </div>
                    <label className="block text-[11px] font-semibold text-slate-300">
                      <span className="flex items-center justify-between">
                        <span>Contact point</span>
                        <span className="font-mono text-violet-200">{formatTime(contactTimestamp ?? 0)}</span>
                      </span>
                      <input
                        type="range"
                        min={startSeconds}
                        max={Math.max(startSeconds, endSeconds)}
                        step="0.01"
                        value={Math.min(contactTimestamp ?? 0, videoDuration)}
                        onChange={event => {
                          const time = Number(event.target.value);
                          if (videoRef.current) videoRef.current.currentTime = time;
                          setContactTimestamp(time);
                        }}
                        className="mt-1 w-full accent-violet-400"
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="space-y-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
        <label className="flex items-start gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            checked={useCapeKinetics}
            onChange={event => setUseCapeKinetics(event.target.checked)}
            className="mt-0.5 accent-emerald-400"
          />
          <span><strong>Include ball and bat measurements</strong><span className="mt-0.5 block text-[10px] text-slate-400">Add estimates for ball speed and bat movement. Mark the four corners of the pitch for more accurate ball measurements.</span></span>
        </label>
        {useCapeKinetics && (
          <OpenAiCapeCalibrationPicker source={stableSource} points={capeCalibrationPoints} onChange={setCapeCalibrationPoints} />
        )}
      </div>
      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
      {children}
    </div>
  );
};
