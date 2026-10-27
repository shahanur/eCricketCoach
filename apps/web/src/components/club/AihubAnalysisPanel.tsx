import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, ScanLine, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { AihubResultView, AihubResultViewModel } from './AihubResultView';
import type { CapeVideoSource } from './CapeAnalysisPanel';

export type AihubResult = Awaited<ReturnType<typeof api.analyzeKinematicsOverlay>>;

interface AihubAnalysisPanelProps {
  discipline: string;
  source: CapeVideoSource | null;
  startLabel?: string;
  onResultChange?: (result: AihubResult | null, durationMs: number | null) => void;
}

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export const AihubAnalysisPanel: React.FC<AihubAnalysisPanelProps> = ({ discipline, source, startLabel, onResultChange }) => {
  const [result, setResult] = useState<AihubResult | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');
  const onResultChangeRef = useRef(onResultChange);
  onResultChangeRef.current = onResultChange;

  useEffect(() => { onResultChangeRef.current?.(result, durationMs); }, [result, durationMs]);

  // Live timer while AIHub runs (CPU analysis can take up to a minute).
  useEffect(() => {
    if (!isRunning) return;
    const startedAt = performance.now();
    setElapsedMs(0);
    const timer = setInterval(() => setElapsedMs(performance.now() - startedAt), 500);
    return () => clearInterval(timer);
  }, [isRunning]);

  const run = async () => {
    if (!source || isRunning) return;
    setIsRunning(true);
    setError('');
    setResult(null);
    setDurationMs(null);
    const startedAt = performance.now();
    try {
      const next = source.file
        ? await api.analyzeKinematicsOverlay({ discipline, videoFile: source.file })
        : await api.analyzeKinematicsOverlay({ discipline, driveFileId: source.driveFileId });
      setResult(next);
      setDurationMs(performance.now() - startedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AIHub could not analyse this video.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-emerald-200">Detailed {discipline === 'BOWLING' ? 'bowling' : 'batting'} analysis (pose, ball &amp; speed)</h4>
        {!isRunning && (
          <button type="button" disabled={!source} onClick={run} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50">
            {result ? <RotateCcw size={13} /> : <ScanLine size={13} />}
            {source ? (startLabel || `Run AIHub analysis (${source.name})`) : 'Choose a video above'}
          </button>
        )}
      </div>

      {!isRunning && !result && !error && (
        <p className="mt-1 text-xs text-slate-400">
          One-click pose, ball-line and correction feedback from the selected video, with downloadable annotated images. No pitch calibration needed.
        </p>
      )}

      {isRunning && (
        <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-300">
          <Loader2 size={14} className="animate-spin text-emerald-300" />
          Analysing the video… {formatSeconds(elapsedMs)} (usually under a minute). Please stay on this page.
        </p>
      )}

      {!isRunning && error && (
        <p className="mt-2 flex items-start gap-2 text-xs text-rose-300">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {!isRunning && result && (
        <>
          {durationMs !== null && <p className="mt-2 text-[11px] text-slate-500">Completed in {formatSeconds(durationMs)}</p>}
          <AihubResultView result={result as AihubResultViewModel} discipline={discipline} />
        </>
      )}
    </div>
  );
};
