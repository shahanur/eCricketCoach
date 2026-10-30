import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';

import { playerProfileRouter } from '../routes/playerProfile.js';
import { PlayerProfileError, updatePlayerProfile } from './playerProfile.js';
import { completeRoadmapDrill, generateProvisionalPractice as generatePlayerRoadmap, generatePlayerRoadmap as generatePersonalRoadmap, getPlayerRoadmap, saveRoadmapAnswers } from './playerRoadmap.js';
import { roadmapDisciplines, validateAnswers, validateRecommendations } from './playerRoadmapPolicy.js';
import { GeminiVideoAnalysisService } from './geminiVideoAnalysisService.js';

const answers = Object.fromEntries(roadmapDisciplines.map(discipline => [discipline, { focus: `Improve ${discipline.toLowerCase()} consistency`, confidence: 3 }]));
const recommendations = roadmapDisciplines.map(discipline => ({
  discipline, objective: `Work on ${discipline.toLowerCase()} consistency using self-reported goals.`,
  proposedStage: null, evidence: [`qa:${discipline}`], drills: [{ drillId: `drill-${discipline}`, reason: 'Supports the self-reported focus.' }],
}));
const catalogue = roadmapDisciplines.map(discipline => ({
  id: `drill-${discipline}`, title: `${discipline} drill`, discipline, duration: 10, instructions: 'Practise the movement.',
}));
const code = (expected: string) => (error: unknown) => error instanceof PlayerProfileError && error.code === expected;

test('shared AI generation honors an already-cancelled deadline before provider work', async () => {
  const controller = new AbortController();
  const reason = new Error('Generation deadline reached');
  controller.abort(reason);
  await assert.rejects(GeminiVideoAnalysisService.generateJsonDetailed(
    ['private evidence'], (value: unknown): value is unknown => true, 'Roadmap', { signal: controller.signal },
  ), error => error === reason);
});

test('roadmap Q&A requires all four disciplines and rejects owner, stage and confidence injection', () => {
  assert.deepEqual(validateAnswers(answers), answers);
  assert.equal(validateAnswers({ ...answers, BATTING: { focus: 'Balance\nand timing', confidence: 3 } }).BATTING.focus, 'Balance\nand timing');
  for (const invalid of [
    { ...answers, playerId: 'other' },
    { ...answers, stage: 'ADVANCED' },
    { ...answers, BATTING: { focus: '', confidence: 3 } },
    { ...answers, BATTING: { focus: 'Timing', confidence: 6 } },
    { ...answers, BATTING: { focus: 'Timing', confidence: 0 } },
    { ...answers, BATTING: { focus: 'Timing', confidence: 3, score: 100 } },
    {},
  ]) assert.throws(() => validateAnswers(invalid), PlayerProfileError);
});

test('AI recommendations cite only supplied evidence and matching public catalogue drills', () => {
  const ids = roadmapDisciplines.map(discipline => `qa:${discipline}`);
  assert.deepEqual(validateRecommendations(recommendations, catalogue, ids), recommendations);
  for (const invalid of [
    recommendations.slice(1),
    [...recommendations.slice(1), recommendations[1]],
    recommendations.map(row => ({ ...row, evidence: ['fabricated-video'] })),
    recommendations.map(row => ({ ...row, score: 99 })),
    recommendations.map(row => ({ ...row, drills: [{ drillId: 'club-private', reason: 'Wrong scope' }] })),
    recommendations.map(row => ({ ...row, drills: [{ drillId: 'drill-BOWLING', reason: 'Wrong discipline' }] })),
    recommendations.map(row => ({ ...row, drills: [row.drills[0], row.drills[0]] })),
  ]) assert.throws(() => validateRecommendations(invalid, catalogue, ids), code('INVALID_ROADMAP_AI'));
});

