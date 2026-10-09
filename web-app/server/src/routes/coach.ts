import { Router, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { DbService } from '../services/dbService.js';
import { SessionExecutionLog } from '../types/index.js';

export const coachRouter = Router();

export const coachRouteQueries = {
  findActiveCoach: (userId: string, clubId: string) => prisma.clubMember.findFirst({
    where: { id: userId, clubId, role: 'COACH', invitationStatus: 'ACTIVE' }
  }),
  findAssignedSession: (sessionId: string, userId: string, clubId: string) =>
    prisma.trainingSession.findFirst({
      where: assignedExecutionSessionWhere(sessionId, userId, clubId)
    })
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const minutes = (value: unknown) => Number.isFinite(value) ? Math.min(Math.max(Math.round(value as number), 0), 600) : 0;

// Normalises the client-supplied execution log into a bounded, well-typed record.
export function parseExecutionLog(value: unknown): SessionExecutionLog | null {
  if (!isRecord(value)) return null;
  if (value.status !== 'PREPARING' && value.status !== 'IN_PROGRESS' && value.status !== 'COMPLETED') return null;
  const checklist = isRecord(value.checklist) ? value.checklist : {};
  const attendance = isRecord(value.attendance) ? value.attendance : {};
  const evaluation = isRecord(value.evaluation) ? value.evaluation : {};
  const drillLog = Array.isArray(value.drillLog) ? value.drillLog.slice(0, 50) : [];
  const incidents = Array.isArray(value.incidents) ? value.incidents.slice(0, 100) : [];
  const objectivesMet = ['YES', 'PARTIAL', 'NO'].includes(evaluation.objectivesMet as string)
    ? evaluation.objectivesMet as 'YES' | 'PARTIAL' | 'NO'
    : '';

  return {
    status: value.status,
    startedAt: text(value.startedAt, 40) || null,
    completedAt: text(value.completedAt, 40) || null,
    checklist: Object.fromEntries(
      Object.entries(checklist).slice(0, 50).map(([key, done]) => [key.slice(0, 100), done === true])
    ),
    attendance: Object.fromEntries(
      Object.entries(attendance)
        .filter(([, status]) => status === 'PRESENT' || status === 'LATE' || status === 'ABSENT')
        .slice(0, 200)
        .map(([playerId, status]) => [playerId.slice(0, 100), status as 'PRESENT' | 'LATE' | 'ABSENT'])
    ),
    drillLog: drillLog.filter(isRecord).map(entry => ({
      id: text(entry.id, 100),
      drillId: text(entry.drillId, 100) || null,
      title: text(entry.title, 200),
      plannedMinutes: minutes(entry.plannedMinutes),
      actualMinutes: minutes(entry.actualMinutes),
      completed: entry.completed === true,
      notes: text(entry.notes, 2000)
    })),
    incidents: incidents.filter(isRecord).map(entry => ({
      id: text(entry.id, 100),
      time: text(entry.time, 40),
      category: text(entry.category, 50),
      note: text(entry.note, 1000)
    })),
    evaluation: {
      objectivesMet,
      engagement: Math.min(Math.max(Math.round(Number(evaluation.engagement) || 0), 0), 5),
      wentWell: text(evaluation.wentWell, 4000),
      challenges: text(evaluation.challenges, 4000),
      nextAdjustments: text(evaluation.nextAdjustments, 4000)
    }
  };
}

coachRouter.use(authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  if (req.user?.role !== 'COACH' || req.user.coachContext !== 'CLUB') {
    res.status(403).json({ error: 'Club coach access required.' });
    return;
  }
  try {
    const member = await coachRouteQueries.findActiveCoach(req.user.userId, req.user.tenantId);
    if (!member) {
      res.status(403).json({ error: 'Active club coach membership required.' });
      return;
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to verify club coach membership.' });
  }
});

coachRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  const [members, allSessions, coachSessions] = await Promise.all([
    DbService.getClubMembers(req.user!.tenantId),
    DbService.getTrainingSessions(req.user!.tenantId),
    DbService.getTrainingSessions(req.user!.tenantId, req.user!.userId)
  ]);

  res.json({
    players: members.filter(member => member.role === 'PLAYER'),
    sessions: allSessions,
    mySessions: coachSessions
  });
});

// Finds a session in the coach's club where they are lead, coordinator, or assistant coach.
export const assignedExecutionSessionWhere = (sessionId: string, coachId: string, clubId: string) => ({
  id: sessionId,
  clubId,
  OR: [{ coachId }, { coordinatorCoachId: coachId }, { assistantCoachId: coachId }]
});

const findAssignedSession = (req: AuthenticatedRequest) =>
  coachRouteQueries.findAssignedSession(req.params.id, req.user!.userId, req.user!.tenantId);

export function isSessionExecutionDateAllowed(
  sessionDate: string,
  status: SessionExecutionLog['status'],
  complete: boolean,
  now = Date.now()
): boolean {
  if (status === 'PREPARING' && !complete) return true;
  const latestLocalDate = new Date(now + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return sessionDate <= latestLocalDate;
}

coachRouter.get('/sessions/:id/execution', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await findAssignedSession(req);
    if (!session) {
      res.status(404).json({ error: 'Session not found or not assigned to you.' });
      return;
    }
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load session execution.' });
  }
});

