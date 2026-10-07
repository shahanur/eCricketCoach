import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, CalendarDays, Check, Download, Mail, Play, Plus, Save, Sparkles, X } from 'lucide-react';
import { api } from '../../services/api';
import { AssessmentMetric, AuthUser, ClubMember, PlayerAssessment, TrainingSession } from '../../types';
import { downloadPdfReport, PdfBlock } from '../../utils/pdfReport';

const METRICS: Record<string, string[]> = {
  BATTING: ['Stance & balance', 'Footwork', 'Shot selection', 'Timing & contact', 'Running between wickets'],
  BOWLING: ['Run-up & rhythm', 'Action & alignment', 'Release point', 'Accuracy', 'Follow-through'],
  KEEPING: ['Stance & readiness', 'Footwork', 'Glove technique', 'Catching & gathering', 'Communication'],
  FIELDING: ['Ready position', 'Movement & agility', 'Ground fielding', 'Throwing accuracy', 'Communication']
};

const today = new Date().toISOString().slice(0, 10);

interface PlayerAssessmentsProps {
  currentUser: AuthUser;
  members: ClubMember[];
  sessions: TrainingSession[];
  initialAssessmentId?: string;
  onViewTrainingSession?: (sessionId: string, playerId: string) => void;
  onAssessmentsChanged?: (assessments: PlayerAssessment[]) => void;
}

function meanScore(metrics: AssessmentMetric[]) {
  const rated = metrics.filter(metric => metric.score !== null);
  return rated.length ? rated.reduce((total, metric) => total + metric.score!, 0) / rated.length : null;
}

