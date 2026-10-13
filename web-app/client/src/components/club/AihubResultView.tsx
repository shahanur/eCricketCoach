import React from 'react';
import { Download } from 'lucide-react';

export interface AihubResultViewModel {
  issues: string[];
  metrics: Record<string, string | number>;
  overlayImageBase64: string;
  overlayMimeType: string;
  overlaySeries?: Array<{ timestampMs: number; overlayImageBase64: string; overlayMimeType: string; phase: string }>;
  cricketInterpretation: {
    overallScore?: number;
    cricketSummary: string;
    phase: string;
    ballLine: { status: string; label: string; confidence?: number; evidence?: string };
    errors: Array<{ title: string; cricketMeaning: string; evidence: string }>;
    corrections: Array<{ title: string; coachingCue: string; drill: string }>;
  } | null;
  cricketInterpretationError: string | null;
}

type Severity = 'ok' | 'medium' | 'high';

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const numberValue = (value: string | number | undefined) =>
  typeof value === 'number' ? value : value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

// Same palette as the CAPE result so both engines render identically.
const severityStyle = (severity: Severity) =>
  severity === 'high' ? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
    : severity === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : 'border-amber-500/40 bg-amber-500/20 text-amber-300';

interface PoseRow { name: string; measured: string; expected: string; status: string; severity: Severity }

interface MetricSpec { name: string; key: string; build: (value: number) => Omit<PoseRow, 'name'> }

const inRange = (low: number, high: number) => (value: number): Omit<PoseRow, 'name'> => {
  const ok = value >= low && value <= high;
  return { measured: `${value.toFixed(1)}°`, expected: `${low}–${high}°`, status: ok ? 'Good' : value < low ? 'Low' : 'High', severity: ok ? 'ok' : 'medium' };
};

const withinLimit = (limit: number, expected: string) => (value: number): Omit<PoseRow, 'name'> => {
  const ok = Math.abs(value) <= limit;
  return { measured: `${value.toFixed(1)}°`, expected, status: ok ? 'Good' : 'Flagged', severity: ok ? 'ok' : 'medium' };
};

const METRICS: MetricSpec[] = [
  { name: 'Front Knee', key: 'leftKneeAngleDegrees', build: inRange(110, 150) },
  { name: 'Back Knee', key: 'rightKneeAngleDegrees', build: inRange(110, 170) },
  { name: 'Front Elbow', key: 'leftElbowAngleDegrees', build: inRange(90, 180) },
  { name: 'Back Elbow', key: 'rightElbowAngleDegrees', build: inRange(60, 180) },
  { name: 'Head Drop', key: 'headDropDegrees', build: withinLimit(35, 'Head over front knee') },
  { name: 'Torso Angle', key: 'torsoAngleDegrees', build: withinLimit(18, '≤ 18°') }
];

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export const AihubResultView: React.FC<{ result: AihubResultViewModel; discipline: string }> = ({ result, discipline }) => {
  const interpretation = result.cricketInterpretation;
  const rows: PoseRow[] = [];
  const notMeasured: string[] = [];
  METRICS.forEach(spec => {
    const value = numberValue(result.metrics[spec.key]);
    if (value === null) notMeasured.push(spec.name);
    else rows.push({ name: spec.name, ...spec.build(value) });
  });
  const ballLine = interpretation?.ballLine;
  if (ballLine && ballLine.status === 'DETECTED') {
    rows.push({ name: 'Ball Line', measured: label(ballLine.label), expected: 'Visible trajectory', status: 'Good', severity: 'ok' });
  } else {
    notMeasured.push('Ball Line');
  }

  const score = interpretation?.overallScore;
  const scoreSeverity: Severity = score === undefined ? 'medium' : score >= 70 ? 'ok' : score >= 40 ? 'medium' : 'high';
  const series = result.overlaySeries?.length
    ? result.overlaySeries
    : [{ timestampMs: 0, overlayImageBase64: result.overlayImageBase64, overlayMimeType: result.overlayMimeType, phase: 'CONTACT' }];
  const fileName = (index: number) => `aihub-${discipline.toLowerCase()}-${index + 1}.png`;
  const errors = interpretation?.errors || [];

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${severityStyle(scoreSeverity)}`}>{score ?? '—'}</div>
        <div>
          <p className="text-sm font-semibold text-white">{interpretation?.cricketSummary || 'AIHub pose and movement evaluation'}</p>
          <p className="text-[11px] text-slate-400">{label(discipline)} · {interpretation?.phase ? label(interpretation.phase) : 'Contact'}</p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Pose</th><th className="py-1 pr-2 font-medium">Measured</th><th className="py-1 pr-2 font-medium">Expected</th><th className="py-1 font-medium">Status</th></tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.name} className="border-t border-slate-800">
                  <td className="py-1.5 pr-2 text-slate-200">{row.name}</td>
                  <td className="py-1.5 pr-2 text-white">{row.measured}</td>
                  <td className="py-1.5 pr-2 text-slate-400">{row.expected}</td>
                  <td className="py-1.5"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityStyle(row.severity)}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-white">What to fix</h5>
          {errors.map((error, index) => {
            const correction = interpretation?.corrections[index];
            return (
              <div key={index} className={`rounded-lg border p-3 ${severityStyle('medium')}`}>
                <p className="text-xs font-semibold">{error.cricketMeaning || error.title} <span className="font-normal opacity-80">({error.title})</span></p>
                <p className="mt-1 text-[11px] text-slate-300">{error.evidence}</p>
                {correction?.coachingCue && <p className="mt-1 text-xs text-slate-200">{correction.coachingCue}</p>}
                {correction?.drill && <p className="mt-1 text-[11px] text-slate-400">Drill: {correction.drill}</p>}
              </div>
            );
          })}
        </div>
      )}

      {result.cricketInterpretationError && <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">{result.cricketInterpretationError}</p>}
      {notMeasured.length > 0 && <p className="text-[11px] text-slate-500">Not measured: {notMeasured.join(', ')}</p>}

      {series.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold text-white">Images</h5>
            <button type="button" onClick={() => series.forEach((frame, index) => downloadDataUrl(`data:${frame.overlayMimeType};base64,${frame.overlayImageBase64}`, fileName(index)))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-emerald-400"><Download size={13} /> Download all</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {series.map((frame, index) => {
              const url = `data:${frame.overlayMimeType};base64,${frame.overlayImageBase64}`;
              const name = label(frame.phase);
              return (
                <figure key={`${frame.timestampMs}-${index}`} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                  <img src={url} alt={name} className="aspect-video w-full object-cover" />
                  <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-slate-300">
                    {name}
                    <button type="button" onClick={() => downloadDataUrl(url, fileName(index))} aria-label={`Download ${name}`} className="text-slate-400 hover:text-emerald-300"><Download size={13} /></button>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
