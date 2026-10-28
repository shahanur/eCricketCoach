import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { adminRouter } from './admin.js';
import { playerSubscriptionRouter } from './playerSubscription.js';
import { subscriptionsRouter } from './subscriptions.js';
import { approveDevelopmentPlayer, getPlayerSubscription, renewDevelopmentPlayer } from '../services/playerDevelopmentSubscription.js';

test('player approval, subscription ownership, expiry and renewal against PostgreSQL', {
  skip: !process.env.PLAYER_SUBSCRIPTION_TEST_DATABASE_URL,
}, async t => {
  // Only an explicitly supplied disposable database may be modified by this test.
  const client = new PrismaClient({
    datasources: { db: { url: process.env.PLAYER_SUBSCRIPTION_TEST_DATABASE_URL! } },
  });
  const originalEnv = ['NODE_ENV', 'PLAYER_DEVELOPMENT_SUBSCRIPTIONS', 'JWT_SECRET', 'ADMIN_EMAILS'].map(key =>
    [key, process.env[key]] as const);
  process.env.NODE_ENV = 'test';
  process.env.PLAYER_DEVELOPMENT_SUBSCRIPTIONS = 'true';
  process.env.JWT_SECRET = 'player-subscription-test-secret';
  process.env.ADMIN_EMAILS = 'admin@example.test';
  t.after(async () => {
    await client.$disconnect();
    await prisma.$disconnect();
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const approval = (id: string, email = `${id}@example.test`, type = 'INDIVIDUAL') => client.clubApproval.create({
    data: {
      id, clubName: `Player ${id}`, adminName: `Player ${id}`, adminEmail: email,
      plan: 'INDIVIDUAL (Monthly)', amountPaid: 14.99, type,
      billingCycle: 'MONTHLY', status: 'AWAITING_APPROVAL', createdAt: '2026-10-28',
    },
  });
  const now = new Date('2026-01-31T16:00:00.000Z');
  await approval('period-player');
  const activated = await approveDevelopmentPlayer('period-player', client, now);
  const owner = {
    role: 'PLAYER' as const, tenantId: activated.customer.id,
    userId: 'oauth-google-owner', email: 'period-player@example.test',
  };
  assert.equal(activated.subscription.status, 'ACTIVE');
  assert.equal(activated.customer.type, 'INDIVIDUAL');
  assert.equal(activated.customer.mrr, 0);
  assert.equal(activated.subscription.paymentVerified, false);
  assert.deepEqual(activated.subscription.capabilities, { purchase: false, restorePurchases: false, analysis: false });
  assert.equal(activated.subscription.period?.endsAt, '2026-02-28T16:00:00.000Z');
  assert.equal(await client.clubMember.count({ where: { clubId: owner.tenantId } }), 0);

  const repeated = await Promise.all(Array.from({ length: 5 }, () =>
    approveDevelopmentPlayer('period-player', client, new Date('2026-02-01T12:00:00Z'))));
  assert.ok(repeated.every(value => value.customer.id === owner.tenantId));
  assert.ok(repeated.every(value => value.subscription.period?.startsAt === now.toISOString()));
  assert.equal(await client.customerTenant.count({ where: { email: owner.email } }), 1);
  assert.equal(await client.playerDevelopmentSubscription.count({ where: { ownerEmail: owner.email } }), 1);
  assert.equal(await client.adminNotification.count({ where: { id: 'player-activated-period-player' } }), 1);

  await approval('same-owner', owner.email.toUpperCase());
  const sameOwner = await approveDevelopmentPlayer('same-owner', client, now);
  assert.equal(sameOwner.customer.id, owner.tenantId);
  assert.equal(await client.playerDevelopmentSubscription.count({ where: { ownerEmail: owner.email } }), 1);
  assert.equal((await getPlayerSubscription({ ...owner, userId: 'oauth-apple-owner' }, client, now)).status, 'ACTIVE');
  await assert.rejects(getPlayerSubscription({ ...owner, email: 'other@example.test' }, client, now), { status: 403 });
  await assert.rejects(getPlayerSubscription({ ...owner, role: 'COACH' }, client, now), { status: 403 });

  const end = new Date(activated.subscription.period!.endsAt);
  assert.equal((await getPlayerSubscription(owner, client, new Date(end.getTime() - 1))).status, 'ACTIVE');
  assert.equal((await getPlayerSubscription(owner, client, end)).status, 'EXPIRED');
  assert.equal((await renewDevelopmentPlayer(owner.tenantId, client, now)).period?.endsAt, end.toISOString());
  const renewals = await Promise.all(Array.from({ length: 5 }, () => renewDevelopmentPlayer(owner.tenantId, client, end)));
  assert.ok(renewals.every(value => value.period?.startsAt === end.toISOString()));
  assert.ok(renewals.every(value => value.period?.endsAt === '2026-03-28T16:00:00.000Z'));

  await client.customerTenant.update({ where: { id: owner.tenantId }, data: { status: 'CANCELED' } });
  assert.equal((await getPlayerSubscription(owner, client, end)).status, 'INACTIVE');
  await assert.rejects(renewDevelopmentPlayer(owner.tenantId, client, end), { status: 404 });
  await client.customerTenant.update({ where: { id: owner.tenantId }, data: { status: 'ACTIVE' } });

  await approval('legacy-approved', 'legacy@example.test');
  await client.clubApproval.update({ where: { id: 'legacy-approved' }, data: { status: 'APPROVED' } });
  await client.customerTenant.create({ data: {
    ...activated.customer, id: 'legacy-tenant', email: 'legacy@example.test', name: 'Legacy player',
  } });
  const legacyOwner = { ...owner, tenantId: 'legacy-tenant', email: 'legacy@example.test' };
  const legacy = await Promise.all(Array.from({ length: 5 }, () => getPlayerSubscription(legacyOwner, client, now)));
  assert.ok(legacy.every(value => value.status === 'ACTIVE'));
  assert.equal(await client.playerDevelopmentSubscription.count({ where: { tenantId: 'legacy-tenant' } }), 1);
  assert.equal((await getPlayerSubscription(legacyOwner, client, end)).status, 'EXPIRED');

  await client.customerTenant.create({ data: {
    ...activated.customer, id: 'pending-tenant', email: 'pending@example.test', name: 'Pending player',
  } });
  await approval('pending', 'pending@example.test');
  const pendingOwner = { ...owner, tenantId: 'pending-tenant', email: 'pending@example.test' };
  assert.equal((await getPlayerSubscription(pendingOwner, client, now)).status, 'INACTIVE');
  await client.clubApproval.update({ where: { id: 'pending' }, data: { status: 'REJECTED' } });
  await assert.rejects(approveDevelopmentPlayer('pending', client, now), { status: 409 });
  assert.equal(await client.playerDevelopmentSubscription.count({ where: { tenantId: 'pending-tenant' } }), 0);

  process.env.NODE_ENV = 'production';
  assert.equal((await getPlayerSubscription(owner, client, now)).status, 'UNAVAILABLE');
  await assert.rejects(approveDevelopmentPlayer('period-player', client, now), { status: 503 });
  await assert.rejects(renewDevelopmentPlayer(owner.tenantId, client, now), { status: 503 });
  process.env.NODE_ENV = 'test';

  // The singleton used by HTTP handlers must target the same explicitly isolated test database.
  assert.equal(process.env.DATABASE_URL, process.env.PLAYER_SUBSCRIPTION_TEST_DATABASE_URL);
  const { authRouter, createSocialSession } = await import('./auth.js');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use('/api/player', playerSubscriptionRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const token = (claims: object, expiresIn = 3600) => jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn });
  const headers = (authToken: string) => ({ Authorization: `Bearer ${authToken}` });
  const adminHeaders = headers(token({ userId: 'admin', role: 'SUPER_ADMIN', tenantId: 'system-admin', email: 'admin@example.test' }));
  const registrationUrl = `${base}/api/subscriptions/checkout`;
  const invoiceCountBeforeRegistration = await client.invoice.count();
  const registrationBody = { planId: 'INDIVIDUAL', billingCycle: 'MONTHLY', name: 'HTTP Player', email: 'http-player@example.test' };
  const register = (body: object) => fetch(registrationUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await register({ ...registrationBody, planId: 'UNKNOWN' })).status, 400);
  assert.equal((await register({ ...registrationBody, billingCycle: 'UNKNOWN' })).status, 400);
  assert.equal((await register({ ...registrationBody, cardNumber: 'test-card' })).status, 400);
  assert.equal((await register({ ...registrationBody, cardNumber: null })).status, 400);
  assert.equal((await register({ ...registrationBody, billingCycle: 'ANNUAL' })).status, 400);
  assert.equal((await register({ ...registrationBody, email: 'invalid' })).status, 400);
  assert.equal((await register({ ...registrationBody, registrationToken: 'invalid' })).status, 401);
  const registration = await register(registrationBody);
  assert.equal(registration.status, 201);
  const submitted = await registration.json() as { data: { approval: { id: string; amountPaid: number }; invoice: null } };
  assert.equal(submitted.data.invoice, null);
  assert.equal(submitted.data.approval.amountPaid, 0);
  const retries = await Promise.all(Array.from({ length: 5 }, () => register(registrationBody)));
  const retryBodies = await Promise.all(retries.map(response => response.json())) as Array<typeof submitted>;
  assert.ok(retryBodies.every(value => value.data.approval.id === submitted.data.approval.id));
  assert.equal(await client.clubApproval.count({ where: { adminEmail: registrationBody.email } }), 1);
  assert.equal(await client.invoice.count(), invoiceCountBeforeRegistration);
  assert.equal(await client.customerTenant.count({ where: { email: registrationBody.email } }), 0);
  const pendingSession = await createSocialSession('google', { sub: 'http-player', email: registrationBody.email, email_verified: true });
  assert.equal(pendingSession.kind, 'registration');
  const path = `${base}/api/admin/club-approvals/${submitted.data.approval.id}/approve`;
  assert.equal((await fetch(path, { method: 'POST' })).status, 401);
  assert.equal((await fetch(path, { method: 'POST', headers: headers(token(owner)) })).status, 403);
  const response = await fetch(path, { method: 'POST', headers: adminHeaders });
  assert.equal(response.status, 200);
  const session = await createSocialSession('google', { sub: 'http-player', email: 'http-player@example.test', email_verified: true });
  assert.equal(session.kind, 'session');
  if (session.kind !== 'session') throw new Error('Expected approved player session.');
  assert.equal(session.user.role, 'PLAYER');
  const access = await fetch(`${base}/api/auth/player-access`, { headers: headers(session.authToken) });
  assert.equal((await access.json() as { access: string }).access, 'ACTIVE');
  const statusUrl = `${base}/api/player/subscription`;
  const status = await fetch(`${statusUrl}?tenantId=${owner.tenantId}&playerId=someone-else`, { headers: headers(session.authToken) });
  assert.equal(status.status, 200);
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.equal((await status.json() as { status: string }).status, 'ACTIVE');
  for (const [authToken, expected] of [
    [undefined, 401], ['invalid', 401], [token(owner, -1), 401],
    [token({ ...owner, email: 'other@example.test' }), 403],
    [token({ ...owner, role: 'CLUB_ADMIN' }), 403],
  ] as const) {
    assert.equal((await fetch(statusUrl, { headers: authToken ? headers(authToken) : {} })).status, expected);
  }
  const renewUrl = `${base}/api/admin/customers/${owner.tenantId}/renew-player-subscription`;
  assert.equal((await fetch(renewUrl, { method: 'POST' })).status, 401);
  assert.equal((await fetch(renewUrl, { method: 'POST', headers: headers(session.authToken) })).status, 403);
  assert.equal((await fetch(renewUrl, { method: 'POST', headers: adminHeaders })).status, 200);
  process.env.NODE_ENV = 'production';
  assert.equal((await register({ ...registrationBody, email: 'blocked@example.test' })).status, 503);
  assert.equal((await fetch(renewUrl, { method: 'POST', headers: adminHeaders })).status, 503);
  const productionStatus = await fetch(statusUrl, { headers: headers(session.authToken) });
  assert.equal((await productionStatus.json() as { status: string }).status, 'UNAVAILABLE');
  process.env.NODE_ENV = 'test';

  // Shared club/academy provisioning retains its existing plan, role and price.
  await approval('club-regression', 'club@example.test', 'CLUB');
  const clubResponse = await fetch(`${base}/api/admin/club-approvals/club-regression/approve`, { method: 'POST', headers: adminHeaders });
  assert.equal(clubResponse.status, 200);
  const club = await clubResponse.json() as { customer: { id: string; type: string; subscriptionPlan: string; mrr: number } };
  assert.equal(club.customer.type, 'CLUB');
  assert.equal(club.customer.subscriptionPlan, 'CLUB_ACADEMY');
  assert.equal(club.customer.mrr, 199.99);
  assert.equal(await client.playerDevelopmentSubscription.count({ where: { tenantId: club.customer.id } }), 0);
  const clubSession = await createSocialSession('google', { sub: 'club', email: 'club@example.test', email_verified: true });
  assert.equal(clubSession.kind, 'session');
  if (clubSession.kind !== 'session') throw new Error('Expected club session.');
  assert.equal(clubSession.user.role, 'CLUB_ADMIN');
  assert.equal((await fetch(statusUrl, { headers: headers(clubSession.authToken) })).status, 403);
  process.env.NODE_ENV = 'production';
  for (const [planId, expectedType, expectedAmount] of [
    ['CLUB_ACADEMY', 'CLUB', 1999.99],
    ['COACH_PRO', 'COACH', 499.99],
  ] as const) {
    const checkout = await register({
      ...registrationBody, planId, billingCycle: 'ANNUAL', email: `${planId.toLowerCase()}@example.test`,
    });
    assert.equal(checkout.status, 201);
    const result = await checkout.json() as { data: { approval: { type: string }; invoice: { amount: number; status: string; currency: string } } };
    assert.equal(result.data.approval.type, expectedType);
    assert.equal(result.data.invoice.amount, expectedAmount);
    assert.equal(result.data.invoice.currency, 'GBP');
    assert.equal(result.data.invoice.status, 'PAID');
  }
});
