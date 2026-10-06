import { Router, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { DbService } from '../services/dbService.js';

export const coachRouter = Router();

coachRouter.use(authenticateToken, async (req: AuthenticatedRequest, res: Response, next) => {
  if (req.user?.role !== 'COACH' || req.user.coachContext !== 'CLUB') {
    res.status(403).json({ error: 'Club coach access required.' });
    return;
  }
  const member = await prisma.clubMember.findFirst({
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