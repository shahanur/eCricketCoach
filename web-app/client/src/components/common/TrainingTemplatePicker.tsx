import React, { useEffect, useId, useState } from 'react';
import { api } from '../../services/api';
import { TrainingSessionTemplate } from '../../types';

interface TrainingTemplatePickerProps {
  onApply?: (template: TrainingSessionTemplate) => void;
}

export const TrainingTemplatePicker: React.FC<TrainingTemplatePickerProps> = ({ onApply }) => {
  const selectId = useId();
  const [templates, setTemplates] = useState<TrainingSessionTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getTrainingSessionTemplates()
      .then(rows => { if (active) setTemplates(rows); })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load shared training templates.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const selected = templates.find(template => template.id === selectedId);
  return (
    <section className="border border-sky-500/30 bg-sky-500/5 rounded-lg p-3 space-y-2">
      <label htmlFor={selectId} className="block text-xs font-semibold text-sky-300">Shared training templates</label>
      <p className="text-[11px] text-slate-400">Reusable activities available to every club and coach.</p>
      {error && (
        <div role="alert" className="text-xs text-rose-300">
          {error}
          <button type="button" onClick={() => setReload(value => value + 1)} className="ml-2 underline">Retry</button>
        </div>
      )}
      <select
        id={selectId}
        value={selectedId}
        onChange={event => setSelectedId(event.target.value)}
        disabled={loading || Boolean(error) || templates.length === 0}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
      >
        <option value="">
          {loading ? 'Loading templates...' : error ? 'Templates unavailable' : templates.length === 0 ? 'No templates available' : 'Choose a training activity'}
        </option>
        {templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
      </select>
      {!loading && !error && templates.length === 0 && <p className="text-xs text-slate-400">No shared templates have been seeded yet.</p>}
      {selected && (
        <div className="space-y-2 text-xs text-slate-300">
          <p className="font-semibold text-white">{selected.activityName}</p>
          <p>{selected.disciplines.join(', ')} | {selected.durationMinutes} min | {selected.drills.length} drills</p>
          <p><strong>Focus:</strong> {selected.focus}</p>
          <p><strong>Organization:</strong> {selected.organization}</p>
          <details>
            <summary className="cursor-pointer text-sky-300">Drills and setups</summary>
            <div className="space-y-3 mt-2">
              {selected.drills.map(drill => (
                <details key={drill.id}>
                  <summary className="cursor-pointer font-semibold">{drill.title} ({drill.duration} min)</summary>
                  <p className="whitespace-pre-wrap mt-2">{drill.instructions}</p>
                </details>
              ))}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-amber-300">Safety</summary>
            <ul className="list-disc pl-4 mt-2 space-y-1">{selected.safety.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </details>
          {onApply && (
            <>
              <p className="text-[11px] text-slate-400">Applying replaces this draft's title, duration, and planned drills. Date, players, squad, and coaches stay unchanged.</p>
              <button type="button" onClick={() => onApply(selected)} className="px-3 py-2 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold">Use template</button>
            </>
          )}
        </div>
      )}
    </section>
  );
};
