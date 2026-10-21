import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { OpenAiBattingAnalysis, PoseOverlayAnalysis } from '../../types';

interface CroppedPoseOverlayPanelProps {
  imageDataUrl: string | null;
  analysis: OpenAiBattingAnalysis;
  sequenceFrames: OpenAiBattingAnalysis['poseSequenceFrames'];
}

const metricLabels: Record<string, string> = {
  front_elbow_angle_degrees: 'Front elbow angle',
  back_elbow_angle_degrees: 'Back elbow angle',
  front_knee_angle_degrees: 'Front knee angle',
  back_knee_angle_degrees: 'Back knee angle',
  front_elbow_height_above_shoulder_pct: 'Front elbow above shoulder',
  head_to_front_toe_horizontal_offset_pct: 'Head-to-front-toe offset',
  front_knee_to_toe_horizontal_offset_pct: 'Front knee-to-toe offset',
  shoulder_tilt_degrees: 'Shoulder tilt'
};

const metricUnit = (name: string) => name.endsWith('_degrees') ? '°' : '% of visible body height';

const jointMetricKeys = [
  'front_elbow_angle_degrees', 'back_elbow_angle_degrees',
  'front_knee_angle_degrees', 'back_knee_angle_degrees'
];
const alignmentMetricKeys = [
  'front_elbow_height_above_shoulder_pct', 'head_to_front_toe_horizontal_offset_pct',
  'front_knee_to_toe_horizontal_offset_pct', 'shoulder_tilt_degrees'
];
const worldAngleMetricKeys: Record<string, string> = {
  front_elbow_angle_degrees: 'front_elbow',
  back_elbow_angle_degrees: 'back_elbow',
  front_knee_angle_degrees: 'front_knee',
  back_knee_angle_degrees: 'back_knee'
};
const battingShotTypes = ['front_foot_drive', 'back_foot_drive', 'forward_defence', 'backward_defence', 'pull', 'cut', 'sweep'];
const formatShotType = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

type CapeRuleCheck = PoseOverlayAnalysis['coaching_rules']['checks'][number];

function expectedText(check: CapeRuleCheck | undefined, unit: string): string {
  const suffix = unit === 'm' ? ' m' : unit;
  if (!check) return 'Observed';
  const [minimum, maximum] = check.expected;
  if (minimum !== null && maximum !== null) return `${minimum}–${maximum}${suffix}`;
  if (minimum !== null) return `≥ ${minimum}${suffix}`;
  if (maximum !== null) return `≤ ${maximum}${suffix}`;
  return '—';
}

function formatExpectedValue(expected: [number | null, number | null], metric: string): string {
  const unit = metric.endsWith('_degrees') || metric.endsWith('_deg') || metric === 'front_knee' ? '°'
    : metric.endsWith('_m') ? 'm' : metric.endsWith('_cm') ? 'cm' : '%';
  const [minimum, maximum] = expected;
  const suffix = unit === 'm' ? ' m' : unit === 'cm' ? ' cm' : unit;
  if (minimum !== null && maximum !== null) return `${minimum}–${maximum}${suffix}`;
  if (minimum !== null) return `≥ ${minimum}${suffix}`;
  if (maximum !== null) return `≤ ${maximum}${suffix}`;
  return '—';
}

function statusText(check: CapeRuleCheck | undefined, available: boolean, alignment = false): string {
  if (!available || check?.status === 'unavailable') return 'Unavailable';
  if (check?.status === 'fault') return check.severity || 'fault';
  return alignment && check ? 'Aligned' : 'Measured';
}

function statusClass(status: string): string {
  if (status === 'high') return 'border-rose-500/40 bg-rose-500/20 text-rose-300';
  if (status === 'medium') return 'border-amber-500/40 bg-amber-500/20 text-amber-300';
  if (status === 'low') return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
  if (status === 'Aligned' || status === 'Measured') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  return 'border-slate-700 text-slate-400';
}

