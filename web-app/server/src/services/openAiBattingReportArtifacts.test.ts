import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { after, test } from 'node:test';
import type { OpenAiBattingAnalysis } from './openAiBattingAnalysisService.js';
import { createAndPersistBattingReport, isBattingReportArtifactName, toPersistableAnalysis } from './openAiBattingReportArtifacts.js';

const temporaryDirectories: string[] = [];

after(async () => {
  await Promise.all(temporaryDirectories.map(directory => rm(directory, { recursive: true, force: true })));
});

async function dataUrlPng(): Promise<string> {
  const buffer = await sharp({ create: { width: 32, height: 48, channels: 3, background: '#223344' } }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

test('persists report artifacts and a ZIP without embedding source image data in analysis.json', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'batting-report-test-'));
  temporaryDirectories.push(root);
  const imageDataUrl = await dataUrlPng();
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><rect width="30" height="20" fill="#123"/></svg>').toString('base64')}`;
  const analysis = {
    provider: 'openai', model: 'test-model', promptVersion: 'test-prompt-v1', schemaVersion: 'test-schema-v1', sourceSha256: 'a'.repeat(64),
    video: { durationSeconds: 1, width: 32, height: 48, fps: 30, sampledOverviewFrames: 1 },
    frameManifest: [], shotCandidates: [], shotAssessments: [], jointAngles: [],
    executionLog: { stages: ['test'], toolVersions: { node: 'test', ffmpeg: 'test', ffprobe: 'test' }, modelRequested: 'test-model', modelReturned: 'test-model', responseIds: ['resp_test'], usage: null },
    contact: { status: 'UNCERTAIN', selectionSource: 'AI', selectedTimestampSeconds: 0.5, frameIndex: 15, timestampSeconds: 0.5, confidence: 0.2, evidence: 'test evidence', imageDataUrl, pointNorm: { x: 0.5, y: 0.5 } },
    croppedContactImageDataUrl: imageDataUrl, contactLandmarksNorm: { leftShoulder: { x: 0.4, y: 0.3 }, leftElbow: { x: 0.3, y: 0.5 }, leftWrist: { x: 0.4, y: 0.6 } },
    batHandleNorm: { x: 0.6, y: 0.5 }, batToeNorm: { x: 0.8, y: 0.8 }, croppedContactLandmarksNorm: {}, croppedContactPointNorm: null,
    poseSequenceFrames: [{ frameIndex: 16, timestampSeconds: 0.55, phase: 'POST_CONTACT', imageDataUrl }],
    visualOutputs: { movementSequenceImageDataUrl: svgDataUrl, jointAlignmentImageDataUrl: svgDataUrl },
    phases: [], summary: 'A cautious synthetic test result.', status: 'partially_assessable',
    shotIdentification: { shotType: null, confidence: 0, evidence: '' },
    footageQuality: { cameraView: 'unknown', blur: 'unknown', occlusions: [], timingLimitations: [], cameraMotion: 'unknown' },
    contactWindow: { startSeconds: 0.4, endSeconds: 0.6 }, observations: [], errors: [], strengths: [], priorityCue: '',
    drill: { title: '', instructions: [], rationale: '' }, limitations: [], additionalEvidence: []
  } as OpenAiBattingAnalysis;

  const persisted = await createAndPersistBattingReport(analysis, root);
  const names = persisted.artifacts.map(artifact => artifact.name);
  assert.ok(names.includes('contact_review.png'));
  assert.ok(names.includes('joint_analysis.png'));
  assert.ok(names.includes('bat_path_sequence.png'));
  assert.ok(names.includes('follow_through.png'));
  assert.ok(names.includes('phase_sequence.png'));
  assert.ok(names.includes('analysis_bundle.zip'));
  const analysisJson = await readFile(path.join(persisted.directory, 'analysis.json'), 'utf8');
  assert.equal(analysisJson.includes('data:image/'), false);
  const zip = await readFile(path.join(persisted.directory, 'analysis_bundle.zip'));
  assert.equal(zip.subarray(0, 2).toString(), 'PK');
  assert.ok(zip.includes('joint_angles.json'));
  assert.ok(persisted.artifacts.every(artifact => artifact.sha256.length === 64));
});

test('persistable analysis omits inline frame data and the artifact allowlist rejects traversal', () => {
  const source = { contact: { imageDataUrl: 'data:image/png;base64,AAAA', timestampSeconds: 1 }, poseSequenceFrames: [{ imageDataUrl: 'data:image/png;base64,BBBB' }] } as unknown as OpenAiBattingAnalysis;
  const safe = toPersistableAnalysis(source);
  assert.equal(JSON.stringify(safe).includes('data:image/'), false);
  assert.equal(isBattingReportArtifactName('analysis_bundle.zip'), true);
  assert.equal(isBattingReportArtifactName('../analysis.json'), false);
});
