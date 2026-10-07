import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { DbService } from '../services/dbService.js';
import { drillsRouter } from './drills.js';
import { DRILL_IMAGE_JSON_LIMIT, MAX_DRILL_IMAGE_BYTES, DrillImageValidationError, drillImageUrl, parseDrillImage } from '../services/drillImage.js';
import { Prisma } from '@prisma/client';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const upload = `data:image/png;base64,${png.toString('base64')}`;

test('creating a drill saves binary image data atomically and returns only its endpoint URL', async t => {
  const create = t.mock.fn(async (_args: Prisma.DrillCreateArgs) => ({
    id: 'binary-drill', title: 'Image drill', discipline: 'BATTING', skillSet: 'Balance',
    contextType: 'GROUP', duration: 20, source: 'CLUB_CUSTOM',
    clubId: null, clubName: null, squadId: null, squadName: null,
    instructions: null, imageUrl: '/api/drills/binary-drill/image'
  }));
  const saved = await DbService.createDrill({
    id: 'binary-drill', title: 'Image drill', discipline: 'BATTING', skillSet: 'Balance',
    contextType: 'GROUP', source: 'CLUB_CUSTOM', imageUrl: upload
  }, { drill: { create } });
  assert.equal(create.mock.callCount(), 1);
  const args = create.mock.calls[0].arguments[0];
  assert.ok(args);
  assert.deepEqual(args.data.image, { create: { data: png, mimeType: 'image/png' } });
  assert.equal(args.data.imageUrl, drillImageUrl('binary-drill', png));
  assert.equal(saved.imageUrl, '/api/drills/binary-drill/image');
  assert.ok(!('image' in saved));
});

test('image parsing preserves bytes and rejects invalid types, encoding, contents, and oversized uploads', () => {
  assert.deepEqual(parseDrillImage(upload), { data: png, mimeType: 'image/png' });
  for (const invalid of [
    'https://example.com/image.png',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,AAAA',
    `data:image/jpeg;base64,${png.toString('base64')}`,
    'data:image/png;base64,abc',
    `data:image/png;base64,${Buffer.alloc(MAX_DRILL_IMAGE_BYTES + 1).toString('base64')}`
  ]) {
    assert.throws(() => parseDrillImage(invalid), DrillImageValidationError);
  }
});

test('drill requests accept exactly 10 MB of image bytes through the JSON parser', async t => {
  const data = Buffer.alloc(MAX_DRILL_IMAGE_BYTES);
  png.copy(data);
  const imageUrl = `data:image/png;base64,${data.toString('base64')}`;
  const create = t.mock.method(DbService, 'createDrill', async (drill: { imageUrl: string }) => {
    assert.equal(parseDrillImage(drill.imageUrl).data.length, MAX_DRILL_IMAGE_BYTES);
    return { id: 'large-image', imageUrl: '/api/drills/large-image/image' };
  });
  const app = express();
  app.use('/api/drills', express.json({ limit: DRILL_IMAGE_JSON_LIMIT }));
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/drills', drillsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/drills/club`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Large image drill', discipline: 'BATTING', skillSet: 'Balance', imageUrl })
  });
  assert.equal(response.status, 201);
  assert.equal(create.mock.callCount(), 1);
});

test('replacing, retaining, and removing drill images use atomic database operations', async t => {
  const update = t.mock.fn(async (args: Prisma.DrillUpdateArgs) => ({
    id: 'binary-drill', title: 'Image drill', discipline: 'BATTING', skillSet: 'Balance',
    contextType: 'GROUP', duration: 20, source: 'CLUB_CUSTOM',
    clubId: null, clubName: null, squadId: null, squadName: null,
    instructions: null, imageUrl: args.data.imageUrl === null ? null : '/api/drills/binary-drill/image'
  }));
  const remove = t.mock.fn(async (_args: Prisma.DrillImageDeleteManyArgs) => ({ count: 1 }));
  const tx = { drill: { update }, drillImage: { deleteMany: remove } };
  const writer = {
    async $transaction<T>(operation: (transaction: typeof tx) => Promise<T>): Promise<T> {
      return operation(tx);
    }
  };
  await DbService.updateDrill('binary-drill', { imageUrl: upload }, writer);
  assert.deepEqual(update.mock.calls[0].arguments[0].data.image, {
    upsert: { create: { data: png, mimeType: 'image/png' }, update: { data: png, mimeType: 'image/png' } }
  });
  await DbService.updateDrill('binary-drill', { imageUrl: '/api/drills/binary-drill/image' }, writer);
  assert.equal(update.mock.calls[1].arguments[0].data.image, undefined);
  assert.equal(remove.mock.callCount(), 0);
  const cleared = await DbService.updateDrill('binary-drill', { imageUrl: null }, writer);
  assert.equal(cleared?.imageUrl, null);
  assert.deepEqual(remove.mock.calls[0].arguments[0], { where: { drillId: 'binary-drill' } });
});

test('drill image endpoint streams exact bytes and reports missing images and database failures', async t => {
  const load = t.mock.method(DbService, 'getDrillImage', async (id: string) =>
    id === 'present' ? { drillId: id, data: png, mimeType: 'image/png' } : null
  );
  const app = express();
  app.use('/api/drills', drillsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/drills`;
  const response = await fetch(`${base}/present/image`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('content-length'), String(png.length));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.equal((await fetch(`${base}/missing/image`)).status, 404);
  load.mock.mockImplementation(async () => { throw new Error('Database unavailable'); });
  const log = t.mock.method(console, 'error', () => {});
  const failure = await fetch(`${base}/present/image`);
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: 'Unable to load drill image.' });
  assert.equal(log.mock.callCount(), 1);
});
