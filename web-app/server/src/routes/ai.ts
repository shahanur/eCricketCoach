import { Router, Request, Response } from 'express';
import { AiAnalysisService } from '../services/aiAnalysisService.js';

export const aiRouter = Router();

aiRouter.post('/analyze', async (req: Request, res: Response) => {
  const { videoUrl, discipline } = req.body;
  if (!discipline) {
    return res.status(400).json({ error: 'Discipline is required (BATTING, BOWLING, KEEPING, FIELDING)' });
  }

  const analysis = await AiAnalysisService.analyzeVideoClip(
    videoUrl || 'mock_video.mp4',
    discipline
  );

  return res.json({
    status: 'COMPLETED',
    discipline,
    analysis
  });
});
