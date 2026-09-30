import { Router, Request, Response } from 'express';
import { mockClubMembers, mockSquads, mockSessions, mockCertificates } from '../data/mockStore.js';
import { ClubMember, Squad, TrainingSession, Certificate } from '../types/index.js';
import { AiAnalysisService } from '../services/aiAnalysisService.js';

export const clubRouter = Router();

// 1. Club Admin: Members & Invitations (Coaches & Players)
clubRouter.get('/members', (_req: Request, res: Response) => {
  res.json(mockClubMembers);
});

clubRouter.post('/members/invite', (req: Request, res: Response) => {
  const { name, email, role, ageGroup, discipline } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  const newMember: ClubMember = {
    id: 'mem-' + Date.now(),
    clubId: 'ten-003',
    name,
    email,
    role,
    ageGroup: ageGroup || 'U15',
    discipline: discipline || 'BATTING',
    invitationStatus: 'PENDING_ACCEPTANCE',
    currentLevel: 'FOUNDATION'
  };

  mockClubMembers.push(newMember);
  return res.json({ success: true, message: `Invitation sent to ${email}`, member: newMember });
});

clubRouter.post('/members/:id/accept-invitation', (req: Request, res: Response) => {
  const { id } = req.params;
  const member = mockClubMembers.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  member.invitationStatus = 'ACTIVE';
  return res.json({ success: true, message: `${member.name} accepted the invitation!`, member });
});

// 2. Coaches: Squads Management
clubRouter.get('/squads', (_req: Request, res: Response) => {
  res.json(mockSquads);
});

clubRouter.post('/squads', (req: Request, res: Response) => {
  const { name, ageGroup, discipline, coachId, coachName, memberIds } = req.body;
  const newSquad: Squad = {
    id: 'sq-' + Date.now(),
    clubId: 'ten-003',
    name,
    ageGroup,
    discipline,
    coachId: coachId || 'mem-2',
    coachName: coachName || 'Shane Bond',
    memberIds: memberIds || []
  };
  mockSquads.push(newSquad);
  return res.json({ success: true, squad: newSquad });
});

// 3. Coaches: Session-Based Training Plans & Publishing
clubRouter.get('/sessions', (_req: Request, res: Response) => {
  res.json(mockSessions);
});

clubRouter.post('/sessions', (req: Request, res: Response) => {
  const { title, squadId, squadName, sessionDate, durationMinutes, drills } = req.body;
  const newSession: TrainingSession = {
    id: 'sess-' + Date.now(),
    clubId: 'ten-003',
    coachId: 'mem-2',
    coachName: 'Shane Bond',
    squadId,
    squadName,
    title,
    sessionDate,
    durationMinutes: durationMinutes || 90,
    drills: drills || [],
    isPublished: false
  };
  mockSessions.push(newSession);
  return res.json({ success: true, session: newSession });
});

clubRouter.post('/sessions/:id/publish', (req: Request, res: Response) => {
  const { id } = req.params;
  const sess = mockSessions.find(s => s.id === id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  sess.isPublished = true;
  sess.publishedAt = new Date().toISOString();
  return res.json({
    success: true,
    message: `Training session "${sess.title}" published! Squad players have been notified.`,
    session: sess
  });
});

// 4. Post-Session Notes, AI Assessment & Tailored Drills Top-Up
clubRouter.post('/sessions/:id/post-notes-ai-assess', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes, context } = req.body;
  const sess = mockSessions.find(s => s.id === id);
  if (!sess) return res.status(404).json({ error: 'Session not found' });

  sess.postSessionNotes = notes;
  const aiResult = await AiAnalysisService.evaluateSessionNotes(
    notes || '',
    'BATTING',
    context || 'GROUP'
  );

  sess.aiAssessment = aiResult;
  return res.json({ success: true, aiResult, session: sess });
});

// 5. Google Drive Video Upload & AI Analysis Simulation
clubRouter.post('/players/:id/upload-drive-video', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { discipline, fileName, googleDriveFolder } = req.body;
  const member = mockClubMembers.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Player not found' });

  const aiAnalysis = await AiAnalysisService.analyzeVideoClip(
    fileName || 'player_action.mp4',
    discipline || member.discipline as any
  );

  return res.json({
    success: true,
    googleDriveStatus: 'SAVED_TO_GOOGLE_DRIVE',
    googleDrivePath: googleDriveFolder || `/eCricketCoach/Clubs/MelbourneCricketAcademy/${member.name}/${discipline}`,
    fileId: 'gdrive_file_' + Date.now(),
    aiAnalysis
  });
});

// 6. Assessments, Level Promotion & Certificate Generation
clubRouter.get('/certificates', (_req: Request, res: Response) => {
  res.json(mockCertificates);
});

clubRouter.post('/players/:id/assess-progress', (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, newLevel, coachNotes, aiCommendation } = req.body;
  const member = mockClubMembers.find(m => m.id === id);
  if (!member) return res.status(404).json({ error: 'Player not found' });

  if (action === 'PROMOTE') {
    member.currentLevel = newLevel || 'ADVANCED';

    const newCert: Certificate = {
      id: 'cert-' + Date.now(),
      certificateNumber: 'ECC-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000),
      playerId: member.id,
      playerName: member.name,
      discipline: member.discipline,
      achievedLevel: member.currentLevel,
      issuedDate: new Date().toISOString().split('T')[0],
      coachName: 'Shane Bond',
      coachNotes: coachNotes || 'Passed all stage milestones with high distinction.',
      aiCommendation: aiCommendation || 'Kinematic posture and consistency rating: 89/100.'
    };

    mockCertificates.unshift(newCert);
    return res.json({ success: true, message: `${member.name} promoted to ${member.currentLevel}!`, certificate: newCert });
  }

  return res.json({ success: true, message: `${member.name} retained at current stage for focused skill consolidation.` });
});
