import { PrismaClient } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { AuthenticatedUser } from '../middleware/auth.js';
import { getPlayerProfile, PlayerProfileError } from './playerProfile.js';

export async function getPlayerDashboard(
  user: AuthenticatedUser,
  client: PrismaClient = prisma,
  env: NodeJS.ProcessEnv = process.env,
) {
  await getPlayerProfile(user, client);
  const empty = { source: 'NONE' as const, progress: null, focus: null, notification: null };
  // Demo records never become assessed progress, even if copied to a production database.
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') return empty;
  const demo = await client.playerDashboardDemo.findUnique({ where: { tenantId: user.tenantId } });
  if (!demo) return empty;
  if (demo.ownerEmail !== user.email.trim().toLowerCase()) {
    throw new PlayerProfileError(403, 'DASHBOARD_OWNER_MISMATCH', 'This dashboard is not available to this account.');
  }
  if (!Number.isInteger(demo.progressPercent) || demo.progressPercent < 0 || demo.progressPercent > 100 ||
      !Number.isInteger(demo.focusMinutes) || demo.focusMinutes < 1 || demo.focusMinutes > 180 ||
      !demo.stage.trim() || !demo.focusTitle.trim() || !demo.focusDiscipline.trim() ||
      !demo.focusDescription.trim() || !demo.notification.trim()) {
    throw new PlayerProfileError(500, 'INVALID_DASHBOARD', 'Unable to load your dashboard right now.');
  }
  return {
    source: 'DEVELOPMENT_SEED' as const,
    progress: { percent: demo.progressPercent, stage: demo.stage },
    focus: {
      title: demo.focusTitle,
      discipline: demo.focusDiscipline,
      minutes: demo.focusMinutes,
      description: demo.focusDescription,
    },
    notification: demo.notification,
  };
}
