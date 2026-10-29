import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

import { getPlayerDashboard } from './playerDashboard.js';
import { PlayerProfileError } from './playerProfile.js';

test('dashboard fixture ownership, gating and empty states against PostgreSQL', {
  skip: !process.env.PLAYER_DASHBOARD_TEST_DATABASE_URL,
}, async t => {
  const client = new PrismaClient({ datasources: { db: { url: process.env.PLAYER_DASHBOARD_TEST_DATABASE_URL! } } });
  const suffix = randomUUID();
  const tenantId = `dashboard-test-${suffix}`;
  const secondId = `dashboard-other-${suffix}`;
  const email = `${suffix}@example.test`;
  t.after(async () => {
    await client.customerTenant.deleteMany({ where: { id: { in: [tenantId, secondId] } } });
    await client.$disconnect();
  });
  for (const [id, address] of [[tenantId, email], [secondId, `other-${email}`]]) {
    await client.customerTenant.create({ data: {
      id, email: address, name: 'Test Player', type: 'INDIVIDUAL', status: 'ACTIVE',
      subscriptionPlan: 'INDIVIDUAL', billingCycle: 'MONTHLY', joinedAt: '2026-10-28',
    } });
  }
  const owner = { userId: suffix, tenantId, email, role: 'PLAYER' as const };
  const env = { NODE_ENV: 'test' };
  const empty = { source: 'NONE', progress: null, focus: null, notification: null };
  assert.deepEqual(await getPlayerDashboard(owner, client, env), empty);
  await client.playerDashboardDemo.create({ data: {
    tenantId, ownerEmail: email, progressPercent: 72, stage: 'Developing Player',
    focusTitle: 'Front Foot Drive Drill', focusDiscipline: 'Batting', focusMinutes: 15,
    focusDescription: 'Sample drill', notification: 'Sample notification',
  } });
  const dashboard = await getPlayerDashboard(owner, client, env);
  assert.equal(dashboard.source, 'DEVELOPMENT_SEED');
  assert.deepEqual(dashboard.progress, { percent: 72, stage: 'Developing Player' });
  assert.equal(dashboard.focus?.minutes, 15);
  assert.deepEqual(await getPlayerDashboard(owner, client, { NODE_ENV: 'production' }), empty);
  assert.deepEqual(await getPlayerDashboard(owner, client, {}), empty);
  assert.deepEqual(await getPlayerDashboard({ ...owner, tenantId: secondId, email: `other-${email}` }, client, env), empty);
  for (const invalid of [
    { ...owner, email: `other-${email}` },
    { ...owner, tenantId: secondId },
    { ...owner, role: 'CLUB_ADMIN' as const },
  ]) await assert.rejects(getPlayerDashboard(invalid, client, env),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 403);
  await client.playerDashboardDemo.update({ where: { tenantId }, data: { ownerEmail: `wrong-${email}` } });
  await assert.rejects(getPlayerDashboard(owner, client, env),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 403);
  await client.customerTenant.update({ where: { id: tenantId }, data: { status: 'PENDING' } });
  await assert.rejects(getPlayerDashboard(owner, client, env),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 403);
  await client.customerTenant.update({ where: { id: tenantId }, data: { status: 'EXPIRED' } });
  await assert.rejects(getPlayerDashboard(owner, client, env),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 403);
});
