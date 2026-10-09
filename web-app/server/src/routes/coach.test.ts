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
});

test('execution log parser normalizes supported fields and rejects invalid status', () => {
  const parsed = parseExecutionLog({
    status: 'IN_PROGRESS',
    checklist: { equipment: true, unsupported: 'yes' },
    attendance: { player1: 'PRESENT', player2: 'UNKNOWN' },
    drillLog: [{ id: 'd1', title: 'Net drill', plannedMinutes: 12, actualMinutes: 15, completed: true }],
    incidents: [{ id: 'i1', category: 'Equipment', note: 'Loose stump' }],
    evaluation: { objectivesMet: 'PARTIAL', engagement: 4, wentWell: 'Good tempo' }
  });

  assert.ok(parsed);
  assert.deepEqual(parsed.attendance, { player1: 'PRESENT' });
  assert.equal(parsed.drillLog[0].actualMinutes, 15);
  assert.equal(parsed.checklist.unsupported, false);
  assert.equal(parseExecutionLog({ status: 'DELIVERED' }), null);
});
