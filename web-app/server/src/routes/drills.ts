import { Router, Request, Response } from 'express';
import { mockDrills } from '../data/mockStore.js';
import { DrillItem } from '../types/index.js';

export const drillsRouter = Router();

// List drills with filters
drillsRouter.get('/', (req: Request, res: Response) => {
  const context = req.query.context as string | undefined;
  const discipline = req.query.discipline as string | undefined;
  const source = req.query.source as string | undefined;
  const clubId = req.query.clubId as string | undefined;

  let filtered = [...mockDrills];
  if (context) filtered = filtered.filter(d => d.contextType === context.toUpperCase());
  if (discipline) filtered = filtered.filter(d => d.discipline === discipline.toUpperCase());
  if (source) filtered = filtered.filter(d => d.source === source.toUpperCase());
  if (clubId) {
    filtered = filtered.filter(d => d.source === 'SYSTEM_PREDEFINED' || d.clubId === clubId);
  }

  res.json(filtered);
});

// System Admin: Add Pre-defined Official eCricketCoach Drill
drillsRouter.post('/admin', (req: Request, res: Response) => {
  const { title, discipline, skillSet, contextType, ageGroup, difficulty, durationMinutes, instructions } = req.body;
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
    durationMinutes: Number(durationMinutes) || 20,
    source: 'SYSTEM_PREDEFINED',
    instructions: instructions || 'Official eCricketCoach pre-defined technical drill.'
  };

  mockDrills.unshift(newDrill);
  return res.status(201).json({ success: true, drill: newDrill });
});

// Coaches / Club Admin: Add Custom Drill for their Club
drillsRouter.post('/club', (req: Request, res: Response) => {
  const { title, discipline, skillSet, contextType, ageGroup, difficulty, durationMinutes, instructions, clubId, clubName } = req.body;
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
    durationMinutes: Number(durationMinutes) || 20,
    source: 'CLUB_CUSTOM',
    clubId: clubId || 'ten-003',
    clubName: clubName || 'Melbourne Cricket Academy',
    instructions: instructions || 'Custom drill tailored by club coaching staff.'
  };

  mockDrills.unshift(newDrill);
  return res.status(201).json({ success: true, drill: newDrill });
});
