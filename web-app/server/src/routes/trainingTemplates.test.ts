import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Drill, Prisma, TrainingSessionTemplate } from '@prisma/client';
import { DbService } from '../services/dbService.js';
import { trainingTemplatesRouter } from './trainingTemplates.js';

const drills: Drill[] = ['drill-one', 'drill-two'].map(id => ({
  id,
  title: id,
  discipline: 'BATTING',
  skillSet: 'Controlled batting',
  contextType: 'GROUP',
  duration: 20,
  source: 'SYSTEM_PREDEFINED',
  clubId: null,
  clubName: null,
  squadId: null,
  squadName: null,
  instructions: 'Practise controlled shots.',
  imageUrl: null
}));
const templates: TrainingSessionTemplate[] = [{
  id: 'template-one',
  title: 'Batting practice',
  activityName: 'Controlled batting',
  disciplines: ['BATTING'],
  focus: 'Balance and control',
  organization: 'Rotate through two stations.',
  safety: ['Use protective gear.'],
  durationMinutes: 40,
  drillIds: drills.map(drill => drill.id)
}];
const catalogue = { drills, templates };

test('shared templates return all linked system drills in template order, excluding club-owned drills', async t => {
  const findDrills = t.mock.fn(async (_args: Prisma.DrillFindManyArgs) =>
    catalogue.drills.map(drill => ({ ...drill, imageUrl: null })).reverse()
  );
  const templates = await DbService.getTrainingSessionTemplates({
    trainingSessionTemplate: { findMany: async () => catalogue.templates },
    drill: { findMany: findDrills }
  });
  assert.equal(templates.length, catalogue.templates.length);
  assert.equal(findDrills.mock.callCount(), 1);
  assert.deepEqual(findDrills.mock.calls[0].arguments[0], {
    where: {
      id: { in: catalogue.templates.flatMap(template => template.drillIds) },
      source: 'SYSTEM_PREDEFINED',
      clubId: null
    }
  });
  for (const template of templates) {
    assert.deepEqual(template.drills.map(drill => drill.id), template.drillIds);
    assert.ok(template.drills.every(drill => drill.source === 'SYSTEM_PREDEFINED' && drill.clubId === null));
  }
});

test('missing shared drills produce an explicit error instead of a partial template', async () => {
  await assert.rejects(DbService.getTrainingSessionTemplates({
    trainingSessionTemplate: { findMany: async () => catalogue.templates },
    drill: { findMany: async () => [] }
  }), /references a missing system drill/);
});

test('template endpoint permits admins and all coaches, rejects players and anonymous users, and surfaces failures', async t => {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'training-template-api-test-secret';
  t.after(() => {
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  });
  const load = t.mock.method(DbService, 'getTrainingSessionTemplates', async () => catalogue.templates);
  const app = express();
  app.use('/api/training-templates', trainingTemplatesRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/training-templates`;
  assert.equal((await fetch(url)).status, 401);
  for (const user of [
    { role: 'SUPER_ADMIN' },
    { role: 'CLUB_ADMIN', tenantId: 'club-one' },
    { role: 'CLUB_ADMIN', tenantId: 'club-two' },
    { role: 'COACH', coachContext: 'CLUB', tenantId: 'club-one' },
    { role: 'COACH', coachContext: 'STANDALONE' }
  ]) {
    const token: string = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1m' });
    const response: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), catalogue.templates);
  }
  const playerToken = jwt.sign({ role: 'PLAYER' }, process.env.JWT_SECRET);
  assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${playerToken}` } })).status, 403);
  assert.equal(load.mock.callCount(), 5);
  load.mock.mockImplementation(async () => { throw new Error('Database unavailable'); });
  const log = t.mock.method(console, 'error', () => {});
  const adminToken = jwt.sign({ role: 'CLUB_ADMIN' }, process.env.JWT_SECRET);
  const failure = await fetch(url, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: 'Unable to load shared training templates.' });
  assert.equal(log.mock.callCount(), 1);
});
