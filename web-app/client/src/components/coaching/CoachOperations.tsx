import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  Download,
  Plus,
  Trash2,
  Users
} from 'lucide-react';
import { api } from '../../services/api';
import {
  AuthUser,
  ClubMember,
  Drill,
  TrainingSession
} from '../../types';
import { SessionExecution } from './SessionExecution';

type CoachTab = 'OVERVIEW' | 'SESSIONS' | 'REPORTS';

interface CoachOperationsProps {
  currentUser: AuthUser;
  drills: Drill[];
  onScheduleSession: (session: TrainingSession) => void | Promise<void>;
  onUpdateSession: (sessionId: string, updates: Partial<TrainingSession>) => void | Promise<void>;
  onDeleteSession: (sessionId: string) => void | Promise<void>;
  onDrillCreated?: (drill: Drill) => void;
  onSessionSynced?: (session: TrainingSession) => void;
}

const currentDate = new Date();
const today = currentDate.toISOString().slice(0, 10);
const currentSeasonStartYear = currentDate.getUTCMonth() >= 9
  ? currentDate.getUTCFullYear()
  : currentDate.getUTCFullYear() - 1;
const seasonStart = `${currentSeasonStartYear}-10-01`;
const seasonEnd = `${currentSeasonStartYear + 1}-09-30`;

