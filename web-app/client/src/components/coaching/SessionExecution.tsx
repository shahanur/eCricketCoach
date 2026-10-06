import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Download, Play, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import {
  AttendanceStatus,
  ClubMember,
  Drill,
  SessionAiEvaluation,
  SessionDrillLogEntry,
  SessionExecutionLog,
  TrainingSession
} from '../../types';

type Step = 'PREPARE' | 'ATTENDANCE' | 'RUN' | 'NOTES' | 'EVALUATE';

interface SessionExecutionProps {
  session: TrainingSession;
  players: ClubMember[];
  drills: Drill[];
  clubName?: string;
  onClose: () => void;
  onSaved: (session: TrainingSession) => void;
  onRefresh?: () => void | Promise<void>;
  onDrillCreated?: (drill: Drill) => void;
  onSessionCreated?: (session: TrainingSession) => void;
}

const DISCIPLINES: Drill['discipline'][] = ['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'];
const EMPTY_ADHOC = { title: '', discipline: 'BATTING' as Drill['discipline'], skillSet: '', contextType: 'GROUP' as Drill['contextType'], duration: 15, instructions: '' };

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'PREPARE', label: '1. Prepare' },
  { id: 'ATTENDANCE', label: '2. Attendance' },
  { id: 'RUN', label: '3. Run drills' },
  { id: 'NOTES', label: '4. Player notes' },
  { id: 'EVALUATE', label: '5. Evaluate & complete' }
];

const CHECKLIST: Array<{ id: string; label: string }> = [
  { id: 'plan', label: 'Session plan, objectives and drill order reviewed' },
  { id: 'equipment', label: 'Balls, bats, stumps, cones, markers and nets ready' },
  { id: 'safety', label: 'Helmets, pads and protective equipment checked' },
  { id: 'firstAid', label: 'First-aid kit, medical info and emergency contacts available' },
  { id: 'facility', label: 'Facility booking and pitch/net condition confirmed' },
  { id: 'staff', label: 'Assistant coaches briefed on roles and groups' },
  { id: 'weather', label: 'Weather checked and indoor/backup plan agreed' }
];

const INCIDENT_CATEGORIES = ['Weather', 'Injury', 'Equipment', 'Facility', 'Behaviour', 'Late start', 'Other'];

const NOTE_TEMPLATE = 'Strengths: \nWork-ons: \nNext focus: ';

interface FollowUpDraft {
  title: string;
  sessionDate: string;
  durationMinutes: number;
  drillIds: string[];
  recommendedDrillIndexes: number[];
}

const READINESS_LABEL: Record<SessionAiEvaluation['progressionReadiness'], string> = {
  READY_FOR_PROMOTION: 'Ready for promotion',
  CONSOLIDATE_CURRENT_STAGE: 'Consolidate current stage',
  REQUIRES_REMEDIATION: 'Requires remediation'
};

const addDays = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
};

// Pre-fills the follow-up session from the AI plan: one week after this session (never in the past).
const buildFollowUpDraft = (session: TrainingSession, evaluation: SessionAiEvaluation): FollowUpDraft => {
  const weekLater = addDays(session.sessionDate, 7);
  const today = localToday();
  return {
    title: evaluation.followUpPlan?.title || `${session.title} – follow-up`,
    sessionDate: weekLater < today ? addDays(today, 7) : weekLater,
    durationMinutes: evaluation.followUpPlan?.durationMinutes || session.durationMinutes,
    drillIds: evaluation.followUpPlan?.catalogueDrillIds || [],
    recommendedDrillIndexes: evaluation.tailoredRecommendedDrills.map((_, index) => index)
  };
};

const GUIDANCE: Record<string, string[]> = {
  Engagement: [
    'Keep queues to 3 players or fewer – add a second station if lines grow.',
    'Use game-based challenges (targets, scores, small competitions) to lift intensity.',
    'Give specific praise tied to effort or technique, not just outcomes.',
    'Let players choose a challenge level to keep stronger and newer players stretched.'
  ],
  'Time management': [
    'Brief each drill in under 60 seconds – demonstrate, then let players work.',
    'Set up the next drill while the current one is running where possible.',
    'If a block overruns, shorten or drop the lowest-priority drill rather than the debrief.',
    'Keep 5–10 minutes at the end for a cool-down and debrief.'
  ],
  Disruptions: [
    'Rain or bad light: move to indoor nets or switch to fielding/skills circuits under cover.',
    'Injury: stop the activity, follow first-aid procedure, log it and inform the parent/guardian and club welfare officer.',
    'Missing equipment: switch to a drill variant using available kit (e.g. tennis balls, cones as stumps).',
    'Behaviour: give one clear reset, then a short time-out; follow up privately after the session.'
  ],
  Communication: [
    'Open with the session goal and how players will know they have succeeded.',
    'Use short, consistent cues (e.g. "head still", "front foot to the ball").',
    'Agree signals with assistant coaches for rotations and safety stops.',
    'Close with one key takeaway per group and the focus for next session.'
  ]
};

const COMMON_CHALLENGES = [
  { challenge: 'Mixed ability in one group', response: 'Split into ability lanes with the same drill and different targets or ball types.' },
  { challenge: 'Low attendance', response: 'Combine stations, increase reps per player, and use the time for individual technical feedback.' },
  { challenge: 'Players losing focus', response: 'Switch to a short competitive game, then return to the technical drill.' },
  { challenge: 'Drill not working as planned', response: 'Simplify (fewer rules, slower feed) or swap to a related progression.' }
];

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const COOL_DOWN_TITLE = 'Cool-down and debrief';

const catalogueEntry = (drillId: string, drills: Drill[]): SessionDrillLogEntry => {
  const drill = drills.find(item => item.id === drillId);
  return {
    id: newId('drill'),
    drillId,
    title: drill?.title || 'Planned drill',
    plannedMinutes: drill?.duration || 15,
    actualMinutes: 0,
    completed: false,
    notes: ''
  };
};

