import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { OpenAiBattingAnalysis, PoseOverlayAnalysis } from '../../types';

interface CroppedPoseOverlayPanelProps {
  imageDataUrl: string | null;
  analysis: OpenAiBattingAnalysis;
  sequenceFrames: OpenAiBattingAnalysis['poseSequenceFrames'];
  savedResult?: PoseOverlayAnalysis;
  onPoseOverlaySaved?: (result: PoseOverlayAnalysis, artifactNames: string[]) => void;
}

const formatShotType = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

function toCapeShotType(value: string | null | undefined): 'front_foot_drive' | 'forward_defence' | null {
  if (value === 'front_foot_drive' || value === 'forward_defence') return value;
  if (value === 'front_foot_defence') return 'forward_defence';
  return null;
}

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

export const CroppedPoseOverlayPanel: React.FC<CroppedPoseOverlayPanelProps> = ({ imageDataUrl, analysis, sequenceFrames, savedResult, onPoseOverlaySaved }) => {
  const identifiedHandedness = savedResult?.handedness
    ?? (analysis.shotIdentification.batterHandedness !== 'unknown'
      ? analysis.shotIdentification.batterHandedness
      : analysis.requestMetadata.batterHandedness);
  const handedness: 'right' | 'left' = identifiedHandedness === 'left' ? 'left' : 'right';
  const shotType = toCapeShotType(savedResult?.shot_type)
    ?? toCapeShotType(analysis.requestMetadata.shotType)
    ?? toCapeShotType(analysis.shotIdentification.shotType)
    ?? 'front_foot_drive';
  const [result, setResult] = useState<PoseOverlayAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const onPoseOverlaySavedRef = useRef(onPoseOverlaySaved);
  onPoseOverlaySavedRef.current = onPoseOverlaySaved;

  useEffect(() => {
    if (savedResult) {
      setResult(savedResult);
      setIsLoading(false);
      setError('');
      return;
    }
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
      .then(next => {
        if (cancelled) return;
        setResult(next);
        if (analysis.reportId && !analysis.restoredFromReport) {
          void api.saveOpenAiPoseOverlay(analysis.reportId, next)
            .then(saved => onPoseOverlaySavedRef.current?.(next, saved.artifactNames))
            .catch(failure => {
              if (!cancelled) setError(failure instanceof Error ? `Overlay ready, but it could not be saved: ${failure.message}` : 'Overlay ready, but it could not be saved to the report.');
            });
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'The cropped image pose analysis failed.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [imageDataUrl, handedness, shotType, retryCount, sequenceFrames, savedResult, analysis.reportId, analysis.restoredFromReport, analysis.croppedContactLandmarksNorm, analysis.croppedContactPointNorm, analysis.croppedBatHandleNorm, analysis.croppedBatToeNorm, analysis.contactBatAngle]);

  const ruleChecks = result?.coaching_rules.checks || [];
  const metricRow = (group: 'alignment' | 'shot', metric: string, label: string, unit: string) => {
    const check = ruleChecks.find(item => item.group === group && item.metric === metric);
    const rawValue = result?.metrics[metric];
    const temporal = result?.temporal_angle_estimates[metric];
    const value = rawValue ?? temporal?.value ?? null;
    const usedTemporalEstimate = rawValue === null || rawValue === undefined ? temporal : undefined;
    const status = usedTemporalEstimate
      ? 'Estimated from nearby frames'
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
  const kineticsRows: Array<{ label: string; key: keyof NonNullable<OpenAiBattingAnalysis['capeKinetics']>['metrics']; unit: string }> = [
    { label: 'Incoming ball speed', key: 'incomingBallSpeedKmh', unit: ' km/h' },
    { label: 'Incoming momentum', key: 'incomingMomentumKgMps', unit: ' kg·m/s' },
    { label: 'Incoming kinetic energy', key: 'incomingKineticEnergyJ', unit: ' J' },
    { label: 'Exit speed', key: 'exitSpeedKmh', unit: ' km/h' },
    { label: 'Exit momentum', key: 'exitMomentumKgMps', unit: ' kg·m/s' },
    { label: 'Exit kinetic energy', key: 'exitKineticEnergyJ', unit: ' J' },
    { label: 'Launch angle', key: 'launchAngleDegrees', unit: '°' },
    { label: 'Bat swing speed before contact', key: 'batSwingSpeedKmh', unit: ' km/h' },
    { label: 'Bat swing arc', key: 'batSwingArcDegrees', unit: '°' },
    { label: 'Follow-through arc', key: 'followThroughArcDegrees', unit: '°' }
  ];
  const capeKinetics = analysis.capeKinetics;
  const showCapeKinetics = Boolean(capeKinetics && capeKinetics.status !== 'not_requested');
  const kineticsValue = (key: typeof kineticsRows[number]['key'], unit: string) => {
    const value = capeKinetics?.metrics[key];
    if (value !== null && value !== undefined) return `${value.toFixed(1)}${unit}`;
    if (!capeKinetics || capeKinetics.status === 'not_requested') return 'Not requested';
    return capeKinetics.message || 'Not measurable in this clip';
  };

  return (
    <section className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-bold text-cyan-100">Movement and technique</h5>
          <p className="text-[11px] text-slate-400">A visual estimate to help guide coaching discussion.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <p className="text-slate-400">Batter hand <span className="ml-1 text-slate-200">{identifiedHandedness === 'unknown' ? 'Unknown' : `${identifiedHandedness === 'left' ? 'Left' : 'Right'}-handed`}</span></p>
          <p className="text-slate-400">CAPE rule set <span className="ml-1 text-slate-200">{formatShotType(shotType)}</span></p>
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

      {result && (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div>
              <h6 className="text-xs font-semibold uppercase tracking-wide text-violet-200">Technique summary</h6>
              <p className="mt-1 text-sm font-semibold text-white">{result.coaching_rules.verdict}</p>
              <p className="mt-1 text-[11px] text-slate-400">{formatShotType(result.coaching_rules.shot_type)}</p>
            </div>
          </section>

          <CapeStyleMetricTable title="Kinematics" rows={kinematicsRows} />
          <CapeStyleMetricTable title="Alignment checklist" rows={alignmentRows} />
          {(result.coaching_rules.faults.length > 0 || result.coaching_rules.strengths.length > 0 || result.coaching_rules.unavailable.length > 0) && (
            <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-300">What to Fix</summary>
              {!result.coaching_rules.score_scope.startsWith('partial') && <p className="mt-2 text-xs text-slate-400">Rule-check score: {result.coaching_rules.score}/100</p>}
              {result.coaching_rules.faults.length > 0 && (
                <section className="mt-3 space-y-2">
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
              {result.coaching_rules.strengths.length > 0 && <ul className="mt-2 list-disc pl-4 text-xs text-emerald-200">{result.coaching_rules.strengths.map((strength, index) => <li key={index}>{strength}</li>)}</ul>}
              {result.coaching_rules.unavailable.length > 0 && <p className="mt-2 text-[11px] text-slate-400">Not assessed: {result.coaching_rules.unavailable.map(name => name.replace(/_/g, ' ')).join(', ')}.</p>}
            </details>
          )}

          <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">Advanced details · pose overlay images</summary>
          <div className="mt-3 grid items-start gap-4 xl:grid-cols-2">
            {imageDataUrl && (
              <figure className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                <img
                  src={imageDataUrl}
                  alt="Enlarged batter crop produced from the selected OpenAI contact frame"
                  className="max-h-[75vh] w-full bg-black object-contain"
                />
                <figcaption className="px-3 py-2 text-[11px] text-slate-400">Selected contact view</figcaption>
              </figure>
            )}
            <figure className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
              <img
                src={`data:${result.overlay_mime_type};base64,${result.overlay_image_base64}`}
                alt="MediaPipe and OpenAI pose landmarks with head-to-toe alignment and joint labels"
                className="max-h-[75vh] w-full bg-black object-contain"
              />
              <figcaption className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 text-[11px] text-slate-400">Pose overlay · visual estimates</figcaption>
            </figure>
          </div>
          </details>
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
                        alt={`${frame.phase.toLowerCase().replace(/_/g, ' ')} pose overlay`}
                        className="max-h-80 w-full bg-black object-contain"
                      />
                    ) : (
                      <div className="flex min-h-36 items-center justify-center p-3 text-center text-[11px] text-slate-400">{frame.error || 'Pose unavailable for this frame.'}</div>
                    )}
                    <figcaption className="px-2 py-1.5 text-[10px] text-slate-300">
                      {frame.phase.replace(/_/g, ' ')}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {showCapeKinetics && <section className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1.5 pl-3 pr-2 font-medium">Video measurements</th><th className="py-1.5 pr-3 font-medium">Estimate</th></tr></thead>
          <tbody>
            {kineticsRows.map(({ label, key, unit }) => (
              <tr key={key} className="border-t border-slate-800">
                <td className="py-1.5 pl-3 pr-2 text-slate-200">{label}</td>
                <td className="py-1.5 pr-3 text-slate-300">{kineticsValue(key, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="px-3 pb-2 text-[10px] text-slate-500">
          <summary className="cursor-pointer">Advanced details · measurement notes</summary>
          <p className="mt-1">{capeKinetics?.limitations.join(' ')}</p>
          {capeKinetics?.contactFrame !== null && capeKinetics?.contactFrame !== undefined && (
            <p>CAPE selected contact from {capeKinetics.contactSelectionSource ?? 'automatic'} review; OpenAI contact: {analysis.contact.frameIndex === null ? 'not available' : 'also reviewed'}.</p>
          )}
        </details>
      </section>}

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
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-300">Advanced details · limitations</summary>
        <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
          {[...new Set([...analysis.limitations, ...(result?.limitations || [])])].map((limitation, index) => <li key={index}>• {limitation}</li>)}
        </ul>
      </details> */}
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