export const CoachOperations: React.FC<CoachOperationsProps> = ({
  currentUser,
  drills,
  onScheduleSession,
  onUpdateSession,
  onDeleteSession,
  onDrillCreated,
  onSessionSynced
}) => {
  const [tab, setTab] = useState<CoachTab>('OVERVIEW');
  const [players, setPlayers] = useState<ClubMember[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [mySessions, setMySessions] = useState<TrainingSession[]>([]);
  const [dashboardError, setDashboardError] = useState('');
  const [executingSessionId, setExecutingSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(today);
  const [sessionDuration, setSessionDuration] = useState(90);
  const squadNames = Array.from(new Set(players.map(player => player.squad).filter(squad => squad !== 'Unassigned')));
  const [sessionSquad, setSessionSquad] = useState(squadNames[0] || 'Unassigned');

  const loadDashboard = async () => {
    try {
      const dashboard = await api.getCoachDashboard();
      setPlayers(dashboard.players);
      setSessions(dashboard.sessions);
      setMySessions(dashboard.mySessions);
      setDashboardError('');
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : 'Unable to load club coach dashboard.');
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [currentUser.id, currentUser.tenantId]);

  useEffect(() => {
    if (!sessionSquad && squadNames[0]) setSessionSquad(squadNames[0]);
  }, [sessionSquad, squadNames]);

  const myUpcomingSessions = useMemo(
    () => mySessions.filter(session => !session.isExecuted).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
    [mySessions]
  );
  const upcomingClubSessions = useMemo(
    () => sessions.filter(session => !session.isExecuted).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
    [sessions]
  );
  const deliveredSessions = mySessions.filter(session =>
    session.isExecuted && session.sessionDate >= seasonStart && session.sessionDate <= seasonEnd
  ).length;
  const executingSession = mySessions.find(session => session.id === executingSessionId) || null;
  const deliveredWithLog = mySessions.filter(session => session.isExecuted && session.executionLog);

  const openExecution = (session: TrainingSession) => {
    setTab('SESSIONS');
    setExecutingSessionId(session.id);
    loadDashboard();
  };

  // Picks up session amendments made elsewhere (e.g. drills added in the club portal) while a session is open.
  useEffect(() => {
    if (!executingSessionId) return;
    const refresh = () => { loadDashboard(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [executingSessionId]);

  const applySavedSession = (updated: TrainingSession) => {
    const merge = (list: TrainingSession[]) => list.map(session => session.id === updated.id ? { ...session, ...updated } : session);
    setSessions(merge);
    setMySessions(merge);
    onSessionSynced?.(updated);
  };

  const playerAttendance = (player: ClubMember) => {
    const recorded = sessions.filter(session => session.executionLog?.attendance?.[player.id]);
    const attended = recorded.filter(session => session.executionLog!.attendance[player.id] !== 'ABSENT').length;
    return { recorded: recorded.length, attended, rate: recorded.length ? Math.round((attended / recorded.length) * 100) : null };
  };

  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sessionTitle.trim() || !sessionDate || !sessionSquad) return;
    const assignedPlayerIds = players.filter(player => player.squad === sessionSquad).map(player => player.id);
    const session: TrainingSession = {
      id: `sess-${Date.now()}`,
      title: sessionTitle.trim(),
      squadName: sessionSquad,
      coachId: currentUser.id,
      coachName: currentUser.name,
      assignedPlayerIds,
      sessionDate,
      durationMinutes: sessionDuration,
      isPublished: false,
      drillCount: 0,
      drillIds: []
    };
    await onScheduleSession(session);
    await loadDashboard();
    setSessionTitle('');
  };

  const cancelSession = async (session: TrainingSession) => {
    await onDeleteSession(session.id);
    await loadDashboard();
  };

  const downloadReport = () => {
    const rows = [
      ['Player', 'Squad', 'Level', 'Scheduled sessions', 'Delivered sessions', 'Attendance recorded', 'Attended', 'Attendance %', 'Sessions with notes'],
      ...players.map(player => {
        const playerSessions = sessions.filter(session => session.assignedPlayerIds?.includes(player.id));
        const attendance = playerAttendance(player);
        return [
          player.name,
          player.squad,
          player.currentLevel,
          playerSessions.length,
          playerSessions.filter(session => session.isExecuted).length,
          attendance.recorded,
          attendance.attended,
          attendance.rate ?? '',
          playerSessions.filter(session => Boolean(session.playerNotes?.[player.id])).length
        ];
      })
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `coach-performance-report-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div className="border-b border-slate-800 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-400 uppercase">{currentUser.clubName} club coach workspace</p>
          <h1 className="text-2xl font-bold text-white">{currentUser.name}'s club coaching dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Plan sessions, monitor club events, and measure development.</p>
        </div>
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Coach workspace sections">
          {(['OVERVIEW', 'SESSIONS', 'REPORTS'] as CoachTab[]).map(value => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${tab === value ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              {value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {dashboardError && <p role="alert" className="text-xs text-rose-400">{dashboardError}</p>}

      {tab === 'OVERVIEW' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { label: 'Upcoming sessions', value: myUpcomingSessions.length, icon: Calendar, detailTab: 'SESSIONS' as CoachTab },
              { label: 'Delivered sessions', value: deliveredSessions, icon: Calendar, detail: `Oct ${currentSeasonStartYear} – Sep ${currentSeasonStartYear + 1}` },
              { label: 'Active participants', value: players.filter(player => player.invitationStatus === 'ACTIVE').length, icon: Users }
            ] as Array<{ label: string; value: number; icon: React.ElementType; detail?: string; detailTab?: CoachTab }>).map(({ label, value, icon: Icon, detail, detailTab }) => {
              const content = (
                <>
                  <div className="flex items-start justify-between">
                    <Icon className="w-4 h-4 text-emerald-400 mb-3" />
                    {detailTab && <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition" />}
                  </div>
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                  {detail && <p className="text-[10px] text-slate-500 mt-1">{detail}</p>}
                </>
              );
              const className = `group border border-slate-800 bg-slate-900 p-4 rounded-lg text-left transition ${detailTab ? 'hover:bg-slate-800 hover:border-emerald-500/50 cursor-pointer' : ''}`;
              return detailTab
                ? <button key={label} type="button" onClick={() => setTab(detailTab)} aria-label={`View ${label.toLowerCase()}`} className={className}>{content}</button>
                : <div key={label} className={className}>{content}</div>;
            })}
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <h2 className="text-sm font-bold text-white mb-3">Next sessions and events</h2>
              <div className="divide-y divide-slate-800 border-y border-slate-800">
                {upcomingClubSessions.map(session => (
                  <div key={session.id} className="py-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-white">{session.title}</p><p className="text-xs text-slate-400">{session.squadName} · {session.durationMinutes} min · Led by {session.coachName || 'Coach not assigned'}</p></div>
                    <time className="shrink-0 text-xs font-semibold text-cyan-300">{session.sessionDate}</time>
                  </div>
                ))}
                {upcomingClubSessions.length === 0 && <p className="py-4 text-xs text-slate-500">No upcoming club sessions.</p>}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-3">My upcoming sessions</h2>
              <div className="divide-y divide-slate-800 border-y border-slate-800">
                {myUpcomingSessions.map(session => (
                  <div key={session.id} className="py-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm font-semibold text-white">{session.title}</p><p className="text-xs text-slate-400">{session.squadName} · {session.durationMinutes} min</p></div>
                    <div className="shrink-0 flex items-center gap-2">
                      <time className="text-xs font-semibold text-cyan-300">{session.sessionDate}</time>
                      <button onClick={() => openExecution(session)} className="px-2 py-1 text-[11px] border border-emerald-500/40 text-emerald-300 rounded">{session.executionLog?.status === 'IN_PROGRESS' ? 'Continue' : 'Run'}</button>
                    </div>
                  </div>
                ))}
                {myUpcomingSessions.length === 0 && <p className="py-4 text-xs text-slate-500">No upcoming sessions assigned to you.</p>}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-4">
            <h2 className="text-sm font-bold text-white">Coaching practice library</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs">
              <a href="https://www.ecb.co.uk/play/coaching" target="_blank" rel="noreferrer" className="border border-slate-800 p-3 rounded-lg text-slate-300 hover:border-emerald-500">ECB coaching resources</a>
              <a href="https://www.icc-cricket.com/about/development/coaching" target="_blank" rel="noreferrer" className="border border-slate-800 p-3 rounded-lg text-slate-300 hover:border-emerald-500">ICC development guidance</a>
            </div>
          </div>
        </div>
      )}

      {tab === 'SESSIONS' && executingSession && (
        <SessionExecution
          key={executingSession.id}
          session={executingSession}
          players={players}
          drills={drills}
          clubName={currentUser.clubName}
          onClose={() => setExecutingSessionId(null)}
          onSaved={applySavedSession}
          onRefresh={loadDashboard}
          onDrillCreated={onDrillCreated}
        />
      )}

      {tab === 'SESSIONS' && !executingSession && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <form onSubmit={createSession} className="space-y-3 border-r-0 lg:border-r border-slate-800 lg:pr-6">
            <h2 className="text-sm font-bold text-white">Schedule session</h2>
            <input value={sessionTitle} onChange={event => setSessionTitle(event.target.value)} placeholder="Session title" required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
            <select value={sessionSquad} onChange={event => setSessionSquad(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
              {squadNames.map(squad => <option key={squad}>{squad}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={sessionDate} onChange={event => setSessionDate(event.target.value)} required className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <input type="number" min={15} step={5} value={sessionDuration} onChange={event => setSessionDuration(Number(event.target.value))} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
            </div>
            <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg px-3 py-2 text-xs font-bold flex items-center justify-center gap-2"><Plus size={14} /> Create draft</button>
          </form>
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-white">Manage schedule</h2>
            {mySessions.map(session => (
              <div key={session.id} className="border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-white">{session.title}</p><p className="text-xs text-slate-400">{session.sessionDate} · {session.squadName} · {session.durationMinutes} min{session.isExecuted ? ' · Delivered' : session.executionLog?.status === 'IN_PROGRESS' ? ' · In progress' : ''}</p></div>
                <div className="flex gap-2">
                  {!session.isExecuted && <input type="date" aria-label={`Reschedule ${session.title}`} value={session.sessionDate} onChange={async event => { await onUpdateSession(session.id, { sessionDate: event.target.value }); await loadDashboard(); }} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" />}
                  <button onClick={() => openExecution(session)} className="px-2.5 py-1.5 text-xs border border-emerald-500/40 text-emerald-300 rounded">
                    {session.isExecuted ? 'Review' : session.executionLog?.status === 'IN_PROGRESS' ? 'Continue session' : 'Run session'}
                  </button>
                  {!session.isExecuted && <button onClick={() => cancelSession(session)} title="Cancel session" aria-label={`Cancel ${session.title}`} className="p-1.5 text-rose-300 border border-rose-500/30 rounded"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'REPORTS' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList size={16} /> Participant session report</h2><p className="text-xs text-slate-400">Session and coaching-note activity from club training records.</p></div><button onClick={downloadReport} className="px-3 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-2"><Download size={14} /> Export CSV</button></div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-slate-500 border-b border-slate-800"><tr><th className="py-2">Participant</th><th>Level</th><th>Squad</th><th>Scheduled sessions</th><th>Delivered sessions</th><th>Attendance</th><th>Sessions with notes</th></tr></thead><tbody>{players.map(player => {
            const playerSessions = sessions.filter(session => session.assignedPlayerIds?.includes(player.id));
            const attendance = playerAttendance(player);
            return <tr key={player.id} className="border-b border-slate-800/60"><td className="py-3 font-semibold text-white">{player.name}</td><td>{player.currentLevel}</td><td>{player.squad}</td><td>{playerSessions.length}</td><td>{playerSessions.filter(session => session.isExecuted).length}</td><td className={attendance.rate !== null && attendance.rate < 75 ? 'text-amber-300' : ''}>{attendance.rate === null ? '—' : `${attendance.attended}/${attendance.recorded} (${attendance.rate}%)`}</td><td>{playerSessions.filter(session => Boolean(session.playerNotes?.[player.id])).length}</td></tr>;
          })}</tbody></table></div>
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-white">My session outcomes</h2>
            <p className="text-xs text-slate-400">Use attendance, engagement and overruns to shape your next sessions.</p>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-slate-500 border-b border-slate-800"><tr><th className="py-2">Date</th><th>Session</th><th>Attendance</th><th>Engagement</th><th>Objectives</th><th>Drills done</th><th>Disruptions</th><th>Next adjustments</th><th></th></tr></thead><tbody>
              {deliveredWithLog.map(session => {
                const log = session.executionLog!;
                const attendanceValues = Object.values(log.attendance || {});
                const attended = attendanceValues.filter(status => status !== 'ABSENT').length;
                return (
                  <tr key={session.id} className="border-b border-slate-800/60 align-top">
                    <td className="py-3 text-slate-300">{session.sessionDate}</td>
                    <td className="font-semibold text-white">{session.title}</td>
                    <td>{attendanceValues.length ? `${attended}/${attendanceValues.length}` : '—'}</td>
                    <td className={log.evaluation.engagement && log.evaluation.engagement <= 2 ? 'text-amber-300' : ''}>{log.evaluation.engagement ? `${log.evaluation.engagement}/5` : '—'}</td>
                    <td>{log.evaluation.objectivesMet || '—'}</td>
                    <td>{log.drillLog.filter(entry => entry.completed).length}/{log.drillLog.length}</td>
                    <td>{log.incidents.length}</td>
                    <td className="max-w-xs whitespace-pre-line text-slate-300">{log.evaluation.nextAdjustments || '—'}</td>
                    <td><button onClick={() => openExecution(session)} className="text-cyan-300">Review</button></td>
                  </tr>
                );
              })}
              {deliveredWithLog.length === 0 && <tr><td colSpan={9} className="py-4 text-slate-500">No delivered sessions with execution records yet.</td></tr>}
            </tbody></table></div>
          </div>
        </div>
      )}
    </section>
  );
};