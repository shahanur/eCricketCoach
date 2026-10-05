import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { ClubMember, Squad, TrainingSession, Certificate } from '../types/index.js';
import { AiAnalysisService } from '../services/aiAnalysisService.js';

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

clubRouter.post('/members/invite', async (req: Request, res: Response) => {
  try {
    const { name, email, role, ageGroup, discipline, clubId, squad } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    const newMember: ClubMember = {
      id: 'mem-' + Date.now(),
      clubId: clubId || 'ten-003',
      name,
      email,
      role,
      ageGroup: ageGroup || 'U15',
      discipline: discipline || 'BATTING',
      invitationStatus: 'PENDING_ACCEPTANCE',
      currentLevel: 'FOUNDATION',
      squad: squad || 'Unassigned'
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
    const { name, ageGroup, discipline, coachId, coachName, memberIds, clubId } = req.body;
    const newSquad: Squad = {
      id: 'sq-' + Date.now(),
      clubId: clubId || 'ten-003',
      name,
      ageGroup,
      discipline,
      coachId: coachId || 'mem-2',
      coachName: coachName || 'Shane Bond',
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
    const { memberCount, name, coachName, ageGroup, discipline } = req.body;
    const updated = await DbService.updateSquad(id, { memberCount, name, coachName, ageGroup, discipline });
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
    const { title, squadId, squadName, sessionDate, durationMinutes, drills, drillIds, clubId } = req.body;
    const newSession: TrainingSession = {
      id: 'sess-' + Date.now(),
      clubId: clubId || 'ten-003',
      coachId: 'mem-2',
      coachName: 'Shane Bond',
      squadId,
      squadName: squadName || 'U15 Squad',
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
    const { title, squadName, sessionDate, durationMinutes } = req.body;
    const updated = await DbService.updateTrainingSession(id, { title, squadName, sessionDate, durationMinutes });
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
