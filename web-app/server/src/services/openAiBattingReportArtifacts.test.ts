import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { after, test } from 'node:test';
import type { OpenAiBattingAnalysis } from './openAiBattingAnalysisService.js';
import { createAndPersistBattingReport, isBattingReportArtifactName, persistBattingCoachReview, persistOpenAiPoseOverlay, toPersistableAnalysis } from './openAiBattingReportArtifacts.js';

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
    requestMetadata: { shotType: 'unknown', batterHandedness: 'unknown', cameraView: 'unknown', playbackSpeed: 'unknown', captureFps: null, priorities: [] },
    video: { durationSeconds: 1, width: 32, height: 48, fps: 30, sampledOverviewFrames: 1 },
    frameManifest: [], shotCandidates: [], shotAssessments: [], jointAngles: [{
      frameId: 'frame_000015', joint: 'elbow', side: 'left', landmarkNames: ['leftShoulder', 'leftElbow', 'leftWrist'],
      a: { x: 0.4, y: 0.3 }, b: { x: 0.3, y: 0.5 }, c: { x: 0.4, y: 0.7 }, visibility: 'visible',
      angleDegrees: 164, frameIndex: 15, timestampSeconds: 0.5, phase: 'contact', confidence: 0.8,
      source: 'openai_visual_estimate', calculation: 'image_plane_angle_from_normalized_landmarks', status: 'calculated', limitations: ['2D estimate only.']
    }],
    phaseReviewFrames: [{ shotId: 'shot_1', frameIndex: 15, timestampSeconds: 0.5, phase: 'contact', confidence: 0.8, landmarksNorm: { leftShoulder: { x: 0.4, y: 0.3 } }, imageDataUrl }],
    sourceFrameImages: [{ frameIndex: 15, timestampSeconds: 0.5, imageDataUrl }],
    batLandmarksByFrame: [{ frameIndex: 15, phase: 'contact', confidence: 0.8, visibility: 'visible', handleNorm: { x: 0.6, y: 0.5 }, toeNorm: { x: 0.8, y: 0.8 } }], annotations: [],
    batAngles: [{
      frameId: 'frame_000015', frameIndex: 15, timestampSeconds: 0.5, phase: 'contact', confidence: 0.8, visibility: 'visible',
      handle: { x: 0.6, y: 0.5 }, toe: { x: 0.8, y: 0.8 }, handleSource: 'model', angleDegrees: 23.9, source: 'openai_visual_estimate',
      calculation: 'image_plane_handle_to_toe_from_vertical', status: 'calculated', limitations: ['2D estimate only.']
    }],
    contactBatAngle: { frameIndex: 15, angleDegrees: 23.9, method: 'handle_to_toe', source: 'openai_visual_estimate', limitations: ['2D estimate only.'] },
    executionLog: { stages: ['test'], toolVersions: { node: 'test', ffmpeg: 'test', ffprobe: 'test', sharp: 'test' }, modelRequested: 'test-model', modelReturned: 'test-model', responseIds: ['resp_test'], usage: null, sourceSha256: 'a'.repeat(64), frameManifest: [], cropTransforms: [], errors: [], outputs: [] },
    contact: { status: 'UNCERTAIN', selectionSource: 'AI', selectedTimestampSeconds: 0.5, frameIndex: 15, timestampSeconds: 0.5, confidence: 0.2, evidence: 'test evidence', imageDataUrl, pointNorm: { x: 0.5, y: 0.5 } },
    croppedContactImageDataUrl: imageDataUrl, contactLandmarksNorm: { leftShoulder: { x: 0.4, y: 0.3 }, leftElbow: { x: 0.3, y: 0.5 }, leftWrist: { x: 0.4, y: 0.6 } },
    batHandleNorm: { x: 0.6, y: 0.5 }, batToeNorm: { x: 0.8, y: 0.8 }, croppedContactLandmarksNorm: {}, croppedContactPointNorm: null,
    croppedBatHandleNorm: null, croppedBatToeNorm: null,
    poseSequenceFrames: [{ frameIndex: 16, timestampSeconds: 0.55, phase: 'POST_CONTACT', imageDataUrl }],
    visualOutputs: { movementSequenceImageDataUrl: svgDataUrl, jointAlignmentImageDataUrl: svgDataUrl },
    phases: [], summary: 'A cautious synthetic test result.', status: 'partially_assessable', kinetics: { status: 'not_measured', hypotheses: [] },
    capeKinetics: {
      status: 'available', source: 'cape', contactFrame: 15, contactSelectionSource: 'detector', message: null,
      metrics: {
        incomingBallSpeedKmh: 101, incomingMomentumKgMps: 15.76, incomingKineticEnergyJ: 122.4,
        exitSpeedKmh: 72, exitMomentumKgMps: 11.23, exitKineticEnergyJ: 50.9,
        launchAngleDegrees: 18, batSwingSpeedKmh: 91, batSwingArcDegrees: 112, followThroughArcDegrees: 97
      }, limitations: ['CAPE estimated from video.']
    },
    shotIdentification: { shotType: null, batterHandedness: 'unknown', confidence: 0, evidence: '' },
      footageQuality: { cameraView: 'unknown', framing: 'unknown', blur: 'unknown', occlusions: [], timingLimitations: [], cameraMotion: 'unknown' },
    contactWindow: { startSeconds: 0.4, endSeconds: 0.6 }, observations: [], errors: [], strengths: [], priorityCue: '',
    drill: { title: '', instructions: [], rationale: '' }, limitations: ['Joint-triplet status: unassessable for reliable angle calculation in this overview. No joint coordinates or angles are guessed.'], additionalEvidence: []
  } as OpenAiBattingAnalysis;

  const persisted = await createAndPersistBattingReport(analysis, root);
  const names = persisted.artifacts.map(artifact => artifact.name);
  assert.ok(names.includes('contact_crop.png'));
  assert.ok(names.includes('contact_review.png'));
  assert.ok(names.includes('joint_analysis.png'));
  assert.ok(names.includes('bat_path_sequence.png'));
  assert.ok(names.includes('follow_through.png'));
  assert.ok(names.includes('phase_sequence.png'));
  assert.ok(names.includes('analysis_bundle.zip'));
  const analysisJson = await readFile(path.join(persisted.directory, 'analysis.json'), 'utf8');
  const reportMarkdown = await readFile(path.join(persisted.directory, 'report.md'), 'utf8');
  assert.equal(analysisJson.includes('data:image/'), false);
  assert.equal(JSON.parse(analysisJson).phaseReviewFrameManifest.length, 1);
  assert.ok(JSON.parse(analysisJson).executionLog.outputs.some((output: { path: string }) => output.path === 'report.md'));
  assert.ok(reportMarkdown.includes('1 triplet(s) calculated from detailed phase frames; 0 unassessable'));
  assert.ok(reportMarkdown.includes('Overview-only limitation: Joint-triplet status'));
  assert.ok(reportMarkdown.includes('**At contact (frame 15):** ≈24° from vertical (handle to toe)'));
  assert.ok(reportMarkdown.includes('| frame_000015 | 0.500 s | contact | visible | ≈24° | 80% |'));
  assert.ok(reportMarkdown.includes('## CAPE video-derived kinetics'));
  assert.ok(reportMarkdown.includes('- incomingBallSpeedKmh: 101'));
  const zip = await readFile(path.join(persisted.directory, 'analysis_bundle.zip'));
  assert.equal(zip.subarray(0, 2).toString(), 'PK');
  assert.ok(zip.includes('joint_angles.json'));
  assert.ok(persisted.artifacts.every(artifact => artifact.sha256.length === 64));

  const reviewed = await persistBattingCoachReview(persisted.directory, persisted.analysisRecord, persisted.artifacts, {
    reviewerId: 'coach-test', reviewedAt: '2026-10-20T00:00:00.000Z', note: 'Review notes',
    findings: [{ findingIndex: 0, status: 'revised', note: 'Keep the cue shorter.' }]
  });
  const reviewedJson = JSON.parse(await readFile(path.join(persisted.directory, 'analysis.json'), 'utf8'));
  const reviewedMarkdown = await readFile(path.join(persisted.directory, 'report.md'), 'utf8');
  const reviewedZip = await readFile(path.join(persisted.directory, 'analysis_bundle.zip'));
  assert.equal(reviewedJson.coachReview.findings[0].status, 'revised');
  assert.ok(reviewedMarkdown.includes('Keep the cue shorter.'));
  assert.equal(reviewedZip.subarray(0, 2).toString(), 'PK');
  assert.ok(reviewed.artifacts.every(artifact => artifact.sha256.length === 64));

  const overlayBuffer = Buffer.from((await dataUrlPng()).split(',', 2)[1], 'base64');
  const persistedOverlay = await persistOpenAiPoseOverlay(
    persisted.directory,
    reviewed.analysisRecord,
    reviewed.artifacts,
    {
      status: 'success',
      metrics: { bat_angle_deg: 24 },
      overlayArtifactName: 'pose_overlay.png',
      sequence: [{ frame_index: 16, timestamp_seconds: 0.55, phase: 'POST_CONTACT', status: 'success', artifactName: 'pose_sequence_0.png' }]
    },
    [
      { name: 'pose_overlay.png', buffer: overlayBuffer },
      { name: 'pose_sequence_0.png', buffer: overlayBuffer }
    ]
  );
  assert.equal((persistedOverlay.analysisRecord.poseOverlay as { metrics: { bat_angle_deg: number } }).metrics.bat_angle_deg, 24);
  assert.ok(persistedOverlay.artifacts.some(artifact => artifact.name === 'pose_overlay.png'));
  assert.ok(persistedOverlay.artifacts.some(artifact => artifact.name === 'pose_sequence_0.png'));
  const finalAnalysisJson = await readFile(path.join(persisted.directory, 'analysis.json'), 'utf8');
  assert.equal(finalAnalysisJson.includes('data:image/'), false);
  const finalZip = await readFile(path.join(persisted.directory, 'analysis_bundle.zip'));
  assert.ok(finalZip.includes('pose_overlay.png'));
  assert.ok(finalZip.includes('pose_sequence_0.png'));
});

test('persistable analysis omits inline frame data and the artifact allowlist rejects traversal', () => {
  const source = { contact: { imageDataUrl: 'data:image/png;base64,AAAA', timestampSeconds: 1 }, poseSequenceFrames: [{ imageDataUrl: 'data:image/png;base64,BBBB' }] } as unknown as OpenAiBattingAnalysis;
  const safe = toPersistableAnalysis(source);
  assert.equal(JSON.stringify(safe).includes('data:image/'), false);
  assert.equal(isBattingReportArtifactName('analysis_bundle.zip'), true);
  assert.equal(isBattingReportArtifactName('pose_overlay.png'), true);
  assert.equal(isBattingReportArtifactName('pose_sequence_8.png'), true);
  assert.equal(isBattingReportArtifactName('pose_sequence_9.png'), false);
  assert.equal(isBattingReportArtifactName('../analysis.json'), false);
});
