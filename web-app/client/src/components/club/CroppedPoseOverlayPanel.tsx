import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import type { PoseOverlayAnalysis } from '../../types';

interface CroppedPoseOverlayPanelProps {
  imageDataUrl: string | null;
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

export const CroppedPoseOverlayPanel: React.FC<CroppedPoseOverlayPanelProps> = ({ imageDataUrl }) => {
  const [handedness, setHandedness] = useState<'right' | 'left'>('right');
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
    api.analyzePoseOverlayImage(imageDataUrl, handedness)
      .then(next => { if (!cancelled) setResult(next); })
      .catch((failure: unknown) => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : 'The cropped image pose analysis failed.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [imageDataUrl, handedness, retryCount]);

  return (
    <section className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-bold text-cyan-100">Pose overlay on OpenAI contact crop</h5>
          <p className="text-[11px] text-slate-400">The crop is processed separately with YOLO person detection, MediaPipe landmarks, and OpenCV geometry.</p>
        </div>
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
                alt="YOLO and MediaPipe pose overlay with head-to-toe alignment and joint labels"
                className="max-h-[75vh] w-full bg-black object-contain"
              />
              <figcaption className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 text-[11px] text-slate-400">
                {result.width} × {result.height}px crop · {result.person_detection ? `YOLO person confidence ${Math.round(result.person_detection.confidence * 100)}%` : 'YOLO person box unavailable; MediaPipe pose retained'}
              </figcaption>
            </figure>
          </div>
          <div className="space-y-2">
            <h6 className="text-xs font-semibold uppercase tracking-wide text-cyan-100">Projected geometry</h6>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(result.metrics).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <span className="text-xs text-slate-300">{metricLabels[key] || key.replace(/_/g, ' ')}</span>
                  <span className="shrink-0 text-xs font-semibold text-white">
                    {value === null ? '—' : `${value.toFixed(1)}${metricUnit(key) === '°' ? '°' : ` ${metricUnit(key)}`}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <ul className="space-y-1 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-[11px] text-amber-100/80">
            {result.limitations.map((limitation, index) => <li key={index}>• {limitation}</li>)}
          </ul>
        </>
      )}
    </section>
  );
};