const insertBeforeCoolDown = (drillLog: SessionDrillLogEntry[], entries: SessionDrillLogEntry[]) => {
  const coolDownIndex = drillLog.length - 1;
  if (coolDownIndex >= 0 && !drillLog[coolDownIndex].drillId && drillLog[coolDownIndex].title === COOL_DOWN_TITLE) {
    return [...drillLog.slice(0, coolDownIndex), ...entries, drillLog[coolDownIndex]];
  }
  return [...drillLog, ...entries];
};

// Keeps catalogue-linked drill log entries in step with the session's drill plan, which can be
// amended after execution started. Untouched entries for removed drills are dropped; recorded work is kept.
const reconcileDrillLog = (drillLog: SessionDrillLogEntry[], drillIds: string[], drills: Drill[]) => {
  const wanted = new Map<string, number>();
  drillIds.forEach(id => wanted.set(id, (wanted.get(id) || 0) + 1));
  const linked = new Map<string, number>();
  let changed = false;
  const kept = drillLog.filter(entry => {
    if (!entry.drillId) return true;
    const count = linked.get(entry.drillId) || 0;
    if (count < (wanted.get(entry.drillId) || 0)) {
      linked.set(entry.drillId, count + 1);
      return true;
    }
    const hasRecordedWork = entry.completed || entry.actualMinutes > 0 || Boolean(entry.notes.trim());
    if (!hasRecordedWork) changed = true;
    return hasRecordedWork;
  });
  const missing: SessionDrillLogEntry[] = [];
  wanted.forEach((count, drillId) => {
    for (let index = linked.get(drillId) || 0; index < count; index += 1) missing.push(catalogueEntry(drillId, drills));
  });
  if (!missing.length && !changed) return drillLog;
  return insertBeforeCoolDown(kept, missing);
};

