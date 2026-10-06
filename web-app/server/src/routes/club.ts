import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { ClubMember, Squad, TrainingSession, Certificate } from '../types/index.js';
import { AiAnalysisService } from '../services/aiAnalysisService.js';
import { prisma } from '../config/prisma.js';

export const clubRouter = Router();

async function resolveSquadCoachAssignments(
  clubId: string,
  coachId: string,
  coordinatorCoachId?: string | null,
  assistantCoachId?: string | null
) {
  const selectedIds = [coachId, coordinatorCoachId, assistantCoachId].filter((id): id is string => Boolean(id));
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new Error('Head coach, coordinator, and assistant coach must be different active coaches.');
  }

  const coaches = await prisma.clubMemberStore.findMany({
    where: {
      id: { in: selectedIds },
      clubId,
      role: 'COACH',
      invitationStatus: 'ACTIVE'
    }
  });
  if (coaches.length !== selectedIds.length) {
    throw new Error('Every squad coaching assignment must be an active coach in this club.');
  }

  const byId = new Map(coaches.map(coach => [coach.id, coach]));
  return {
    coachId,
    coachName: byId.get(coachId)!.name,
    coordinatorCoachId: coordinatorCoachId || null,
    coordinatorCoachName: coordinatorCoachId ? byId.get(coordinatorCoachId)!.name : null,
    assistantCoachId: assistantCoachId || null,
    assistantCoachName: assistantCoachId ? byId.get(assistantCoachId)!.name : null
  };
}

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

clubRouter.post('/members/invite', async (req: Request, res: Response) => {
  try {
    const { name, email, role, ageGroup, discipline, currentLevel, clubId, squad } = req.body;
    if (!name || !email || !role || !clubId) {
      return res.status(400).json({ error: 'Name, email, role, and clubId are required' });
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

clubRouter.post('/members/:id/accept-invitation', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await DbService.updateClubMember(id, { invitationStatus: 'ACTIVE' });
    if (!updated) return res.status(404).json({ error: 'Member not found' });
    return res.json({ success: true, message: `${updated.name} accepted the invitation!`, member: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

clubRouter.patch('/members/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { squad, currentLevel, invitationStatus, name, email, role, ageGroup, discipline } = req.body;
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
    const { name, ageGroup, discipline, coachId, coordinatorCoachId, assistantCoachId, memberIds, clubId } = req.body;
    if (!name || !clubId || !coachId) {
      return res.status(400).json({ error: 'Squad name, clubId, and an active head coach are required.' });
    }
    let coachAssignments;
    try {
      coachAssignments = await resolveSquadCoachAssignments(clubId, coachId, coordinatorCoachId, assistantCoachId);
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid squad coach assignments.' });
    }
    const newSquad: Squad = {
      id: 'sq-' + Date.now(),
      clubId,
      name,
      ageGroup,
      discipline,
      ...coachAssignments,
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
    const { memberCount, name, coachId, coordinatorCoachId, assistantCoachId, ageGroup, discipline } = req.body;
    const existing = await prisma.squadStore.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Squad not found' });
    const resolvedCoachId = coachId ?? existing.coachId;
    if (!existing.clubId || !resolvedCoachId) {
      return res.status(400).json({ error: 'An active head coach from this club is required.' });
    }
    let coachAssignments;
    try {
      coachAssignments = await resolveSquadCoachAssignments(
        existing.clubId,
        resolvedCoachId,
        coordinatorCoachId !== undefined ? coordinatorCoachId : existing.coordinatorCoachId,
        assistantCoachId !== undefined ? assistantCoachId : existing.assistantCoachId
      );
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid squad coach assignments.' });
    }
    const updated = await DbService.updateSquad(id, { memberCount, name, ...coachAssignments, ageGroup, discipline });
    if (!updated) return res.status(404).json({ error: 'Squad not found' });
    return res.json({ success: true, squad: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

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
    const newSession: TrainingSession = {
      id: 'sess-' + Date.now(),
      clubId: clubId || 'ten-003',
      squadId,
      squadName: squadName || 'U15 Squad',
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
    const { title, squadName, coachId, coachName, coordinatorCoachId, coordinatorCoachName, assistantCoachId, assistantCoachName, assignedPlayerIds, sessionDate, durationMinutes, isExecuted, playerNotes } = req.body;
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
    const updated = await DbService.updateTrainingSession(id, {
      title,
      squadName,
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
clubRouter.post('/sessions/:id/post-notes-ai-assess', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, context } = req.body;

    const aiResult = await AiAnalysisService.evaluateSessionNotes(
      notes || '',
      'BATTING',
      context || 'GROUP'
    );

    const updated = await DbService.updateSessionNotesAndEvaluation(id, notes || '', aiResult);
    if (!updated) return res.status(404).json({ error: 'Session not found' });

    return res.json({ success: true, aiResult, session: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Certificate Generation & Progress Assessment
clubRouter.get('/certificates', async (_req: Request, res: Response) => {
  try {
    const certs = await DbService.getCertificates();
    res.json(certs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

clubRouter.post('/players/:id/assess-progress', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, newLevel, coachNotes, aiCommendation, playerName, discipline } = req.body;

    if (action === 'PROMOTE') {
      const updatedMember = await DbService.updateClubMember(id, { currentLevel: newLevel || 'ADVANCED' });

      const newCert: Certificate = {
        id: 'cert-' + Date.now(),
        certificateNumber: 'ECC-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
        playerId: id,
        playerName: updatedMember?.name || playerName || 'Player',
        discipline: updatedMember?.discipline || discipline || 'BATTING',
        achievedLevel: newLevel || 'ADVANCED',
        issuedDate: new Date().toISOString().split('T')[0],
        coachName: 'Shane Bond',
        coachNotes: coachNotes || 'Passed all stage milestones with high distinction.',
        aiCommendation: aiCommendation || 'Kinematic posture and consistency rating: 89/100.'
      };

      const savedCert = await DbService.createCertificate(newCert);
      return res.json({
        success: true,
        message: `${newCert.playerName} promoted to ${newCert.achievedLevel}!`,
        certificate: savedCert,
        member: updatedMember
      });
    }

    return res.json({ success: true, message: `Player retained at current stage for focused skill consolidation.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
