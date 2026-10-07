import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { ClubMember, Squad, TrainingSession } from '../types/index.js';
import { SessionEvaluationService } from '../services/sessionEvaluationService.js';
import { prisma } from '../config/prisma.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const clubRouter = Router();

// 1. Club Admin: Members & Invitations (Coaches & Players)
clubRouter.get('/members', async (req: Request, res: Response) => {
  try {
    const clubId = req.query.clubId as string | undefined;
    const members = await DbService.getClubMembers(clubId);
    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/members/invite', authenticateToken, requireRole(['CLUB_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, role, ageGroup, discipline, currentLevel, clubId, squad } = req.body;
    if (!name || !email || !role || !clubId) {
      return res.status(400).json({ error: 'Name, email, role, and clubId are required' });
    }
    if (clubId !== req.user!.tenantId) {
      return res.status(403).json({ error: 'You can only invite members to your own club.' });
    }
    if (role !== 'COACH' && role !== 'PLAYER') {
      return res.status(400).json({ error: 'Invited members must be coaches or players.' });
    }
    const coachLevels = ['SUPPORT_COACH', 'FOUNDATION_COACH', 'CORE_COACH', 'ADVANCED_COACH', 'SPECIALIST_COACH'];
    const playerLevels = ['FOUNDATION', 'DEVELOPING', 'INTERMEDIATE', 'ADVANCED', 'ELITE'];
    const validLevels = role === 'COACH' ? coachLevels : playerLevels;
    if (currentLevel !== undefined && !validLevels.includes(currentLevel)) {
      return res.status(400).json({ error: 'Invalid level for the selected role' });
    }

    const newMember: ClubMember = {
      id: 'mem-' + Date.now(),
      clubId,
      name,
      email,
      role,
      ageGroup: role === 'COACH' ? '' : (ageGroup || 'U15'),
      discipline: discipline || 'BATTING',
      invitationStatus: 'PENDING_ACCEPTANCE',
      currentLevel: currentLevel || (role === 'COACH' ? 'SUPPORT_COACH' : 'FOUNDATION'),
      squad: role === 'COACH' ? 'Unassigned' : (squad || 'Unassigned')
    };

    const saved = await DbService.createClubMember(newMember);
    return res.json({ success: true, message: `Invitation sent to ${email}`, member: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/members/:id/accept-invitation', authenticateToken, requireRole(['CLUB_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const member = await prisma.clubMember.findFirst({
      where: { id, clubId: req.user!.tenantId }
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    const updated = await DbService.updateClubMember(id, { invitationStatus: 'ACTIVE' });
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    return res.json({ success: true, message: `${updated.name} accepted the invitation!`, member: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.patch('/members/:id', authenticateToken, requireRole(['CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { squad, currentLevel, invitationStatus, name, email, role, ageGroup, discipline } = req.body;
    if (req.user!.role === 'COACH') {
      if (req.user!.coachContext !== 'CLUB') {
        return res.status(403).json({ error: 'Club coach access required.' });
      }
      const activeCoach = await prisma.clubMember.findFirst({
        where: {
          id: req.user!.userId,
          clubId: req.user!.tenantId,
          role: 'COACH',
          invitationStatus: 'ACTIVE'
        }
      });
      if (!activeCoach) return res.status(403).json({ error: 'Active club coach membership required.' });
      if (invitationStatus !== undefined) {
        return res.status(403).json({ error: 'Only club admins can manage member invitations.' });
      }
    }
    if (role !== undefined && role !== 'COACH' && role !== 'PLAYER') {
      return res.status(400).json({ error: 'Member role must be a coach or player.' });
    }
    const member = await prisma.clubMember.findFirst({
      where: { id, clubId: req.user!.tenantId }
    });
    if (!member) return res.status(404).json({ error: 'Member not found' });
    const updated = await DbService.updateClubMember(id, { squad, currentLevel, invitationStatus, name, email, role, ageGroup, discipline });
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    return res.json({ success: true, member: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Coaches: Squads Management
clubRouter.get('/squads', async (req: Request, res: Response) => {
  try {
    const clubId = req.query.clubId as string | undefined;
    const squads = await DbService.getSquads(clubId);
    res.json(squads);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/squads', async (req: Request, res: Response) => {
  try {
    const { name, ageGroup, discipline, memberIds, clubId } = req.body;
    const disciplines = normalizeSquadDisciplines(discipline);
    if (typeof name !== 'string' || !name.trim() || typeof clubId !== 'string' || !clubId || disciplines.length === 0) {
      return res.status(400).json({ error: 'Squad name, clubId, and at least one valid discipline are required.' });
    }
    const newSquad: Squad = {
      id: 'sq-' + Date.now(),
      clubId,
      name,
      ageGroup,
      discipline: disciplines.join(','),
      memberIds: memberIds || []
    };
    const saved = await DbService.createSquad({
      ...newSquad,
      memberCount: (memberIds || []).length
    });
    return res.json({ success: true, squad: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.patch('/squads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { memberCount, name, ageGroup } = req.body;
    let discipline: string | undefined = req.body.discipline;
    if (discipline !== undefined) {
      const disciplines = normalizeSquadDisciplines(discipline);
      if (disciplines.length === 0) {
        return res.status(400).json({ error: 'Select at least one valid squad discipline.' });
      }
      discipline = disciplines.join(',');
    }
    const existing = await prisma.squad.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Squad not found' });
    const updated = await DbService.updateSquad(id, { memberCount, name, ageGroup, discipline });
    if (!updated) return res.status(404).json({ error: 'Squad not found' });
    return res.json({ success: true, squad: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function normalizeSquadDisciplines(value: unknown): string[] {
  const allowed = new Set(['BATTING', 'BOWLING', 'KEEPING', 'FIELDING']);
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(values
    .filter((discipline): discipline is string => typeof discipline === 'string')
    .map(discipline => discipline.trim().toUpperCase())
    .filter(discipline => allowed.has(discipline)))];
}

// Permanently removes a squad (e.g. formed in error, or no longer needed).
clubRouter.delete('/squads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await DbService.deleteSquad(id);
    if (!deleted) return res.status(404).json({ error: 'Squad not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Coaches: Session-Based Training Plans & Publishing
clubRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const clubId = req.query.clubId as string | undefined;
    const sessions = await DbService.getTrainingSessions(clubId);
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { title, squadId, squadName, coachId, coachName, coordinatorCoachId, coordinatorCoachName, assistantCoachId, assistantCoachName, assignedPlayerIds, sessionDate, durationMinutes, drills, drillIds, clubId } = req.body;
    if (assignedPlayerIds !== undefined && (!Array.isArray(assignedPlayerIds) || assignedPlayerIds.some(id => typeof id !== 'string'))) {
      return res.status(400).json({ error: 'assignedPlayerIds must be an array of player IDs' });
    }
    const sessionClubId = clubId || 'ten-003';
    let resolvedSquadName = squadName;
    if (squadId !== undefined && squadId !== null) {
      if (typeof squadId !== 'string') {
        return res.status(400).json({ error: 'squadId must be a string or null.' });
      }
      const squad = await prisma.squad.findFirst({ where: { id: squadId, clubId: sessionClubId } });
      if (!squad) return res.status(400).json({ error: 'The selected squad does not belong to this club.' });
      resolvedSquadName = squad.name;
    }
    const newSession: TrainingSession = {
      id: 'sess-' + Date.now(),
      clubId: sessionClubId,
      squadId: squadId || null,
      squadName: resolvedSquadName || 'U15 Squad',
      coachId,
      coachName,
      coordinatorCoachId,
      coordinatorCoachName,
      assistantCoachId,
      assistantCoachName,
      assignedPlayerIds: assignedPlayerIds || [],
      title,
      sessionDate,
      durationMinutes: durationMinutes || 90,
      drills: drills || [],
      drillIds: drillIds || [],
      drillCount: Array.isArray(drillIds) ? drillIds.length : 0,
      isPublished: false
    };
    const saved = await DbService.createTrainingSession(newSession);
    return res.json({ success: true, session: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Edit a scheduled (not-yet-published) training session's core details.
clubRouter.patch('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, squadId, squadName, coachId, coachName, coordinatorCoachId, coordinatorCoachName, assistantCoachId, assistantCoachName, assignedPlayerIds, sessionDate, durationMinutes, isExecuted, playerNotes } = req.body;
    if (isExecuted !== undefined && typeof isExecuted !== 'boolean') {
      return res.status(400).json({ error: 'isExecuted must be a boolean' });
    }
    if (
      playerNotes !== undefined &&
      (!playerNotes || typeof playerNotes !== 'object' || Array.isArray(playerNotes) ||
        Object.values(playerNotes).some(note => typeof note !== 'string'))
    ) {
      return res.status(400).json({ error: 'playerNotes must map player IDs to note strings' });
    }
    if (assignedPlayerIds !== undefined && (!Array.isArray(assignedPlayerIds) || assignedPlayerIds.some(id => typeof id !== 'string'))) {
      return res.status(400).json({ error: 'assignedPlayerIds must be an array of player IDs' });
    }
    let resolvedSquadName = squadName;
    if (squadId !== undefined && squadId !== null) {
      if (typeof squadId !== 'string') {
        return res.status(400).json({ error: 'squadId must be a string or null.' });
      }
      const currentSession = await prisma.trainingSession.findUnique({ where: { id } });
      if (!currentSession) return res.status(404).json({ error: 'Session not found' });
      const squad = await prisma.squad.findFirst({ where: { id: squadId, clubId: currentSession.clubId } });
      if (!squad) return res.status(400).json({ error: 'The selected squad does not belong to this club.' });
      resolvedSquadName = squad.name;
    }
    const updated = await DbService.updateTrainingSession(id, {
      title,
      squadId,
      squadName: resolvedSquadName,
      coachId,
      coachName,
      coordinatorCoachId,
      coordinatorCoachName,
      assistantCoachId,
      assistantCoachName,
      assignedPlayerIds,
      sessionDate,
      durationMinutes,
      isExecuted,
      playerNotes
    });
    if (!updated) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true, session: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/sessions/:id/publish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const published = await DbService.publishTrainingSession(id);
    if (!published) return res.status(404).json({ error: 'Session not found' });

    return res.json({
      success: true,
      message: `Training session "${published.title}" published! Squad players have been notified.`,
      session: published
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Permanently removes a scheduled training session (e.g. a draft that was created in error).
clubRouter.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await DbService.deleteTrainingSession(id);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Incorporates a drill into an upcoming training session by appending it to the session's
// drill list (bumping its drill count), so coaches can manually add one or more drills to a
// session, or an AI-adopted drill recommendation is reflected in that squad's training plan.
clubRouter.patch('/sessions/:id/add-drill', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { drillId } = req.body || {};
    const updated = await DbService.incrementSessionDrillCount(id, drillId);
    if (!updated) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true, session: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Removes a single previously-added drill instance from a training session.
clubRouter.patch('/sessions/:id/remove-drill', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { drillId } = req.body || {};
    if (!drillId) return res.status(400).json({ error: 'drillId is required' });
    const updated = await DbService.removeDrillFromSession(id, drillId);
    if (!updated) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true, session: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Post-Session Notes, AI Assessment & Tailored Drills Top-Up
clubRouter.post('/sessions/:id/post-notes-ai-assess', authenticateToken, requireRole(['CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

    const session = await prisma.trainingSession.findUnique({ where: { id }, select: { clubId: true, isExecuted: true } });
    if (!session || session.clubId !== req.user?.tenantId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (!session.isExecuted) {
      return res.status(409).json({ error: 'Complete the session before running the AI analysis.' });
    }

    const aiResult = await SessionEvaluationService.evaluate(id, notes);
    if (!aiResult) {
      return res.status(400).json({ error: 'Add player notes or session observations before running the AI assessment.' });
    }

    const updated = await DbService.updateSessionNotesAndEvaluation(id, undefined, aiResult);
    if (!updated) return res.status(404).json({ error: 'Session not found' });

    return res.json({ success: true, aiResult, session: updated });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('GEMINI_QUOTA_EXCEEDED')) {
      return res.status(429).json({ error: 'The AI assessment quota has been reached. Please try again later.' });
    }
    if (/high demand|overloaded|503 Service Unavailable/i.test(message)) {
      return res.status(503).json({ error: 'The AI service is busy right now. Please try again in a minute.' });
    }
    if (message.includes('not configured')) {
      return res.status(503).json({ error: message });
    }
    return res.status(500).json({ error: message });
  }
});

// 5. Certificate Generation & Progress Assessment
clubRouter.get('/certificates', authenticateToken, requireRole(['SUPER_ADMIN', 'CLUB_ADMIN', 'COACH', 'PLAYER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const where = req.user!.role === 'PLAYER'
      ? { playerId: req.user!.userId }
      : req.user!.role === 'SUPER_ADMIN'
        ? {}
        : { clubId: req.user!.tenantId };
    const certs = await DbService.getCertificates(where);
    res.json(certs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

clubRouter.delete('/certificates/:id', authenticateToken, requireRole(['CLUB_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const certificate = await prisma.certificate.findFirst({
      where: { id: req.params.id, clubId: req.user!.tenantId },
      select: { id: true }
    });
    if (!certificate) return res.status(404).json({ error: 'Certificate not found in your club.' });

    await prisma.certificate.delete({ where: { id: certificate.id } });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.get('/settings/branding', authenticateToken, requireRole(['CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenant = await prisma.customerTenant.findUnique({ where: { id: req.user!.tenantId } });
    if (!tenant || tenant.type !== 'CLUB') return res.status(404).json({ error: 'Club not found' });
    return res.json({ logoUrl: tenant.logoUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.patch('/settings/branding', authenticateToken, requireRole(['CLUB_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { logoUrl } = req.body;
  const imageMatch = typeof logoUrl === 'string'
    ? logoUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/)
    : null;
  const imageBytes = imageMatch ? Buffer.from(imageMatch[2], 'base64') : null;
  const hasValidImageSignature = imageMatch && imageBytes && (
    imageMatch[1] === 'png'
      ? imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
  );
  if (logoUrl !== null && (!imageMatch || !imageBytes || imageBytes.length > 1024 * 1024 || !hasValidImageSignature)) {
    return res.status(400).json({ error: 'Upload a PNG or JPEG club logo smaller than 1 MB.' });
  }

  try {
    const tenant = await prisma.customerTenant.findUnique({ where: { id: req.user!.tenantId } });
    if (!tenant || tenant.type !== 'CLUB') return res.status(404).json({ error: 'Club not found' });
    const updated = await prisma.customerTenant.update({
      where: { id: tenant.id },
      data: { logoUrl }
    });
    return res.json({ logoUrl: updated.logoUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/players/:id/assess-progress', authenticateToken, requireRole(['CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action, newLevel, coachNotes, aiCommendation, coachName } = req.body;

    if (action !== 'PROMOTE' || typeof newLevel !== 'string' || !newLevel.trim()) {
      return res.status(400).json({ error: 'A promotion action and target level are required.' });
    }

    const result = await prisma.$transaction(async transaction => {
      const member = await transaction.clubMember.findUnique({ where: { id } });
      if (!member || member.clubId !== req.user!.tenantId || member.role !== 'PLAYER') return null;

      const tenant = await transaction.customerTenant.findUnique({ where: { id: member.clubId! } });
      const updatedMember = await transaction.clubMember.update({
        where: { id },
        data: { currentLevel: newLevel }
      });

      const certificate = await transaction.certificate.create({
        data: {
          id: `cert-${Date.now()}`,
          certificateNumber: `ECC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          playerId: member.id,
          clubId: member.clubId,
          clubName: tenant?.name || null,
          clubLogo: tenant?.logoUrl || null,
          playerName: member.name,
          discipline: member.discipline,
          achievedLevel: newLevel,
          issuedDate: new Date().toISOString().split('T')[0],
          coachName: typeof coachName === 'string' && coachName.trim() ? coachName.trim() : req.user!.email,
          coachNotes: typeof coachNotes === 'string' ? coachNotes : 'Passed all stage milestones with high distinction.',
          aiCommendation: typeof aiCommendation === 'string' ? aiCommendation : null
        }
      });
      return { member: updatedMember, certificate };
    });

    if (!result) return res.status(404).json({ error: 'Player not found in your club roster.' });
    return res.json({
      success: true,
      message: `${result.member.name} promoted to ${result.certificate.achievedLevel}!`,
      certificate: result.certificate,
      member: result.member
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