function saveBlob(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportCalendarEvent(assessment: PlayerAssessment) {
  const date = assessment.scheduledDate.replace(/-/g, '');
  const title = assessment.title.replace(/[\\,;]/g, '\\$&').replace(/\n/g, '\\n');
  const description = `Player: ${assessment.playerName}\nCoach: ${assessment.coachName}\nDiscipline: ${assessment.discipline}`
    .replace(/[\\,;]/g, '\\$&').replace(/\r?\n/g, '\\n');
  const endDate = assessment.scheduledTime
    ? new Date(Date.parse(`${assessment.scheduledDate}T${assessment.scheduledTime}:00Z`) + 60 * 60 * 1000)
        .toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').slice(0, 15)
    : new Date(Date.parse(`${assessment.scheduledDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//eCricketCoach//Player Assessment//EN',
    'BEGIN:VEVENT',
    `UID:${assessment.id}@ecricketcoach`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    assessment.scheduledTime
      ? `DTSTART:${date}T${assessment.scheduledTime.replace(':', '')}00`
      : `DTSTART;VALUE=DATE:${date}`,
    assessment.scheduledTime
      ? `DTEND:${endDate}`
      : `DTEND;VALUE=DATE:${endDate}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  saveBlob(`assessment-${assessment.scheduledDate}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
}

export const PlayerAssessments: React.FC<PlayerAssessmentsProps> = ({ currentUser, members, sessions, initialAssessmentId, onViewTrainingSession, onAssessmentsChanged }) => {
  const players = useMemo(
    () => members.filter(member => member.role === 'PLAYER' && member.invitationStatus === 'ACTIVE'),
    [members]
  );
  const coaches = useMemo(
    () => members.filter(member => member.role === 'COACH' && member.invitationStatus === 'ACTIVE'),
    [members]
  );
  const [assessments, setAssessments] = useState<PlayerAssessment[]>([]);
  const [hasLoadedAssessments, setHasLoadedAssessments] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [title, setTitle] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [coachId, setCoachId] = useState(currentUser.roles.includes('COACH') ? currentUser.id : '');
  const [discipline, setDiscipline] = useState('BATTING');
  const [scheduledDate, setScheduledDate] = useState(today);
  const [scheduledTime, setScheduledTime] = useState('');
  const [trainingSessionId, setTrainingSessionId] = useState('');
  const [videoAnalysisId, setVideoAnalysisId] = useState('');
  const [videoOptions, setVideoOptions] = useState<Array<{ id: string; discipline: string; overallScore: number; createdAt: string }>>([]);
  const [metrics, setMetrics] = useState<AssessmentMetric[]>([]);
  const [strengths, setStrengths] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [coachFeedback, setCoachFeedback] = useState('');
  const [playerFeedback, setPlayerFeedback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkedVideoAnalysis, setLinkedVideoAnalysis] = useState<Awaited<ReturnType<typeof api.getVideoAnalysisById>>['entry']>(null);
  const [isLoadingLinkedVideo, setIsLoadingLinkedVideo] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [completionFilter, setCompletionFilter] = useState<'ALL' | 'COMPLETED' | 'NOT_COMPLETED'>('ALL');
  const [playerSort, setPlayerSort] = useState<'name' | 'level' | 'completion' | 'lastAssessed' | 'recommendation'>('name');
  const [playerSortDirection, setPlayerSortDirection] = useState<'asc' | 'desc'>('asc');
  const appliedInitialAssessmentId = useRef('');

  const loadAssessments = async () => {
    setError('');
    try {
      const rows = await api.getPlayerAssessments();
      setAssessments(rows);
      setHasLoadedAssessments(true);
      setSelectedId(current => rows.some(row => row.id === current) ? current : '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load assessments.');
    }
  };

  const scheduleForPlayer = (player: ClubMember) => {
    const playerDiscipline = player.discipline.split(',').map(value => value.trim().toUpperCase())
      .find(value => Object.prototype.hasOwnProperty.call(METRICS, value)) || 'BATTING';
    setPlayerId(player.id);
    setCoachId(currentUser.roles.includes('COACH') ? currentUser.id : '');
    setDiscipline(playerDiscipline);
    setTitle(`${player.name} ${playerDiscipline.toLowerCase()} assessment`);
    setScheduledDate(today);
    setScheduledTime('');
    setTrainingSessionId('');
    setVideoAnalysisId('');
    setShowSchedule(true);
    setSelectedId('');
    setError('');
    setNotice('');
  };

  useEffect(() => {
    loadAssessments();
  }, [currentUser.id, currentUser.tenantId]);

  useEffect(() => {
    if (hasLoadedAssessments) onAssessmentsChanged?.(assessments);
  }, [assessments, hasLoadedAssessments, onAssessmentsChanged]);

  useEffect(() => {
    if (
      initialAssessmentId &&
      initialAssessmentId !== appliedInitialAssessmentId.current &&
      assessments.some(assessment => assessment.id === initialAssessmentId)
    ) {
      appliedInitialAssessmentId.current = initialAssessmentId;
      setSelectedId(initialAssessmentId);
    }
  }, [initialAssessmentId, assessments]);

  useEffect(() => {
    if (!playerId) {
      setVideoOptions([]);
      setVideoAnalysisId('');
      return;
    }
    let cancelled = false;
    api.getVideoAnalysisHistory(playerId)
      .then(({ history }) => {
        if (!cancelled) {
          setVideoOptions(history.map(item => ({
            id: item.id,
            discipline: item.discipline,
            overallScore: item.overallScore,
            createdAt: item.createdAt
          })));
        }
      })
      .catch(loadError => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load video analyses.');
      });
    return () => { cancelled = true; };
  }, [playerId]);

  const selectedAssessment = assessments.find(assessment => assessment.id === selectedId) || null;
  const linkedSessions = sessions.filter(session => session.assignedPlayerIds?.includes(playerId));
  const matchingVideos = videoOptions.filter(video => video.discipline === discipline);

  useEffect(() => {
    if (!selectedAssessment) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId('');
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedAssessment?.id]);

  const playerProgress = useMemo(() => {
    const rows = players.map(player => {
      const history = assessments
        .filter(assessment => assessment.playerId === player.id)
        .sort((a, b) => (b.completedAt || b.scheduledDate).localeCompare(a.completedAt || a.scheduledDate));
      const latestCompleted = history.find(assessment => assessment.status === 'COMPLETED') || null;
      return {
        player,
        hasCompleted: Boolean(latestCompleted),
        latest: history[0] || null,
        latestCompleted,
        recommendation: latestCompleted?.aiInsights?.recommendations[0] || latestCompleted?.focusAreas || ''
      };
    }).filter(row => {
      const matchesName = row.player.name.toLowerCase().includes(playerSearch.trim().toLowerCase());
      const matchesLevel = !levelFilter || row.player.currentLevel === levelFilter;
      const matchesCompletion = completionFilter === 'ALL' ||
        (completionFilter === 'COMPLETED' ? row.hasCompleted : !row.hasCompleted);
      return matchesName && matchesLevel && matchesCompletion;
    });

    return rows.sort((a, b) => {
      const value = playerSort === 'name'
        ? a.player.name.localeCompare(b.player.name)
        : playerSort === 'level'
          ? a.player.currentLevel.localeCompare(b.player.currentLevel)
          : playerSort === 'completion'
            ? Number(a.hasCompleted) - Number(b.hasCompleted)
            : playerSort === 'lastAssessed'
              ? (a.latestCompleted?.completedAt?.slice(0, 10) || '').localeCompare(b.latestCompleted?.completedAt?.slice(0, 10) || '')
              : a.recommendation.localeCompare(b.recommendation);
      return value === 0 ? a.player.name.localeCompare(b.player.name) : playerSortDirection === 'asc' ? value : -value;
    });
  }, [players, assessments, playerSearch, levelFilter, completionFilter, playerSort, playerSortDirection]);

  const sortPlayersBy = (column: typeof playerSort) => {
    if (playerSort === column) {
      setPlayerSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    } else {
      setPlayerSort(column);
      setPlayerSortDirection('asc');
    }
  };

  useEffect(() => {
    if (!selectedAssessment) {
      setMetrics([]);
      setStrengths('');
      setFocusAreas('');
      setCoachFeedback('');
      setPlayerFeedback('');
      return;
    }
    setMetrics(selectedAssessment.metrics || []);
    setStrengths(selectedAssessment.strengths || '');
    setFocusAreas(selectedAssessment.focusAreas || '');
    setCoachFeedback(selectedAssessment.coachFeedback || '');
    setPlayerFeedback(selectedAssessment.playerFeedback || '');
  }, [selectedId]);

  useEffect(() => {
    const videoAnalysisId = selectedAssessment?.videoAnalysisId;
    if (!videoAnalysisId) {
      setLinkedVideoAnalysis(null);
      setIsLoadingLinkedVideo(false);
      return;
    }
    let cancelled = false;
    setLinkedVideoAnalysis(null);
    setIsLoadingLinkedVideo(true);
    api.getVideoAnalysisById(videoAnalysisId)
      .then(({ entry }) => {
        if (!cancelled) setLinkedVideoAnalysis(entry);
      })
      .catch(loadError => {
        if (!cancelled) {
          setLinkedVideoAnalysis(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load linked video analysis.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLinkedVideo(false);
      });
    return () => { cancelled = true; };
  }, [selectedAssessment?.videoAnalysisId]);

  const updateAssessment = (updated: PlayerAssessment) => {
    setAssessments(current => current.map(item => item.id === updated.id ? updated : item));
    setSelectedId(updated.id);
  };

  const scheduleAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      const assessment = await api.schedulePlayerAssessment({
        title: title.trim(),
        playerId,
        coachId: currentUser.roles.includes('COACH') ? currentUser.id : coachId,
        discipline,
        scheduledDate,
        scheduledTime: scheduledTime || undefined,
        trainingSessionId: trainingSessionId || undefined,
        videoAnalysisId: videoAnalysisId || undefined
      });
      setAssessments(current => [assessment, ...current]);
      setSelectedId(assessment.id);
      setShowSchedule(false);
      setTitle('');
      setTrainingSessionId('');
      setVideoAnalysisId('');
      setNotice('Assessment scheduled.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to schedule assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  const startAssessment = async (assessment: PlayerAssessment) => {
    setError('');
    setIsSaving(true);
    try {
      const started = await api.updatePlayerAssessment(assessment.id, { status: 'IN_PROGRESS' });
      updateAssessment(started);
      setNotice('Assessment started. Record each metric, then save or complete the report.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to start assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveAssessment = async (complete = false) => {
    if (!selectedAssessment) return;
    setError('');
    setNotice('');
    if (complete && metrics.some(metric => metric.score === null)) {
      setError('Rate all five metrics before completing the assessment.');
      return;
    }
    if (complete && !coachFeedback.trim()) {
      setError('Add feedback for the player before completing the assessment.');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await api.updatePlayerAssessment(selectedAssessment.id, {
        ...(complete ? { status: 'COMPLETED' as const } : {}),
        metrics,
        strengths,
        focusAreas,
        coachFeedback,
        playerFeedback
      });
      updateAssessment(updated);
      setNotice(complete ? 'Assessment report completed and saved.' : 'Assessment progress saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateInsights = async () => {
    if (!selectedAssessment) return;
    setError('');
    setIsGenerating(true);
    try {
      const updated = await api.generatePlayerAssessmentInsights(selectedAssessment.id);
      updateAssessment(updated);
      setNotice('AI insights generated from the recorded scores and observations.');
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : 'Unable to generate assessment insights.');
    } finally {
      setIsGenerating(false);
    }
  };

  const scheduleFollowUp = (assessment: PlayerAssessment) => {
    const anchorDate = assessment.completedAt?.slice(0, 10) || assessment.scheduledDate;
    const followUpDate = new Date(Date.parse(`${anchorDate}T00:00:00Z`) + 28 * 86400000).toISOString().slice(0, 10);
    setPlayerId(assessment.playerId);
    setCoachId(assessment.coachId);
    setDiscipline(assessment.discipline);
    setScheduledDate(followUpDate);
    setScheduledTime('');
    setTitle(`${assessment.discipline.toLowerCase()} progress review`);
    setTrainingSessionId('');
    setVideoAnalysisId('');
    setShowSchedule(true);
    setError('');
    setNotice('Follow-up draft prepared four weeks after this assessment. Confirm or adjust its schedule.');
  };

  const downloadCsv = (assessment?: PlayerAssessment | PlayerAssessment[]) => {
    const exportRows = assessment
      ? Array.isArray(assessment) ? assessment : [assessment]
      : assessments;
    const rows = [
      ['Player', 'Assessment', 'Discipline', 'Date', 'Coach', 'Status', 'Metric scores', 'Strengths', 'Focus areas', 'Coach feedback', 'Player feedback', 'AI summary'],
      ...exportRows.map(item => [
        item.playerName,
        item.title,
        item.discipline,
        item.scheduledDate,
        item.coachName,
        item.status,
        item.metrics.map(metric => `${metric.name}: ${metric.score ?? 'Not rated'}`).join('; '),
        item.strengths,
        item.focusAreas,
        item.coachFeedback,
        item.playerFeedback,
        item.aiInsights?.summary || ''
      ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const filename = !assessment
      ? `player-assessments-${today}.csv`
      : Array.isArray(assessment)
        ? `player-assessments-${assessment[0]?.playerId || 'history'}.csv`
        : `assessment-${assessment.id}.csv`;
    saveBlob(filename, csv, 'text/csv;charset=utf-8');
  };

  const downloadPdf = (assessment?: PlayerAssessment | PlayerAssessment[]) => {
    const exportRows = assessment
      ? Array.isArray(assessment) ? assessment : [assessment]
      : assessments;
    if (!exportRows.length) return;
    const single = exportRows.length === 1 ? exportRows[0] : null;
    const blocks: PdfBlock[] = [];
    exportRows.forEach(item => {
      const average = meanScore(item.metrics);
      blocks.push(
        { type: 'heading', text: `${item.playerName} - ${item.title}` },
        {
          type: 'facts',
          items: [
            ['Discipline', item.discipline],
            ['Date', item.scheduledDate],
            ['Coach', item.coachName],
            ['Status', item.status.replace(/_/g, ' ')],
            ['Average rating', average !== null ? `${average.toFixed(1)} / 5` : 'Not rated']
          ]
        },
        { type: 'table', head: ['Metric', 'Rating (1-5)', 'Note'], rows: item.metrics.map(metric => [metric.name, metric.score ?? 'Not rated', metric.note || '']) },
        { type: 'text', label: 'Strengths', text: item.strengths },
        { type: 'text', label: 'Focus areas', text: item.focusAreas },
        { type: 'text', label: 'Coach feedback', text: item.coachFeedback },
        { type: 'text', label: "Player's own thoughts", text: item.playerFeedback }
      );
      if (item.aiInsights) {
        blocks.push({ type: 'text', label: 'Development insights', text: item.aiInsights.summary }, { type: 'bullets', items: item.aiInsights.recommendations });
      }
    });
    downloadPdfReport({
      title: single ? 'Player Assessment Report' : 'Player Assessments Report',
      subtitle: single ? `${single.playerName} - ${single.title}` : `${exportRows.length} assessments`,
      filename: single ? `assessment-${single.id}.pdf` : `player-assessments-${today}.pdf`,
      blocks
    });
  };

  const mailFeedback = (assessment: PlayerAssessment) => {
    const player = members.find(member => member.id === assessment.playerId);
    const body = [
      `Assessment: ${assessment.title}`,
      `Discipline: ${assessment.discipline}`,
      `Date: ${assessment.scheduledDate}`,
      '',
      ...assessment.metrics.map(metric => `${metric.name}: ${metric.score}/5${metric.note ? ` — ${metric.note}` : ''}`),
      '',
      `Strengths: ${assessment.strengths || '—'}`,
      `Focus areas: ${assessment.focusAreas || '—'}`,
      `Coach feedback: ${assessment.coachFeedback}`,
      `Player's thoughts: ${assessment.playerFeedback || '—'}`,
      assessment.aiInsights ? `\nDevelopment insights: ${assessment.aiInsights.summary}\n${assessment.aiInsights.recommendations.map(item => `- ${item}`).join('\n')}` : ''
    ].join('\n');
    window.location.href = `mailto:${encodeURIComponent(player?.email || '')}?subject=${encodeURIComponent(`Player assessment: ${assessment.title}`)}&body=${encodeURIComponent(body)}`;
  };

  const completedForPlayer = selectedAssessment
    ? assessments.filter(item => item.playerId === selectedAssessment.playerId && item.discipline === selectedAssessment.discipline && item.status === 'COMPLETED')
      .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''))
    : [];
  const selectedIndex = selectedAssessment ? completedForPlayer.findIndex(item => item.id === selectedAssessment.id) : -1;
  const currentAverage = selectedAssessment ? meanScore(selectedAssessment.metrics) : null;
  const previousAverage = selectedIndex > 0 ? meanScore(completedForPlayer[selectedIndex - 1].metrics) : null;
  const trendAssessments = completedForPlayer.slice(-6);

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-400">Player development</p>
          <h2 className="text-xl font-bold text-white">Assessments & progress reports</h2>
          <p className="mt-1 text-xs text-slate-400">Schedule an individual assessment, record discipline-specific ratings, and track progress over time.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCsv()} disabled={!assessments.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => downloadPdf()} disabled={!assessments.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">
            <Download className="h-4 w-4" /> Export PDF
          </button>
          <button onClick={() => { setShowSchedule(value => !value); setError(''); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">
            <Plus className="h-4 w-4" /> Schedule assessment
          </button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}

      {showSchedule && (
        <form onSubmit={scheduleAssessment} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-300">Assessment title
            <input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Batting technique review" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Player
            <select required value={playerId} onChange={event => {
              const id = event.target.value;
              setPlayerId(id);
              const chosen = players.find(player => player.id === id);
              if (chosen && Object.prototype.hasOwnProperty.call(METRICS, chosen.discipline)) setDiscipline(chosen.discipline);
              setTrainingSessionId('');
            }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="">Select player</option>
              {players.map(player => <option key={player.id} value={player.id}>{player.name} · {player.squad || 'Unassigned'}</option>)}
            </select>
          </label>
          {!currentUser.roles.includes('COACH') && (
            <label className="text-xs text-slate-300">Assigned coach
              <select required value={coachId} onChange={event => setCoachId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                <option value="">Select coach</option>
                {coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-slate-300">Discipline
            <select value={discipline} onChange={event => { setDiscipline(event.target.value); setVideoAnalysisId(''); }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
              {Object.keys(METRICS).map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-300">Date
            <input required type="date" value={scheduledDate} onChange={event => setScheduledDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Time (optional)
            <input type="time" value={scheduledTime} onChange={event => setScheduledTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-slate-300">Related training session (optional)
            <select value={trainingSessionId} onChange={event => setTrainingSessionId(event.target.value)} disabled={!playerId} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-50">
              <option value="">No linked session</option>
              {linkedSessions.map(session => <option key={session.id} value={session.id}>{session.title} · {session.sessionDate}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-300 sm:col-span-2 lg:col-span-3">Existing video analysis (optional)
            <select value={videoAnalysisId} onChange={event => setVideoAnalysisId(event.target.value)} disabled={!playerId || !matchingVideos.length} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-50">
              <option value="">No linked video analysis</option>
              {matchingVideos.map(video => <option key={video.id} value={video.id}>{video.discipline} · {video.overallScore}/100 · {new Date(video.createdAt).toLocaleDateString()}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="button" onClick={() => setShowSchedule(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Cancel</button>
            <button type="submit" disabled={isSaving || !players.length || (!currentUser.roles.includes('COACH') && !coaches.length)} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">
              {isSaving ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Player progress</h3>
            <p className="text-[11px] text-slate-500">Current level, latest completed assessment, and the next development focus.</p>
          </div>
          <span className="text-xs text-slate-500">{players.length} active players</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input aria-label="Filter players by name" value={playerSearch} onChange={event => setPlayerSearch(event.target.value)} placeholder="Search player name" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
          <select aria-label="Filter players by current level" value={levelFilter} onChange={event => setLevelFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
            <option value="">All current levels</option>
            {[...new Set(players.map(player => player.currentLevel))].sort().map(level => <option key={level} value={level}>{level}</option>)}
          </select>
          <select aria-label="Filter by assessment completion" value={completionFilter} onChange={event => setCompletionFilter(event.target.value as typeof completionFilter)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
            <option value="ALL">All assessment statuses</option>
            <option value="COMPLETED">Has completed assessment</option>
            <option value="NOT_COMPLETED">No completed assessment</option>
          </select>
        </div>
        {players.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[1040px] text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900 text-[10px] uppercase text-slate-500">
                <tr>
                  {([
                    ['name', 'Player'],
                    ['level', 'Current level'],
                    ['completion', 'Assessment status'],
                    ['lastAssessed', 'Last assessment'],
                    ['recommendation', 'Recommendation']
                  ] as Array<[typeof playerSort, string]>).map(([column, label]) => (
                    <th key={column} scope="col" aria-sort={playerSort === column ? (playerSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-3">
                      <button type="button" onClick={() => sortPlayersBy(column)} className="inline-flex items-center gap-1.5 font-semibold hover:text-white">
                        {label}<ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {playerProgress.map(({ player, hasCompleted, latest, latestCompleted, recommendation }) => (
                  <tr
                    key={player.id}
                    onClick={() => {
                      const report = latestCompleted || latest;
                      if (report) setSelectedId(report.id);
                    }}
                    onKeyDown={event => {
                      if ((event.key === 'Enter' || event.key === ' ') && (latestCompleted || latest)) {
                        event.preventDefault();
                        setSelectedId((latestCompleted || latest)!.id);
                      }
                    }}
                    tabIndex={latest ? 0 : undefined}
                    aria-label={latest ? `View ${player.name}'s latest assessment` : undefined}
                    className={`border-b border-slate-800/70 last:border-0 ${latest ? 'cursor-pointer hover:bg-slate-800/50 focus:bg-slate-800/50 focus:outline-none' : ''}`}
                  >
                    <td className="px-3 py-3 font-semibold text-white">{player.name}</td>
                    <td className="px-3 py-3 text-slate-300">{player.currentLevel}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${hasCompleted ? 'bg-emerald-500/15 text-emerald-300' : latest ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                        {hasCompleted ? 'Completed' : latest ? latest.status.replace('_', ' ') : 'Not assessed'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-400">{latestCompleted?.completedAt?.slice(0, 10) || latestCompleted?.scheduledDate || '—'}</td>
                    <td className="max-w-xs px-3 py-3 text-slate-300">{recommendation || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <button type="button" onClick={event => { event.stopPropagation(); scheduleForPlayer(player); }} className="font-semibold text-sky-300 hover:text-sky-200">Schedule</button>
                      <button type="button" onClick={event => {
                        event.stopPropagation();
                        downloadCsv(assessments.filter(assessment => assessment.playerId === player.id && assessment.status === 'COMPLETED'));
                      }} disabled={!hasCompleted} className="ml-3 font-semibold text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">CSV</button>
                      <button type="button" onClick={event => {
                        event.stopPropagation();
                        downloadPdf(assessments.filter(assessment => assessment.playerId === player.id && assessment.status === 'COMPLETED'));
                      }} disabled={!hasCompleted} className="ml-3 font-semibold text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">PDF</button>
                    </td>
                  </tr>
                ))}
                {playerProgress.length === 0 && <tr><td colSpan={6} className="px-3 py-5 text-center text-slate-500">No players match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        ) : <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">No active players are available for assessment.</p>}
      </div>

      <div>
        {selectedAssessment && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assessment-detail-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-6"
            onClick={event => {
              if (event.target === event.currentTarget) setSelectedId('');
            }}
          >
            <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:p-6">
              <div className="mb-3 flex justify-end">
                <button type="button" onClick={() => setSelectedId('')} aria-label="Close assessment details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <p className="text-xs uppercase text-emerald-400">{selectedAssessment.playerName} · {selectedAssessment.discipline}</p>
                  <h3 id="assessment-detail-title" className="mt-1 text-lg font-bold text-white">{selectedAssessment.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{selectedAssessment.scheduledDate}{selectedAssessment.scheduledTime ? ` at ${selectedAssessment.scheduledTime}` : ''} · Coach {selectedAssessment.coachName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAssessment.status === 'SCHEDULED' && <button onClick={() => startAssessment(selectedAssessment)} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-2 text-xs font-bold text-slate-950"><Play className="h-3.5 w-3.5" /> Start</button>}
                  {selectedAssessment.status === 'SCHEDULED' && <button onClick={() => exportCalendarEvent(selectedAssessment)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"><CalendarDays className="h-3.5 w-3.5" /> Calendar</button>}
                  {selectedAssessment.status === 'COMPLETED' && <button onClick={() => scheduleFollowUp(selectedAssessment)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"><CalendarDays className="h-3.5 w-3.5" /> Follow-up</button>}
                  {selectedAssessment.status === 'COMPLETED' && <button onClick={() => downloadPdf(selectedAssessment)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"><Download className="h-3.5 w-3.5" /> PDF</button>}
                  {selectedAssessment.status === 'COMPLETED' && <button onClick={() => downloadCsv(selectedAssessment)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"><Download className="h-3.5 w-3.5" /> CSV</button>}
                </div>
              </div>

              {selectedAssessment.status === 'SCHEDULED' && <p className="text-sm text-slate-400">This assessment is scheduled. Start it when the player is ready to be assessed.</p>}

              {selectedAssessment.videoAnalysisId && (
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                  <h4 className="text-xs font-semibold text-sky-200">Linked video analysis</h4>
                  {isLoadingLinkedVideo ? <p className="mt-1 text-xs text-slate-400">Loading video findings…</p> :
                    linkedVideoAnalysis ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-slate-300">Video score: <strong className="text-white">{linkedVideoAnalysis.overallScore}/100</strong> · {new Date(linkedVideoAnalysis.createdAt).toLocaleDateString()}</p>
                        {linkedVideoAnalysis.analysis.detectedIssues.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
                            {linkedVideoAnalysis.analysis.detectedIssues.map((issue, index) => <li key={index}>{issue}</li>)}
                          </ul>
                        )}
                        {linkedVideoAnalysis.analysis.biomechanicalMetrics && (
                          <p className="text-[11px] text-slate-400">
                            Head position: {linkedVideoAnalysis.analysis.biomechanicalMetrics.headPosition} · Foot alignment: {linkedVideoAnalysis.analysis.biomechanicalMetrics.footAlignment}
                          </p>
                        )}
                      </div>
                    ) : <p className="mt-1 text-xs text-slate-400">Video analysis details are unavailable.</p>}
                </div>
              )}

              {selectedAssessment.status !== 'SCHEDULED' && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white">Performance ratings <span className="text-xs font-normal text-slate-500">(1 = needs work, 5 = strong)</span></h4>
                    {metrics.map((metric, index) => (
                      <div key={metric.name} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-[minmax(120px,0.7fr)_180px_minmax(120px,1fr)] sm:items-center">
                        <span className="text-xs font-medium text-slate-200">{metric.name}</span>
                        {selectedAssessment.status === 'IN_PROGRESS' ? (
                          <div role="group" aria-label={`${metric.name} rating`} className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map(score => (
                              <button
                                key={score}
                                type="button"
                                aria-label={`${metric.name}: ${score} out of 5`}
                                aria-pressed={metric.score === score}
                                onClick={() => setMetrics(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, score } : item))}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                  metric.score === score
                                    ? 'border-emerald-300 bg-emerald-400 text-slate-950'
                                    : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-emerald-400 hover:text-emerald-200'
                                }`}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                        ) : <span className="text-xs font-bold text-emerald-300">{metric.score ?? '—'} / 5</span>}
                        {selectedAssessment.status === 'IN_PROGRESS'
                          ? <input aria-label={`${metric.name} observation`} value={metric.note} maxLength={1000} onChange={event => setMetrics(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} placeholder="Observation (optional)" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white" />
                          : <span className="text-xs text-slate-400">{metric.note || 'No observation recorded.'}</span>}
                      </div>
                    ))}
                  </div>
                  {selectedAssessment.status === 'IN_PROGRESS' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-slate-300">Strengths
                        <textarea rows={3} maxLength={4000} value={strengths} onChange={event => setStrengths(event.target.value)} placeholder={'Strength shown: ...\nEvidence from this assessment: ...'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                      </label>
                      <label className="text-xs text-slate-300">Focus areas
                        <textarea rows={3} maxLength={4000} value={focusAreas} onChange={event => setFocusAreas(event.target.value)} placeholder={'Skill to develop: ...\nSuggested next step: ...'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                      </label>
                      <label className="text-xs text-slate-300 sm:col-span-2">Feedback for player
                        <textarea required rows={3} maxLength={4000} value={coachFeedback} onChange={event => setCoachFeedback(event.target.value)} placeholder={'What you did well: ...\nWhat to focus on next: ...\nTry this in training: ...'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                      </label>
                      <label className="text-xs text-slate-300 sm:col-span-2">Player's thoughts or feedback
                        <textarea rows={3} maxLength={4000} value={playerFeedback} onChange={event => setPlayerFeedback(event.target.value)} placeholder={'What felt good during this assessment?\nWhat would you like to improve or ask about?'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
                      </label>
                      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                        <button onClick={() => saveAssessment(false)} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"><Save className="h-3.5 w-3.5" /> Save progress</button>
                        <button onClick={() => saveAssessment(true)} disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950"><Check className="h-3.5 w-3.5" /> Complete assessment</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-slate-950/60 p-3">
                          <p className="text-[10px] uppercase text-slate-500">Average rating</p>
                          <p className="mt-1 text-lg font-bold text-white">{currentAverage === null ? '—' : `${currentAverage.toFixed(1)} / 5`}</p>
                        </div>
                        <div className="rounded-lg bg-slate-950/60 p-3">
                          <p className="text-[10px] uppercase text-slate-500">Progress vs previous</p>
                          <p className="mt-1 text-lg font-bold text-white">{currentAverage === null ? '—' : previousAverage === null ? 'Baseline' : `${currentAverage - previousAverage >= 0 ? '+' : ''}${(currentAverage - previousAverage).toFixed(1)}`}</p>
                        </div>
                        <div className="rounded-lg bg-slate-950/60 p-3">
                          <p className="text-[10px] uppercase text-slate-500">Linked evidence</p>
                          <p className="mt-1 truncate text-sm text-slate-200">{selectedAssessment.videoAnalysisId ? 'Video analysis attached' : selectedAssessment.trainingSessionId ? 'Training session attached' : 'None attached'}</p>
                          {(() => {
                            const linked = selectedAssessment.trainingSessionId ? sessions.find(s => s.id === selectedAssessment.trainingSessionId) : undefined;
                            if (!linked || !onViewTrainingSession) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => onViewTrainingSession(linked.id, selectedAssessment.playerId)}
                                title={`${linked.title} (${linked.sessionDate})`}
                                className="mt-1.5 block max-w-full truncate text-left text-xs font-semibold text-sky-400 underline hover:text-sky-300"
                              >
                                View {selectedAssessment.playerName.split(' ')[0]}'s session: {linked.title} ({linked.sessionDate})
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                      {trendAssessments.length > 0 && (
                        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold text-slate-200">Assessment trend</h4>
                            <span className="text-[10px] text-slate-500">Average rating · 1–5 · {selectedAssessment.discipline}</span>
                          </div>
                          <div className="mt-3 flex h-28 items-end gap-2" role="img" aria-label={`Average rating trend over ${trendAssessments.length} completed assessments`}>
                            {trendAssessments.map(item => {
                              const average = meanScore(item.metrics);
                              return (
                                <div key={item.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                                  <span className="text-[10px] font-semibold text-emerald-200">{average === null ? '—' : average.toFixed(1)}</span>
                                  <div className="flex h-16 w-full items-end rounded-t bg-slate-800">
                                    <div className="w-full rounded-t bg-emerald-400" style={{ height: `${average === null ? 0 : Math.max(average / 5 * 100, 4)}%` }} />
                                  </div>
                                  <span className="truncate text-[9px] text-slate-500">{item.completedAt?.slice(5, 10) || item.scheduledDate.slice(5, 10)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 p-3"><h4 className="text-xs font-semibold text-emerald-300">Strengths</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{strengths || 'No strengths recorded.'}</p></div>
                        <div className="rounded-lg border border-slate-800 p-3"><h4 className="text-xs font-semibold text-amber-300">Focus areas</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{focusAreas || 'No focus areas recorded.'}</p></div>
                        <div className="rounded-lg border border-slate-800 p-3 sm:col-span-2"><h4 className="text-xs font-semibold text-slate-300">Coach feedback</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{coachFeedback}</p></div>
                        <div className="rounded-lg border border-slate-800 p-3 sm:col-span-2"><h4 className="text-xs font-semibold text-sky-300">Player's thoughts or feedback</h4><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{selectedAssessment.playerFeedback || 'No player feedback recorded.'}</p></div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={() => mailFeedback(selectedAssessment)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200"><Mail className="h-3.5 w-3.5" /> Share by email</button>
                        <button onClick={generateInsights} disabled={isGenerating} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 px-3 py-2 text-xs text-violet-200 disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" /> {isGenerating ? 'Generating…' : selectedAssessment.aiInsights ? 'Refresh AI insights' : 'Generate AI insights'}</button>
                      </div>
                      {selectedAssessment.aiInsights && (
                        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                          <h4 className="text-sm font-semibold text-violet-200">AI development insights</h4>
                          <p className="mt-2 text-sm text-slate-300">{selectedAssessment.aiInsights.summary}</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">{selectedAssessment.aiInsights.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </section>
  );
};
