import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import { playerProfileRouter } from './playerProfile.js';

test('player profile HTTP routes reject unauthenticated, expired and non-player sessions', async t => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'player-profile-route-test-secret';
  const app = express();
  app.use(express.json());
  app.use('/api/player', playerProfileRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    return new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/player/profile`;
  const token = (claims: object, expiresIn = 3600) =>
    jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn });
  const headers = (bearer: string) => ({ Authorization: `Bearer ${bearer}` });

  const missing = await fetch(url);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  assert.equal((await missing.json() as { code: string }).code, 'SESSION_REQUIRED');
  assert.equal((await fetch(url, { headers: headers('invalid-token') })).status, 401);
  assert.equal((await fetch(url, {
    headers: headers(token({ userId: 'player', tenantId: 'tenant', role: 'PLAYER', email: 'p@example.test' }, -1)),
  })).status, 401);
  assert.equal((await fetch(url, {
    headers: headers(token({ userId: 'club', tenantId: 'tenant', role: 'CLUB_ADMIN', email: 'p@example.test' })),
  })).status, 403);

  const invalidUpdate = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(token({ userId: 'player', tenantId: 'tenant', role: 'PLAYER', email: 'p@example.test' })), 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'Not allowed to set role', role: 'CLUB_ADMIN' }),
  });
  assert.equal(invalidUpdate.status, 400);
  assert.equal((await invalidUpdate.json() as { code: string }).code, 'INVALID_PROFILE');
});
