import React, { useState } from 'react';
import { OpenAiBattingAnalysis } from '../../types';
import { api } from '../../services/api';
import { CroppedPoseOverlayPanel } from './CroppedPoseOverlayPanel';

type FindingReviewStatus = 'accepted' | 'revised' | 'not_applicable' | '';

interface OpenAiBattingReviewResultProps {
  analysis: OpenAiBattingAnalysis;
  playerName: string;
  onAnalysisChange: (update: (current: OpenAiBattingAnalysis | null) => OpenAiBattingAnalysis | null) => void;
  containerRef?: React.Ref<HTMLDivElement>;
}

const contactLabel = (status: OpenAiBattingAnalysis['contact']['status']) =>
  status === 'DETECTED' ? 'Contact visible'
    : status === 'LIKELY' ? 'Contact likely'
      : status === 'UNCERTAIN' ? 'Contact unclear' : 'Contact not visible';

// Batting review result: contact status, coach review of findings, and the pose overlay.
// Remount with a key per report so the coach review state starts from the saved review.
export const OpenAiBattingReviewResult: React.FC<OpenAiBattingReviewResultProps> = ({ analysis, playerName, onAnalysisChange, containerRef }) => {
  const [coachNote, setCoachNote] = useState(analysis.coachReview?.note ?? '');
  const [findingReviews, setFindingReviews] = useState<Record<number, { status: FindingReviewStatus; note: string }>>(
    () => Object.fromEntries((analysis.coachReview?.findings ?? []).map(finding => [finding.findingIndex, { status: finding.status, note: finding.note }]))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const findings = [...analysis.errors, ...analysis.observations];

  const saveCoachReview = async () => {
    if (!analysis.reportId) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const reviewed = Object.entries(findingReviews)
        .filter(([, review]) => review.status !== '')
        .map(([findingIndex, review]) => ({ findingIndex: Number(findingIndex), status: review.status as Exclude<FindingReviewStatus, ''>, note: review.note }));
      await api.saveOpenAiBattingReview(analysis.reportId, { note: coachNote, findings: reviewed });
      setMessage('Coach review saved. The downloadable JSON, Markdown, and ZIP were refreshed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save coach review.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="scroll-mt-4 rounded-xl border border-violet-400/30 bg-slate-950 p-5 space-y-4">
      <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Batting review</h4>
          <p className="text-xs text-slate-400">{playerName}</p>
        </div>
        <span className="w-fit rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">
          {contactLabel(analysis.contact.status)}
        </span>
      </div>

      {analysis.reportId && (
        <section className="space-y-3 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wide text-emerald-200">Coach review</h5>
            <p className="mt-1 text-[11px] text-slate-400">Mark findings and add your coaching note. Your notes will be added to the report.</p>
          </div>
          {findings.map((finding, findingIndex) => (
            <div key={`${finding.title}-${findingIndex}`} className="grid gap-2 rounded-md border border-slate-800 bg-slate-950 p-3 md:grid-cols-[1fr_160px]">
              <div>
                <p className="text-xs font-semibold text-white">{finding.title}</p>
                <p className="mt-1 text-xs text-slate-300">{finding.coachingImplication}</p>
                {finding.coachingCue && <p className="mt-1 text-xs text-violet-200">Cue: {finding.coachingCue}</p>}
                {finding.drill && <p className="mt-1 text-xs text-emerald-200">Drill: {finding.drill}</p>}
                <details className="mt-2 text-[10px] text-slate-500">
                  <summary className="cursor-pointer">Advanced details · evidence</summary>
                  <p className="mt-1">{finding.observation}</p>
                  {finding.alternativeExplanation && <p className="mt-1">Alternative explanation: {finding.alternativeExplanation}</p>}
                  <p className="mt-1">Evidence references: {finding.frameIndices.join(', ') || 'not cited'} · {finding.confidence} confidence</p>
                </details>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400">Review decision
                  <select value={findingReviews[findingIndex]?.status ?? ''} onChange={event => {
                    const status = event.target.value as FindingReviewStatus;
                    setFindingReviews(current => ({ ...current, [findingIndex]: { status, note: current[findingIndex]?.note ?? '' } }));
                  }} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white">
                    <option value="">Not reviewed</option><option value="accepted">Accepted</option><option value="revised">Revised</option><option value="not_applicable">Not applicable</option>
                  </select>
                </label>
                <input value={findingReviews[findingIndex]?.note ?? ''} onChange={event => setFindingReviews(current => ({ ...current, [findingIndex]: { status: current[findingIndex]?.status ?? '', note: event.target.value } }))} maxLength={1000} placeholder="Coach correction or note" className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-white placeholder:text-slate-600" />
              </div>
            </div>
          ))}
          <textarea value={coachNote} onChange={event => setCoachNote(event.target.value)} maxLength={3000} rows={3} placeholder="Overall coach note, context, or next-session focus" className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder:text-slate-600" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void saveCoachReview()} disabled={isSaving} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{isSaving ? 'Saving…' : 'Save coach review'}</button>
            {message && <p role="status" className="text-xs text-emerald-200">{message}</p>}
          </div>
        </section>
      )}

      {(!analysis.restoredFromReport || analysis.poseOverlayResult) && (
        <CroppedPoseOverlayPanel
          imageDataUrl={analysis.croppedContactImageDataUrl}
          analysis={analysis}
          playerName={playerName}
          sequenceFrames={analysis.poseSequenceFrames}
          savedResult={analysis.poseOverlayResult}
          onPoseOverlaySaved={(result, artifactNames) => onAnalysisChange(current => current
            ? { ...current, poseOverlayResult: result, artifactNames }
            : current)}
        />
      )}
    </div>
  );
};
