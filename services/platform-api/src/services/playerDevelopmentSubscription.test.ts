import assert from 'node:assert/strict';
import test from 'node:test';
import { developmentSubscriptionsEnabled, oneMonthAfter } from './playerDevelopmentSubscription.js';

test('approval-based subscriptions require an explicit non-production opt-in', () => {
  for (const NODE_ENV of [undefined, 'production', 'staging']) {
    assert.equal(developmentSubscriptionsEnabled({ NODE_ENV, PLAYER_DEVELOPMENT_SUBSCRIPTIONS: 'true' }), false);
  }
  for (const NODE_ENV of ['development', 'test']) {
    assert.equal(developmentSubscriptionsEnabled({ NODE_ENV, PLAYER_DEVELOPMENT_SUBSCRIPTIONS: 'true' }), true);
    for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      assert.equal(developmentSubscriptionsEnabled({ NODE_ENV, PLAYER_DEVELOPMENT_SUBSCRIPTIONS: flag }), false);
    }
  }
});

test('one month of access preserves UTC time and clamps short months', () => {
  for (const [start, end] of [
    ['2026-01-31T16:24:30.123Z', '2026-02-28T16:24:30.123Z'],
    ['2028-01-31T16:24:30.123Z', '2028-02-29T16:24:30.123Z'],
    ['2026-12-15T00:00:00.000Z', '2027-01-15T00:00:00.000Z'],
    ['2026-03-31T23:59:59.999Z', '2026-04-30T23:59:59.999Z'],
  ]) {
    const original = new Date(start);
    assert.equal(oneMonthAfter(original).toISOString(), end);
    assert.equal(original.toISOString(), start);
  }
});
