import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';

test('native Google challenges and shared social sessions preserve web authorization', async t => {
  const envKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'JWT_SECRET', 'ADMIN_EMAILS'] as const;
  const originalEnv = envKeys.map(key => [key, process.env[key]] as const);
  t.after(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.GOOGLE_CLIENT_ID = 'test-web-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  process.env.JWT_SECRET = 'native-google-test-secret';
  process.env.ADMIN_EMAILS = 'admin@example.com';
  const { authRouter, createSocialSession } = await import('./auth.js');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/auth`;
  const response = await fetch(`${base}/google/native`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const challenge = await response.json() as { clientId: string; nonce: string; challenge: string };
  assert.equal(challenge.clientId, 'test-web-client');
  const state = jwt.verify(challenge.challenge, process.env.JWT_SECRET);
  assert.ok(typeof state !== 'string');
  assert.equal(state.nonce, challenge.nonce);
  assert.equal(state.type, 'google-native');
  assert.equal(state.exp! - state.iat!, 300);
  for (const [body, status] of [
    [{}, 400],
    [{ idToken: 123, challenge: challenge.challenge }, 400],
    [{ idToken: 'invalid', challenge: 'tampered' }, 401],
    [{ idToken: 'invalid', challenge: jwt.sign({ type: 'registration', nonce: challenge.nonce }, process.env.JWT_SECRET) }, 401],
    [{ idToken: 'invalid', challenge: jwt.sign({ type: 'google-native', nonce: challenge.nonce }, process.env.JWT_SECRET, { expiresIn: -1 }) }, 401]
  ] as const) {
    const invalid = await fetch(`${base}/google/native`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(invalid.status, status);
  }
  const admin = await createSocialSession('google', { sub: '123', email: 'ADMIN@example.com', email_verified: true, name: 'Admin' });
  assert.equal(admin.kind, 'session');
  if (admin.kind !== 'session') throw new Error('Missing admin session.');
  assert.equal(admin.user.role, 'SUPER_ADMIN');
  assert.equal(admin.user.tenantId, 'system-admin');
  const claims = jwt.verify(admin.authToken, process.env.JWT_SECRET);
  assert.ok(typeof claims !== 'string');
  assert.equal(claims.exp! - claims.iat!, 8 * 3600);
  assert.equal(claims.userId, 'oauth-google-123');
  assert.deepEqual(admin.redirectFields, { name: 'Admin', email: 'admin@example.com', role: 'SUPER_ADMIN' });
  assert.equal((await createSocialSession('google', { sub: '123', email: 'admin@example.com', email_verified: false })).kind, 'invalid');
  const tenant = { id: 'club-one', name: 'Club One', type: 'CLUB', status: 'ACTIVE', email: 'owner@example.com' };
  const originals = [
    { target: prisma.customerTenant, method: 'findFirst', value: prisma.customerTenant.findFirst },
    { target: prisma.customerTenant, method: 'findUnique', value: prisma.customerTenant.findUnique },
    { target: prisma.clubMember, method: 'findFirst', value: prisma.clubMember.findFirst }
  ];
  t.after(() => {
    for (const { target, method, value } of originals) Reflect.set(target, method, value);
  });
  Reflect.set(prisma.customerTenant, 'findFirst', t.mock.fn(async () => null));
  Reflect.set(prisma.customerTenant, 'findUnique', t.mock.fn(async () => tenant));
  let member: { id: string; clubId: string; role: string } | null = { id: 'member-one', clubId: tenant.id, role: 'COACH' };
  const findMember = t.mock.fn(async () => member);
  Reflect.set(prisma.clubMember, 'findFirst', findMember);
  const coach = await createSocialSession('google', { sub: '456', email: 'coach@example.com', email_verified: true, name: 'Coach' });
  assert.equal(coach.kind, 'session');
  if (coach.kind !== 'session') throw new Error('Missing coach session.');
  assert.equal(coach.user.userId, 'member-one');
  assert.equal(coach.user.role, 'COACH');
  assert.ok('coachContext' in coach.user);
  assert.equal(coach.user.coachContext, 'CLUB');
  assert.equal(coach.user.tenantId, tenant.id);
  assert.ok('tenantId' in coach.redirectFields);
  assert.equal(coach.redirectFields.tenantId, tenant.id);
  assert.deepEqual(findMember.mock.calls[0].arguments, [{
    where: {
      email: { equals: 'coach@example.com', mode: 'insensitive' },
      invitationStatus: 'ACTIVE', role: { in: ['COACH', 'PLAYER'] }
    }
  }]);
  tenant.status = 'SUSPENDED';
  assert.equal((await createSocialSession('google', { sub: '456', email: 'coach@example.com', email_verified: true })).kind, 'registration');
  tenant.status = 'ACTIVE';
  member.role = 'PLAYER';
  const player = await createSocialSession('google', { sub: '456', email: 'player@example.com', email_verified: true });
  assert.equal(player.kind, 'session');
  if (player.kind !== 'session') throw new Error('Missing player session.');
  assert.equal(player.user.role, 'PLAYER');
  assert.ok('coachContext' in player.user);
  assert.equal(player.user.coachContext, undefined);
  member = null;
  const registration = await createSocialSession('google', { sub: '789', email: 'new@example.com', email_verified: true });
  assert.equal(registration.kind, 'registration');
  const web = await fetch(`${base}/google?returnTo=/training`, { redirect: 'manual' });
  assert.equal(web.status, 302);
  const location = new URL(web.headers.get('location')!);
  assert.ok(location.searchParams.get('redirect_uri')!.endsWith('/api/auth/google/callback'));
  const webState = jwt.verify(location.searchParams.get('state')!, process.env.JWT_SECRET);
  assert.ok(typeof webState !== 'string');
  assert.equal(webState.returnTo, '/training');
  for (const [returnTo, expected] of [
    ['ecricketcoach://auth/callback', 'ecricketcoach://auth/callback'],
    ['ecricketcoach-player://auth/callback', 'ecricketcoach-player://auth/callback'],
    ['attacker://auth/callback', '/']
  ] as const) {
    const redirect = await fetch(
      `${base}/google?returnTo=${encodeURIComponent(returnTo)}`,
      { redirect: 'manual' }
    );
    assert.equal(redirect.status, 302);
    const authorizationUrl = new URL(redirect.headers.get('location')!);
    const returnState: string | jwt.JwtPayload = jwt.verify(authorizationUrl.searchParams.get('state')!, process.env.JWT_SECRET);
    assert.ok(typeof returnState !== 'string');
    assert.equal(returnState.returnTo, expected);
  }
});

test('player access is derived from the verified session and the caller-owned individual tenant', async t => {
  const secret = 'native-google-test-secret';
  const originalSecret = process.env.JWT_SECRET;
  t.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });
  process.env.JWT_SECRET = secret;
  const { authRouter } = await import('./auth.js');
  const app = express();
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/auth/player-access`;

  const tenants: Record<string, { id: string; name: string; type: string; status: string; email: string }> = {
    'ind-1': { id: 'ind-1', name: 'Asha Patel', type: 'INDIVIDUAL', status: 'ACTIVE', email: 'asha@example.com' },
    'ind-trial': { id: 'ind-trial', name: 'Trial Player', type: 'INDIVIDUAL', status: 'TRIAL', email: 'trial@example.com' },
    'ind-suspended': { id: 'ind-suspended', name: 'Lapsed', type: 'INDIVIDUAL', status: 'SUSPENDED', email: 'lapsed@example.com' },
    'club-1': { id: 'club-1', name: 'Club One', type: 'CLUB', status: 'ACTIVE', email: 'owner@example.com' }
  };
  const originalFindUnique = prisma.customerTenant.findUnique;
  t.after(() => Reflect.set(prisma.customerTenant, 'findUnique', originalFindUnique));
  const findUnique = t.mock.fn(async ({ where }: { where: { id: string } }) => tenants[where.id] ?? null);
  Reflect.set(prisma.customerTenant, 'findUnique', findUnique);

  const check = async (headers: Record<string, string>) => {
    const response = await fetch(url, { headers });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  const bearer = (claims: object, options: jwt.SignOptions = { expiresIn: '8h' }, key = secret) =>
    ({ Authorization: `Bearer ${jwt.sign(claims, key, options)}` });

  assert.equal((await check({})).status, 401);
  assert.equal((await check({ Authorization: 'Bearer not-a-token' })).status, 401);
  assert.equal((await check(bearer({ userId: 'u', tenantId: 'ind-1', role: 'PLAYER', email: 'asha@example.com' }, {}, 'wrong-secret'))).status, 401);
  assert.equal((await check(bearer({ userId: 'u', tenantId: 'ind-1', role: 'PLAYER', email: 'asha@example.com' }, { expiresIn: -1 }))).status, 401);
  assert.equal((await check(bearer({ userId: 'u', role: 'PLAYER', email: 'asha@example.com' }))).status, 401);

  assert.deepEqual(
    await check(bearer({ userId: 'oauth-google-1', tenantId: 'ind-1', role: 'PLAYER', email: 'ASHA@example.com' })),
    { status: 200, body: { access: 'ACTIVE', email: 'asha@example.com', displayName: 'Asha Patel' } }
  );
  assert.equal((await check(bearer({ userId: 'u', tenantId: 'ind-trial', role: 'PLAYER', email: 'trial@example.com' }))).body.access, 'ACTIVE');

  for (const claims of [
    { userId: 'u', tenantId: 'ind-suspended', role: 'PLAYER', email: 'lapsed@example.com' },
    { userId: 'member-1', tenantId: 'club-1', role: 'PLAYER', email: 'member@example.com' },
    { userId: 'u', tenantId: 'ind-1', role: 'PLAYER', email: 'someone-else@example.com' },
    { userId: 'u', tenantId: 'ind-1', role: 'COACH', email: 'asha@example.com' },
    { userId: 'u', tenantId: 'system-admin', role: 'SUPER_ADMIN', email: 'admin@example.com' },
    { userId: 'u', tenantId: 'missing', role: 'PLAYER', email: 'asha@example.com' }
  ]) {
    const result = await check(bearer(claims));
    assert.equal(result.status, 200);
    assert.equal(result.body.access, 'UNAVAILABLE', JSON.stringify(claims));
    assert.equal(result.body.displayName, null);
  }
  assert.ok(findUnique.mock.calls.every(call => ['ind-1', 'ind-trial', 'ind-suspended', 'club-1', 'missing'].includes(call.arguments[0].where.id)));

  Reflect.set(prisma.customerTenant, 'findUnique', t.mock.fn(async () => { throw new Error('db down'); }));
  t.mock.method(console, 'error', () => undefined);
  assert.equal((await check(bearer({ userId: 'u', tenantId: 'ind-1', role: 'PLAYER', email: 'asha@example.com' }))).status, 500);
});
