import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignedExecutionSessionWhere,
  isSessionExecutionDateAllowed,
  parseExecutionLog
} from './coach.js';

test('execution session lookup includes tenant and every assigned coach role', () => {
  assert.deepEqual(
    assignedExecutionSessionWhere('session-1', 'coach-1', 'club-1'),
    {
      id: 'session-1',
      clubId: 'club-1',
      OR: [
        { coachId: 'coach-1' },
        { coordinatorCoachId: 'coach-1' },
        { assistantCoachId: 'coach-1' }
      ]
    }
  );
});

test('future session execution is rejected except for preparation saves', () => {
  const now = Date.UTC(2025, 4, 10, 12);
  assert.equal(isSessionExecutionDateAllowed('2025-05-11', 'PREPARING', false, now), true);
  assert.equal(isSessionExecutionDateAllowed('2025-05-12', 'IN_PROGRESS', false, now), false);
  assert.equal(isSessionExecutionDateAllowed('2025-05-12', 'COMPLETED', true, now), false);
});

test('session scheduled date is available for UTC+14 local coaches', () => {
  const now = Date.UTC(2025, 4, 10, 12);
  assert.equal(isSessionExecutionDateAllowed('2025-05-11', 'IN_PROGRESS', false, now), true);
  assert.equal(isSessionExecutionDateAllowed('2025-05-12', 'PAUSED', false, now), false);
  assert.equal(isSessionExecutionDateAllowed('2025-05-12', 'PAUSED', false, now, true), true);
});

test('execution log parser normalizes supported fields and rejects invalid status', () => {
  const parsed = parseExecutionLog({
    status: 'IN_PROGRESS',
    activeDrillId: 'planned-drill-1',
    activeDrillStartedAt: '2025-05-10T12:00:00.000Z',
    activeDrillElapsedSeconds: 92,
    activeDrillPaused: true,
    checklist: { equipment: true, unsupported: 'yes' },
    attendance: { player1: 'PRESENT', player2: 'UNKNOWN' },
    drillLog: [{ id: 'd1', title: 'Net drill', plannedMinutes: 12, actualMinutes: 15, completed: true }],
    incidents: [{ id: 'i1', category: 'Equipment', note: 'Loose stump' }],
    evaluation: { objectivesMet: 'PARTIAL', engagement: 4, wentWell: 'Good tempo' }
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.attendance, { player1: 'PRESENT' });
  assert.equal(parsed.drillLog[0].actualMinutes, 15);
  assert.equal(parsed.activeDrillId, 'planned-drill-1');
  assert.equal(parsed.activeDrillElapsedSeconds, 92);
  assert.equal(parsed.activeDrillPaused, true);
  assert.equal(parsed.checklist.unsupported, false);
  const paused = parseExecutionLog({
    status: 'PAUSED',
    startedAt: '2025-05-10T12:00:00.000Z',
    sessionPausedAt: '2025-05-10T12:15:00.000Z',
    sessionPausedSeconds: 45,
    sessionPausedDrillWasRunning: true
  });
  assert.equal(paused?.status, 'PAUSED');
  assert.equal(paused?.sessionPausedSeconds, 45);
  assert.equal(paused?.sessionPausedDrillWasRunning, true);
  assert.equal(parseExecutionLog({ status: 'DELIVERED' }), null);
});
