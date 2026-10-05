import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { VideoAnalysisResult } from '../../types';

interface VideoAnalysisEntry {
  id: string;
  playerId: string | null;
  playerName: string | null;
  discipline: string;
  context: string;
  sourceType: string;
  driveFileId: string | null;
  model: string;
  overallScore: number;
  analysis: VideoAnalysisResult;
  drillAdopted: boolean;
  createdAt: string;
}

interface VideoAnalysisDetailModalProps {
  analysisId: string;
  onClose: () => void;
  // Called when the coach/club admin adopts a recommended drill from this saved analysis into
  // their training catalogue. The parent is responsible for actually adding the drill; this
  // modal takes care of persisting the "adopted" flag against the saved analysis record.
  // playerId is passed through so the parent can incorporate the drill into that player's squad/session.
  onAdopt: (drill: VideoAnalysisResult['recommendedDrills'][number], playerId: string | null) => void;
}

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return iso;
  }
}

export const VideoAnalysisDetailModal: React.FC<VideoAnalysisDetailModalProps> = ({ analysisId, onClose, onAdopt }) => {
  const [entry, setEntry] = useState<VideoAnalysisEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdopting, setIsAdopting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api.getVideoAnalysisById(analysisId)
      .then(res => {
        if (!res.entry) {
          setError('This analysis could not be found.');
        } else {
          setEntry(res.entry as VideoAnalysisEntry);
        }
      })
      .catch(() => setError('Failed to load the analysis result.'))
      .finally(() => setIsLoading(false));
  }, [analysisId]);

  const handleAdopt = async (drill: VideoAnalysisResult['recommendedDrills'][number]) => {
    setIsAdopting(true);
    try {
      onAdopt(drill, entry?.playerId ?? null);
      await api.markVideoAnalysisDrillAdopted(analysisId);
      setEntry(prev => (prev ? { ...prev, drillAdopted: true } : prev));
    } catch {
      // Non-fatal: the drill was still added to the catalogue even if the flag failed to persist.
    } finally {
      setIsAdopting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 sm:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {isLoading && (
          <p className="text-xs text-slate-500 py-8 text-center">Loading analysis...</p>
        )}

        {!isLoading && error && (
          <p className="text-xs text-rose-400 py-8 text-center">{error}</p>
        )}

        {!isLoading && entry && (
          <>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 pr-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg">
                  {entry.overallScore}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Biomechanical AI Pose Evaluation</h3>
                  <p className="text-xs text-slate-400">
                    {entry.playerName ? <strong className="text-white">{entry.playerName}</strong> : 'Unassigned Player'} • {entry.discipline} ({entry.context})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatFullDate(entry.createdAt)} • {entry.sourceType === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Device Upload'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Drill Status</span>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${entry.drillAdopted ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {entry.drillAdopted && <CheckCircle2 className="w-3 h-3" />}
                {entry.drillAdopted ? 'Recommended Drill Adopted into Catalogue' : 'Recommended Drill Not Yet Adopted'}
              </span>
            </div>

            {entry.analysis?.detectedIssues?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Detected Observations</span>
                <ul className="space-y-1">
                  {entry.analysis.detectedIssues.map((issue, idx) => (
                    <li key={idx} className="text-xs text-slate-200 flex items-center gap-2 bg-slate-950/60 p-2 rounded border border-slate-800">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {entry.analysis?.biomechanicalMetrics && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Joint & Axis Telemetry</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Head Alignment</span>
                    <p className="text-xs font-bold text-white mt-0.5">{entry.analysis.biomechanicalMetrics.headPosition}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Foot Placement</span>
                    <p className="text-xs font-bold text-white mt-0.5">{entry.analysis.biomechanicalMetrics.footAlignment}</p>
                  </div>
                  {entry.analysis.biomechanicalMetrics.backliftAngle && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Backlift Plane</span>
                      <p className="text-xs font-bold text-emerald-400 mt-0.5">{entry.analysis.biomechanicalMetrics.backliftAngle}</p>
                    </div>
                  )}
                  {entry.analysis.biomechanicalMetrics.releasePoint && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase">Arm Release</span>
                      <p className="text-xs font-bold text-cyan-400 mt-0.5">{entry.analysis.biomechanicalMetrics.releasePoint}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {entry.analysis?.recommendedDrills?.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  AI Prescribed Corrective Drills
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {entry.analysis.recommendedDrills.map((drill, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{drill.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {drill.durationMinutes} mins • {drill.discipline} • {drill.context}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={entry.drillAdopted || isAdopting}
                        onClick={() => handleAdopt(drill)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow transition cursor-pointer"
                      >
                        {entry.drillAdopted ? 'Adopted' : 'Adopt Drill'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
