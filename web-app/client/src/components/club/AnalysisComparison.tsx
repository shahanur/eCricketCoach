import React, { useEffect, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { api } from '../../services/api';
import { CapeJob } from '../../types';

export interface AihubComparisonInput {
  issues: string[];
  metrics: Record<string, string | number>;
  overlayImageBase64: string;
  overlayMimeType: string;
  cricketInterpretation?: { ballLine: { status: string; label: string } } | null;
}

interface AnalysisComparisonProps {
  aihub: AihubComparisonInput | null;
  aihubDurationMs: number | null;
  capeJob: CapeJob | null;
}

const label = (value: string) => value.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());
const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const num = (value: unknown) => (typeof value === 'number' ? value : Number.isFinite(Number(value)) ? Number(value) : null);
const deg = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value.toFixed(1)}°`);

const KEY_IMAGES = ['impact_snapshot', 'release_snapshot', 'pre_contact_snapshot', 'pitching_point_snapshot'];

export const AnalysisComparison: React.FC<AnalysisComparisonProps> = ({ aihub, aihubDurationMs, capeJob }) => {
  const cape = capeJob?.status === 'SUCCEEDED' ? capeJob.result : null;
  const [capeImage, setCapeImage] = useState('');
  const capePath = cape ? KEY_IMAGES.map(key => cape.download_endpoints[key]).find(Boolean) || null : null;

  useEffect(() => {
    if (!capePath) {
      setCapeImage('');
      return;
    }
    let cancelled = false;
    let url = '';
    api.fetchCapeArtifact(capePath)
      .then(({ blob }) => {
        url = URL.createObjectURL(blob);
        if (!cancelled) setCapeImage(url);
      })
      .catch(() => undefined);
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [capePath]);

  if (!aihub && !cape) return null;

  const angles = cape?.analytics_payload.pre_contact?.batter_joint_angles || cape?.analytics_payload.release?.bowler_joint_angles || {};
  // CAPE reports front/back; for a right-hander the front side is the left.
  const rightHanded = cape?.metadata.handedness !== 'left';
  const capeSide = (side: 'left' | 'right', joint: string) => angles[`${(side === 'left') === rightHanded ? 'front' : 'back'}_${joint}`];
  const capeDurationMs = capeJob && cape ? new Date(capeJob.updatedAt).getTime() - new Date(capeJob.createdAt).getTime() : null;
  const delivery = cape?.delivery;
  const ballLine = aihub?.cricketInterpretation?.ballLine;

  const rows: Array<[string, string, string]> = [
    ['Setup needed', 'None – one click', 'Mark 4 pitch corners, hand and shot'],
    ['Time taken', seconds(aihubDurationMs), capeDurationMs !== null ? `${seconds(capeDurationMs)} (incl. queue)` : '—'],
    ['Overall score', '—', cape ? `${cape.coaching.score}/100 · ${cape.coaching.verdict}` : '—'],
    ['Left knee angle', aihub ? deg(num(aihub.metrics.leftKneeAngleDegrees)) : '—', cape ? deg(capeSide('left', 'knee')) : '—'],
    ['Right knee angle', aihub ? deg(num(aihub.metrics.rightKneeAngleDegrees)) : '—', cape ? deg(capeSide('right', 'knee')) : '—'],
    ['Elbow angles', '—', cape ? `Front ${deg(angles.front_elbow)} · Back ${deg(angles.back_elbow)}` : '—'],
    ['Head', aihub ? `Drop ${deg(num(aihub.metrics.headDropDegrees))}` : '—', cape ? (cape.coaching.faults.some(f => f.metric.startsWith('head')) ? 'Flagged (see faults)' : 'Measured (head over front knee)') : '—'],
    ['Torso angle', aihub ? deg(num(aihub.metrics.torsoAngleDegrees)) : '—', '—'],
    ['Ball line', ballLine ? `${label(ballLine.label)} (${ballLine.status.toLowerCase().replace(/_/g, ' ')})` : '—', delivery ? label(delivery.line_zone) : '—'],
    ['Ball length / speed', '—', delivery ? `${label(delivery.length_zone)} (${delivery.length_m.toFixed(1)} m) · ${delivery.speed_kmh === null ? '—' : `${delivery.speed_kmh.toFixed(0)} km/h`}` : '—'],
    ['Issues found', aihub ? String(aihub.issues.length) : '—', cape ? String(cape.coaching.faults.length) : '—'],
  ];

  return (
    <div className="rounded-xl border border-sky-500/30 bg-slate-950 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-sky-300" />
        <h4 className="text-sm font-bold text-white">AIHub vs CAPE comparison</h4>
        {(!aihub || !cape) && <span className="text-[11px] text-slate-500">Run {aihub ? 'CAPE' : 'AIHub'} on the same video to complete the comparison.</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { name: 'AIHub', color: 'text-sky-300', image: aihub ? `data:${aihub.overlayMimeType};base64,${aihub.overlayImageBase64}` : '' , ready: Boolean(aihub) },
          { name: 'CAPE', color: 'text-emerald-300', image: capeImage, ready: Boolean(cape) },
        ].map(engine => (
          <figure key={engine.name} className="overflow-hidden rounded-lg border border-slate-800 bg-black">
            {engine.image
              ? <img src={engine.image} alt={`${engine.name} annotated frame`} className="w-full max-h-[420px] object-contain" />
              : <div className="flex aspect-video items-center justify-center text-xs text-slate-500">{engine.ready ? 'Loading image…' : `Not run yet`}</div>}
            <figcaption className={`bg-slate-900 px-3 py-1.5 text-xs font-semibold ${engine.color}`}>{engine.name}</figcaption>
          </figure>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Measure</th>
              <th className="py-1.5 pr-3 font-medium text-sky-300">AIHub</th>
              <th className="py-1.5 font-medium text-emerald-300">CAPE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, a, c]) => (
              <tr key={name} className="border-t border-slate-800">
                <td className="py-1.5 pr-3 text-slate-400">{name}</td>
                <td className="py-1.5 pr-3 text-slate-100">{a}</td>
                <td className="py-1.5 text-slate-100">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">AIHub issues</span>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
            {aihub ? aihub.issues.map((issue, index) => <li key={index}>{issue}</li>) : <li className="list-none -ml-5 text-slate-500">Not run yet</li>}
          </ul>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">CAPE faults</span>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-slate-300">
            {cape
              ? (cape.coaching.faults.length ? cape.coaching.faults.map(fault => <li key={fault.code}>{fault.message} ({fault.severity})</li>) : <li>No faults found.</li>)
              : <li className="list-none -ml-5 text-slate-500">Not run yet</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};
