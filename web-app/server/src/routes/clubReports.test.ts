import assert from 'node:assert/strict';
import test, { TestContext } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { DbService } from '../services/dbService.js';
import { clubRouteQueries, clubRouter } from './club.js';
import { coachRouteQueries, coachRouter } from './coach.js';

async function startTestServer(t: TestContext) {
  const secret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'club-report-api-test-secret';
  t.after(() => {
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/club', clubRouter);
  app.use('/api/coach', coachRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

function token(payload: Record<string, string>) {
  return jwt.sign(payload, process.env.JWT_SECRET!);
}

function authHeaders(value: string) {
  return { Authorization: ['Bearer', value].join(' ') };
}

function sessionFixture(): NonNullable<Awaited<ReturnType<typeof clubRouteQueries.findSessionForEditing>>> {
  return {
    id: 'session-a', clubId: 'club-a', title: 'Training', squadId: null, squadName: 'All players',
    coachId: 'coach-a', coachName: 'Coach A', coordinatorCoachId: 'coordinator-a',
    coordinatorCoachName: 'Coordinator A', assistantCoachId: 'assistant-a', assistantCoachName: 'Assistant A',
    sessionDate: '2026-10-09', durationMinutes: 60, safety: [], isPublished: true, isExecuted: false,
    drillCount: 1, drillIds: ['drill-a'], assignedPlayerIds: ['player-a'], playerNotes: {},
    postNotes: null, aiEvaluation: null, executionLog: null
  };
}

test('session report is authenticated, role-restricted, and scoped to the claim tenant', async t => {
  const baseUrl = await startTestServer(t);
  const members = t.mock.method(DbService, 'getClubMembers', async (clubId?: string) => {
    assert.equal(clubId, 'club-a');
    return [{
      id: 'player-a',
      name: 'Player A',
      email: 'private@example.test',
      role: 'PLAYER',
      ageGroup: 'U15',
      discipline: 'BATTING',
      invitationStatus: 'ACTIVE',
      currentLevel: 'DEVELOPING',
      squad: 'U15'
    }] as Awaited<ReturnType<typeof DbService.getClubMembers>>;
  });
  const sessions = t.mock.method(DbService, 'getTrainingSessions', async (clubId?: string) => {
    assert.equal(clubId, 'club-a');
    return [{
      id: 'session-a',
      title: 'Training',
      squadName: 'U15',
      sessionDate: '2026-10-09',
      durationMinutes: 60,
      isExecuted: true,
      drillCount: 1,
      assignedPlayerIds: ['player-a'],
      executionLog: { attendance: { 'player-a': 'PRESENT' } },
      playerNotes: { 'player-a': 'private coaching note' }
    }] as unknown as Awaited<ReturnType<typeof DbService.getTrainingSessions>>;
  });
  const findTenant = t.mock.method(clubRouteQueries, 'findTenantById', async (clubId: string) => {
    assert.equal(clubId, 'club-a');
    return { type: 'CLUB' } as never;
  });

  assert.equal((await fetch(`${baseUrl}/api/club/reports/session-activity`)).status, 401);
  const playerToken = token({ userId: 'player-a', role: 'PLAYER', tenantId: 'club-a' });
  assert.equal((await fetch(`${baseUrl}/api/club/reports/session-activity`, {
    headers: authHeaders(playerToken)
  })).status, 403);

  const adminToken = token({ userId: 'admin-a', role: 'CLUB_ADMIN', tenantId: 'club-a' });
  const response = await fetch(`${baseUrl}/api/club/reports/session-activity?clubId=club-b`, {
    headers: authHeaders(adminToken)
  });
  assert.equal(response.status, 200);
  const report = await response.json() as { members: Array<Record<string, unknown>>; sessions: Array<Record<string, unknown>> };
  assert.equal(report.members[0].email, undefined);
  assert.deepEqual(report.sessions[0].playerNotes, { 'player-a': true });
  assert.deepEqual(report.sessions[0].executionLog, { attendance: { 'player-a': 'PRESENT' } });
  assert.equal(members.mock.callCount(), 1);
  assert.equal(sessions.mock.callCount(), 1);
  assert.equal(findTenant.mock.callCount(), 1);
});

test('session deletion rejects another tenant and delivered sessions', async t => {
  const baseUrl = await startTestServer(t);
  const findSession = t.mock.method(clubRouteQueries, 'findSessionForDeletion', async (id: string, clubId: string) => {
    assert.equal(id, 'session-a');
    assert.equal(clubId, 'club-a');
    return { id: 'session-a', isExecuted: true, coachId: 'coach-a', coordinatorCoachId: null, assistantCoachId: null } as never;
  });

  const deletion = t.mock.method(DbService, 'deleteTrainingSession', async () => true);
  const adminToken = token({ userId: 'admin-a', role: 'CLUB_ADMIN', tenantId: 'club-a' });
  const response = await fetch(`${baseUrl}/api/club/sessions/session-a`, {
    method: 'DELETE',
    headers: authHeaders(adminToken)
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Delivered sessions cannot be deleted.' });
  assert.equal(findSession.mock.callCount(), 1);
  assert.equal(deletion.mock.callCount(), 0);
});

test('Run loads the assigned session through the authenticated execution GET route', async t => {
    const baseUrl = await startTestServer(t);
    const activeCoach = t.mock.method(coachRouteQueries, 'findActiveCoach', async (userId: string, clubId: string) => {
      assert.equal(userId, 'coach-a');
      assert.equal(clubId, 'club-a');
      return { id: 'coach-a' };
    });
    let assigned = true;
    const findSession = t.mock.method(coachRouteQueries, 'findAssignedSession', async (id: string, userId: string, clubId: string) => {
      assert.equal(id, 'session-a');
      assert.equal(userId, 'coach-a');
      assert.equal(clubId, 'club-a');
      return assigned ? sessionFixture() : null;
    });
    const url = `${baseUrl}/api/coach/sessions/session-a/execution`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(activeCoach.mock.callCount(), 0);
    const headers = authHeaders(token({ userId: 'coach-a', role: 'COACH', coachContext: 'CLUB', tenantId: 'club-a' }));
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { session: sessionFixture() });
    assigned = false;
    const missing = await fetch(url, { headers });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Session not found or not assigned to you.' });
    assert.equal(findSession.mock.callCount(), 2);
  });

test('assigned lead, coordinator, and assistant coaches can edit scheduled session plans', async t => {
    const baseUrl = await startTestServer(t);
    t.mock.method(clubRouteQueries, 'findSessionForEditing', async (id: string, clubId: string) => {
      assert.equal(id, 'session-a');
      assert.equal(clubId, 'club-a');
      return sessionFixture();
    });
    t.mock.method(clubRouteQueries, 'findActiveCoach', async () => ({ id: 'active-coach' }));
    const update = t.mock.method(DbService, 'updateTrainingSession', async (id: string, updates: Parameters<typeof DbService.updateTrainingSession>[1]) => {
      assert.equal(id, 'session-a');
      assert.equal(updates.title, 'Updated training');
      assert.equal(updates.sessionDate, '2026-10-10');
      assert.equal(updates.durationMinutes, 75);
      assert.deepEqual(updates.safety, ['Check nets']);
      assert.equal(updates.coachId, undefined);
      assert.equal(updates.isExecuted, undefined);
      return { ...sessionFixture(), ...updates };
    });
    for (const userId of ['coach-a', 'coordinator-a', 'assistant-a']) {
      const response = await fetch(`${baseUrl}/api/club/sessions/session-a`, {
        method: 'PATCH',
        headers: { ...authHeaders(token({ userId, role: 'COACH', coachContext: 'CLUB', tenantId: 'club-a' })), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated training', sessionDate: '2026-10-10', durationMinutes: 75, safety: ['Check nets'] })
      });
      assert.equal(response.status, 200);
      const body = await response.json() as { session: { title: string } };
      assert.equal(body.session.title, 'Updated training');
    }
    assert.equal(update.mock.callCount(), 3);
  });

test('session edits reject unauthenticated, foreign, unassigned, inactive, delivered, and invalid requests', async t => {
    const baseUrl = await startTestServer(t);
    let sessionExists = true;
    let delivered = false;
    let active = true;
    t.mock.method(clubRouteQueries, 'findSessionForEditing', async (_id: string, clubId: string) =>
      sessionExists && clubId === 'club-a' ? { ...sessionFixture(), isExecuted: delivered } : null);
    t.mock.method(clubRouteQueries, 'findActiveCoach', async () => active ? { id: 'coach-a' } : null);
    const update = t.mock.method(DbService, 'updateTrainingSession', async () => sessionFixture());
    const url = `${baseUrl}/api/club/sessions/session-a`;
    assert.equal((await fetch(url, { method: 'PATCH' })).status, 401);
    async function patch(userId: string, tenantId = 'club-a', body: Record<string, unknown> = { title: 'Updated' }) {
      return fetch(url, {
        method: 'PATCH',
        headers: { ...authHeaders(token({ userId, role: 'COACH', coachContext: 'CLUB', tenantId })), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    assert.equal((await patch('coach-a', 'club-b')).status, 404);
    assert.equal((await patch('other-coach')).status, 404);
    active = false;
    assert.equal((await patch('coach-a')).status, 403);
    active = true;
    delivered = true;
    assert.equal((await patch('coach-a')).status, 409);
    delivered = false;
    for (const invalid of [{ title: '' }, { sessionDate: '2026-02-30' }, { durationMinutes: 0 }, { safety: [false] }]) {
      assert.equal((await patch('coach-a', 'club-a', invalid)).status, 400);
    }
    sessionExists = false;
    assert.equal((await patch('coach-a')).status, 404);
    assert.equal(update.mock.callCount(), 0);
  });
