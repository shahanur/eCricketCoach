import React from 'react';
import { Download, Eye } from 'lucide-react';

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

const label = (value: string) => value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());
const numberValue = (value: string | number | undefined) => typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : null;
const degrees = (value: string | number | undefined) => { const numeric = numberValue(value); return numeric === null ? '—' : `${numeric.toFixed(1)}°`; };
const statusFor = (value: number | null, low: number, high: number) => value === null ? '—' : value >= low && value <= high ? 'Good' : value < low ? 'Low' : 'High';
const statusClass = (status: string) => status === 'Good' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : status === '—' ? 'border-slate-700 bg-slate-900 text-slate-500' : 'border-amber-500/40 bg-amber-500/20 text-amber-300';

function downloadBlob(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export const AihubResultView: React.FC<{ result: AihubResultViewModel; discipline: string }> = ({ result, discipline }) => {
  const interpretation = result.cricketInterpretation;
  const rows = [
    ['Front Knee', degrees(result.metrics.leftKneeAngleDegrees), '110–150', statusFor(numberValue(result.metrics.leftKneeAngleDegrees), 110, 150)],
    ['Back Knee', degrees(result.metrics.rightKneeAngleDegrees), '110–170', statusFor(numberValue(result.metrics.rightKneeAngleDegrees), 110, 170)],
    ['Front Elbow', degrees(result.metrics.leftElbowAngleDegrees), 'In range', '—'],
    ['Back Elbow', degrees(result.metrics.rightElbowAngleDegrees), 'In range', '—'],
    ['Head', `Drop ${degrees(result.metrics.headDropDegrees)}`, 'Head over front knee', numberValue(result.metrics.headDropDegrees) !== null && Number(result.metrics.headDropDegrees) > 35 ? 'Flagged' : 'Good'],
    ['Torso angle', degrees(result.metrics.torsoAngleDegrees), 'Balanced', numberValue(result.metrics.torsoAngleDegrees) !== null && Math.abs(Number(result.metrics.torsoAngleDegrees)) > 18 ? 'Flagged' : 'Good'],
    ['Ball line', interpretation ? `${label(interpretation.ballLine.label)} (${interpretation.ballLine.status.toLowerCase()})` : '—', 'Visible trajectory', interpretation?.ballLine.status === 'DETECTED' ? 'Good' : '—']
  ];
  const series = result.overlaySeries?.length ? result.overlaySeries : [{ timestampMs: 0, overlayImageBase64: result.overlayImageBase64, overlayMimeType: result.overlayMimeType, phase: 'CONTACT' }];

  return (
    <div className="aihub-result-view mt-3 rounded-lg border border-sky-300/40 bg-slate-950 p-4 text-white space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-slate-900 p-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sm font-bold text-sky-700">{interpretation?.overallScore ?? '—'}</div>
        <div>
          <p className="text-sm font-semibold text-white">{interpretation?.cricketSummary || 'AIHub pose and movement evaluation'}</p>
          <p className="text-[11px] text-slate-500">{label(discipline)} · {interpretation?.phase ? label(interpretation.phase) : 'Contact analysis'}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1 pr-2 font-medium">Pose</th><th className="py-1 pr-2 font-medium">Measured</th><th className="py-1 pr-2 font-medium">Expected</th><th className="py-1 font-medium">Status</th></tr></thead>
          <tbody>{rows.map(([name, measured, expected, status]) => (
            <tr key={name} className="border-t border-slate-800">
              <td className="py-1.5 pr-2 font-medium text-slate-200">{name}</td>
              <td className="py-1.5 pr-2 text-white">{measured}</td>
              <td className="py-1.5 pr-2 text-slate-500">{expected}</td>
              <td className="py-1.5"><span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusClass(status)}`}>{status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {interpretation?.errors.length ? <div className="space-y-2"><h5 className="text-sm font-semibold text-slate-800">What to fix</h5>{interpretation.errors.map((error, index) => (
        <div key={index} className="rounded-lg border border-rose-500/40 bg-rose-500/20 p-3">
          <p className="text-xs font-semibold text-rose-200">{error.title}</p>
          <p className="mt-1 text-xs text-slate-200">{error.cricketMeaning}</p>
          <p className="mt-1 text-[11px] text-slate-400">Evidence: {error.evidence}</p>
        </div>
      ))}</div> : null}

      {interpretation?.corrections.length ? <div className="space-y-2"><h5 className="text-sm font-semibold text-slate-800">How to correct it</h5>{interpretation.corrections.map((correction, index) => (
        <div key={index} className="rounded-lg border border-amber-500/40 bg-amber-500/20 p-3">
          <p className="text-xs font-semibold text-amber-200">{correction.title}</p>
          <p className="mt-1 text-xs text-slate-200">{correction.coachingCue}</p>
          <p className="mt-1 text-[11px] text-slate-400">Drill: {correction.drill}</p>
        </div>
      ))}</div> : null}

      {result.cricketInterpretationError && <p className="text-xs text-amber-700">{result.cricketInterpretationError}</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h5 className="text-sm font-semibold text-slate-800">Images</h5><button type="button" onClick={() => series.forEach((frame, index) => downloadBlob(`data:${frame.overlayMimeType};base64,${frame.overlayImageBase64}`, `aihub-${discipline.toLowerCase()}-${index + 1}.png`))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700"><Download size={13} /> Download all</button></div>
        <div className="grid gap-2 sm:grid-cols-3">{series.map((frame, index) => {
          const url = `data:${frame.overlayMimeType};base64,${frame.overlayImageBase64}`;
          return <figure key={`${frame.timestampMs}-${index}`} className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900"><img src={url} alt={label(frame.phase)} className="aspect-video w-full object-contain" /><figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px] text-slate-300">{label(frame.phase)}<span className="flex gap-2"><a href={url} target="_blank" rel="noreferrer" aria-label="View image"><Eye size={13} /></a><button type="button" onClick={() => downloadBlob(url, `aihub-${discipline.toLowerCase()}-${index + 1}.png`)} aria-label="Download image"><Download size={13} /></button></span></figcaption></figure>;
        })}</div>
      </div>
    </div>
  );
};