const DISCIPLINES = ['BATTING', 'BOWLING', 'KEEPING', 'FIELDING'];

// Adds a drill to a session during planning or execution: either an existing catalogue drill
// (system, AI, or this club's custom drills) or a new ad-hoc drill that is saved to the club catalogue.
coachRouter.post('/sessions/:id/drills', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await findAssignedSession(req);
    if (!session) {
      res.status(404).json({ error: 'Session not found or not assigned to you.' });
      return;
    }
    if (session.isExecuted) {
      res.status(400).json({ error: 'Drills cannot be changed on a delivered session.' });
      return;
    }

    const { drillId, drill } = req.body || {};
    let drillToAdd: { id: string } & Record<string, unknown>;
    let createdDrill = null;

    if (typeof drillId === 'string' && drillId) {
      const existing = await prisma.drill.findFirst({
        where: {
          id: drillId,
          OR: [{ source: { not: 'CLUB_CUSTOM' } }, { clubId: req.user!.tenantId }]
        }
      });
      if (!existing) {
        res.status(404).json({ error: 'Drill not found in your catalogue.' });
        return;
      }
      drillToAdd = existing;
    } else if (isRecord(drill)) {
      const title = text(drill.title, 200).trim();
      const skillSet = text(drill.skillSet, 200).trim();
      if (!title || !skillSet || !DISCIPLINES.includes(drill.discipline as string)) {
        res.status(400).json({ error: 'Ad-hoc drills need a title, skill focus, and valid discipline.' });
        return;
      }
      const tenant = await prisma.customerTenant.findUnique({ where: { id: req.user!.tenantId } });
      createdDrill = await DbService.createDrill({
        id: `drill-club-${Date.now()}`,
        title,
        discipline: drill.discipline,
        skillSet,
        contextType: drill.contextType === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'GROUP',
        duration: minutes(drill.duration) || 15,
        source: 'CLUB_CUSTOM',
        clubId: req.user!.tenantId,
        clubName: tenant?.name || null,
        squadId: session.squadId,
        squadName: session.squadName,
        instructions: text(drill.instructions, 4000) || 'Ad-hoc drill added during a training session.'
      });
      drillToAdd = createdDrill;
    } else {
      res.status(400).json({ error: 'Provide a catalogue drillId or an ad-hoc drill.' });
      return;
    }

    const updated = await DbService.incrementSessionDrillCount(session.id, drillToAdd.id);
    res.status(createdDrill ? 201 : 200).json({ success: true, session: updated, drill: createdDrill || drillToAdd });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to add drill to session.' });
  }
});

coachRouter.delete('/sessions/:id/drills/:drillId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await findAssignedSession(req);
    if (!session) {
      res.status(404).json({ error: 'Session not found or not assigned to you.' });
      return;
    }
    if (session.isExecuted) {
      res.status(400).json({ error: 'Drills cannot be changed on a delivered session.' });
      return;
    }
    const drillIds: unknown[] = Array.isArray(session.drillIds) ? session.drillIds : [];
    if (!drillIds.includes(req.params.drillId)) {
      res.status(404).json({ error: 'Drill is not part of this session.' });
      return;
    }
    const updated = await DbService.removeDrillFromSession(session.id, req.params.drillId);
    res.json({ success: true, session: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to remove drill from session.' });
  }
});

