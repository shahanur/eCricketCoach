import React, { useEffect, useRef, useState } from 'react';
import { OpenAiBattingAnalysis } from '../../types';
import { api } from '../../services/api';
import { OpenAiBattingReviewForm } from './OpenAiBattingReviewForm';
import { OpenAiBattingReviewResult } from './OpenAiBattingReviewResult';

interface AssessmentBattingReviewProps {
  assessmentId: string;
  playerId: string;
  playerName: string;
  discipline: string;
  canSubmit: boolean;
}

// Batting video review for one assessment; reviews run here are linked to the assessment.
// Render with key={assessmentId} so state resets when the assessment changes.
export const AssessmentBattingReview: React.FC<AssessmentBattingReviewProps> = ({ assessmentId, playerId, playerName, discipline, canSubmit }) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<OpenAiBattingAnalysis | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const mounted = useRef(true);
  const isBatting = discipline === 'BATTING';

  useEffect(() => {
    mounted.current = true;
    if (!isBatting) return () => { mounted.current = false; };
    setIsLoadingSaved(true);
    api.getLatestOpenAiBattingAnalysis(playerId, undefined, assessmentId)
      .then(saved => { if (mounted.current) setAnalysis(current => current ?? saved); })
      .catch(error => { if (mounted.current) setLoadError(error instanceof Error ? error.message : 'Could not load the saved batting review.'); })
      .finally(() => { if (mounted.current) setIsLoadingSaved(false); });
    return () => { mounted.current = false; };
  }, [assessmentId, playerId, isBatting]);

  if (!isBatting) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-400">
        Batting video review is available for batting assessments.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canSubmit ? (
        <OpenAiBattingReviewForm
          source={videoFile ? { file: videoFile } : null}
          playerId={playerId}
          assessmentId={assessmentId}
          onStart={() => { setAnalysis(null); setLoadError(null); }}
          onComplete={result => { if (mounted.current) setAnalysis(result); }}
          sourcePicker={(
            <label className="block text-[11px] text-slate-400">Assessment video
              <input
                type="file"
                accept="video/*"
                onChange={event => setVideoFile(event.target.files?.[0] || null)}
                className="mt-1 block w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-slate-200"
              />
            </label>
          )}
        >
          {loadError && <p role="alert" className="text-xs text-rose-300">{loadError}</p>}
          {isLoadingSaved && <p role="status" className="text-xs text-slate-400">Loading this assessment’s latest review…</p>}
        </OpenAiBattingReviewForm>
      ) : (
        <div className="rounded-xl border border-violet-400/25 bg-violet-500/5 p-3 space-y-1">
          <h4 className="text-xs font-bold text-violet-200">Batting video review</h4>
          {isLoadingSaved ? <p role="status" className="text-xs text-slate-400">Loading this assessment’s latest review…</p>
            : loadError ? <p role="alert" className="text-xs text-rose-300">{loadError}</p>
              : !analysis && <p className="text-[11px] text-slate-400">No batting video review was recorded for this assessment.</p>}
        </div>
      )}
      {analysis && (
        <OpenAiBattingReviewResult
          key={analysis.reportId ?? 'unsaved'}
          analysis={analysis}
          playerName={playerName}
          onAnalysisChange={setAnalysis}
        />
      )}
    </div>
  );
};
