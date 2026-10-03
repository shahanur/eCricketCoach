import React, { useState } from 'react';
import { Discipline, ContextType, Drill, VideoAnalysisResult } from '../../types';
import { api } from '../../services/api';
import { ConfirmationModal, ConfirmationType } from '../common/ConfirmationModal';

interface CoachingPortalProps {
  drills: Drill[];
  onAddAiDrill: (drill: Drill) => void;
}

export const CoachingPortal: React.FC<CoachingPortalProps> = ({ drills, onAddAiDrill }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline>('BATTING');
  const [selectedContext, setSelectedContext] = useState<ContextType>('INDIVIDUAL');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<VideoAnalysisResult | null>(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    type?: ConfirmationType;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const handleSimulateAnalysis = async () => {
    setAnalyzing(true);
    setAiFeedback(null);
    try {
      const res = await api.analyzeVideo({
        discipline: selectedDiscipline,
        videoUrl: `sample_${selectedDiscipline.toLowerCase()}_action.mp4`
      });
      if (res?.analysis) {
        setAiFeedback(res.analysis);
      }
    } catch {
      // Fallback local analysis
      setTimeout(() => {
        setAiFeedback({
          overallScore: 82,
          detectedIssues: [
            selectedDiscipline === 'BATTING'
              ? 'Head falling slightly off-axis during dynamic front-foot weight transfer'
              : selectedDiscipline === 'BOWLING'
              ? 'Front non-bowling arm collapses 60ms prior to delivery stride release'
              : 'Glove reaction delay on sudden bounce'
          ],
          biomechanicalMetrics: {
            headPosition: 'Slightly off-axis (-4 deg)',
            footAlignment: 'Pointing towards mid-off instead of cover',
            backliftAngle: selectedDiscipline === 'BATTING' ? 'Optimal 42 deg' : undefined,
            releasePoint: selectedDiscipline === 'BOWLING' ? '172 deg high release' : undefined
          },
          recommendedDrills: [
            {
              title: selectedDiscipline === 'BATTING'
                ? 'AI Head-over-Ball Weighted Bat Punch Drill'
                : 'AI Target Towel High Arm Extension Drill',
              discipline: selectedDiscipline,
              durationMinutes: 20,
              context: selectedContext,
              isNewRecommendation: true
            }
          ]
        });
      }, 800);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddRecommended = (drillItem?: any) => {
    const drillToAdopt = drillItem || aiFeedback?.recommendedDrills?.[0];
    if (!drillToAdopt) return;
    const newDrill: Drill = {
      id: 'drill-ai-' + Date.now(),
      title: drillToAdopt.title,
      discipline: selectedDiscipline,
      skillSet: 'AI Biomechanical Correction',
      contextType: selectedContext,
      duration: drillToAdopt.durationMinutes || 20,
      source: 'AI_RECOMMENDED',
      instructions: 'Custom corrective drill generated via computer vision pose analysis.'
    };
    onAddAiDrill(newDrill);
    setConfirmModal({
      isOpen: true,
      title: 'Drill Adopted into Catalog',
      message: `AI Recommended Drill "${newDrill.title}" has been successfully added to your training catalog!`,
      type: 'success',
      confirmLabel: 'Done',
      onConfirm: () => setConfirmModal(null)
    });
  };

  const filteredDrills = drills.filter(
    d => d.discipline === selectedDiscipline && d.contextType === selectedContext
  );

  return (
    <div className="space-y-6">
      {/* Discipline & Context Selector */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Discipline</h2>
          <div className="flex flex-wrap gap-2">
            {(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'] as Discipline[]).map(discipline => (
              <button
                key={discipline}
                onClick={() => setSelectedDiscipline(discipline)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedDiscipline === discipline
                    ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {discipline}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Training Context</h2>
          <div className="inline-flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => setSelectedContext('INDIVIDUAL')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedContext === 'INDIVIDUAL' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Solo / 1-on-1
            </button>
            <button
              onClick={() => setSelectedContext('GROUP')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                selectedContext === 'GROUP' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Squad / Group
            </button>
          </div>
        </div>
      </section>

      {/* 2-Column Grid: AI Video Analysis & Drill Tailoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Video Analysis Panel */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-white">AI Video Biomechanics</h3>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              Video Engine
            </span>
          </div>

          <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-3 bg-slate-950/40">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl">
              📹
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Upload {selectedDiscipline.toLowerCase()} clip</p>
              <p className="text-xs text-slate-500 mt-1">Accepts short MP4 / MOV videos (up to 60s)</p>
            </div>
            <button
              onClick={handleSimulateAnalysis}
              disabled={analyzing}
              className="mt-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold text-xs rounded-lg transition disabled:opacity-50"
            >
              {analyzing ? 'Analyzing Biomechanics...' : 'Run Simulated AI Video Analysis'}
            </button>
          </div>

          {aiFeedback && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-emerald-400">Analysis Completed</span>
                <span className="text-xs font-bold px-2 py-0.5 bg-emerald-500/20 rounded text-emerald-300">
                  Biomechanical Score: {aiFeedback.overallScore}/100
                </span>
              </div>
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-slate-400">Detected Observations:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {aiFeedback.detectedIssues.map((obs: string, idx: number) => (
                    <li key={idx}>{obs}</li>
                  ))}
                </ul>
              </div>

              {/* Biomechanical Telemetry */}
              {aiFeedback.biomechanicalMetrics && (
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-400 block">Head Position</span>
                    <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.headPosition}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Foot Alignment</span>
                    <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.footAlignment}</span>
                  </div>
                  {aiFeedback.biomechanicalMetrics.backliftAngle && (
                    <div>
                      <span className="text-slate-400 block">Backlift Angle</span>
                      <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.backliftAngle}</span>
                    </div>
                  )}
                  {aiFeedback.biomechanicalMetrics.releasePoint && (
                    <div>
                      <span className="text-slate-400 block">Release Point</span>
                      <span className="font-medium text-slate-200">{aiFeedback.biomechanicalMetrics.releasePoint}</span>
                    </div>
                  )}
                </div>
              )}

              {aiFeedback.recommendedDrills?.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Recommended Corrective Drill:</p>
                  {aiFeedback.recommendedDrills.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/50 p-2 rounded border border-slate-800">
                      <div>
                        <p className="text-xs font-medium text-white">{d.title}</p>
                        <p className="text-xs text-slate-400">{d.durationMinutes} mins • {d.context}</p>
                      </div>
                      <button
                        onClick={() => handleAddRecommended(d)}
                        className="text-xs px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded transition cursor-pointer"
                      >
                        Add to Plans
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Drills & Training Plan Tailoring */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg text-white">Drill Library & Custom Plan</h3>
              <p className="text-xs text-slate-400">Filtered for {selectedDiscipline} ({selectedContext})</p>
            </div>
            <span className="text-xs bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              {filteredDrills.length} Drills
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {filteredDrills.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No drills found for this filter. Try AI analysis to generate one.
              </div>
            ) : (
              filteredDrills.map(drill => (
                <div
                  key={drill.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-medium text-slate-200">{drill.title}</h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold">
                        {drill.source === 'SYSTEM_PREDEFINED' ? 'Official' : drill.source === 'CLUB_CUSTOM' ? 'Club' : 'AI'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {drill.duration} mins • {drill.discipline} • {drill.contextType} • {drill.skillSet}
                    </p>
                  </div>
                  <button className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                    Tailor
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Multi-Tenant Subscription Tiers */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="font-semibold text-lg text-white mb-1">Multi-Tenant Subscription Plans</h3>
        <p className="text-xs text-slate-400 mb-4">Choose your tenancy tier (Player, Coach, or Club / Academy)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-400">Individual</span>
              <h4 className="text-xl font-bold text-white mt-1">$14.99 <span className="text-xs font-normal text-slate-400">/mo</span></h4>
              <p className="text-xs text-slate-400 mt-2">Solo training, 5 AI video analyses/month, personal skill levels.</p>
            </div>
            <button className="mt-4 w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium border border-slate-700">
              Choose Individual
            </button>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border-2 border-emerald-500/50 flex flex-col justify-between relative">
            <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full uppercase">
              Popular
            </span>
            <div>
              <span className="text-xs font-semibold uppercase text-emerald-400">Coach Pro</span>
              <h4 className="text-xl font-bold text-white mt-1">$49.99 <span className="text-xs font-normal text-slate-400">/mo</span></h4>
              <p className="text-xs text-slate-400 mt-2">Manage up to 25 players, group/squad modeling, assessments & promotion approvals.</p>
            </div>
            <button className="mt-4 w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold">
              Choose Coach
            </button>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-400">Club / Academy</span>
              <h4 className="text-xl font-bold text-white mt-1">$199.99 <span className="text-xs font-normal text-slate-400">/mo</span></h4>
              <p className="text-xs text-slate-400 mt-2">Multi-coach seats, squad segmentation, club-wide drill library & centralized billing.</p>
            </div>
            <button className="mt-4 w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium border border-slate-700">
              Choose Club
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation & Info Modal */}
      {confirmModal && (
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
};
