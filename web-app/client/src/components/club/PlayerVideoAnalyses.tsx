import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { CapeJobSummary, VideoAnalysisResult } from '../../types';
import { VideoAnalysisDetailModal } from '../common/VideoAnalysisDetailModal';
import { CapeAnalysisPanel } from './CapeAnalysisPanel';

type GeminiEntry = Awaited<ReturnType<typeof api.getVideoAnalysisHistory>>['history'][number];

type Row =
  | { kind: 'CAPE'; id: string; createdAt: string; job: CapeJobSummary }
  | { kind: 'GEMINI'; id: string; createdAt: string; entry: GeminiEntry };

interface PlayerVideoAnalysesProps {
  playerId: string;
  playerName: string;
  canAssignDrills: boolean;
  onAdoptDrill?: (drill: VideoAnalysisResult['recommendedDrills'][number], playerId: string | null) => void;
}

const SHOT_LABEL = (value: string | null) => value ? value.replace(/_/g, ' ') : '';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Every saved video analysis for one player: CAPE pose/ball analyses and saved Gemini evaluations.
export const PlayerVideoAnalyses: React.FC<PlayerVideoAnalysesProps> = ({ playerId, playerName, canAssignDrills, onAdoptDrill }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCapeJob, setSelectedCapeJob] = useState<CapeJobSummary | null>(null);
  const [viewingGeminiId, setViewingGeminiId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    setError('');
    Promise.allSettled([api.getPlayerCapeJobs(playerId), api.getVideoAnalysisHistory(playerId)])
      .then(([cape, gemini]) => {
        const next: Row[] = [];
        if (cape.status === 'fulfilled') cape.value.forEach(job => next.push({ kind: 'CAPE', id: job.jobId, createdAt: job.createdAt, job }));
        if (gemini.status === 'fulfilled') (gemini.value.history || []).forEach(entry => next.push({ kind: 'GEMINI', id: entry.id, createdAt: entry.createdAt, entry }));
        if (cape.status === 'rejected' && gemini.status === 'rejected') setError('Unable to load video analyses.');
        next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRows(next);
        setSelectedCapeJob(current => current && next.some(row => row.kind === 'CAPE' && row.id === current.jobId) ? current : null);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setSelectedCapeJob(null);
    setViewingGeminiId(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  return (
    <div className="space-y-4">
      {selectedCapeJob && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">
              {formatDate(selectedCapeJob.createdAt)}{selectedCapeJob.assessmentId ? ' · linked to an assessment' : ''}
            </p>
            <button type="button" onClick={() => setSelectedCapeJob(null)} className="text-xs font-semibold text-slate-300 hover:text-white">Close</button>
          </div>
          <CapeAnalysisPanel
            key={selectedCapeJob.jobId}
            jobId={selectedCapeJob.jobId}
            discipline={selectedCapeJob.target === 'bowler' ? 'BOWLING' : 'BATTING'}
            canSubmit={false}
            canAssignDrills={canAssignDrills}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Past AI Video Analyses</h3>
            <p className="text-xs text-slate-400">Saved video analysis history for <strong className="text-white">{playerName}</strong></p>
          </div>
          <button type="button" onClick={load} title="Refresh history" aria-label="Refresh video analysis history" className="cursor-pointer rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <p role="alert" className="mb-2 text-xs text-rose-300">{error}</p>}
        {isLoading && rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">Loading history...</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No saved video analyses yet for this player. Run one from the AI Analysis page or an assessment.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(row => row.kind === 'CAPE' ? (
              <button
                type="button"
                key={`cape-${row.id}`}
                onClick={() => { setSelectedCapeJob(row.job); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-pressed={selectedCapeJob?.jobId === row.id}
                className={`w-full cursor-pointer rounded-lg border bg-slate-950 p-3 text-left transition hover:border-emerald-500/40 ${selectedCapeJob?.jobId === row.id ? 'border-emerald-500/60' : 'border-slate-800'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-xs font-bold text-emerald-400">
                      {row.job.score ?? '—'}
                    </span>
                    <div>
                      <p className="text-xs font-semibold capitalize text-white">
                        {row.job.target === 'bowler' ? 'Bowling' : 'Batting'}{row.job.shotType || row.job.bowlerType ? ` • ${SHOT_LABEL(row.job.shotType || row.job.bowlerType)}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500">{formatDate(row.createdAt)} • Detailed analysis (CAPE){row.job.assessmentId ? ' • Assessment' : ''}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    row.job.status === 'SUCCEEDED' ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
                      : row.job.status === 'FAILED' ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                        : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                  }`}>
                    {row.job.status === 'SUCCEEDED' ? 'Completed' : row.job.status === 'FAILED' ? 'Failed' : row.job.status === 'RUNNING' ? 'Running' : 'Queued'}
                  </span>
                </div>
                {row.job.verdict && <p className="mt-2 text-[11px] text-slate-300">{row.job.verdict}{row.job.faultCount ? ` · ${row.job.faultCount} fault${row.job.faultCount === 1 ? '' : 's'} found` : ''}</p>}
                {row.job.errorMessage && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-300">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /><span>{row.job.errorMessage}</span>
                  </p>
                )}
              </button>
            ) : (
              <button
                type="button"
                key={`gemini-${row.id}`}
                onClick={() => setViewingGeminiId(row.id)}
                className="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 p-3 text-left transition hover:border-emerald-500/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-xs font-bold text-emerald-400">
                      {row.entry.overallScore}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-white">{row.entry.discipline} • {row.entry.context}</p>
                      <p className="text-[10px] text-slate-500">{formatDate(row.createdAt)} • {row.entry.sourceType === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Device Upload'}</p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${row.entry.drillAdopted ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
                    {row.entry.drillAdopted ? 'Drill Adopted' : 'Not Adopted'}
                  </span>
                </div>
                {row.entry.analysis?.detectedIssues?.length > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-300">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /><span>{row.entry.analysis.detectedIssues[0]}</span>
                  </p>
                )}
                {row.entry.analysis?.recommendedDrills?.length > 0 && (
                  <p className="mt-1 text-[11px] text-emerald-400">🎯 {row.entry.analysis.recommendedDrills[0].title}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewingGeminiId && (
        <VideoAnalysisDetailModal
          analysisId={viewingGeminiId}
          onClose={() => setViewingGeminiId(null)}
          onAdopt={(drill, adoptPlayerId) => {
            onAdoptDrill?.(drill, adoptPlayerId);
            load();
          }}
        />
      )}
    </div>
  );
};
