import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthenticatedUser } from '../middleware/auth.js';
import { getPlayerSubscription, PlayerSubscriptionError } from '../services/playerDevelopmentSubscription.js';

export const playerSubscriptionRouter = Router();

export function sendPlayerSubscriptionError(error: unknown, res: Response) {
  if (error instanceof PlayerSubscriptionError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error('Player subscription request failed:', error);
  res.status(500).json({ error: 'Unable to load the player subscription.', code: 'SUBSCRIPTION_FAILED' });
}

playerSubscriptionRouter.get('/subscription', async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const bearer = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '');
  if (!bearer) return res.status(401).json({ error: 'Access token required.' });
  let user: AuthenticatedUser;
  try {
    const claims = jwt.verify(bearer[1], process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production');
    if (typeof claims === 'string' || typeof claims.userId !== 'string' || typeof claims.email !== 'string' ||
      typeof claims.tenantId !== 'string' || claims.role !== 'PLAYER') {
      return res.status(403).json({ error: 'An individual player account is required.' });
    }
    user = { userId: claims.userId, tenantId: claims.tenantId, role: 'PLAYER', email: claims.email };
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
  try {
    return res.json(await getPlayerSubscription(user));
  } catch (error) {
    sendPlayerSubscriptionError(error, res);
  }
});
