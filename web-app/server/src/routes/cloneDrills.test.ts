import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { DbService } from '../services/dbService.js';
import { drillsRouter } from './drills.js';

test('club staff can clone global drills into their own club only', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'clone-drill-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const clone = t.mock.method(DbService, 'cloneGlobalDrill', async (id: string, clubId: string) =>
    id === 'global' ? { id: 'clone-1', title: 'Shared drill', source: 'CLUB_CUSTOM', clubId } : null
  );
  const app = express();
  app.use(express.json());
  app.use('/api/drills', drillsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const post = (id: string, claims?: Record<string, string>) => fetch(
    `http://127.0.0.1:${address.port}/api/drills/${id}/clone`,
    {
      method: 'POST',
      headers: claims ? { Authorization: `Bearer ${jwt.sign({ userId: 'user-1', email: 'u@example.com', ...claims }, process.env.JWT_SECRET!)}` } : {}
    }
  );

  assert.equal((await post('global')).status, 401);
  assert.equal((await post('global', { role: 'PLAYER', tenantId: 'club-one' })).status, 403);
  assert.equal((await post('global', { role: 'SUPER_ADMIN', tenantId: 'platform' })).status, 403);
  assert.equal((await post('global', { role: 'COACH', coachContext: 'STANDALONE', tenantId: 'coach-1' })).status, 403);
  assert.equal(clone.mock.callCount(), 0);

  const saved = await post('global', { role: 'CLUB_ADMIN', tenantId: 'club-one' });
  assert.equal(saved.status, 201);
  const body = await saved.json();
  assert.equal(body.drill.clubId, 'club-one');
  assert.equal(body.drill.source, 'CLUB_CUSTOM');
  assert.deepEqual(clone.mock.calls[0].arguments, ['global', 'club-one']);

  assert.equal((await post('global', { role: 'COACH', coachContext: 'CLUB', tenantId: 'club-two' })).status, 201);
  assert.deepEqual(clone.mock.calls[1].arguments, ['global', 'club-two']);
  assert.equal((await post('club-drill', { role: 'CLUB_ADMIN', tenantId: 'club-one' })).status, 404);
});

test('only super admins can delete global drills; club staff delete only their own club drills', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'delete-drill-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const scopes: Record<string, { source: string; clubId: string | null }> = {
    global: { source: 'SYSTEM_PREDEFINED', clubId: null },
    'club-drill': { source: 'CLUB_CUSTOM', clubId: 'club-one' }
  };
  t.mock.method(DbService, 'getDrillEditScope', async (id: string) => scopes[id] || null);
  const remove = t.mock.method(DbService, 'deleteDrill', async () => true);
  const app = express();
  app.use(express.json());
  app.use('/api/drills', drillsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const del = (id: string, claims?: Record<string, string>) => fetch(
    `http://127.0.0.1:${address.port}/api/drills/${id}`,
    {
      method: 'DELETE',
      headers: claims ? { Authorization: `Bearer ${jwt.sign({ userId: 'user-1', email: 'u@example.com', ...claims }, process.env.JWT_SECRET!)}` } : {}
    }
  );

  assert.equal((await del('global')).status, 401);
  assert.equal((await del('global', { role: 'CLUB_ADMIN', tenantId: 'club-one' })).status, 403);
  assert.equal((await del('club-drill', { role: 'CLUB_ADMIN', tenantId: 'club-two' })).status, 403);
  assert.equal((await del('global', { role: 'PLAYER', tenantId: 'club-one' })).status, 403);
  assert.equal(remove.mock.callCount(), 0);

  assert.equal((await del('missing', { role: 'SUPER_ADMIN', tenantId: 'platform' })).status, 404);
  assert.equal((await del('global', { role: 'SUPER_ADMIN', tenantId: 'platform' })).status, 200);
  assert.deepEqual(remove.mock.calls[0].arguments, ['global']);
  assert.equal((await del('club-drill', { role: 'COACH', coachContext: 'CLUB', tenantId: 'club-one' })).status, 200);
  assert.deepEqual(remove.mock.calls[1].arguments, ['club-drill']);
});
