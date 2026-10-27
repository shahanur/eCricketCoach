import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { analyzeBattingVideoWithOpenAI, calculateBatAngle, calculateBatAngles, calculateContactBatAngle, calculateProjectedAngle, contactFrameImageDetail, denseSourceFrameSelectFilter, denseSourceFrameWindow, extractStructuredOutput, formatFrameSourceMap, isOpenAiTimeoutMessage, nextOutputTokenBudget, normalizeFrameReferenceList, normalizeLandmarksInCrop, OpenAiBattingAnalysisError, renderPromptTemplate, safeOpenAiErrorDiagnostics, selectDenseContactWindow, validateAndNormalizeOverview } from './openAiBattingAnalysisService.js';

test('OpenAI batting analysis reports a clear configuration error without an API key', async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => analyzeBattingVideoWithOpenAI(Buffer.alloc(0)),
      (error: unknown) => error instanceof OpenAiBattingAnalysisError &&
        error.status === 503 && error.code === 'openai_not_configured'
    );
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test('completed, incomplete, and refused structured responses are handled distinctly', () => {
  const completed = extractStructuredOutput({
    id: 'resp_test', model: 'gpt-6.1-sol', status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
    usage: { input_tokens: 12, output_tokens: 5 }
  });
  assert.equal(completed.value, '{"ok":true}');
  assert.equal(completed.metadata.responseId, 'resp_test');
  assert.equal(completed.metadata.inputTokens, 12);
  assert.throws(() => extractStructuredOutput({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }),
    (error: unknown) => error instanceof OpenAiBattingAnalysisError && error.code === 'openai_response_incomplete');
  assert.throws(() => extractStructuredOutput({
    status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'not available' }] }]
  }), (error: unknown) => error instanceof OpenAiBattingAnalysisError && error.code === 'openai_analysis_refused');
});

test('only max-output-token truncation receives one bounded token-budget increase', () => {
  assert.equal(nextOutputTokenBudget('incomplete', 'max_output_tokens', 16_000, 32_000), 32_000);
  assert.equal(nextOutputTokenBudget('incomplete', 'max_output_tokens', 32_000, 32_000), null);
  assert.equal(nextOutputTokenBudget('incomplete', 'content_filter', 16_000, 32_000), null);
  assert.equal(nextOutputTokenBudget('completed', null, 16_000, 32_000), null);
});

test('request timeouts are classified and only the contact-anchor neighborhood uses high image detail', () => {
  assert.equal(isOpenAiTimeoutMessage('Request timed out.'), true);
  assert.equal(isOpenAiTimeoutMessage('invalid_request_error'), false);
  assert.equal(contactFrameImageDetail(0.994, 0.994), 'high');
  assert.equal(contactFrameImageDetail(0.95, 0.994), 'high');
  assert.equal(contactFrameImageDetail(0.9, 0.994), 'low');
  assert.equal(contactFrameImageDetail(0.8, 0.994), 'low');
});

test('frame-source map preserves source frame IDs and timestamps compactly', () => {
  assert.equal(
    formatFrameSourceMap([
      { sampleIndex: 0, frameIndex: 4, timestampSeconds: 0.133333 },
      { sampleIndex: 1, frameIndex: 10, timestampSeconds: 0.333333 }
    ]),
    'Chronological image map (sample: source-frame@PTS-seconds): 0:4@0.133 1:10@0.333. Images follow sample order; cite source frame indices.'
  );
});

test('OpenAI diagnostics include useful status/message metadata while redacting secrets and images', () => {
  const error = Object.assign(new Error('bad request sk-proj-abcdefghijklmnop data:image/jpeg;base64,QUJDREVGRw=='), {
    status: 400, code: 'invalid_request_error', request_id: 'req_test'
  });
  const diagnostics = safeOpenAiErrorDiagnostics(error);
  assert.equal(diagnostics.status, 400);
  assert.equal(diagnostics.code, 'invalid_request_error');
  assert.equal(diagnostics.requestId, 'req_test');
  assert.equal(diagnostics.message.includes('abcdefghijklmnop'), false);
  assert.equal(diagnostics.message.includes('QUJDREVGRw'), false);
  assert.ok(diagnostics.message.includes('[image data redacted]'));
});