// Records live execution of a session (preparation, attendance, drills, notes, evaluation)
// by a coach assigned to it as lead, coordinator, or assistant.
coachRouter.patch('/sessions/:id/execution', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await findAssignedSession(req);
    if (!session) {
      res.status(404).json({ error: 'Session not found or not assigned to you.' });
      return;
    }

    const { executionLog, playerNotes, postNotes, complete } = req.body || {};
    const parsedLog = parseExecutionLog(executionLog);
    if (!parsedLog) {
      res.status(400).json({ error: 'A valid execution log is required.' });
      return;
    }
    if (!isSessionExecutionDateAllowed(session.sessionDate, parsedLog.status, complete === true)) {
      res.status(400).json({ error: 'Sessions can only be started on or after their scheduled date.' });
      return;
    }
    if (
      playerNotes !== undefined &&
      (!isRecord(playerNotes) || Object.values(playerNotes).some(note => typeof note !== 'string'))
    ) {
      res.status(400).json({ error: 'playerNotes must map player IDs to note strings.' });
      return;
    }
    if (complete !== undefined && typeof complete !== 'boolean') {
      res.status(400).json({ error: 'complete must be a boolean.' });
      return;
    }

    const finalLog: SessionExecutionLog = complete || session.isExecuted
      ? { ...parsedLog, status: 'COMPLETED', completedAt: parsedLog.completedAt || new Date().toISOString() }
      : parsedLog;
    const updated = await DbService.updateTrainingSession(session.id, {
      executionLog: finalLog,
      playerNotes: playerNotes as Record<string, string> | undefined,
      postNotes: postNotes === undefined ? undefined : text(postNotes, 8000) || null,
      isExecuted: complete ? true : undefined
    });
    res.json({ success: true, session: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save session execution.' });
  }
});
// Creates a draft follow-up session from a session's saved AI assessment. The coach confirms the
// date, title, duration and drills (catalogue drills plus any AI-recommended drills, which are saved
// to the club catalogue). The new session keeps the same squad, players and coaching team and stays
// unpublished so the club can review it in the planner.
coachRouter.post('/sessions/:id/follow-up', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const source = await findAssignedSession(req);
    if (!source) {
      res.status(404).json({ error: 'Session not found or not assigned to you.' });
      return;
    }
    const evaluation = isRecord(source.aiEvaluation) ? source.aiEvaluation : null;
    if (!evaluation || !isRecord(evaluation.followUpPlan)) {
      res.status(400).json({ error: 'Run the AI analysis for this session before creating a follow-up session.' });
      return;
    }

    const { title, sessionDate, durationMinutes, drillIds, recommendedDrillIndexes } = req.body || {};
    const cleanTitle = text(title, 200).trim();
    const earliestLocalDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!cleanTitle) {
      res.status(400).json({ error: 'A title is required.' });
      return;
    }
    if (typeof sessionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || sessionDate < earliestLocalDate) {
      res.status(400).json({ error: 'Choose a valid date from today onwards.' });
      return;
    }
    if (
      (drillIds !== undefined && (!Array.isArray(drillIds) || drillIds.some(id => typeof id !== 'string'))) ||
      (recommendedDrillIndexes !== undefined && (!Array.isArray(recommendedDrillIndexes) || recommendedDrillIndexes.some(index => !Number.isInteger(index))))
    ) {
      res.status(400).json({ error: 'drillIds must be drill IDs and recommendedDrillIndexes must be integers.' });
      return;
    }

    const requestedIds: string[] = Array.from(new Set((drillIds || []) as string[])).slice(0, 20);
    const catalogueDrills = requestedIds.length
      ? await prisma.drill.findMany({
        where: { id: { in: requestedIds }, OR: [{ source: { not: 'CLUB_CUSTOM' } }, { clubId: req.user!.tenantId }] },
        select: { id: true }
      })
      : [];
    if (catalogueDrills.length !== requestedIds.length) {
      res.status(400).json({ error: 'One or more drills are not in your catalogue.' });
      return;
    }

    const recommended = Array.isArray(evaluation.tailoredRecommendedDrills) ? evaluation.tailoredRecommendedDrills : [];
    const indexes: number[] = Array.from(new Set((recommendedDrillIndexes || []) as number[]));
    if (indexes.some(index => index < 0 || index >= recommended.length || !isRecord(recommended[index]))) {
      res.status(400).json({ error: 'Unknown AI-recommended drill.' });
      return;
    }
    if (!requestedIds.length && !indexes.length) {
      res.status(400).json({ error: 'Select at least one drill for the follow-up session.' });
      return;
    }

    const tenant = await prisma.customerTenant.findUnique({ where: { id: req.user!.tenantId } });
    const createdDrills = [];
    for (const index of indexes) {
      const item = recommended[index] as Record<string, unknown>;
      createdDrills.push(await DbService.createDrill({
        id: `drill-club-${Date.now()}-${index}`,
        title: text(item.title, 200) || 'AI recommended drill',
        discipline: DISCIPLINES.includes(item.discipline as string) ? item.discipline : 'BATTING',
        skillSet: 'Post-session follow-up',
        contextType: item.context === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'GROUP',
        duration: minutes(item.durationMinutes) || 15,
        source: 'CLUB_CUSTOM',
        clubId: req.user!.tenantId,
        clubName: tenant?.name || null,
        squadId: source.squadId,
        squadName: source.squadName,
        instructions: text(item.reason, 4000) || 'AI-recommended follow-up drill.'
      }));
    }

    const allDrillIds = [...requestedIds, ...createdDrills.map(drill => drill.id)];
    const session = await DbService.createTrainingSession({
      id: `sess-${Date.now()}`,
      clubId: source.clubId,
      squadId: source.squadId,
      squadName: source.squadName,
      coachId: source.coachId,
      coachName: source.coachName,
      coordinatorCoachId: source.coordinatorCoachId,
      coordinatorCoachName: source.coordinatorCoachName,
      assistantCoachId: source.assistantCoachId,
      assistantCoachName: source.assistantCoachName,
      assignedPlayerIds: Array.isArray(source.assignedPlayerIds) ? source.assignedPlayerIds : [],
      title: cleanTitle,
      sessionDate,
      durationMinutes: minutes(durationMinutes) || source.durationMinutes,
      safety: source.safety,
      drillIds: allDrillIds,
      drillCount: allDrillIds.length,
      isPublished: false
    });
    res.status(201).json({ success: true, session: { ...session, clubId: source.clubId }, drills: createdDrills });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create follow-up session.' });
  }
});
