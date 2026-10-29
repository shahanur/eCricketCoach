import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';

import { AuthenticatedRequest, AuthenticatedUser } from '../middleware/auth.js';
import { getPlayerProfile, PlayerProfileError, updatePlayerProfile } from '../services/playerProfile.js';
import { getPlayerDashboard } from '../services/playerDashboard.js';
import { getPlayerRoadmap, saveRoadmapAnswers, generatePlayerRoadmap, completeRoadmapDrill } from '../services/playerRoadmap.js';
import { PlayerSubscriptionError } from '../services/playerDevelopmentSubscription.js';

export const playerProfileRouter = Router();

function getPlayerSession(req: AuthenticatedRequest, res: Response): AuthenticatedUser | null {
  res.setHeader('Cache-Control', 'no-store');
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
  if (!bearer) {
    res.status(401).json({ error: 'Access token required.', code: 'SESSION_REQUIRED' });
    return null;
  }
  try {
    const claims = jwt.verify(bearer[1], process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production', {
      algorithms: ['HS256'],
    });
    if (typeof claims === 'string' || typeof claims.userId !== 'string' ||
        typeof claims.email !== 'string' || typeof claims.tenantId !== 'string' ||
        claims.role !== 'PLAYER') {
      res.status(403).json({ error: 'An individual player account is required.', code: 'INDIVIDUAL_PLAYER_REQUIRED' });
      return null;
    }
    return {
      userId: claims.userId,
      tenantId: claims.tenantId,
      role: 'PLAYER',
      email: claims.email,
    };
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.', code: 'SESSION_INVALID' });
    return null;
  }
}

function sendProfileError(error: unknown, res: Response) {
  if (error instanceof PlayerProfileError || error instanceof PlayerSubscriptionError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error('Player profile request failed:', error);
  res.status(500).json({ error: 'Unable to complete your request right now.', code: 'PROFILE_FAILED' });
}

playerProfileRouter.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const user = getPlayerSession(req, res);
  if (!user) return;
  try {
    res.json({ profile: await getPlayerProfile(user) });
  } catch (error) {
    sendProfileError(error, res);
  }
});

playerProfileRouter.get('/roadmap', async (req: AuthenticatedRequest, res: Response) => {
  const user = getPlayerSession(req, res);
  if (!user) return;
  try {
    res.json({ roadmap: await getPlayerRoadmap(user) });
  } catch (error) { sendProfileError(error, res); }
});

for (const [path, action] of [
  ['/roadmap/answers', saveRoadmapAnswers],
  ['/roadmap/generate', generatePlayerRoadmap],
  ['/roadmap/practice', completeRoadmapDrill],
] as const) {
  playerProfileRouter.post(path, async (req: AuthenticatedRequest, res: Response) => {
    const user = getPlayerSession(req, res);
    if (!user) return;
    try {
      res.json({ roadmap: await action(user, req.body) });
    } catch (error) { sendProfileError(error, res); }
  });
}

playerProfileRouter.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  const user = getPlayerSession(req, res);
  if (!user) return;
  try {
    res.json({ dashboard: await getPlayerDashboard(user) });
  } catch (error) {
    if (error instanceof PlayerProfileError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }
    console.error('Player dashboard request failed:', error);
    res.status(500).json({ error: 'Unable to load your dashboard right now.', code: 'DASHBOARD_FAILED' });
  }
});

playerProfileRouter.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  const user = getPlayerSession(req, res);
  if (!user) return;
  try {
    res.json({ profile: await updatePlayerProfile(user, req.body) });
  } catch (error) {
    sendProfileError(error, res);
  }
});