test('all roadmap HTTP surfaces reject missing, expired and wrong-persona sessions', async t => {
  const app = express();
  app.use(express.json());
  app.use('/api/player', playerProfileRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const claims = { userId: 'u', tenantId: 't', role: 'PLAYER', email: 'player@example.test' };
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
  for (const [path, method] of [['', 'GET'], ['/answers', 'POST'], ['/generate', 'POST'], ['/provisional/generate', 'POST'], ['/practice', 'POST']]) {
    const url: string = `http://127.0.0.1:${address.port}/api/player/roadmap${path}`;
    assert.equal((await fetch(url, { method })).status, 401);
    for (const [token, expected] of [
      [jwt.sign(claims, secret, { expiresIn: -1 }), 401],
      [jwt.sign({ ...claims, role: 'CLUB_ADMIN' }, secret), 403],
    ] as const) {
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, expected);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
});

test('roadmaps persist private revisions and evidence without duplicate advancement', {
  skip: !process.env.PLAYER_PROFILE_TEST_DATABASE_URL,
}, async t => {
  const client = new PrismaClient({ datasources: { db: { url: process.env.PLAYER_PROFILE_TEST_DATABASE_URL! } } });
  const suffix = randomUUID();
  const tenantId = `roadmap-${suffix}`;
  const email = `roadmap-${suffix}@example.test`;
  const original = { mode: process.env.NODE_ENV, enabled: process.env.PLAYER_DEVELOPMENT_SUBSCRIPTIONS };
  process.env.NODE_ENV = 'test';
  process.env.PLAYER_DEVELOPMENT_SUBSCRIPTIONS = 'true';
  t.after(async () => {
    await client.customerTenant.deleteMany({ where: { id: { in: [tenantId, `${tenantId}-other`] } } });
    await client.clubApproval.deleteMany({ where: { id: { in: [`approval-${suffix}`, `approval-${suffix}-other`] } } });
    await client.drill.deleteMany({ where: { id: { startsWith: suffix } } });
    await client.$disconnect();
    if (original.mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original.mode;
    if (original.enabled === undefined) delete process.env.PLAYER_DEVELOPMENT_SUBSCRIPTIONS; else process.env.PLAYER_DEVELOPMENT_SUBSCRIPTIONS = original.enabled;
  });
  await client.customerTenant.create({ data: {
    id: tenantId, name: 'Test Player', email, type: 'INDIVIDUAL', subscriptionPlan: 'INDIVIDUAL',
    status: 'ACTIVE', billingCycle: 'MONTHLY', mrr: 0, activeMembers: 1, joinedAt: '2026-10-29',
  } });
  await client.clubApproval.create({ data: {
    id: `approval-${suffix}`, clubName: 'Player', adminName: 'Player', adminEmail: email,
    plan: 'INDIVIDUAL', amountPaid: 0, type: 'INDIVIDUAL', billingCycle: 'MONTHLY', status: 'APPROVED', createdAt: new Date().toISOString(),
  } });
  await client.playerDevelopmentSubscription.create({ data: {
    tenantId, ownerEmail: email, approvalId: `approval-${suffix}`,
    startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 86_400_000),
  } });
  const owner = { tenantId, userId: 'self', role: 'PLAYER' as const, email };
  await client.customerTenant.create({ data: {
    id: `${tenantId}-other`, name: 'Other Player', email: `other-${email}`, type: 'INDIVIDUAL', subscriptionPlan: 'INDIVIDUAL',
    status: 'ACTIVE', billingCycle: 'MONTHLY', mrr: 0, activeMembers: 1, joinedAt: '2026-10-29',
  } });
  await client.clubApproval.create({ data: {
    id: `approval-${suffix}-other`, clubName: 'Player', adminName: 'Player', adminEmail: `other-${email}`,
    plan: 'INDIVIDUAL', amountPaid: 0, type: 'INDIVIDUAL', billingCycle: 'MONTHLY', status: 'APPROVED', createdAt: new Date().toISOString(),
  } });
  await client.playerDevelopmentSubscription.create({ data: {
    tenantId: `${tenantId}-other`, ownerEmail: `other-${email}`, approvalId: `approval-${suffix}-other`,
    startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 86_400_000),
  } });
  const otherOwner = { ...owner, tenantId: `${tenantId}-other`, email: `other-${email}` };
  const initial = await getPlayerRoadmap(owner, client);
  assert.equal(initial.stage, 'UNASSESSED');
  assert.equal(initial.planKind, 'PROVISIONAL_PRACTICE');
  assert.equal(initial.journey.nextStep, 'COMPLETE_PROFILE');
  assert.equal(initial.journey.videoBaseline, 'UNAVAILABLE');
  await assert.rejects(generatePersonalRoadmap(owner, { version: 0, requestId: 'personal' }, client), code('ROADMAP_VIDEO_BASELINE_REQUIRED'));
  await assert.rejects(generatePersonalRoadmap(owner, { version: 0, requestId: 'spoof', baseline: 'VERIFIED' }, client), code('INVALID_ROADMAP_INPUT'));
  assert.equal(initial.revisions.length, 0);
  assert.deepEqual(initial.answers, {});
  await assert.rejects(getPlayerRoadmap({ ...owner, email: 'other@example.test' }, client), code('INDIVIDUAL_PLAYER_REQUIRED'));
  await assert.rejects(getPlayerRoadmap({ ...owner, role: 'COACH' }, client), code('INDIVIDUAL_PLAYER_REQUIRED'));
  await client.drill.createMany({ data: catalogue.map(drill => ({
    ...drill, id: `${suffix}-${drill.id}`, source: 'SYSTEM_PREDEFINED', contextType: 'INDIVIDUAL', skillSet: 'Consistency',
  })) });
  let roadmap = await saveRoadmapAnswers(owner, { version: 0, answers }, client);
  assert.equal(roadmap.version, 1);
  await assert.rejects(saveRoadmapAnswers(owner, { version: 0, answers }, client), code('ROADMAP_VERSION_CONFLICT'));
  let calls = 0;
  const ai = async (prompt: string) => {
    calls++;
    assert.ok(prompt.includes('SELF_REPORTED'));
    assert.ok(!prompt.includes(email));
    return { data: recommendations.map(row => ({ ...row, drills: [{ drillId: `${suffix}-${row.drills[0].drillId}`, reason: row.drills[0].reason }] })), model: 'test-model', provider: 'OPENAI' as const };
  };
  let release: () => void = () => undefined;
  let entered: () => void = () => undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const generating = generatePlayerRoadmap(owner, { version: 1, requestId: 'generate-1' }, client, async prompt => {
    entered(); await gate; return ai(prompt);
  });
  await started;
  await assert.rejects(generatePlayerRoadmap(owner, { version: 1, requestId: 'concurrent' }, client, ai), code('ROADMAP_GENERATING'));
  release();
  roadmap = await generating;
  assert.equal(roadmap.revisions.length, 1);
  assert.equal(roadmap.stage, 'UNASSESSED');
  await generatePlayerRoadmap(owner, { version: 1, requestId: 'generate-1' }, client, ai);
  assert.equal(calls, 1);
  const revisionId = roadmap.revisions[0].id;
  const practice = { requestId: 'practice-1', revisionId, drillId: `${suffix}-drill-BATTING`, minutes: 15, reflection: 'Worked on balance.' };
  assert.equal((await getPlayerRoadmap(otherOwner, client)).revisions.length, 0);
  await assert.rejects(completeRoadmapDrill(otherOwner, practice, client), code('ROADMAP_NOT_FOUND'));
  await assert.rejects(completeRoadmapDrill(owner, { ...practice, revisionId: 'someone-elses-revision' }, client), code('ROADMAP_NOT_FOUND'));
  const completions = await Promise.all([completeRoadmapDrill(owner, practice, client), completeRoadmapDrill(owner, practice, client)]);
  assert.equal(completions[1].practice.length, 1);
  assert.equal(completions[1].version, 2);
  assert.equal(completions[1].stage, 'UNASSESSED');
  assert.equal(completions[1].milestoneEligibility, 'BLOCKED_PENDING_VERIFIED_VIDEO_AND_APPROVED_RUBRIC');
  await assert.rejects(completeRoadmapDrill(owner, { ...practice, minutes: 16 }, client), code('PRACTICE_IDEMPOTENCY_CONFLICT'));
  await assert.rejects(completeRoadmapDrill(owner, { ...practice, requestId: 'duplicate' }, client), code('PRACTICE_ALREADY_RECORDED'));
  roadmap = await generatePlayerRoadmap(owner, { version: 2, requestId: 'generate-2' }, client, ai);
  assert.equal(roadmap.revisions.length, 2);
  assert.equal(roadmap.practice.length, 1);
  assert.equal(roadmap.needsReassessment, false);
  await assert.rejects(completeRoadmapDrill(owner, { ...practice, requestId: 'old-path', drillId: `${suffix}-drill-BOWLING` }, client), code('ROADMAP_SUPERSEDED'));
  const profile = await client.playerProfile.findUniqueOrThrow({ where: { tenantId } });
  await updatePlayerProfile(owner, {
    version: profile.version, displayName: 'Test Player', battingHandedness: 'RIGHT', bowlingStyle: 'NOT_SET',
    primaryDisciplines: ['BATTING'], experienceLevel: 'BEGINNER', goals: ['Improve timing'],
  }, client);
  roadmap = await getPlayerRoadmap(owner, client);
  assert.equal(roadmap.needsReassessment, true);
  assert.equal(roadmap.revisions.length, 2);
  assert.equal(roadmap.journey.nextStep, 'VIDEO_BASELINE');
  assert.equal(roadmap.journey.personalRoadmap, 'BLOCKED_PENDING_VERIFIED_VIDEO');
  await assert.rejects(generatePersonalRoadmap(owner, { version: 2, requestId: 'after-practice' }, client), code('ROADMAP_VIDEO_BASELINE_REQUIRED'));
  await assert.rejects(generatePlayerRoadmap(owner, { version: 2, requestId: 'bad-ai' }, client, async () => ({ data: [], model: 'test', provider: 'OPENAI' })), code('INVALID_ROADMAP_AI'));
  assert.equal((await getPlayerRoadmap(owner, client)).generating, false);
  // Evidence changes during generation must not publish a stale path.
  await assert.rejects(generatePlayerRoadmap(owner, { version: 2, requestId: 'stale-ai' }, client, async prompt => {
    await saveRoadmapAnswers(owner, { version: 2, answers }, client);
    return ai(prompt);
  }), code('ROADMAP_VERSION_CONFLICT'));
  assert.equal((await getPlayerRoadmap(owner, client)).revisions.length, 2);
  await assert.rejects(generatePlayerRoadmap(owner, { version: 3, requestId: 'expired-lease' }, client, async prompt => {
    await client.playerRoadmap.update({ where: { profileId: profile.id }, data: { generationStartedAt: new Date(Date.now() - 300_001) } });
    return ai(prompt);
  }), code('ROADMAP_INPUT_CHANGED'));
  assert.equal((await getPlayerRoadmap(owner, client)).generating, false);
  await assert.rejects(generatePlayerRoadmap(owner, { version: 3, requestId: 'replaced-lease' }, client, async prompt => {
    await client.playerRoadmap.update({ where: { profileId: profile.id }, data: { generatingKey: 'replacement-lease' } });
    return ai(prompt);
  }), code('ROADMAP_INPUT_CHANGED'));
  assert.equal((await getPlayerRoadmap(owner, client)).generating, true);
  await client.playerRoadmap.update({ where: { profileId: profile.id }, data: { generatingKey: null, generationStartedAt: null } });
  await client.playerDevelopmentSubscription.update({ where: { tenantId }, data: { endsAt: new Date(Date.now() - 1) } });
  await assert.rejects(getPlayerRoadmap(owner, client), code('ROADMAP_ENTITLEMENT_REQUIRED'));
  await client.customerTenant.update({ where: { id: tenantId }, data: { status: 'SUSPENDED' } });
  await assert.rejects(getPlayerRoadmap(owner, client), code('INDIVIDUAL_PLAYER_REQUIRED'));
});
