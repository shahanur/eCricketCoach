import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { DbService } from '../services/dbService.js';

export const trainingTemplatesRouter = Router();

trainingTemplatesRouter.get(
  '/',
  authenticateToken,
  requireRole(['SUPER_ADMIN', 'CLUB_ADMIN', 'COACH']),
  async (_req, res) => {
    try {
      res.json(await DbService.getTrainingSessionTemplates());
    } catch (error) {
      console.error('Unable to load shared training templates:', error);
      res.status(500).json({ error: 'Unable to load shared training templates.' });
    }
  }
);