const buildInitialLog = (session: TrainingSession, drills: Drill[]): SessionExecutionLog => {
  if (session.executionLog) {
    if (session.isExecuted) return session.executionLog;
    return { ...session.executionLog, drillLog: reconcileDrillLog(session.executionLog.drillLog, session.drillIds || [], drills) };
  }
  const sessionDrills = (session.drillIds || []).map(drillId => catalogueEntry(drillId, drills));
  const block = (title: string, plannedMinutes: number): SessionDrillLogEntry => ({
    id: newId('block'), drillId: null, title, plannedMinutes, actualMinutes: 0, completed: false, notes: ''
  });
  return {
    status: 'PREPARING',
    startedAt: null,
    completedAt: null,
    checklist: {},
    attendance: {},
    drillLog: [block('Warm-up', 10), ...sessionDrills, block(COOL_DOWN_TITLE, 10)],
    incidents: [],
    evaluation: { objectivesMet: '', engagement: 0, wentWell: '', challenges: '', nextAdjustments: '' }
  };
};

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours ? `${hours}:` : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const SessionExecution: React.FC<SessionExecutionProps> = ({ session, players, drills, clubName, onClose, onSaved, onRefresh, onDrillCreated, onSessionCreated }) => {
  const [log, setLog] = useState<SessionExecutionLog>(() => buildInitialLog(session, drills));
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueDiscipline, setCatalogueDiscipline] = useState<'ALL' | Drill['discipline']>('ALL');
  const [drillPanel, setDrillPanel] = useState<'NONE' | 'CATALOGUE' | 'ADHOC'>('NONE');
  const [adhocDrill, setAdhocDrill] = useState(EMPTY_ADHOC);
  const [drillBusy, setDrillBusy] = useState(false);
  const [playerNotes, setPlayerNotes] = useState<Record<string, string>>(session.playerNotes || {});
  const [postNotes, setPostNotes] = useState(session.postNotes || '');
  const [step, setStep] = useState<Step>(session.isExecuted ? 'EVALUATE' : session.executionLog?.status === 'IN_PROGRESS' ? 'RUN' : 'PREPARE');
  const [guidanceTab, setGuidanceTab] = useState('Engagement');
  const [incidentCategory, setIncidentCategory] = useState(INCIDENT_CATEGORIES[0]);
  const [incidentNote, setIncidentNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [followUp, setFollowUp] = useState<FollowUpDraft | null>(null);
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [createdFollowUp, setCreatedFollowUp] = useState<TrainingSession | null>(null);

  const aiEvaluation = session.aiEvaluation?.squadSummary ? session.aiEvaluation : null;
  const aiGeneratedAt = aiEvaluation?.generatedAt || '';
  useEffect(() => {
    setFollowUp(aiEvaluation?.followUpPlan ? buildFollowUpDraft(session, aiEvaluation) : null);
  }, [aiGeneratedAt]);

  const isCompleted = Boolean(session.isExecuted) || log.status === 'COMPLETED';
  const canStart = session.sessionDate <= localToday();
  const isLive = log.status === 'IN_PROGRESS';

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isLive]);

  const drillIdsKey = (session.drillIds || []).join('|');
  useEffect(() => {
    if (session.isExecuted) return;
    setLog(current => {
      const drillLog = reconcileDrillLog(current.drillLog, session.drillIds || [], drills);
      return drillLog === current.drillLog ? current : { ...current, drillLog };
    });
  }, [drillIdsKey, drills, session.isExecuted]);

  const catalogue = useMemo(() => {
    const search = catalogueSearch.trim().toLowerCase();
    return drills
      .filter(drill => drill.source !== 'CLUB_CUSTOM' || (clubName && drill.clubName === clubName))
      .filter(drill => catalogueDiscipline === 'ALL' || drill.discipline === catalogueDiscipline)
      .filter(drill => !search || `${drill.title} ${drill.skillSet}`.toLowerCase().includes(search));
  }, [drills, clubName, catalogueDiscipline, catalogueSearch]);

  const sessionPlayers = useMemo(() => {
    const assigned = new Set(session.assignedPlayerIds || []);
    return assigned.size
      ? players.filter(player => assigned.has(player.id))
      : players.filter(player => player.squad === session.squadName);
  }, [players, session.assignedPlayerIds, session.squadName]);

  const attendingPlayers = sessionPlayers.filter(player => log.attendance[player.id] === 'PRESENT' || log.attendance[player.id] === 'LATE');
  const markedCount = sessionPlayers.filter(player => log.attendance[player.id]).length;
  const plannedMinutes = log.drillLog.reduce((sum, entry) => sum + entry.plannedMinutes, 0);
  const actualMinutes = log.drillLog.reduce((sum, entry) => sum + entry.actualMinutes, 0);
  const checklistDone = CHECKLIST.filter(item => log.checklist[item.id]).length;
  const elapsedMs = log.startedAt ? (log.completedAt ? Date.parse(log.completedAt) : now) - Date.parse(log.startedAt) : 0;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const attendanceRate = sessionPlayers.length ? Math.round((attendingPlayers.length / sessionPlayers.length) * 100) : 0;

  const suggestions = useMemo(() => {
    const items: string[] = [];
    log.drillLog.filter(entry => entry.actualMinutes > entry.plannedMinutes + 5)
      .forEach(entry => items.push(`"${entry.title}" overran by ${entry.actualMinutes - entry.plannedMinutes} min – plan more time or simplify the setup.`));
    log.drillLog.filter(entry => !entry.completed)
      .forEach(entry => items.push(`"${entry.title}" was not completed – carry it forward to the next session.`));
    if (sessionPlayers.length && attendanceRate < 75) items.push(`Attendance was ${attendanceRate}% – confirm availability and send a reminder before the next session.`);
    if (log.evaluation.engagement > 0 && log.evaluation.engagement <= 2) items.push('Engagement was low – add more game-based or competitive drills and shorten queues.');
    if (log.evaluation.objectivesMet === 'NO' || log.evaluation.objectivesMet === 'PARTIAL') items.push('Objectives were not fully met – repeat the key drill with a simpler progression next time.');
    if (log.incidents.length) items.push(`${log.incidents.length} disruption(s) logged – review the backup plan and equipment checklist.`);
    if (plannedMinutes > session.durationMinutes) items.push(`Planned blocks (${plannedMinutes} min) exceed the ${session.durationMinutes} min slot – trim the plan.`);
    return items;
  }, [log, sessionPlayers.length, attendanceRate, plannedMinutes, session.durationMinutes]);

  const updateLog = (updates: Partial<SessionExecutionLog>) => setLog(current => ({ ...current, ...updates }));
  const updateDrill = (id: string, updates: Partial<SessionDrillLogEntry>) =>
    updateLog({ drillLog: log.drillLog.map(entry => entry.id === id ? { ...entry, ...updates } : entry) });
  const setAttendance = (playerId: string, status: AttendanceStatus) =>
    updateLog({ attendance: { ...log.attendance, [playerId]: status } });

  const persist = async (nextLog: SessionExecutionLog, complete = false): Promise<boolean> => {
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const notes = Object.fromEntries(Object.entries(playerNotes).filter(([, note]) => note.trim()));
      const updated = await api.saveSessionExecution(session.id, { executionLog: nextLog, playerNotes: notes, postNotes, complete });
      if (updated.executionLog) setLog(updated.executionLog);
      onSaved(updated);
      setSavedMessage(complete ? 'Session completed and saved.' : 'Progress saved.');
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save session.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startSession = async () => {
    const nextLog: SessionExecutionLog = { ...log, status: 'IN_PROGRESS', startedAt: new Date().toISOString() };
    if (await persist(nextLog)) setStep('ATTENDANCE');
  };

  const addSessionDrill = async (payload: Parameters<typeof api.addCoachSessionDrill>[1]) => {
    setDrillBusy(true);
    setError('');
    try {
      const result = await api.addCoachSessionDrill(session.id, payload);
      if ('drill' in payload) onDrillCreated?.(result.drill);
      const nextLog = { ...log, drillLog: insertBeforeCoolDown(log.drillLog, [catalogueEntry(result.drill.id, [result.drill])]) };
      setLog(nextLog);
      onSaved(result.session);
      if (await persist(nextLog)) setSavedMessage(`"${result.drill.title}" added to the session${'drill' in payload ? ' and saved to the club catalogue' : ''}.`);
      setAdhocDrill(EMPTY_ADHOC);
      setDrillPanel('NONE');
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add drill.');
    } finally {
      setDrillBusy(false);
    }
  };

  const removeSessionDrill = async (entry: SessionDrillLogEntry) => {
    const nextLog = { ...log, drillLog: log.drillLog.filter(item => item.id !== entry.id) };
    if (!entry.drillId) {
      setLog(nextLog);
      return;
    }
    if (!window.confirm(`Remove "${entry.title}" from this session's plan?`)) return;
    setDrillBusy(true);
    setError('');
    try {
      const updated = await api.removeCoachSessionDrill(session.id, entry.drillId);
      setLog(nextLog);
      onSaved(updated);
      await persist(nextLog);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove drill.');
    } finally {
      setDrillBusy(false);
    }
  };

  // Saves the latest notes and evaluation first so the AI analyses exactly what the coach recorded.
  const runAiAnalysis = async () => {
    const hasNotes = Object.values(playerNotes).some(note => note.trim() && note.trim() !== NOTE_TEMPLATE.trim())
      || postNotes.trim() || log.evaluation.wentWell.trim() || log.evaluation.challenges.trim();
    if (!hasNotes) {
      setAiError('Add player notes, a session summary, or what went well / challenges before running the AI analysis.');
      return;
    }
    setAiBusy(true);
    setAiError('');
    setCreatedFollowUp(null);
    try {
      if (!(await persist(log))) return;
      const updated = await api.assessSessionWithAi(session.id, '');
      onSaved(updated);
    } catch (analysisError) {
      setAiError(analysisError instanceof Error ? analysisError.message : 'AI analysis failed.');
    } finally {
      setAiBusy(false);
    }
  };

  const createFollowUpSession = async () => {
    if (!followUp) return;
    setFollowUpBusy(true);
    setAiError('');
    try {
      const result = await api.createFollowUpSession(session.id, followUp);
      result.drills.forEach(drill => onDrillCreated?.(drill));
      onSessionCreated?.(result.session);
      setCreatedFollowUp(result.session);
    } catch (createError) {
      setAiError(createError instanceof Error ? createError.message : 'Unable to create follow-up session.');
    } finally {
      setFollowUpBusy(false);
    }
  };

  const toggleFollowUpDrill = (drillId: string) => setFollowUp(current => current && ({
    ...current,
    drillIds: current.drillIds.includes(drillId) ? current.drillIds.filter(id => id !== drillId) : [...current.drillIds, drillId]
  }));
  const toggleRecommendedDrill = (index: number) => setFollowUp(current => current && ({
    ...current,
    recommendedDrillIndexes: current.recommendedDrillIndexes.includes(index)
      ? current.recommendedDrillIndexes.filter(item => item !== index)
      : [...current.recommendedDrillIndexes, index]
  }));
  const followUpMinutes = followUp
    ? followUp.drillIds.reduce((sum, id) => sum + (drills.find(drill => drill.id === id)?.duration || 0), 0)
      + followUp.recommendedDrillIndexes.reduce((sum, index) => sum + (aiEvaluation?.tailoredRecommendedDrills[index]?.durationMinutes || 0), 0)
    : 0;

  const submitAdhocDrill = () => {
    if (!adhocDrill.title.trim() || !adhocDrill.skillSet.trim()) {
      setError('Ad-hoc drills need a title and skill focus.');
      return;
    }
    addSessionDrill({ drill: { ...adhocDrill, title: adhocDrill.title.trim(), skillSet: adhocDrill.skillSet.trim(), instructions: adhocDrill.instructions.trim() } });
  };

  const addIncident = () => {
    if (!incidentNote.trim()) return;
    updateLog({
      incidents: [...log.incidents, { id: newId('inc'), time: new Date().toISOString(), category: incidentCategory, note: incidentNote.trim() }]
    });
    setIncidentNote('');
  };

  const completeSession = async () => {
    const unmarked = sessionPlayers.length - markedCount;
    if (unmarked > 0 && !window.confirm(`${unmarked} player(s) have no attendance recorded. Complete the session anyway?`)) return;
    await persist({ ...log, completedAt: new Date().toISOString() }, true);
  };

  const downloadReport = () => {
    const attendanceLabel = (status?: AttendanceStatus) => status ? status.charAt(0) + status.slice(1).toLowerCase() : 'Not recorded';
    const lines = [
      `SESSION REPORT – ${session.title}`,
      `Date: ${session.sessionDate}   Squad: ${session.squadName}   Lead coach: ${session.coachName || '-'}`,
      `Planned duration: ${session.durationMinutes} min   Actual drill time: ${actualMinutes} min`,
      `Started: ${log.startedAt ? new Date(log.startedAt).toLocaleString() : '-'}   Completed: ${log.completedAt ? new Date(log.completedAt).toLocaleString() : '-'}`,
      '',
      `PREPARATION (${checklistDone}/${CHECKLIST.length})`,
      ...CHECKLIST.map(item => `[${log.checklist[item.id] ? 'x' : ' '}] ${item.label}`),
      '',
      `ATTENDANCE (${attendingPlayers.length}/${sessionPlayers.length}, ${attendanceRate}%)`,
      ...sessionPlayers.map(player => `- ${player.name}: ${attendanceLabel(log.attendance[player.id])}`),
      '',
      'DRILLS',
      ...log.drillLog.map(entry => `- ${entry.title}: planned ${entry.plannedMinutes} min, actual ${entry.actualMinutes} min, ${entry.completed ? 'completed' : 'not completed'}${entry.notes ? ` – ${entry.notes}` : ''}`),
      '',
      'DISRUPTIONS',
      ...(log.incidents.length ? log.incidents.map(item => `- ${new Date(item.time).toLocaleTimeString()} [${item.category}] ${item.note}`) : ['- None']),
      '',
      'PLAYER PROGRESS NOTES',
      ...sessionPlayers.filter(player => playerNotes[player.id]?.trim()).map(player => `- ${player.name}:\n  ${playerNotes[player.id].trim().replace(/\n/g, '\n  ')}`),
      '',
      'EVALUATION',
      `Objectives met: ${log.evaluation.objectivesMet || '-'}   Engagement: ${log.evaluation.engagement || '-'}/5`,
      `What went well: ${log.evaluation.wentWell || '-'}`,
      `Challenges: ${log.evaluation.challenges || '-'}`,
      `Adjustments for next session: ${log.evaluation.nextAdjustments || '-'}`,
      '',
      `Session summary: ${postNotes || '-'}`
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `session-report-${session.sessionDate}-${session.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white';
  const statusLabel = isCompleted ? 'Completed' : isLive ? 'In progress' : 'Preparing';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-1"><ArrowLeft size={14} /> Back to schedule</button>
          <h2 className="text-lg font-bold text-white">{session.title}</h2>
          <p className="text-xs text-slate-400">{session.sessionDate} · {session.squadName} · {session.durationMinutes} min · <span className={isCompleted ? 'text-emerald-300' : isLive ? 'text-amber-300' : 'text-cyan-300'}>{statusLabel}</span></p>
        </div>
        <div className="flex items-center gap-2">
          {log.startedAt && (
            <span className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border ${elapsedMinutes > session.durationMinutes ? 'border-rose-500/50 text-rose-300' : 'border-slate-700 text-slate-200'}`}>
              <Clock size={14} /> {formatElapsed(elapsedMs)} / {session.durationMinutes}:00
            </span>
          )}
          <button onClick={() => persist(log)} disabled={saving} className="px-3 py-1.5 text-xs border border-slate-600 text-slate-200 rounded flex items-center gap-1 disabled:opacity-50"><Save size={14} /> Save</button>
          <button onClick={downloadReport} className="px-3 py-1.5 text-xs border border-cyan-500/40 text-cyan-300 rounded flex items-center gap-1"><Download size={14} /> Report</button>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      {savedMessage && <p role="status" className="text-xs text-emerald-400">{savedMessage}</p>}

      <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Session execution steps">
        {STEPS.map(item => (
          <button
            key={item.id}
            role="tab"
            aria-selected={step === item.id}
            onClick={() => setStep(item.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${step === item.id ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {step === 'PREPARE' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">Pre-session checklist ({checklistDone}/{CHECKLIST.length})</h3>
            {CHECKLIST.map(item => (
              <label key={item.id} className="flex items-start gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={Boolean(log.checklist[item.id])} onChange={event => updateLog({ checklist: { ...log.checklist, [item.id]: event.target.checked } })} className="mt-0.5" />
                {item.label}
              </label>
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white">Session plan</h3>
            <ul className="text-xs text-slate-300 divide-y divide-slate-800 border-y border-slate-800">
              {log.drillLog.map(entry => <li key={entry.id} className="py-2 flex justify-between"><span>{entry.title}</span><span className="text-slate-500">{entry.plannedMinutes} min</span></li>)}
            </ul>
            <p className={`text-xs ${plannedMinutes > session.durationMinutes ? 'text-amber-300' : 'text-slate-400'}`}>
              Planned {plannedMinutes} of {session.durationMinutes} min{plannedMinutes > session.durationMinutes ? ' – plan exceeds the slot, trim a block before starting.' : '.'}
            </p>
            <p className="text-xs text-slate-400">{sessionPlayers.length} player(s) expected.</p>
            {!isLive && !isCompleted && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => persist(log)} disabled={saving} className="px-3 py-2 text-xs border border-slate-600 text-slate-200 rounded-lg disabled:opacity-50">Save preparation</button>
                <button onClick={startSession} disabled={!canStart || saving} className="px-3 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"><Play size={14} /> Start session</button>
                {!canStart && <p className="w-full text-xs text-slate-500">The session can be started on {session.sessionDate}.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'ATTENDANCE' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">{markedCount}/{sessionPlayers.length} marked · {attendingPlayers.length} attending ({attendanceRate}%)</p>
            <button onClick={() => updateLog({ attendance: { ...log.attendance, ...Object.fromEntries(sessionPlayers.filter(player => !log.attendance[player.id]).map(player => [player.id, 'PRESENT' as AttendanceStatus])) } })} className="px-3 py-1.5 text-xs border border-emerald-500/40 text-emerald-300 rounded">Mark unmarked as present</button>
          </div>
          <div className="divide-y divide-slate-800 border-y border-slate-800">
            {sessionPlayers.map(player => (
              <div key={player.id} className="py-2 flex items-center justify-between gap-3">
                <div><p className="text-sm text-white">{player.name}</p><p className="text-[11px] text-slate-500">{player.squad} · {player.currentLevel}</p></div>
                <div className="flex gap-1" role="group" aria-label={`Attendance for ${player.name}`}>
                  {(['PRESENT', 'LATE', 'ABSENT'] as AttendanceStatus[]).map(status => (
                    <button
                      key={status}
                      aria-pressed={log.attendance[player.id] === status}
                      onClick={() => setAttendance(player.id, status)}
                      className={`px-2.5 py-1 text-xs rounded border ${log.attendance[player.id] === status
                        ? status === 'ABSENT' ? 'bg-rose-500/20 border-rose-500 text-rose-200' : status === 'LATE' ? 'bg-amber-500/20 border-amber-500 text-amber-200' : 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                        : 'border-slate-700 text-slate-400'}`}
                    >
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {sessionPlayers.length === 0 && <p className="py-4 text-xs text-slate-500">No players are assigned to this session.</p>}
          </div>
        </div>
      )}

      {step === 'RUN' && (
        <div className="grid xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Drill log</h3>
              <span className={`text-xs ${actualMinutes > session.durationMinutes ? 'text-rose-300' : 'text-slate-400'}`}>{actualMinutes} min recorded / {plannedMinutes} planned</span>
            </div>
            {log.drillLog.map(entry => (
              <div key={entry.id} className={`border rounded-lg p-3 space-y-2 ${entry.completed ? 'border-emerald-500/40' : 'border-slate-800'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label="Drill title" value={entry.title} onChange={event => updateDrill(entry.id, { title: event.target.value })} className="flex-1 min-w-[160px] bg-transparent text-sm font-semibold text-white border-b border-slate-800 focus:outline-none" />
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">Planned <input type="number" min={0} value={entry.plannedMinutes} onChange={event => updateDrill(entry.id, { plannedMinutes: Number(event.target.value) })} className="w-14 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-xs text-white" /></label>
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">Actual <input type="number" min={0} value={entry.actualMinutes} onChange={event => updateDrill(entry.id, { actualMinutes: Number(event.target.value) })} className={`w-14 bg-slate-950 border rounded px-1 py-0.5 text-xs text-white ${entry.actualMinutes > entry.plannedMinutes + 5 ? 'border-amber-500' : 'border-slate-700'}`} /></label>
                  <button onClick={() => updateDrill(entry.id, { completed: !entry.completed })} aria-pressed={entry.completed} className={`px-2 py-1 text-xs rounded border flex items-center gap-1 ${entry.completed ? 'border-emerald-500 text-emerald-300' : 'border-slate-700 text-slate-400'}`}><CheckCircle2 size={12} /> Done</button>
                  <button onClick={() => removeSessionDrill(entry)} disabled={drillBusy || isCompleted} aria-label={`Remove ${entry.title}`} title={entry.drillId ? 'Remove from session plan' : 'Remove block'} className="p-1 text-rose-300 disabled:opacity-40"><Trash2 size={14} /></button>
                </div>
                <textarea value={entry.notes} onChange={event => updateDrill(entry.id, { notes: event.target.value })} placeholder="What happened? Adaptations, standout performers, issues…" rows={2} className={inputClass} />
              </div>
            ))}
            {!isCompleted && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setDrillPanel(drillPanel === 'CATALOGUE' ? 'NONE' : 'CATALOGUE')} aria-expanded={drillPanel === 'CATALOGUE'} className="px-3 py-1.5 text-xs border border-emerald-500/40 text-emerald-300 rounded flex items-center gap-1"><Plus size={14} /> Add from catalogue</button>
                  <button onClick={() => setDrillPanel(drillPanel === 'ADHOC' ? 'NONE' : 'ADHOC')} aria-expanded={drillPanel === 'ADHOC'} className="px-3 py-1.5 text-xs border border-cyan-500/40 text-cyan-300 rounded flex items-center gap-1"><Plus size={14} /> Ad-hoc drill</button>
                  <button onClick={() => updateLog({ drillLog: insertBeforeCoolDown(log.drillLog, [{ id: newId('block'), drillId: null, title: 'New block', plannedMinutes: 10, actualMinutes: 0, completed: false, notes: '' }]) })} className="px-3 py-1.5 text-xs border border-slate-600 text-slate-200 rounded flex items-center gap-1"><Plus size={14} /> Add time block</button>
                  {onRefresh && <button onClick={() => onRefresh()} className="px-3 py-1.5 text-xs border border-slate-600 text-slate-300 rounded flex items-center gap-1"><RefreshCw size={14} /> Refresh plan</button>}
                </div>

                {drillPanel === 'CATALOGUE' && (
                  <div className="border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input value={catalogueSearch} onChange={event => setCatalogueSearch(event.target.value)} placeholder="Search drills or skills" aria-label="Search drill catalogue" className={inputClass} />
                      <select value={catalogueDiscipline} onChange={event => setCatalogueDiscipline(event.target.value as 'ALL' | Drill['discipline'])} aria-label="Filter by discipline" className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
                        <option value="ALL">All disciplines</option>
                        {DISCIPLINES.map(discipline => <option key={discipline} value={discipline}>{discipline.charAt(0) + discipline.slice(1).toLowerCase()}</option>)}
                      </select>
                    </div>
                    <ul className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                      {catalogue.map(drill => (
                        <li key={drill.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-white truncate">{drill.title}</p>
                            <p className="text-[11px] text-slate-500">{drill.discipline} · {drill.skillSet} · {drill.duration} min{drill.source === 'CLUB_CUSTOM' ? ' · Club' : ''}</p>
                          </div>
                          <button onClick={() => addSessionDrill({ drillId: drill.id })} disabled={drillBusy} className="px-2 py-1 text-xs border border-emerald-500/40 text-emerald-300 rounded disabled:opacity-40">Add</button>
                        </li>
                      ))}
                      {catalogue.length === 0 && <li className="py-3 text-xs text-slate-500">No drills match. Create an ad-hoc drill instead.</li>}
                    </ul>
                  </div>
                )}

                {drillPanel === 'ADHOC' && (
                  <div className="border border-slate-800 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] text-slate-400">Ad-hoc drills are added to this session and saved to your club's drill catalogue.</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input value={adhocDrill.title} onChange={event => setAdhocDrill({ ...adhocDrill, title: event.target.value })} placeholder="Drill title" aria-label="Ad-hoc drill title" className={inputClass} />
                      <input value={adhocDrill.skillSet} onChange={event => setAdhocDrill({ ...adhocDrill, skillSet: event.target.value })} placeholder="Skill focus (e.g. Front-foot drive)" aria-label="Ad-hoc drill skill focus" className={inputClass} />
                      <select value={adhocDrill.discipline} onChange={event => setAdhocDrill({ ...adhocDrill, discipline: event.target.value as Drill['discipline'] })} aria-label="Ad-hoc drill discipline" className={inputClass}>
                        {DISCIPLINES.map(discipline => <option key={discipline} value={discipline}>{discipline.charAt(0) + discipline.slice(1).toLowerCase()}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <select value={adhocDrill.contextType} onChange={event => setAdhocDrill({ ...adhocDrill, contextType: event.target.value as Drill['contextType'] })} aria-label="Ad-hoc drill context" className={inputClass}>
                          <option value="GROUP">Group</option>
                          <option value="INDIVIDUAL">Individual</option>
                        </select>
                        <label className="text-[11px] text-slate-400 flex items-center gap-1 whitespace-nowrap">Min <input type="number" min={1} value={adhocDrill.duration} onChange={event => setAdhocDrill({ ...adhocDrill, duration: Number(event.target.value) })} className="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-2 text-xs text-white" /></label>
                      </div>
                    </div>
                    <textarea value={adhocDrill.instructions} onChange={event => setAdhocDrill({ ...adhocDrill, instructions: event.target.value })} placeholder="Setup and instructions" aria-label="Ad-hoc drill instructions" rows={2} className={inputClass} />
                    <button onClick={submitAdhocDrill} disabled={drillBusy} className="px-3 py-1.5 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded disabled:opacity-40">Add to session &amp; catalogue</button>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-slate-800 pt-4 space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" /> Disruptions and incidents</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={incidentCategory} onChange={event => setIncidentCategory(event.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white">
                  {INCIDENT_CATEGORIES.map(category => <option key={category}>{category}</option>)}
                </select>
                <input value={incidentNote} onChange={event => setIncidentNote(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addIncident(); }} placeholder="What happened and what action was taken" className={inputClass} />
                <button onClick={addIncident} className="px-3 py-2 text-xs border border-amber-500/40 text-amber-300 rounded-lg">Log</button>
              </div>
              <ul className="text-xs text-slate-300 space-y-1">
                {log.incidents.map(item => (
                  <li key={item.id} className="flex justify-between gap-2"><span><span className="text-slate-500">{new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> [{item.category}] {item.note}</span><button onClick={() => updateLog({ incidents: log.incidents.filter(entry => entry.id !== item.id) })} aria-label="Remove incident" className="text-rose-300"><Trash2 size={12} /></button></li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="border border-slate-800 rounded-lg p-3 space-y-3 h-fit">
            <h3 className="text-sm font-bold text-white">Coaching guidance</h3>
            <div className="flex flex-wrap gap-1">
              {Object.keys(GUIDANCE).map(key => (
                <button key={key} onClick={() => setGuidanceTab(key)} className={`px-2 py-1 text-[11px] rounded ${guidanceTab === key ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-white'}`}>{key}</button>
              ))}
            </div>
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-300">
              {GUIDANCE[guidanceTab].map(tip => <li key={tip}>{tip}</li>)}
            </ul>
          </aside>
        </div>
      )}

      {step === 'NOTES' && (
        <div className="grid xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Record progress for each attending player. Notes are visible in the player's session history.</p>
            {(attendingPlayers.length ? attendingPlayers : sessionPlayers).map(player => (
              <div key={player.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor={`note-${player.id}`} className="text-sm text-white">{player.name} <span className="text-[11px] text-slate-500">{player.discipline} · {player.currentLevel}</span></label>
                  {!playerNotes[player.id] && <button onClick={() => setPlayerNotes(current => ({ ...current, [player.id]: NOTE_TEMPLATE }))} className="text-[11px] text-cyan-300">Use template</button>}
                </div>
                <textarea id={`note-${player.id}`} value={playerNotes[player.id] || ''} onChange={event => setPlayerNotes(current => ({ ...current, [player.id]: event.target.value }))} rows={3} placeholder="Strengths, work-ons and next focus" className={inputClass} />
              </div>
            ))}
            {sessionPlayers.length === 0 && <p className="text-xs text-slate-500">No players are assigned to this session.</p>}
          </div>
          <aside className="border border-slate-800 rounded-lg p-3 space-y-3 h-fit text-xs">
            <h3 className="text-sm font-bold text-white">Writing useful progress notes</h3>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-300">
              <li>Be specific: "Front-foot drive – head over the ball in 7/10 reps" rather than "batted well".</li>
              <li>Record one strength, one work-on and one next focus.</li>
              <li>Link the work-on to a drill for the next session.</li>
              <li>Keep notes factual and suitable for the player and parents to read.</li>
            </ul>
            <p className="text-slate-500">Example:</p>
            <pre className="whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded p-2 text-slate-300">{'Strengths: Consistent seam position, 8/12 on target.\nWork-ons: Front arm pulls away early at release.\nNext focus: Target-bowling with front-arm cue.'}</pre>
          </aside>
        </div>
      )}

      {step === 'EVALUATE' && (
        <div className="space-y-6">
        <div className="grid xl:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-slate-400 space-y-1">Objectives met
                <select value={log.evaluation.objectivesMet} onChange={event => updateLog({ evaluation: { ...log.evaluation, objectivesMet: event.target.value as SessionExecutionLog['evaluation']['objectivesMet'] } })} className={inputClass}>
                  <option value="">Select…</option><option value="YES">Yes</option><option value="PARTIAL">Partially</option><option value="NO">No</option>
                </select>
              </label>
              <div className="text-xs text-slate-400 space-y-1">Player engagement
                <div className="flex gap-1" role="group" aria-label="Player engagement rating">
                  {[1, 2, 3, 4, 5].map(value => (
                    <button key={value} aria-pressed={log.evaluation.engagement === value} onClick={() => updateLog({ evaluation: { ...log.evaluation, engagement: value } })} className={`w-8 py-1.5 rounded border text-xs ${log.evaluation.engagement === value ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>{value}</button>
                  ))}
                </div>
              </div>
            </div>
            <label className="block text-xs text-slate-400 space-y-1">What went well
              <textarea value={log.evaluation.wentWell} onChange={event => updateLog({ evaluation: { ...log.evaluation, wentWell: event.target.value } })} rows={3} className={inputClass} />
            </label>
            <label className="block text-xs text-slate-400 space-y-1">Challenges
              <textarea value={log.evaluation.challenges} onChange={event => updateLog({ evaluation: { ...log.evaluation, challenges: event.target.value } })} rows={3} className={inputClass} />
            </label>
            <label className="block text-xs text-slate-400 space-y-1">Adjustments for the next session
              <textarea value={log.evaluation.nextAdjustments} onChange={event => updateLog({ evaluation: { ...log.evaluation, nextAdjustments: event.target.value } })} rows={3} className={inputClass} />
            </label>
            <label className="block text-xs text-slate-400 space-y-1">Session summary (shared with the club)
              <textarea value={postNotes} onChange={event => setPostNotes(event.target.value)} rows={3} placeholder="Overall outcome, key messages, and follow-ups" className={inputClass} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => persist(log)} disabled={saving} className="px-3 py-2 text-xs border border-slate-600 text-slate-200 rounded-lg disabled:opacity-50">Save evaluation</button>
              {!isCompleted && (
                <button onClick={completeSession} disabled={saving || !log.startedAt} className="px-3 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Complete session</button>
              )}
              {!log.startedAt && !isCompleted && <p className="w-full text-xs text-slate-500">Start the session from the Prepare step before completing it.</p>}
            </div>
          </div>
          <aside className="space-y-4 text-xs">
            <div className="border border-slate-800 rounded-lg p-3 space-y-2">
              <h3 className="text-sm font-bold text-white">Session data</h3>
              <p className="text-slate-300">Attendance: {attendingPlayers.length}/{sessionPlayers.length} ({attendanceRate}%)</p>
              <p className="text-slate-300">Drills completed: {log.drillLog.filter(entry => entry.completed).length}/{log.drillLog.length}</p>
              <p className="text-slate-300">Time: {actualMinutes} min recorded vs {session.durationMinutes} min slot</p>
              <p className="text-slate-300">Disruptions: {log.incidents.length}</p>
            </div>
            <div className="border border-slate-800 rounded-lg p-3 space-y-2">
              <h3 className="text-sm font-bold text-white">Suggested adjustments</h3>
              {suggestions.length ? (
                <>
                  <ul className="list-disc pl-4 space-y-1 text-slate-300">{suggestions.map(item => <li key={item}>{item}</li>)}</ul>
                  <button onClick={() => updateLog({ evaluation: { ...log.evaluation, nextAdjustments: [log.evaluation.nextAdjustments, ...suggestions.map(item => `- ${item}`)].filter(Boolean).join('\n') } })} className="text-cyan-300">Add to adjustments</button>
                </>
              ) : <p className="text-slate-500">No issues detected from the session data.</p>}
            </div>
            <div className="border border-slate-800 rounded-lg p-3 space-y-2">
              <h3 className="text-sm font-bold text-white">Common challenges</h3>
              {COMMON_CHALLENGES.map(item => <p key={item.challenge} className="text-slate-300"><span className="text-white font-semibold">{item.challenge}:</span> {item.response}</p>)}
            </div>
          </aside>
        </div>

        <section aria-labelledby="ai-analysis-heading" className="border border-purple-500/30 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="ai-analysis-heading" className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-300" /> AI session analysis</h3>
              <p className="text-xs text-slate-400 mt-1">Gemini reviews your player notes, attendance, drill timings, disruptions and evaluation, then suggests improvements and a follow-up session.</p>
            </div>
            <button onClick={runAiAnalysis} disabled={aiBusy || saving} className="px-3 py-2 text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white rounded-lg disabled:opacity-50">
              {aiBusy ? 'Analysing…' : aiEvaluation ? 'Re-run AI analysis' : 'Run AI analysis'}
            </button>
          </div>
          {aiError && <p role="alert" className="text-xs text-red-300">{aiError}</p>}

          {aiEvaluation && (
            <div className="grid lg:grid-cols-2 gap-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-purple-300 uppercase">Diagnosis</span>
                  <span className="bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded font-semibold">{READINESS_LABEL[aiEvaluation.progressionReadiness] || aiEvaluation.progressionReadiness}</span>
                </div>
                <p className="text-slate-300">{aiEvaluation.squadSummary}</p>
                {aiEvaluation.identifiedGaps.length > 0 && (
                  <div>
                    <p className="font-semibold text-white mb-1">Gaps</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300">{aiEvaluation.identifiedGaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
                  </div>
                )}
                {!!aiEvaluation.playerFeedback?.length && (
                  <div>
                    <p className="font-semibold text-white mb-1">Player focus</p>
                    <ul className="space-y-0.5 text-slate-300">{aiEvaluation.playerFeedback.map(item => <li key={item.playerName}><span className="text-white">{item.playerName}:</span> {item.focus}</li>)}</ul>
                  </div>
                )}
                {!!aiEvaluation.sessionImprovements?.length && (
                  <div>
                    <p className="font-semibold text-white mb-1">Improve the next session</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-300">{aiEvaluation.sessionImprovements.map(item => <li key={item}>{item}</li>)}</ul>
                    <button onClick={() => updateLog({ evaluation: { ...log.evaluation, nextAdjustments: [log.evaluation.nextAdjustments, ...(aiEvaluation.sessionImprovements || []).map(item => `- ${item}`)].filter(Boolean).join('\n') } })} className="mt-1 text-cyan-300">Add to adjustments</button>
                  </div>
                )}
                <p className="text-slate-400 border-t border-slate-800 pt-2">💬 {aiEvaluation.aiCommendation}</p>
                {aiEvaluation.generatedAt && <p className="text-[10px] text-slate-500">Generated {new Date(aiEvaluation.generatedAt).toLocaleString()}</p>}
              </div>

              <div className="border border-slate-800 rounded-lg p-3 space-y-3">
                <p className="font-bold text-white">Follow-up session</p>
                {createdFollowUp ? (
                  <div className="space-y-1 text-emerald-200">
                    <p className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> "{createdFollowUp.title}" created for {createdFollowUp.sessionDate} with {createdFollowUp.drillCount} drill(s).</p>
                    <p className="text-slate-400">It is saved as a draft for the club to review and publish in the session planner.</p>
                  </div>
                ) : followUp ? (
                  <>
                    {aiEvaluation.followUpPlan?.objective && <p className="text-slate-300">{aiEvaluation.followUpPlan.objective}</p>}
                    <label className="block text-slate-400 space-y-1">Title
                      <input value={followUp.title} onChange={event => setFollowUp({ ...followUp, title: event.target.value })} className={inputClass} />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-slate-400 space-y-1">Date
                        <input type="date" min={localToday()} value={followUp.sessionDate} onChange={event => setFollowUp({ ...followUp, sessionDate: event.target.value })} className={inputClass} />
                      </label>
                      <label className="block text-slate-400 space-y-1">Minutes
                        <input type="number" min={15} max={240} value={followUp.durationMinutes} onChange={event => setFollowUp({ ...followUp, durationMinutes: Number(event.target.value) || 0 })} className={inputClass} />
                      </label>
                    </div>
                    <fieldset className="space-y-1">
                      <legend className="text-slate-400 mb-1">Catalogue drills</legend>
                      {(aiEvaluation.followUpPlan?.catalogueDrillIds || []).map(id => {
                        const drill = drills.find(item => item.id === id);
                        return drill ? (
                          <label key={id} className="flex items-center gap-2 text-slate-300">
                            <input type="checkbox" checked={followUp.drillIds.includes(id)} onChange={() => toggleFollowUpDrill(id)} />
                            {drill.title} <span className="text-slate-500">· {drill.discipline} · {drill.duration} min</span>
                          </label>
                        ) : null;
                      })}
                      {!aiEvaluation.followUpPlan?.catalogueDrillIds.length && <p className="text-slate-500">No catalogue drills suggested.</p>}
                    </fieldset>
                    {aiEvaluation.tailoredRecommendedDrills.length > 0 && (
                      <fieldset className="space-y-1">
                        <legend className="text-slate-400 mb-1">New AI-recommended drills (saved to the club catalogue)</legend>
                        {aiEvaluation.tailoredRecommendedDrills.map((drill, index) => (
                          <label key={`${drill.title}-${index}`} className="flex items-start gap-2 text-slate-300">
                            <input type="checkbox" className="mt-0.5" checked={followUp.recommendedDrillIndexes.includes(index)} onChange={() => toggleRecommendedDrill(index)} />
                            <span>{drill.title} <span className="text-slate-500">· {drill.discipline} · {drill.durationMinutes} min</span><br /><span className="text-slate-500">{drill.reason}</span></span>
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <p className={followUpMinutes > followUp.durationMinutes ? 'text-amber-300' : 'text-slate-500'}>Selected drills: {followUpMinutes} min of {followUp.durationMinutes} min</p>
                    <button
                      onClick={createFollowUpSession}
                      disabled={followUpBusy || !followUp.title.trim() || !followUp.sessionDate || (!followUp.drillIds.length && !followUp.recommendedDrillIndexes.length)}
                      className="px-3 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg disabled:opacity-40"
                    >
                      {followUpBusy ? 'Creating…' : 'Create follow-up session'}
                    </button>
                  </>
                ) : <p className="text-slate-500">Re-run the AI analysis to get a follow-up session plan.</p>}
              </div>
            </div>
          )}
        </section>
        </div>
      )}
    </div>
  );
};
