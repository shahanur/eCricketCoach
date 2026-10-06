import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  MessageSquare,
  Plus,
  Target,
  Trash2,
  Users
} from 'lucide-react';
import { api } from '../../services/api';
import {
  AuthUser,
  Certificate,
  ClubMember,
  CoachWorkspaceItem,
  CoachWorkspaceKind,
  TrainingSession
} from '../../types';

type CoachTab = 'OVERVIEW' | 'SESSIONS' | 'PARTICIPANTS' | 'UPDATES' | 'COLLABORATION' | 'REPORTS';

interface CoachOperationsProps {
  currentUser: AuthUser;
  certificates: Certificate[];
  onScheduleSession: (session: TrainingSession) => void | Promise<void>;
  onUpdateSession: (sessionId: string, updates: Partial<TrainingSession>) => void | Promise<void>;
  onDeleteSession: (sessionId: string) => void | Promise<void>;
  onPromotePlayer: (playerId: string) => void;
}

const today = new Date().toISOString().slice(0, 10);

export const CoachOperations: React.FC<CoachOperationsProps> = ({
  currentUser,
  certificates,
  onScheduleSession,
  onUpdateSession,
  onDeleteSession,
  onPromotePlayer
}) => {
  const [tab, setTab] = useState<CoachTab>('OVERVIEW');
  const [items, setItems] = useState<CoachWorkspaceItem[]>([]);
  const [players, setPlayers] = useState<ClubMember[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [workspaceError, setWorkspaceError] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState(today);
  const [sessionDuration, setSessionDuration] = useState(90);
  const squadNames = Array.from(new Set(players.map(player => player.squad).filter(squad => squad !== 'Unassigned')));
  const [sessionSquad, setSessionSquad] = useState(squadNames[0] || 'Unassigned');
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || '');
  const [goalTitle, setGoalTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [attendanceSessionId, setAttendanceSessionId] = useState(sessions[0]?.id || '');
  const [attendanceStatus, setAttendanceStatus] = useState('PRESENT');
  const [teamNote, setTeamNote] = useState('');
  const [ideaText, setIdeaText] = useState('');
  const [aiRating, setAiRating] = useState('HELPFUL');
  const [aiComment, setAiComment] = useState('');

  const loadDashboard = async () => {
    try {
      const dashboard = await api.getCoachDashboard();
      setPlayers(dashboard.players);
      setSessions(dashboard.sessions);
      setItems(dashboard.items);
      setWorkspaceError('');
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to load club coach dashboard.');
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [currentUser.id, currentUser.tenantId]);

  useEffect(() => {
    if (!selectedPlayerId && players[0]) setSelectedPlayerId(players[0].id);
    if (!sessionSquad && squadNames[0]) setSessionSquad(squadNames[0]);
  }, [players, selectedPlayerId, sessionSquad, squadNames]);

  const upcomingSessions = useMemo(
    () => sessions.filter(session => session.sessionDate >= today && !session.isExecuted).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)),
    [sessions]
  );
  const goals = items.filter(item => item.kind === 'GOAL');
  const notifications = items.filter(item => item.kind === 'NOTIFICATION');
  const attendance = items.filter(item => item.kind === 'ATTENDANCE');

  const createItem = async (payload: {
    kind: CoachWorkspaceKind;
    title: string;
    playerId?: string;
    sessionId?: string;
    content?: string;
    status?: string;
    progress?: number;
    metadata?: Record<string, unknown>;
  }) => {
    setWorkspaceError('');
    try {
      const created = await api.createCoachWorkspaceItem(payload);
      setItems(previous => [created, ...previous]);
      return created;
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to save coach workspace item.');
      return null;
    }
  };

  const updateItem = async (id: string, updates: Partial<CoachWorkspaceItem>) => {
    try {
      const updated = await api.updateCoachWorkspaceItem(id, updates);
      setItems(previous => previous.map(item => item.id === id ? updated : item));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to update coach workspace item.');
    }
  };

  const removeItem = async (id: string) => {
    try {
      await api.deleteCoachWorkspaceItem(id);
      setItems(previous => previous.filter(item => item.id !== id));
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : 'Unable to delete coach workspace item.');
    }
  };

  const notifyScheduleChange = (title: string, content: string, sessionId?: string) =>
    createItem({ kind: 'NOTIFICATION', title, content, sessionId, status: 'UNREAD' });

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
    await notifyScheduleChange('Session scheduled', `${session.title} was added for ${session.squadName} on ${session.sessionDate}.`, session.id);
    await loadDashboard();
    setSessionTitle('');
  };

  const cancelSession = async (session: TrainingSession) => {
    await onDeleteSession(session.id);
    await notifyScheduleChange('Session canceled', `${session.title} on ${session.sessionDate} was canceled. Participants should be contacted.`, session.id);
    await loadDashboard();
  };

  const downloadReport = () => {
    const rows = [
      ['Player', 'Squad', 'Level', 'Goals', 'Average goal progress', 'Attendance records'],
      ...players.map(player => {
        const playerGoals = goals.filter(goal => goal.playerId === player.id);
        const averageProgress = playerGoals.length
          ? Math.round(playerGoals.reduce((sum, goal) => sum + (goal.progress || 0), 0) / playerGoals.length)
          : 0;
        return [
          player.name,
          player.squad,
          player.currentLevel,
          playerGoals.length,
          `${averageProgress}%`,
          attendance.filter(record => record.playerId === player.id).length
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
          <p className="text-xs text-slate-400 mt-1">Plan sessions, guide participants, collaborate with staff, and measure development.</p>
        </div>
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Coach workspace sections">
          {(['OVERVIEW', 'SESSIONS', 'PARTICIPANTS', 'UPDATES', 'COLLABORATION', 'REPORTS'] as CoachTab[]).map(value => (
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

      {workspaceError && <p role="alert" className="text-xs text-rose-400">{workspaceError}</p>}

      {tab === 'OVERVIEW' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              ['Upcoming sessions', upcomingSessions.length, Calendar, 'SESSIONS'],
              ['Active participants', players.filter(player => player.invitationStatus === 'ACTIVE').length, Users, 'PARTICIPANTS'],
              ['Development goals', goals.filter(goal => goal.status !== 'COMPLETED').length, Target, 'PARTICIPANTS'],
              ['Unread updates', notifications.filter(item => item.status === 'UNREAD').length, Bell, 'UPDATES']
            ] as Array<[string, number, React.ElementType, CoachTab]>).map(([label, value, Icon, detailTab]) => (
              <button
                key={label}
                type="button"
                onClick={() => setTab(detailTab)}
                aria-label={`View ${label.toLowerCase()}`}
                className="group border border-slate-800 bg-slate-900 hover:bg-slate-800 hover:border-emerald-500/50 p-4 rounded-lg text-left transition cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <Icon className="w-4 h-4 text-emerald-400 mb-3" />
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition" />
                </div>
                <p className="text-2xl font-bold text-white">{String(value)}</p>
                <p className="text-xs text-slate-400">{String(label)}</p>
              </button>
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <h2 className="text-sm font-bold text-white mb-3">Next sessions and events</h2>
              <div className="divide-y divide-slate-800 border-y border-slate-800">
                {upcomingSessions.slice(0, 4).map(session => (
                  <button key={session.id} type="button" onClick={() => setTab('SESSIONS')} className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-900/60 transition">
                    <div><p className="text-sm font-semibold text-white">{session.title}</p><p className="text-xs text-slate-400">{session.squadName} · {session.durationMinutes} min</p></div>
                    <span className="flex items-center gap-2"><time className="text-xs font-semibold text-cyan-300">{session.sessionDate}</time><ChevronRight className="w-4 h-4 text-slate-600" /></span>
                  </button>
                ))}
                {upcomingSessions.length === 0 && <p className="py-4 text-xs text-slate-500">No upcoming sessions.</p>}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white mb-3">Schedule notifications</h2>
              <div className="space-y-2">
                {notifications.slice(0, 4).map(item => (
                  <button key={item.id} onClick={() => updateItem(item.id, { status: 'READ' })} className="w-full text-left border-l-2 border-cyan-400 bg-slate-900 px-3 py-2">
                    <p className="text-xs font-semibold text-white">{item.title}</p><p className="text-[11px] text-slate-400">{item.content}</p>
                  </button>
                ))}
                {notifications.length === 0 && <p className="text-xs text-slate-500">Schedule changes will appear here.</p>}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-4">
            <h2 className="text-sm font-bold text-white">Coaching practice library</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-3 text-xs">
              <a href="https://www.ecb.co.uk/play/coaching" target="_blank" rel="noreferrer" className="border border-slate-800 p-3 rounded-lg text-slate-300 hover:border-emerald-500">ECB coaching resources</a>
              <a href="https://www.icc-cricket.com/about/development/coaching" target="_blank" rel="noreferrer" className="border border-slate-800 p-3 rounded-lg text-slate-300 hover:border-emerald-500">ICC development guidance</a>
              <button onClick={() => setTab('COLLABORATION')} className="border border-slate-800 p-3 rounded-lg text-left text-slate-300 hover:border-emerald-500">Mentor and staff collaboration</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'SESSIONS' && (
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
            {sessions.map(session => (
              <div key={session.id} className="border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-white">{session.title}</p><p className="text-xs text-slate-400">{session.squadName} · {session.durationMinutes} min</p></div>
                <div className="flex gap-2">
                  <input type="date" aria-label={`Reschedule ${session.title}`} value={session.sessionDate} onChange={async event => { await onUpdateSession(session.id, { sessionDate: event.target.value }); await notifyScheduleChange('Session rescheduled', `${session.title} moved to ${event.target.value}.`, session.id); await loadDashboard(); }} className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                  {!session.isExecuted && <button onClick={async () => { await onUpdateSession(session.id, { isExecuted: true }); await notifyScheduleChange('Session executed', `${session.title} was completed. Add participant notes and attendance.`, session.id); await loadDashboard(); }} className="px-2.5 py-1.5 text-xs border border-emerald-500/40 text-emerald-300 rounded">Complete</button>}
                  <button onClick={() => cancelSession(session)} title="Cancel session" aria-label={`Cancel ${session.title}`} className="p-1.5 text-rose-300 border border-rose-500/30 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'PARTICIPANTS' && (
        <div className="space-y-5">
          <select value={selectedPlayerId} onChange={event => setSelectedPlayerId(event.target.value)} className="w-full sm:w-80 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">
            {players.map(player => <option key={player.id} value={player.id}>{player.name} · {player.squad}</option>)}
          </select>
          {players.filter(player => player.id === selectedPlayerId).map(player => (
            <div key={player.id} className="grid sm:grid-cols-4 gap-3 border-y border-slate-800 py-4 text-xs">
              <div><p className="text-slate-500">Level</p><p className="font-semibold text-white">{player.currentLevel}</p></div>
              <div><p className="text-slate-500">Discipline</p><p className="font-semibold text-white">{player.discipline}</p></div>
              <div><p className="text-slate-500">Squad</p><p className="font-semibold text-white">{player.squad}</p></div>
              <div><p className="text-slate-500">Certificates</p><p className="font-semibold text-white">{certificates.filter(certificate => certificate.playerName === player.name).length}</p></div>
            </div>
          ))}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            <form onSubmit={event => { event.preventDefault(); if (goalTitle.trim()) createItem({ kind: 'GOAL', playerId: selectedPlayerId, title: goalTitle, progress: 0 }); setGoalTitle(''); }} className="space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><Target size={15} /> Development goal</h2>
              <input value={goalTitle} onChange={event => setGoalTitle(event.target.value)} placeholder="e.g. Consistent yorker length" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <button className="text-xs font-semibold text-emerald-300">Add goal</button>
            </form>
            <form onSubmit={event => { event.preventDefault(); if (messageText.trim()) createItem({ kind: 'MESSAGE', playerId: selectedPlayerId, title: 'Personalized coach feedback', content: messageText, status: 'SENT' }); setMessageText(''); }} className="space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><MessageSquare size={15} /> Message participant</h2>
              <textarea value={messageText} onChange={event => setMessageText(event.target.value)} placeholder="Feedback and recommendation" rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <button className="text-xs font-semibold text-emerald-300">Send through platform</button>
            </form>
            <form onSubmit={event => { event.preventDefault(); if (progressNote.trim()) createItem({ kind: 'PROGRESS_NOTE', playerId: selectedPlayerId, title: 'Coach progress observation', content: progressNote }); setProgressNote(''); }} className="space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList size={15} /> Progress note</h2>
              <textarea value={progressNote} onChange={event => setProgressNote(event.target.value)} placeholder="Progress, development needs, and next action" rows={2} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white" />
              <button className="text-xs font-semibold text-emerald-300">Save private note</button>
            </form>
            <form onSubmit={event => { event.preventDefault(); if (attendanceSessionId) createItem({ kind: 'ATTENDANCE', playerId: selectedPlayerId, sessionId: attendanceSessionId, title: 'Session attendance', status: attendanceStatus }); }} className="space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2"><CheckCircle2 size={15} /> Attendance</h2>
              <select value={attendanceSessionId} onChange={event => setAttendanceSessionId(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white">{sessions.map(session => <option key={session.id} value={session.id}>{session.title}</option>)}</select>
              <select value={attendanceStatus} onChange={event => setAttendanceStatus(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"><option>PRESENT</option><option>LATE</option><option>ABSENT</option><option>EXCUSED</option></select>
              <button className="text-xs font-semibold text-emerald-300">Record attendance</button>
            </form>
          </div>
          <div className="space-y-3">
            {goals.filter(goal => goal.playerId === selectedPlayerId).map(goal => (
              <div key={goal.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">{goal.title}</p><input aria-label={`Progress for ${goal.title}`} type="range" min={0} max={100} value={goal.progress || 0} onChange={event => updateItem(goal.id, { progress: Number(event.target.value), status: Number(event.target.value) === 100 ? 'COMPLETED' : 'ACTIVE' })} className="w-full accent-emerald-500" /></div>
                <span className="w-10 text-right text-xs text-emerald-300">{goal.progress || 0}%</span>
                <button onClick={() => removeItem(goal.id)} aria-label={`Delete ${goal.title}`} className="text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
              </div>
            ))}
            {items.filter(item => item.kind === 'PROGRESS_NOTE' && item.playerId === selectedPlayerId).map(note => (
              <div key={note.id} className="flex justify-between gap-3 border-l-2 border-cyan-500 pl-3 py-1"><div><p className="text-xs font-semibold text-white">{note.title}</p><p className="text-xs text-slate-400">{note.content}</p></div><button onClick={() => removeItem(note.id)} className="text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button></div>
            ))}
            <button type="button" onClick={() => onPromotePlayer(selectedPlayerId)} disabled={!selectedPlayerId || players.find(player => player.id === selectedPlayerId)?.currentLevel === 'ELITE'} className="px-3 py-2 bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-lg text-xs font-semibold disabled:opacity-40">Promote to next development level</button>
          </div>
        </div>
      )}

      {tab === 'UPDATES' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Schedule and coaching updates</h2>
            <p className="text-xs text-slate-400">Review changes to sessions and participant notifications.</p>
          </div>
          <div className="divide-y divide-slate-800 border-y border-slate-800">
            {notifications.map(item => (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                <button type="button" onClick={() => updateItem(item.id, { status: 'READ' })} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    {item.status === 'UNREAD' && <span className="w-2 h-2 rounded-full bg-cyan-400" aria-label="Unread" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.content}</p>
                  <time className="text-[10px] text-slate-500">{new Date(item.updatedAt).toLocaleString()}</time>
                </button>
                <button type="button" onClick={() => removeItem(item.id)} aria-label={`Delete ${item.title}`} className="text-slate-500 hover:text-rose-300 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
            {notifications.length === 0 && <p className="py-5 text-xs text-slate-500">No schedule or coaching updates yet.</p>}
          </div>
        </div>
      )}

      {tab === 'COLLABORATION' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <form onSubmit={event => { event.preventDefault(); if (teamNote.trim()) createItem({ kind: 'COLLABORATION', title: 'Coach and staff note', content: teamNote }); setTeamNote(''); }} className="space-y-2"><h2 className="text-sm font-bold text-white">Staff collaboration and mentorship</h2><textarea value={teamNote} onChange={event => setTeamNote(event.target.value)} rows={4} placeholder="Share a plan, observation, or junior-coach guidance" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white" /><button className="text-xs font-semibold text-emerald-300">Share note</button></form>
          <form onSubmit={event => { event.preventDefault(); if (aiComment.trim()) createItem({ kind: 'AI_FEEDBACK', title: `AI analysis rated ${aiRating.toLowerCase()}`, content: aiComment, metadata: { rating: aiRating } }); setAiComment(''); }} className="space-y-2"><h2 className="text-sm font-bold text-white">Rate AI coaching insight</h2><select value={aiRating} onChange={event => setAiRating(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"><option>HELPFUL</option><option>PARTLY_HELPFUL</option><option>NOT_RELEVANT</option></select><textarea value={aiComment} onChange={event => setAiComment(event.target.value)} rows={3} placeholder="What was accurate or should improve?" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white" /><button className="text-xs font-semibold text-emerald-300">Submit AI feedback</button></form>
          <form onSubmit={event => { event.preventDefault(); if (ideaText.trim()) createItem({ kind: 'FEATURE_IDEA', title: 'Coach AI feature input', content: ideaText }); setIdeaText(''); }} className="space-y-2"><h2 className="text-sm font-bold text-white">AI feature input</h2><textarea value={ideaText} onChange={event => setIdeaText(event.target.value)} rows={4} placeholder="Suggest a new coaching or analysis capability" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white" /><button className="text-xs font-semibold text-emerald-300">Submit idea</button></form>
          <div className="lg:col-span-3 border-t border-slate-800 pt-4 space-y-2">{items.filter(item => ['COLLABORATION', 'AI_FEEDBACK', 'FEATURE_IDEA'].includes(item.kind)).slice(0, 8).map(item => <div key={item.id} className="flex justify-between gap-3 py-2"><div><p className="text-xs font-semibold text-white">{item.title}</p><p className="text-xs text-slate-400">{item.content}</p></div><button onClick={() => removeItem(item.id)} className="text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button></div>)}</div>
        </div>
      )}

      {tab === 'REPORTS' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList size={16} /> Attendance and performance report</h2><p className="text-xs text-slate-400">Live summary from participant goals, attendance, notes, and progression records.</p></div><button onClick={downloadReport} className="px-3 py-2 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-2"><Download size={14} /> Export CSV</button></div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="text-left text-slate-500 border-b border-slate-800"><tr><th className="py-2">Participant</th><th>Level</th><th>Goals</th><th>Attendance</th><th>Session notes</th></tr></thead><tbody>{players.map(player => <tr key={player.id} className="border-b border-slate-800/60"><td className="py-3 font-semibold text-white">{player.name}</td><td>{player.currentLevel}</td><td>{goals.filter(goal => goal.playerId === player.id).length}</td><td>{attendance.filter(record => record.playerId === player.id).length}</td><td>{sessions.filter(session => Boolean(session.playerNotes?.[player.id])).length}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </section>
  );
};