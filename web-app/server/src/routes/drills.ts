import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { DrillItem } from '../types/index.js';
import { Readable } from 'node:stream';
import { DrillImageValidationError } from '../services/drillImage.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const drillsRouter = Router();

drillsRouter.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const image = await DbService.getDrillImage(req.params.id);
    if (!image) return res.status(404).json({ error: 'Drill image not found' });
    res.set({
      'Content-Type': image.mimeType,
      'Content-Length': String(image.data.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = Readable.from([image.data]);
    stream.on('error', error => {
      console.error('Unable to stream drill image:', error);
      res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Unable to load drill image:', error);
    return res.status(500).json({ error: 'Unable to load drill image.' });
  }
});

// List drills with filters
drillsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const context = req.query.context as string | undefined;
    const discipline = req.query.discipline as string | undefined;
    const source = req.query.source as string | undefined;
    const clubId = req.query.clubId as string | undefined;

    const drills = await DbService.getDrills({ context, discipline, source, clubId });
    res.json(drills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// System Admin: Add Pre-defined Official eCricketCoach Drill
drillsRouter.post('/admin', async (req: Request, res: Response) => {
  try {
    const { title, discipline, skillSet, contextType, ageGroup, difficulty, durationMinutes, duration, instructions, imageUrl } = req.body;
    if (!title || !discipline || !skillSet) {
      return res.status(400).json({ error: 'Title, discipline, and skillSet are required' });
    }

    const newDrill: DrillItem = {
      id: 'drill-sys-' + Date.now(),
      title,
      discipline,
      skillSet,
      contextType: contextType || 'INDIVIDUAL',
      ageGroup: ageGroup || 'ALL',
      difficulty: difficulty || 'INTERMEDIATE',
      durationMinutes: Number(duration || durationMinutes) || 20,
      source: 'SYSTEM_PREDEFINED',
      imageUrl,
      instructions: instructions || 'Official eCricketCoach pre-defined technical drill.'
    };

    const saved = await DbService.createDrill(newDrill);
    return res.status(201).json({ success: true, drill: saved });
  } catch (err: any) {
    if (err instanceof DrillImageValidationError) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Coaches / Club Admin: Add Custom Drill for their Club
drillsRouter.post('/club', async (req: Request, res: Response) => {
  try {
    const { title, discipline, skillSet, contextType, ageGroup, difficulty, durationMinutes, duration, instructions, clubId, clubName, squadId, squadName, imageUrl } = req.body;
    if (!title || !discipline || !skillSet) {
      return res.status(400).json({ error: 'Title, discipline, and skillSet are required' });
    }

    const newDrill: DrillItem = {
      id: 'drill-club-' + Date.now(),
      title,
      discipline,
      skillSet,
      contextType: contextType || 'INDIVIDUAL',
      ageGroup: ageGroup || 'U15',
      difficulty: difficulty || 'INTERMEDIATE',
      durationMinutes: Number(duration || durationMinutes) || 20,
      source: 'CLUB_CUSTOM',
      imageUrl,
      clubId: clubId || 'ten-003',
      clubName: clubName || 'Marylebone Cricket Club Academy',
      squadId: squadId || null,
      squadName: squadName || null,
      instructions: instructions || 'Custom drill tailored by club coaching staff.'
    };

    const saved = await DbService.createDrill(newDrill);
    return res.status(201).json({ success: true, drill: saved });
  } catch (err: any) {
    if (err instanceof DrillImageValidationError) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Removes a drill (e.g. club custom drill no longer needed) from the catalogue.
drillsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await DbService.deleteDrill(id);
    if (!deleted) return res.status(404).json({ error: 'Drill not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Edit an existing drill's details, including its setup instructions and setup reference image.
drillsRouter.patch('/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'CLUB_ADMIN', 'COACH']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await DbService.getDrillEditScope(id);
    if (!existing) return res.status(404).json({ error: 'Drill not found' });
    if (req.user?.role !== 'SUPER_ADMIN' && (
      existing.source === 'SYSTEM_PREDEFINED' || !existing.clubId || existing.clubId !== req.user?.tenantId
    )) {
      return res.status(403).json({ error: 'Only super admins can edit global drills. Club drills can only be edited by their own club.' });
    }
    const { title, discipline, skillSet, contextType, durationMinutes, duration, instructions, imageUrl } = req.body;
    const updated = await DbService.updateDrill(id, {
      title,
      discipline,
      skillSet,
      contextType,
      duration: duration !== undefined || durationMinutes !== undefined ? Number(duration || durationMinutes) : undefined,
      instructions,
      imageUrl
    });
    if (!updated) return res.status(404).json({ error: 'Drill not found' });
    return res.json({ success: true, drill: updated });
  } catch (err: any) {
    if (err instanceof DrillImageValidationError) return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
});
