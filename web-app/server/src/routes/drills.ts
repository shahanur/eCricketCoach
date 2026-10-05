import { Router, Request, Response } from 'express';
import { DbService } from '../services/dbService.js';
import { DrillItem } from '../types/index.js';

export const drillsRouter = Router();

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
    const { title, discipline, skillSet, contextType, ageGroup, difficulty, durationMinutes, duration, instructions } = req.body;
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
      instructions: instructions || 'Official eCricketCoach pre-defined technical drill.'
    };

    const saved = await DbService.createDrill(newDrill);
    return res.status(201).json({ success: true, drill: saved });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Coaches / Club Admin: Add Custom Drill for their Club
drillsRouter.post('/club', async (req: Request, res: Response) => {
  try {
    const { title, discipline, skillSet, contextType, ageGroup, difficulty, durationMinutes, duration, instructions, clubId, clubName, squadId, squadName } = req.body;
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
      clubId: clubId || 'ten-003',
      clubName: clubName || 'Marylebone Cricket Club Academy',
      squadId: squadId || null,
      squadName: squadName || null,
      instructions: instructions || 'Custom drill tailored by club coaching staff.'
    };

    const saved = await DbService.createDrill(newDrill);
    return res.status(201).json({ success: true, drill: saved });
  } catch (err: any) {
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
drillsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
    return res.status(500).json({ error: err.message });
  }
});


