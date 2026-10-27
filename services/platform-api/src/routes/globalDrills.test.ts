import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { DbService } from '../services/dbService.js';
import { drillsRouter } from './drills.js';

test('global edits require a super admin and update the original shared drill', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'global-drill-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  t.mock.method(DbService, 'getDrillEditScope', async (id: string) =>
    id === 'missing' ? null : {
      source: id === 'global' ? 'SYSTEM_PREDEFINED' : 'CLUB_CUSTOM',
      clubId: id === 'global' ? null : 'club-one'
    }
  );
  const update = t.mock.method(DbService, 'updateDrill', async (id: string, updates: { title?: string }) => ({
    id, title: updates.title, source: 'SYSTEM_PREDEFINED', clubId: null
  }));
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
  const patch = (id: string, role?: string, tenantId = 'club-one') => fetch(
    `http://127.0.0.1:${address.port}/api/drills/${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(role ? { Authorization: `Bearer ${jwt.sign({ role, tenantId }, process.env.JWT_SECRET!)}` } : {})
      },
      body: JSON.stringify({ title: 'Updated shared drill' })
    }
  );
  assert.equal((await patch('global')).status, 401);
  for (const role of ['PLAYER', 'CLUB_ADMIN', 'COACH']) {
    assert.equal((await patch('global', role)).status, 403);
  }
  assert.equal(update.mock.callCount(), 0);
  const saved = await patch('global', 'SUPER_ADMIN');
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.drill.id, 'global');
  assert.equal(body.drill.title, 'Updated shared drill');
  assert.equal(body.drill.clubId, null);
  assert.equal((await patch('local', 'CLUB_ADMIN')).status, 200);
  assert.equal((await patch('local', 'COACH', 'club-two')).status, 403);
  assert.equal((await patch('missing', 'SUPER_ADMIN')).status, 404);
});
