import React, { useEffect, useState } from 'react';
import { GitCompare } from 'lucide-react';
import { api } from '../../services/api';
import { CapeJob } from '../../types';

export interface AihubComparisonInput {
  issues: string[];
  metrics: Record<string, string | number>;
  overlayImageBase64: string;
  overlayMimeType: string;
  cricketInterpretation?: { overallScore?: number; ballLine: { status: string; label: string } } | null;
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

function landmarkAngle(points: Record<string, [number, number, number]>, a: string, b: string, c: string): number | null {
  const first = points[a];
  const vertex = points[b];
  const last = points[c];
  if (!first || !vertex || !last) return null;
  const ba = [first[0] - vertex[0], first[1] - vertex[1], first[2] - vertex[2]];
  const bc = [last[0] - vertex[0], last[1] - vertex[1], last[2] - vertex[2]];
  const normA = Math.hypot(...ba);
  const normC = Math.hypot(...bc);
  if (!normA || !normC) return null;
  const cosine = Math.max(-1, Math.min(1, (ba[0] * bc[0] + ba[1] * bc[1] + ba[2] * bc[2]) / (normA * normC)));
  return Math.acos(cosine) * 180 / Math.PI;
}

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

  const angles = cape?.analytics_payload.point_of_contact?.batter_joint_angles || cape?.analytics_payload.pre_contact?.batter_joint_angles || cape?.analytics_payload.release?.bowler_joint_angles || {};
  const contactLandmarks = cape?.analytics_payload.point_of_contact?.batter_3d_landmarks || {};
  // CAPE reports front/back; for a right-hander the front side is the left.
  const rightHanded = cape?.metadata.handedness !== 'left';
  const derivedCapeAngles = { ...angles } as Record<string, number>;
  for (const [role, side] of [['front', rightHanded ? 'left' : 'right'], ['back', rightHanded ? 'right' : 'left']] as const) {
    const knee = landmarkAngle(contactLandmarks, `${side}_hip`, `${side}_knee`, `${side}_ankle`);
    const elbow = landmarkAngle(contactLandmarks, `${side}_shoulder`, `${side}_elbow`, `${side}_wrist`);
    if (knee !== null) derivedCapeAngles[`${role}_knee`] = knee;
    if (elbow !== null) derivedCapeAngles[`${role}_elbow`] = elbow;
  }
  const shoulderCenter = contactLandmarks.left_shoulder && contactLandmarks.right_shoulder
    ? [(contactLandmarks.left_shoulder[0] + contactLandmarks.right_shoulder[0]) / 2, (contactLandmarks.left_shoulder[1] + contactLandmarks.right_shoulder[1]) / 2]
    : null;
  const hipCenter = contactLandmarks.left_hip && contactLandmarks.right_hip
    ? [(contactLandmarks.left_hip[0] + contactLandmarks.right_hip[0]) / 2, (contactLandmarks.left_hip[1] + contactLandmarks.right_hip[1]) / 2]
    : null;
  const capeTorso = shoulderCenter && hipCenter ? Math.abs(Math.atan2(hipCenter[0] - shoulderCenter[0], shoulderCenter[1] - hipCenter[1]) * 180 / Math.PI) : null;
  const capeSide = (side: 'left' | 'right', joint: string) => derivedCapeAngles[`${(side === 'left') === rightHanded ? 'front' : 'back'}_${joint}`];
  const capeDurationMs = capeJob && cape ? new Date(capeJob.updatedAt).getTime() - new Date(capeJob.createdAt).getTime() : null;
  const delivery = cape?.delivery;
  const ballLine = aihub?.cricketInterpretation?.ballLine;

  const rows: Array<[string, string, string]> = [
    ['Setup needed', 'None – one click', 'Mark 4 pitch corners, hand and shot'],
    ['Time taken', seconds(aihubDurationMs), capeDurationMs !== null ? `${seconds(capeDurationMs)} (incl. queue)` : '—'],
    ['Overall score', aihub?.cricketInterpretation?.overallScore !== undefined ? `${aihub.cricketInterpretation.overallScore}/100` : '—', cape ? `${cape.coaching.score}/100 · ${cape.coaching.verdict}` : '—'],
    ['Left knee angle', aihub ? deg(num(aihub.metrics.leftKneeAngleDegrees)) : '—', cape ? deg(capeSide('left', 'knee')) : '—'],
    ['Right knee angle', aihub ? deg(num(aihub.metrics.rightKneeAngleDegrees)) : '—', cape ? deg(capeSide('right', 'knee')) : '—'],
    ['Elbow angles', aihub ? `Left ${deg(num(aihub.metrics.leftElbowAngleDegrees))} · Right ${deg(num(aihub.metrics.rightElbowAngleDegrees))}` : '—', cape ? `Front ${deg(capeSide('left', 'elbow'))} · Back ${deg(capeSide('right', 'elbow'))}` : '—'],
    ['Head', aihub ? `Drop ${deg(num(aihub.metrics.headDropDegrees))}` : '—', cape ? (cape.coaching.faults.some(f => f.metric.startsWith('head')) ? 'Flagged (see faults)' : 'Measured (head over front knee)') : '—'],
    ['Torso angle', aihub ? deg(num(aihub.metrics.torsoAngleDegrees)) : '—', cape ? deg(capeTorso) : '—'],
    ['Ball line', ballLine ? `${label(ballLine.label)} (${ballLine.status.toLowerCase().replace(/_/g, ' ')})` : '—', cape ? label(delivery?.line_zone || cape.analytics_payload.point_of_contact?.ball_line || 'unavailable') : '—'],
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
          {
            name: 'AIHub',
            color: 'text-sky-300',
            border: 'border-sky-500/30',
            image: aihub ? `data:${aihub.overlayMimeType};base64,${aihub.overlayImageBase64}` : '',
            ready: Boolean(aihub),
            score: aihub?.cricketInterpretation?.overallScore,
            duration: seconds(aihubDurationMs),
            detail: 'One-click pose, ball-line, and overlay analysis'
          },
          {
            name: 'CAPE',
            color: 'text-emerald-300',
            border: 'border-emerald-500/30',
            image: capeImage,
            ready: Boolean(cape),
            score: cape?.coaching.score,
            duration: capeDurationMs !== null ? `${seconds(capeDurationMs)} incl. queue` : '—',
            detail: 'Calibrated pose, coaching faults, and delivery analysis'
          },
        ].map(engine => (
          <figure key={engine.name} className={`self-start overflow-hidden rounded-lg border ${engine.border} bg-black`}>
            <div className="flex items-center justify-between gap-3 bg-slate-900 px-3 py-2">
              <div>
                <p className={`text-sm font-bold ${engine.color}`}>{engine.name}</p>
                <p className="text-[11px] text-slate-400">{engine.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{engine.score === undefined ? '—' : `${engine.score}/100`}</p>
                <p className="text-[10px] text-slate-500">{engine.duration}</p>
              </div>
            </div>
            {/* Identical fixed viewer for both engines so portrait and landscape frames line up. */}
            <div className="flex aspect-[4/3] w-full items-center justify-center bg-black">
              {engine.image
                ? <img src={engine.image} alt={`${engine.name} annotated frame`} className="h-full w-full object-contain" />
                : <span className="text-xs text-slate-500">{engine.ready ? 'Loading image…' : 'Not run yet'}</span>}
            </div>
            <figcaption className={`border-t border-slate-800 bg-slate-950 px-3 py-1.5 text-[11px] font-semibold ${engine.color}`}>{engine.ready ? 'COMPLETED' : 'NOT RUN'}</figcaption>
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