export const CroppedPoseOverlayPanel: React.FC<CroppedPoseOverlayPanelProps> = ({ imageDataUrl, analysis, sequenceFrames }) => {
  const [handedness, setHandedness] = useState<'right' | 'left'>('right');
  const [shotType, setShotType] = useState('front_foot_drive');
  const [result, setResult] = useState<PoseOverlayAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!imageDataUrl) {
      setResult(null);
      setIsLoading(false);
      setError('OpenAI did not return a usable batter crop for pose analysis.');
      return;
    }
    let cancelled = false;
    setResult(null);
    setIsLoading(true);
    setError('');
    api.analyzePoseOverlayImage(
      imageDataUrl,
      handedness,
      shotType,
      analysis.croppedContactLandmarksNorm,
      analysis.croppedContactPointNorm,
      sequenceFrames,
      { handle: analysis.croppedBatHandleNorm ?? null, toe: analysis.croppedBatToeNorm ?? null, angle: analysis.contactBatAngle?.angleDegrees ?? null }
    )
      .then(next => { if (!cancelled) setResult(next); })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'The cropped image pose analysis failed.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [imageDataUrl, handedness, shotType, retryCount, sequenceFrames, analysis.croppedContactLandmarksNorm, analysis.croppedContactPointNorm, analysis.croppedBatHandleNorm, analysis.croppedBatToeNorm, analysis.contactBatAngle]);

  const ruleChecks = result?.coaching_rules.checks || [];
  const metricRow = (group: 'alignment' | 'shot', metric: string, label: string, unit: string) => {
    const check = ruleChecks.find(item => item.group === group && item.metric === metric);
    const rawValue = result?.metrics[metric];
    const temporal = result?.temporal_angle_estimates[metric];
    const value = rawValue ?? temporal?.value ?? null;
    const usedTemporalEstimate = rawValue === null || rawValue === undefined ? temporal : undefined;
    const status = usedTemporalEstimate
      ? `Nearest frame #${usedTemporalEstimate.frame_index} (${usedTemporalEstimate.offset_ms > 0 ? '+' : ''}${usedTemporalEstimate.offset_ms} ms)`
      : statusText(check, value !== null, group === 'alignment');
    return {
      key: `${group}-${metric}`,
      label,
      value,
      unit,
      source: usedTemporalEstimate?.source || result?.metric_sources[metric],
      expected: expectedText(check, unit),
      status,
      severity: usedTemporalEstimate ? null : check?.severity
    };
  };
  const kinematicsRows = [
    metricRow('shot', 'back_knee', 'Back knee', '°'),
    metricRow('shot', 'back_elbow', 'Back elbow', '°'),
    metricRow('shot', 'front_knee', 'Front knee', '°'),
    metricRow('shot', 'front_elbow', 'Front elbow', '°'),
    metricRow('shot', 'shoulder_tilt_degrees', 'Shoulder tilt', '°'),
    metricRow('shot', 'head_front_knee_offset_pct', 'Head front-knee offset', '%'),
    metricRow('shot', 'bat_angle_deg', 'Bat angle', '°'),
    metricRow('shot', 'stride_m', 'Stride', 'm')
  ];
  const alignmentRows = [
    metricRow('alignment', 'chin_front_toe_offset_pct', 'Chin over front toe', '%'),
    metricRow('alignment', 'front_shoulder_target_angle_deg', 'Front shoulder to target', '°'),
    metricRow('alignment', 'back_foot_crease_angle_deg', 'Back foot to crease', '°'),
    metricRow('alignment', 'front_elbow_height_pct', 'Front elbow height', '%')
  ];
  const kineticsRows = [
    'Incoming ball speed', 'Incoming momentum', 'Incoming kinetic energy', 'Exit speed',
    'Exit momentum', 'Exit kinetic energy', 'Launch angle', 'Bat swing speed before contact',
    'Bat swing arc', 'Follow-through arc'
  ];

  return (
    <section className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-bold text-cyan-100">Pose overlay on OpenAI contact crop</h5>
          <p className="text-[11px] text-slate-400">OpenAI landmarks are primary; MediaPipe fills only missing points. YOLO and OpenCV provide person geometry and 2D calculations.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            Batter hand
            <select
              value={handedness}
              onChange={event => setHandedness(event.target.value as 'right' | 'left')}
              disabled={isLoading}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              <option value="right">Right-handed</option>
              <option value="left">Left-handed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            CAPE rule set
            <select
              value={shotType}
              onChange={event => setShotType(event.target.value)}
              disabled={isLoading}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              {battingShotTypes.map(type => <option key={type} value={type}>{formatShotType(type)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {isLoading && <p className="inline-flex items-center gap-2 text-xs text-cyan-100"><Loader2 size={14} className="animate-spin" />Drawing joints and calculating 2D alignment…</p>}
      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-xs text-rose-300">{error}</p>
          {imageDataUrl && (
            <button type="button" onClick={() => setRetryCount(count => count + 1)} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-cyan-300">
              Retry overlay
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
        <p className="text-sm font-semibold text-white">{analysis.summary}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-100">
            Contact: {analysis.contact.status.toLowerCase().replace(/_/g, ' ')} · {Math.round(analysis.contact.confidence * 100)}% confidence
          </span>
          {analysis.contact.frameIndex !== null && (
            <span className="text-slate-400">
              Frame #{analysis.contact.frameIndex} · {analysis.contact.timestampSeconds?.toFixed(3) ?? '—'}s
            </span>
          )}
          <span className="text-slate-500">{analysis.contact.selectionSource === 'MANUAL' ? 'Coach-selected reference' : 'AI-selected reference'}</span>
        </div>
        <p className="mt-2 text-xs text-slate-300">{analysis.contact.evidence}</p>
      </div>

      {result && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div>
              <h6 className="text-xs font-semibold uppercase tracking-wide text-violet-200">Detailed batting analysis</h6>
              <p className="mt-1 text-sm font-semibold text-white">{result.coaching_rules.verdict}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {formatShotType(result.coaching_rules.shot_type)} · {result.coaching_rules.checks_evaluated}/{result.coaching_rules.checks_applicable} CAPE checks evaluated · {result.landmark_source === 'openai+mediapipe-fallback' ? 'OpenAI primary + MediaPipe fallback' : result.landmark_source === 'openai' ? 'OpenAI landmarks' : 'MediaPipe landmarks'}
              </p>
            </div>
            {!result.coaching_rules.score_scope.startsWith('partial') && (
              <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-sm font-bold text-violet-100">{result.coaching_rules.score}/100</span>
            )}
          </section>

          <CapeStyleMetricTable title="Kinematics" rows={kinematicsRows} />
          <CapeStyleMetricTable title="Alignment checklist" rows={alignmentRows} />
          <section className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500"><tr><th className="py-1.5 pl-3 pr-2 font-medium">Kinetics</th><th className="py-1.5 pr-3 font-medium">Estimated</th></tr></thead>
              <tbody>
                {kineticsRows.map(name => (
                  <tr key={name} className="border-t border-slate-800 bg-slate-950/40">
                    <td className="py-2 pl-3 pr-2 text-slate-200">{name}</td>
                    <td className="py-2 pr-3 text-slate-500">Unavailable from one crop</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 pb-2 text-[10px] text-slate-500">{result.coaching_rules.metric_basis}</p>
          </section>

          {result.coaching_rules.faults.length > 0 && (
            <section className="space-y-2">
              <h6 className="text-xs font-semibold text-white">What to fix</h6>
              {result.coaching_rules.faults.map(fault => (
                <article key={fault.code} className={`rounded-lg border p-3 ${fault.severity === 'high' ? 'border-rose-400/30 bg-rose-500/10' : fault.severity === 'medium' ? 'border-amber-400/30 bg-amber-500/10' : 'border-yellow-400/20 bg-yellow-500/5'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h6 className="text-xs font-bold text-white">{fault.verdict || fault.message}</h6>
                    <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase">{fault.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{fault.message}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{fault.metric.replace(/_/g, ' ')}: {fault.value.toFixed(1)} · {formatExpectedValue(fault.expected, fault.metric)}</p>
                  <p className="mt-1 text-xs text-slate-200">{fault.recommendation}</p>
                  {fault.drill && <p className="mt-1 text-[11px] text-violet-200">Drill: {fault.drill}</p>}
                </article>
              ))}
            </section>
          )}
          {result.coaching_rules.strengths.length > 0 && (
            <section className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <h6 className="text-xs font-semibold text-emerald-200">Strengths</h6>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">{result.coaching_rules.strengths.map((strength, index) => <li key={index}>{strength}</li>)}</ul>
            </section>
          )}
          {result.coaching_rules.unavailable.length > 0 && (
            <p className="text-[11px] text-slate-400">Not evaluated: {result.coaching_rules.unavailable.map(name => name.replace(/_/g, ' ')).join(', ')}; these checks require additional frames or calibrated video.</p>
          )}
          <p className="text-[10px] text-slate-500">Rules loaded from CAPE’s shared coaching_rules.yaml. Expected ranges and status are taken directly from that rules file.</p>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <figure className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
              <img
                src={imageDataUrl || ''}
                alt="Enlarged batter crop produced from the selected OpenAI contact frame"
                className="max-h-[75vh] w-full bg-black object-contain"
              />
              <figcaption className="px-3 py-2 text-[11px] text-slate-400">OpenAI contact-frame crop sent to the pose service</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
              <img
                src={`data:${result.overlay_mime_type};base64,${result.overlay_image_base64}`}
                alt="MediaPipe and OpenAI pose landmarks with head-to-toe alignment and joint labels"
                className="max-h-[75vh] w-full bg-black object-contain"
              />
              <figcaption className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 text-[11px] text-slate-400">
                {result.width} × {result.height}px crop · magenta markers are OpenAI estimates; skeleton is MediaPipe{result.person_detection ? ` · YOLO person confidence ${Math.round(result.person_detection.confidence * 100)}%` : ''}
              </figcaption>
            </figure>
          </div>
          {result.sequence.length > 0 && (
            <section className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <div>
                <h6 className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Pose through contact</h6>
                <p className="mt-1 text-[11px] text-slate-400">Each overlay is independently estimated from a sampled source frame; apparent changes are 2D image-plane changes, not calibrated movement speed.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {result.sequence.map(frame => (
                  <figure key={`${frame.frame_index}-${frame.timestamp_seconds}`} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    {frame.status === 'success' && frame.overlay_image_base64 ? (
                      <img
                        src={`data:${frame.overlay_mime_type || 'image/png'};base64,${frame.overlay_image_base64}`}
                        alt={`${frame.phase.toLowerCase().replace(/_/g, ' ')} pose overlay at ${frame.timestamp_seconds.toFixed(3)} seconds`}
                        className="max-h-80 w-full bg-black object-contain"
                      />
                    ) : (
                      <div className="flex min-h-36 items-center justify-center p-3 text-center text-[11px] text-slate-400">{frame.error || 'Pose unavailable for this frame.'}</div>
                    )}
                    <figcaption className="px-2 py-1.5 text-[10px] text-slate-300">
                      {frame.phase.replace(/_/g, ' ')} · #{frame.frame_index} · {frame.timestamp_seconds.toFixed(3)}s
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1.5 pl-3 pr-2 font-medium">2D metric</th>
                      {result.sequence.map(frame => (
                        <th key={`head-${frame.frame_index}`} className="py-1.5 pr-2 font-medium">
                          {frame.phase.replace(/_/g, ' ')}<br />{frame.timestamp_seconds.toFixed(2)}s
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...jointMetricKeys, ...alignmentMetricKeys].map(key => (
                      <tr key={key} className="border-t border-slate-800 bg-slate-950/40">
                        <td className="py-1.5 pl-3 pr-2 text-slate-300">{metricLabels[key] || key.replace(/_/g, ' ')}</td>
                        {result.sequence.map(frame => {
                          const value = (worldAngleMetricKeys[key]
                            ? frame.mediapipe_world_metrics?.[worldAngleMetricKeys[key]]
                            : undefined) ?? frame.metrics?.[key];
                          return (
                            <td key={`${frame.frame_index}-${key}`} className="py-1.5 pr-2 text-white">
                              {value === null || value === undefined ? '—' : `${value.toFixed(1)}${metricUnit(key) === '°' ? '°' : '%'}`}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <p className="text-[11px] text-slate-400">
            Primary landmark source: {result.landmark_source === 'openai+mediapipe-fallback'
              ? 'OpenAI, with MediaPipe fallback for missing joints'
              : result.landmark_source === 'openai' ? 'OpenAI' : 'MediaPipe'}.
          </p>
          <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">Optional: compare OpenAI and MediaPipe landmark outputs</summary>
            <div className="mt-3 space-y-3">
              <PoseMetricTable title="Joint-model comparison · 2D estimates" metricKeys={jointMetricKeys} metrics={result.mediapipe_metrics} openAiMetrics={result.openai_metrics} />
              <PoseMetricTable title="Alignment-model comparison · image-plane estimates" metricKeys={alignmentMetricKeys} metrics={result.mediapipe_metrics} openAiMetrics={result.openai_metrics} />
              {Object.keys(result.landmark_disagreement_pct).length > 0 && (
                <section className="space-y-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/5 p-3">
                  <h6 className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">Landmark distance between sources</h6>
                  <p className="text-[11px] text-slate-400">Distance between corresponding MediaPipe and OpenAI points, normalized by visible body height. This is a comparison, not an accuracy score.</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(result.landmark_disagreement_pct).map(([name, value]) => (
                      <div key={name} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
                        <span className="text-xs capitalize text-slate-300">{name.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-semibold text-fuchsia-100">{value === null ? '—' : `${value.toFixed(1)}%`}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </details>
        </>
      )}

      <section className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1.5 pl-3 pr-2 font-medium">Kinetics</th><th className="py-1.5 pr-3 font-medium">Estimated</th></tr></thead>
          <tbody>
            {kineticsRows.map(name => (
              <tr key={name} className="border-t border-slate-800">
                <td className="py-1.5 pl-3 pr-2 text-slate-200">{name}</td>
                <td className="py-1.5 pr-3 text-slate-500">Unavailable from a still image</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 pb-2 text-[10px] text-slate-500">Ball/swing speed, momentum, energy and power require video; calibrated values require pitch calibration.</p>
      </section>

      {analysis.errors.length > 0 && (
        <section className="space-y-2">
          <h6 className="text-xs font-semibold uppercase tracking-wide text-rose-200">What to review</h6>
          {analysis.errors.map((item, index) => (
            <article key={`${item.title}-${index}`} className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h6 className="text-xs font-bold text-rose-100">{item.title}</h6>
                <span className="text-[10px] uppercase text-rose-200">{item.confidence} confidence</span>
              </div>
              <p className="mt-1 text-xs text-slate-200">{item.observation}</p>
              <p className="mt-1 text-xs text-slate-300">{item.coachingImplication}</p>
            </article>
          ))}
        </section>
      )}

      {analysis.observations.length > 0 && (
        <section className="space-y-2">
          <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Visible observations</h6>
          {analysis.observations.map((item, index) => (
            <article key={`${item.title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h6 className="text-xs font-bold text-white">{item.title}</h6>
                <span className="text-[10px] uppercase text-slate-500">{item.confidence} confidence</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">{item.observation}</p>
              <p className="mt-1 text-xs text-cyan-100">{item.coachingImplication}</p>
              {item.coachingCue && <p className="mt-1 text-xs text-violet-200">Cue: {item.coachingCue}</p>}
              {item.drill && <p className="mt-1 text-xs text-emerald-200">Drill: {item.drill}</p>}
            </article>
          ))}
        </section>
      )}

      {(analysis.priorityCue || analysis.drill.title || analysis.strengths.length > 0) && (
        <section className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/5 p-3">
          <h6 className="text-xs font-semibold uppercase tracking-wide text-violet-200">Coaching guidance</h6>
          {analysis.priorityCue && <p className="text-sm font-semibold text-white">Priority cue: {analysis.priorityCue}</p>}
          {analysis.drill.title && (
            <div className="rounded-md border border-violet-400/15 bg-slate-950/50 p-3">
              <p className="text-xs font-bold text-violet-100">Drill: {analysis.drill.title}</p>
              {analysis.drill.rationale && <p className="mt-1 text-xs text-slate-300">{analysis.drill.rationale}</p>}
              {analysis.drill.instructions.length > 0 && (
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
                  {analysis.drill.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}
                </ol>
              )}
            </div>
          )}
          {analysis.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-200">Strengths</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-300">
                {analysis.strengths.map((strength, index) => (
                  <li key={`${strength.title}-${index}`}>
                    <span className="font-semibold">{strength.title}:</span> {strength.observation}
                    <span className="ml-1 text-[10px] text-slate-500">{strength.confidence} confidence · frames {strength.frameIndices.join(', ') || 'not cited'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <ul className="space-y-1 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-[11px] text-amber-100/80">
        {[...new Set([...analysis.limitations, ...(result?.limitations || [])])].map((limitation, index) => <li key={index}>• {limitation}</li>)}
      </ul>
    </section>
  );
};

const CapeStyleMetricTable: React.FC<{
  title: string;
  rows: Array<{
    key: string;
    label: string;
    value: number | null;
    unit: string;
    expected: string;
    status: string;
    severity?: 'low' | 'medium' | 'high' | null;
    source?: string;
  }>;
}> = ({ title, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-xs">
      <thead className="text-slate-500">
        <tr>
          <th className="py-1.5 pr-2 font-medium">{title}</th>
          <th className="py-1.5 pr-2 font-medium">Measured</th>
          <th className="py-1.5 pr-2 font-medium">Expected</th>
          <th className="py-1.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const unit = row.unit === 'm' ? ' m' : row.unit;
          const badgeText = row.severity ? formatShotType(row.severity) : row.status;
          return (
            <tr key={row.key} className="border-t border-slate-800">
              <td className="py-1.5 pr-2 text-slate-200">
                {row.label}
                {row.source && row.source !== 'OpenAI 2D' && <span className="ml-1 text-[9px] text-slate-500">({row.source})</span>}
              </td>
              <td className="py-1.5 pr-2 text-white">{row.value === null ? '—' : `${row.value.toFixed(1)}${unit}`}</td>
              <td className="py-1.5 pr-2 text-slate-400">{row.expected}</td>
              <td className="py-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(row.severity || row.status)}`}>{badgeText}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const PoseMetricTable: React.FC<{
  title: string;
  metricKeys: string[];
  metrics: Record<string, number | null>;
  openAiMetrics: Record<string, number | null>;
}> = ({ title, metricKeys, metrics, openAiMetrics }) => (
  <section className="space-y-1.5">
    <h6 className="text-xs font-semibold uppercase tracking-wide text-cyan-100">{title}</h6>
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1.5 pl-3 pr-2 font-medium">Metric</th>
            <th className="py-1.5 pr-2 font-medium">MediaPipe</th>
            <th className="py-1.5 pr-2 font-medium">OpenAI</th>
            <th className="py-1.5 pr-3 font-medium">Difference</th>
          </tr>
        </thead>
        <tbody>
          {metricKeys.map(key => {
            const value = metrics[key];
            const openAiValue = openAiMetrics[key];
            const difference = value === null || value === undefined || openAiValue === null || openAiValue === undefined
              ? null
              : Math.abs(value - openAiValue);
            return (
              <tr key={key} className="border-t border-slate-800 bg-slate-950/40">
                <td className="py-2 pl-3 pr-2 text-slate-200">{metricLabels[key] || key.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-2 font-semibold text-white">
                  {value === null || value === undefined ? '—' : `${value.toFixed(1)}${metricUnit(key) === '°' ? '°' : ` ${metricUnit(key)}`}`}
                </td>
                <td className="py-2 pr-2 text-fuchsia-100">
                  {openAiValue === null || openAiValue === undefined ? '—' : `${openAiValue.toFixed(1)}${metricUnit(key) === '°' ? '°' : ` ${metricUnit(key)}`}`}
                </td>
                <td className="py-2 pr-3 text-slate-300">
                  {difference === null ? '—' : `${difference.toFixed(1)}${metricUnit(key) === '°' ? '°' : ` ${metricUnit(key)}`}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);
