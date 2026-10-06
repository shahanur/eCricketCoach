import { Router, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { DbService } from '../services/dbService.js';

const workspaceKinds = new Set([
  'GOAL',
  'PROGRESS_NOTE',
  'MESSAGE',
  'ATTENDANCE',
  'COLLABORATION',
  'AI_FEEDBACK',
  'FEATURE_IDEA',
  'NOTIFICATION'
]);

function serializeItem(item: any) {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

export const coachRouter = Router();

coachRouter.use(authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  if (req.user?.role !== 'COACH' || req.user.coachContext !== 'CLUB') {
    res.status(403).json({ error: 'Club coach access required.' });
    return;
  }
  const member = await prisma.clubMemberStore.findFirst({
    where: {
      id: req.user.userId,
      clubId: req.user.tenantId,
      role: 'COACH',
      invitationStatus: 'ACTIVE'
    }
  });
  if (!member) {
    res.status(403).json({ error: 'Active club coach membership required.' });
    return;
  }
  next();
});

coachRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  const [members, allSessions, items] = await Promise.all([
    DbService.getClubMembers(req.user!.tenantId),
    DbService.getTrainingSessions(req.user!.tenantId),
    prisma.coachWorkspaceItem.findMany({
      where: { tenantId: req.user!.tenantId, coachId: req.user!.userId },
      orderBy: { updatedAt: 'desc' }
    })
  ]);
  const coach = members.find(member => member.id === req.user!.userId && member.role === 'COACH');
  const sessions = allSessions.filter(session =>
    session.coachId === req.user!.userId || (coach?.name && session.coachName === coach.name)
  );

  res.json({
    players: members.filter(member => member.role === 'PLAYER'),
    sessions,
    items: items.map(serializeItem)
  });
});

coachRouter.get('/workspace', async (req: AuthenticatedRequest, res: Response) => {
  const items = await prisma.coachWorkspaceItem.findMany({
    where: {
      tenantId: req.user!.tenantId,
      coachId: req.user!.userId,
      ...(typeof req.query.kind === 'string' ? { kind: req.query.kind } : {})
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json(items.map(serializeItem));
});

coachRouter.post('/workspace', async (req: AuthenticatedRequest, res: Response) => {
  const { kind, sessionId, playerId, title, content, status, progress, metadata } = req.body;
  if (!workspaceKinds.has(kind) || typeof title !== 'string' || !title.trim()) {
    res.status(400).json({ error: 'A valid kind and title are required.' });
    return;
  }
  if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
    res.status(400).json({ error: 'progress must be an integer from 0 to 100.' });
    return;
  }
  if (metadata !== undefined && (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))) {
    res.status(400).json({ error: 'metadata must be an object.' });
    return;
  }

  const item = await prisma.coachWorkspaceItem.create({
    data: {
      tenantId: req.user!.tenantId,
      coachId: req.user!.userId,
      kind,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      playerId: typeof playerId === 'string' ? playerId : null,
      title: title.trim(),
      content: typeof content === 'string' ? content.trim() : null,
      status: typeof status === 'string' ? status : 'ACTIVE',
      progress: progress ?? null,
      metadata: metadata || {}
    }
  });
  res.status(201).json(serializeItem(item));
});

coachRouter.patch('/workspace/:id', async (req: AuthenticatedRequest, res: Response) => {
  const existing = await prisma.coachWorkspaceItem.findFirst({
    where: { id: req.params.id, tenantId: req.user!.tenantId, coachId: req.user!.userId }
  });
  if (!existing) {
    res.status(404).json({ error: 'Coach workspace item not found.' });
    return;
  }

  const { title, content, status, progress, metadata } = req.body;
  if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
    res.status(400).json({ error: 'progress must be an integer from 0 to 100.' });
    return;
  }
  if (metadata !== undefined && (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))) {
    res.status(400).json({ error: 'metadata must be an object.' });
    return;
  }

  const item = await prisma.coachWorkspaceItem.update({
    where: { id: existing.id },
    data: {
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      content: typeof content === 'string' ? content.trim() : undefined,
      status: typeof status === 'string' ? status : undefined,
      progress: progress === null || Number.isInteger(progress) ? progress : undefined,
      metadata: metadata || undefined
    }
  });
  res.json(serializeItem(item));
});

coachRouter.delete('/workspace/:id', async (req: AuthenticatedRequest, res: Response) => {
  const result = await prisma.coachWorkspaceItem.deleteMany({
    where: { id: req.params.id, tenantId: req.user!.tenantId, coachId: req.user!.userId }
  });
  if (result.count === 0) {
    res.status(404).json({ error: 'Coach workspace item not found.' });
    return;
  }
  res.status(204).send();
});