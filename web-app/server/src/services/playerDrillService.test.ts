import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../config/prisma.js';
import { assignCapeGuidanceDrill, DrillAssignmentError, drillInstructions } from './playerDrillService.js';

const item = {
  fault_code: 'front_knee_collapse',
  title: 'Firm front knee',
  why_it_matters: 'A stable base transfers weight into the shot.',
  coaching_cues: ['Bend, then brace', 'Head over knee'],
  drill: { name: 'Marker stride drive', instructions: ['Place a marker', 'Stride to it and hold'], equipment: ['Marker'] }
};

const job = {
  id: 'job-1',
  tenantId: 'club-one',
  playerId: 'player-1',
  playerName: 'Sam Player',
  status: 'SUCCEEDED',
  request: { target: 'batter' },
  result: { coaching: { ai_guidance: { source: 'gemini', summary: 's', items: [item] } } }
};

// Swaps a Prisma delegate method for a fake for the duration of one test.
function stub(t: test.TestContext, target: object, name: string, impl: (...args: any[]) => unknown) {
  const original = (target as Record<string, unknown>)[name];
  (target as Record<string, unknown>)[name] = impl;
  t.after(() => { (target as Record<string, unknown>)[name] = original; });
}

test('rejects unfinished jobs, jobs without a player, and unknown findings', async () => {
  await assert.rejects(assignCapeGuidanceDrill({ ...job, status: 'RUNNING' }, item.fault_code, 'coach-1'), (e: unknown) => e instanceof DrillAssignmentError && e.status === 409);
  await assert.rejects(assignCapeGuidanceDrill({ ...job, playerId: null }, item.fault_code, 'coach-1'), (e: unknown) => e instanceof DrillAssignmentError && e.status === 400);
  await assert.rejects(assignCapeGuidanceDrill(job, 'unknown_fault', 'coach-1'), (e: unknown) => e instanceof DrillAssignmentError && e.status === 404);
});

test('creates system and club catalogue drills and assigns the club copy to the player', async t => {
  const createdDrills: any[] = [];
  let createdAssignment: any = null;
  const tx = {
    drill: {
      findFirst: async ({ where }: any) => (where.source === 'SYSTEM_PREDEFINED' ? { id: 'drill-sys-existing' } : null),
      create: async ({ data }: any) => { createdDrills.push(data); return { id: data.id }; }
    },
    playerDrillAssignment: {
      create: async ({ data }: any) => { createdAssignment = { id: 'a-1', createdAt: new Date('2025-01-01'), ...data }; return createdAssignment; }
    }
  };
  stub(t, prisma.playerDrillAssignment, 'findUnique', async () => null);
  stub(t, prisma.customerTenant, 'findUnique', async () => ({ name: 'Riverside CC' }));
  stub(t, prisma.clubMember, 'findFirst', async () => ({ name: 'Coach Kim' }));
  stub(t, prisma, '$transaction', async (fn: (client: typeof tx) => unknown) => fn(tx));

  const { assignment, created } = await assignCapeGuidanceDrill(job, item.fault_code, 'coach-1');

  assert.equal(created, true);
  // Existing system drill with the same title is reused; only the club copy is created.
  assert.equal(createdDrills.length, 1);
  assert.equal(createdDrills[0].source, 'CLUB_CUSTOM');
  assert.equal(createdDrills[0].clubId, 'club-one');
  assert.equal(createdDrills[0].clubName, 'Riverside CC');
  assert.equal(createdDrills[0].discipline, 'BATTING');
  assert.equal(createdDrills[0].title, 'Marker stride drive');
  assert.equal(assignment.systemDrillId, 'drill-sys-existing');
  assert.equal(assignment.drillId, createdDrills[0].id);
  assert.equal(assignment.playerId, 'player-1');
  assert.equal(assignment.assignedByName, 'Coach Kim');
  assert.equal(createdAssignment.tenantId, 'club-one');
});

test('returns the existing assignment instead of creating duplicates', async t => {
  const existing = {
    id: 'a-1', tenantId: 'club-one', playerId: 'player-1', playerName: 'Sam Player', drillId: 'd', systemDrillId: 's',
    capeJobId: 'job-1', faultCode: item.fault_code, title: 'Marker stride drive', discipline: 'BATTING', details: {},
    assignedById: 'coach-1', assignedByName: null, createdAt: new Date('2025-01-01')
  };
  stub(t, prisma.playerDrillAssignment, 'findUnique', async () => existing);
  stub(t, prisma, '$transaction', async () => { throw new Error('should not write'); });
  const { assignment, created } = await assignCapeGuidanceDrill(job, item.fault_code, 'coach-1');
  assert.equal(created, false);
  assert.equal(assignment.id, 'a-1');
});

test('catalogue instructions include steps, cues, equipment and focus', () => {
  const text = drillInstructions(item);
  assert.match(text, /^1\. Place a marker\n2\. Stride to it and hold/);
  assert.match(text, /Coaching cues: Bend, then brace; Head over knee/);
  assert.match(text, /Equipment: Marker/);
  assert.match(text, /Focus: Firm front knee\./);
});
