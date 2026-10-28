import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

import { getPlayerProfile, PlayerProfileError, updatePlayerProfile, validatePlayerProfileInput } from './playerProfile.js';

const validInput = {
  version: 0,
  displayName: 'Asha Player',
  battingHandedness: 'RIGHT',
  bowlingStyle: 'RIGHT_ARM_SPIN',
  primaryDisciplines: ['BATTING', 'BOWLING'],
  experienceLevel: 'DEVELOPING',
  goals: ['Improve footwork'],
};

test('player profile input accepts supported editable fields only', () => {
  assert.deepEqual(validatePlayerProfileInput(validInput), validInput);
  for (const invalid of [
    { ...validInput, role: 'CLUB_ADMIN' },
    { ...validInput, displayName: ' '.repeat(2) },
    { ...validInput, version: -1 },
    { ...validInput, primaryDisciplines: ['BATTING', 'BATTING'] },
    { ...validInput, primaryDisciplines: ['ALL_ROUNDER'] },
    { ...validInput, goals: [''] },
    { ...validInput, goals: ['one', 'two', 'three', 'four'] },
  ]) {
    assert.throws(() => validatePlayerProfileInput(invalid), PlayerProfileError);
  }
});

test('player profile ownership, idempotency, uniqueness and concurrent edits against PostgreSQL', {
  skip: !process.env.PLAYER_PROFILE_TEST_DATABASE_URL,
}, async t => {
  const url = process.env.PLAYER_PROFILE_TEST_DATABASE_URL!;
  const client = new PrismaClient({ datasources: { db: { url } } });
  t.after(() => client.$disconnect());

  await client.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS customer_tenants (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    logo_url TEXT,
    subscription_plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(50) NOT NULL,
    mrr NUMERIC(10,2) NOT NULL DEFAULT 0,
    active_members INT DEFAULT 1,
    joined_at VARCHAR(50) NOT NULL
  )`);
  await client.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS player_profiles (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL UNIQUE REFERENCES customer_tenants(id) ON DELETE CASCADE,
    owner_email TEXT NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    batting_handedness VARCHAR(20) NOT NULL,
    bowling_style VARCHAR(30) NOT NULL,
    primary_disciplines TEXT[] NOT NULL DEFAULT '{}',
    experience_level VARCHAR(20) NOT NULL,
    goals TEXT[] NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const suffix = randomUUID();
  const email = `player-${suffix}@example.test`;
  const tenantId = `profile-${suffix}`;
  const secondTenantId = `profile-other-${suffix}`;
  await client.customerTenant.create({
    data: {
      id: tenantId,
      name: 'Asha Player',
      type: 'INDIVIDUAL',
      email,
      subscriptionPlan: 'INDIVIDUAL',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      mrr: 0,
      activeMembers: 1,
      joinedAt: '2026-10-28',
    },
  });
  await client.customerTenant.create({
    data: {
      id: secondTenantId,
      name: 'Another tenant',
      type: 'INDIVIDUAL',
      email,
      subscriptionPlan: 'INDIVIDUAL',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      mrr: 0,
      activeMembers: 1,
      joinedAt: '2026-10-28',
    },
  });
  t.after(async () => {
    await client.customerTenant.deleteMany({ where: { id: { in: [tenantId, secondTenantId] } } });
  });

  const owner = {
    userId: `oauth-google-${suffix}`,
    tenantId,
    role: 'PLAYER' as const,
    email,
  };
  const profiles = await Promise.all(Array.from({ length: 5 }, () => getPlayerProfile(owner, client)));
  assert.equal(new Set(profiles.map(profile => profile.id)).size, 1);
  assert.equal(profiles[0].isComplete, false);
  assert.equal(await client.playerProfile.count({ where: { tenantId } }), 1);

  const updated = await updatePlayerProfile(owner, validInput, client);
  assert.equal(updated.version, 1);
  assert.equal(updated.isComplete, true);
  assert.deepEqual(updated.primaryDisciplines, ['BATTING', 'BOWLING']);
  await assert.rejects(
    updatePlayerProfile(owner, validInput, client),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 409,
  );
  await assert.rejects(
    getPlayerProfile({ ...owner, email: `other-${suffix}@example.test` }, client),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 403,
  );
  await assert.rejects(
    getPlayerProfile({ ...owner, role: 'COACH' }, client),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 403,
  );
  await assert.rejects(
    getPlayerProfile({ ...owner, tenantId: secondTenantId }, client),
    (error: unknown) => error instanceof PlayerProfileError && error.status === 409,
  );
  assert.equal(await client.clubMember.count({ where: { clubId: tenantId } }), 0);
});