test('projected joint angles are calculated deterministically in image pixels', () => {
  assert.equal(calculateProjectedAngle({ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), 90);
  assert.equal(calculateProjectedAngle({ x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 200, 100), 180);
  assert.equal(calculateProjectedAngle({ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 200, 100), 90);
  assert.equal(calculateProjectedAngle(null, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), null);
  assert.equal(calculateProjectedAngle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), null);
  assert.equal(calculateProjectedAngle({ x: Number.NaN, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), null);
  assert.equal(calculateProjectedAngle({ x: 1.1, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), null);
});

test('bat angle follows CAPE handle-to-toe convention from vertical in image pixels', () => {
  assert.equal(calculateBatAngle({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }, 101, 101), 0);
  assert.equal(calculateBatAngle({ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.2 }, 101, 101), 180);
  assert.equal(calculateBatAngle({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, 101, 101), 90);
  assert.equal(calculateBatAngle({ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, 101, 101), 45);
  assert.equal(calculateBatAngle({ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, 201, 101), 63.4);
  assert.equal(calculateBatAngle(null, { x: 0.5, y: 0.5 }, 101, 101), null);
  assert.equal(calculateBatAngle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, 101, 101), null);
  assert.equal(calculateBatAngle({ x: 1.2, y: 0.5 }, { x: 0.5, y: 0.5 }, 101, 101), null);
});

test('contact bat angle prefers handle-to-toe and falls back to hands-to-contact', () => {
  const frame = { frameIndex: 42, width: 101, height: 101 };
  const direct = calculateContactBatAngle(frame, { x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, {}, null);
  assert.equal(direct?.method, 'handle_to_toe');
  assert.equal(direct?.angleDegrees, 90);
  const fallback = calculateContactBatAngle(frame, null, null, { leftWrist: { x: 0.4, y: 0.4 }, rightWrist: { x: 0.6, y: 0.4 } }, { x: 0.5, y: 0.7 });
  assert.equal(fallback?.method, 'wrists_to_contact');
  assert.equal(fallback?.angleDegrees, 0);
  assert.equal(fallback?.frameIndex, 42);
  assert.equal(calculateContactBatAngle(frame, null, null, {}, { x: 0.5, y: 0.7 }), null);
  const grip = calculateContactBatAngle(frame, null, { x: 0.8, y: 0.4 }, { leftWrist: { x: 0.2, y: 0.4 } }, null);
  assert.equal(grip?.method, 'hands_to_toe');
  assert.equal(grip?.angleDegrees, 90);
});

test('per-frame bat angles use the wrist grip when the model omits the hidden handle', () => {
  const frames = [{ sampleIndex: 0, frameIndex: 29, timestampSeconds: 1, width: 101, height: 101, imageDataUrl: '', imagePath: '', playerBoxNorm: null }];
  const [record] = calculateBatAngles(
    [{ frameIndex: 29, phase: 'contact', confidence: 0.6, visibility: 'partially_visible', handleNorm: null, toeNorm: { x: 0.5, y: 0.8 } }],
    frames,
    new Map([[29, { leftWrist: { x: 0.4, y: 0.3 }, rightWrist: { x: 0.6, y: 0.3 } }]])
  );
  assert.equal(record.handleSource, 'wrists');
  assert.equal(record.angleDegrees, 0);
  assert.equal(record.status, 'calculated');
  const [missing] = calculateBatAngles(
    [{ frameIndex: 29, phase: 'contact', confidence: 0.6, visibility: 'partially_visible', handleNorm: null, toeNorm: { x: 0.5, y: 0.8 } }],
    frames
  );
  assert.equal(missing.status, 'unassessable');
});

test('crop landmark coordinates map back to the source image and out-of-crop points remain null', () => {
  const normalized = normalizeLandmarksInCrop(
    { head: { x: 0.5, y: 0.5 }, leftWrist: { x: 0.1, y: 0.1 } },
    { width: 100, height: 200 },
    { left: 25, top: 50, width: 50, height: 100 }
  );
  assert.deepEqual(normalized.head, { x: 0.5, y: 0.5 });
  assert.equal(normalized.left_wrist, null);
});

test('sample-position frame citations normalize to original source frame IDs', () => {
  const frames = [{ frameIndex: 0 }, { frameIndex: 5 }, { frameIndex: 12 }, { frameIndex: 20 }];
  assert.deepEqual(normalizeFrameReferenceList([0, 1, 2, 3], frames), [0, 5, 12, 20]);
  assert.deepEqual(normalizeFrameReferenceList([0, 5, 12, 20], frames), [0, 5, 12, 20]);
  assert.equal(normalizeFrameReferenceList([99], frames), null);
});

test('overview responses citing supplied sample positions pass and are canonicalized to source IDs', () => {
  const frames = [0, 5, 12, 20, 27, 35, 42, 50, 57, 65, 72, 80, 87, 95, 102, 110, 117, 125].map(frameIndex => ({ frameIndex }));
  const candidatePhases = [
    { phase: 'preparation', sampleIndex: 0, confidence: 0.65, evidence: 'Late preparation is visible.', playerBoxNorm: null },
    { phase: 'foot_plant', sampleIndex: 2, confidence: 0.7, evidence: 'The front foot appears settled.', playerBoxNorm: null },
    { phase: 'downswing', sampleIndex: 3, confidence: 0.9, evidence: 'The bat is descending.', playerBoxNorm: null },
    { phase: 'contact', sampleIndex: 4, confidence: 0.68, evidence: 'Candidate anchor only.', playerBoxNorm: null },
    { phase: 'extension', sampleIndex: 5, confidence: 0.72, evidence: 'The bat rises.', playerBoxNorm: null },
    { phase: 'finish', sampleIndex: 9, confidence: 0.95, evidence: 'A sustained finish is visible.', playerBoxNorm: null }
  ];
  const result = {
    subjectStatus: 'single_batter', subjectEvidence: 'One batter is visible.',
    contactCandidateSampleIndex: 4, contactCandidateConfidence: 0.68, contactCandidateEvidence: 'Contact is unclear.',
    summary: 'One candidate stroke.',
    observations: [{ title: 'Sparse phase', observation: 'The initial setup is omitted.', coachingImplication: 'Request earlier footage.', frameIndices: [0, 1, 2, 3], confidence: 'moderate' }],
    phases: [], limitations: [],
    shotCandidates: [{
      shotId: 'shot_01', sampleIndex: 4, shotType: 'candidate_front_foot_drive', confidence: 0.88,
      evidence: 'One continuous stroke.', windowStartSeconds: 0, windowEndSeconds: 4.259956, phases: candidatePhases
    }]
  };
  assert.equal(validateAndNormalizeOverview(result, frames, 4.26), true);
  assert.deepEqual(result.observations[0].frameIndices, [0, 5, 12, 20]);
});

test('stroke-wide overview windows fall back to bounded contact-anchor extraction', () => {
  assert.deepEqual(selectDenseContactWindow(0.9942, 4.259956, 0.5, 2, 0, 4.259956), {
    startSeconds: 0.4942,
    endSeconds: 1.4942,
    usedProposedWindow: false
  });
  assert.deepEqual(selectDenseContactWindow(0.9942, 4.259956, 0.5, 2, 0.760944, 1.260822), {
    startSeconds: 0.4942,
    endSeconds: 1.4942,
    usedProposedWindow: true
  });
});

test('dense contact extraction selects probed source indices for irregular timestamps', () => {
  const frames = denseSourceFrameWindow([0, 0.033, 0.071, 0.1, 0.141], 0.03, 0.1);
  assert.deepEqual(frames, [
    { index: 1, timestamp: 0.033 },
    { index: 2, timestamp: 0.071 },
    { index: 3, timestamp: 0.1 }
  ]);
  assert.equal(denseSourceFrameSelectFilter(frames), 'between(n\\,1\\,3)');
});

test('detailed strict schema includes phase landmark provenance and rejects extra root properties', async () => {
  const schema = JSON.parse(await readFile(path.join(process.cwd(), 'src/services/openai_inputs/detailed.schema.v1.json'), 'utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.required.includes('landmarksByFrame'));
  assert.equal(schema.properties.landmarksByFrame.maxItems, 6);
  assert.equal(schema.properties.shotIdentification.additionalProperties, false);
  assert.ok(schema.$defs.finding.required.includes('coachingCue'));
  assert.ok(schema.$defs.finding.required.includes('drill'));
  assert.ok(schema.properties.footageQuality.required.includes('framing'));
  assert.ok(schema.required.includes('kinetics'));
  assert.equal(schema.properties.kinetics.properties.status.enum[0], 'not_measured');
  assert.equal(schema.properties.annotations.maxItems, 100);
  const overview = JSON.parse(await readFile(path.join(process.cwd(), 'src/services/openai_inputs/overview.schema.v1.json'), 'utf8'));
  const finding = overview.$defs.observation;
  assert.ok(finding.required.includes('frameIndices'));
  assert.equal(finding.additionalProperties, false);
  assert.ok(overview.properties.shotCandidates.items.required.includes('windowStartSeconds'));
  assert.ok(overview.properties.shotCandidates.items.required.includes('phases'));
  assert.ok(overview.required.includes('subjectStatus'));
});

test('versioned prompt assets include the handoff instructions and resolve every request placeholder', async () => {
  const assetPath = (name: string) => path.join(process.cwd(), 'src/services/openai_inputs', name);
  const [shared, overviewTemplate, detailedTemplate] = await Promise.all([
    readFile(assetPath('shared-instructions.v1.md'), 'utf8'),
    readFile(assetPath('overview.v1.md'), 'utf8'),
    readFile(assetPath('detailed.v1.md'), 'utf8')
  ]);
  for (const requiredHeading of ['EVIDENCE', 'CONTACT', 'KINEMATICS', 'KINETICS', 'JOINT ANGLES', 'BAT PATH', 'ANNOTATIONS', 'OUTPUT']) {
    assert.ok(shared.includes(requiredHeading));
  }
  assert.ok(overviewTemplate.includes('Locate each batting stroke in this overview sequence.'));
  assert.ok(overviewTemplate.includes('{{validated_user_metadata_json}}'));
  for (const placeholder of ['shot_id', 'shot_type', 'batter_handedness', 'camera_view', 'timing_metadata', 'priorities']) {
    assert.ok(detailedTemplate.includes(`{{${placeholder}}}`));
  }
  const resolvedOverview = renderPromptTemplate(overviewTemplate, { validated_user_metadata_json: '{"shot_type":"unknown"}' });
  const resolvedDetailed = renderPromptTemplate(detailedTemplate, {
    shot_id: 'shot_001', shot_type: 'front_foot_drive', batter_handedness: 'right',
    camera_view: 'side_on', timing_metadata: '{"playback_speed":"unknown"}', priorities: '["contact"]'
  });
  assert.equal(/\{\{[a-z_]+\}\}/.test(resolvedOverview + resolvedDetailed), false);
  assert.ok(resolvedDetailed.includes('Handedness: right'));
  assert.ok(resolvedDetailed.includes('early elbow folding'));
});
