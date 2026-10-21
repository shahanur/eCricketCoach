import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { emptyOpenAiCapeKinetics, mapCapeKineticsResponse, analyzeVideoKineticsWithCape } from './openAiCapeKinetics.js';

test('maps CAPE video-derived metrics into OpenAI kinetics fields', () => {
  const result = mapCapeKineticsResponse({
    analytics_payload: {
      pre_contact: { bat_swing_speed_kmh: 91.4, bat_swing_arc_degrees: 112 },
      point_of_contact: {
        milestone_frame: 127,
        selection_source: 'gemini',
        ball_velocity_kmh: 104,
        estimated_ball_momentum_kg_m_s: 4.55,
        estimated_ball_kinetic_energy_j: 65.2
      },
      post_contact: {
        exit_velocity_kmh: 72,
        estimated_ball_momentum_kg_m_s: 3.12,
        estimated_ball_kinetic_energy_j: 31.6,
        launch_angle_degrees: 18,
        follow_through_arc_degrees: 97
      }
    }
  }, 123);
  assert.equal(result.status, 'available');
  assert.equal(result.source, 'cape');
  assert.equal(result.contactFrame, 127);
  assert.equal(result.contactSelectionSource, 'gemini');
  assert.deepEqual(result.metrics, {
    incomingBallSpeedKmh: 104,
    incomingMomentumKgMps: 4.55,
    incomingKineticEnergyJ: 65.2,
    exitSpeedKmh: 72,
    exitMomentumKgMps: 3.12,
    exitKineticEnergyJ: 31.6,
    launchAngleDegrees: 18,
    batSwingSpeedKmh: 91.4,
    batSwingArcDegrees: 112,
    followThroughArcDegrees: 97
  });
});

test('marks partial or empty CAPE measurements without fabricating values', () => {
  const partial = mapCapeKineticsResponse({ analytics_payload: { pre_contact: { bat_swing_arc_degrees: 90 } } }, 8);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.metrics.batSwingArcDegrees, 90);
  assert.equal(partial.metrics.incomingBallSpeedKmh, null);
  const unavailable = mapCapeKineticsResponse({}, 8);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.metrics.exitSpeedKmh, null);
  assert.equal(emptyOpenAiCapeKinetics('not_requested').status, 'not_requested');
});

test('calls CAPE with calibration and supports automatic parallel contact detection', async () => {
  const previous = {
    url: process.env.CAPE_API_URL,
    key: process.env.CAPE_API_KEY,
    timeout: process.env.OPENAI_CAPE_TIMEOUT_MS
  };
  let requestBody = '';
  let requestKey = '';
  const server = createServer((request, response) => {
    requestBody = '';
    requestKey = String(request.headers['x-api-key'] || '');
    request.setEncoding('utf8');
    request.on('data', chunk => { requestBody += chunk; });
    request.on('end', () => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      const manual = requestBody.includes('name="manual_frames"');
      response.end(JSON.stringify({
        analytics_payload: {
          pre_contact: { bat_swing_speed_kmh: 88 },
          point_of_contact: { milestone_frame: manual ? 42 : 55, selection_source: manual ? 'manual' : 'detector', ball_velocity_kmh: 99 },
          post_contact: { exit_velocity_kmh: 70 }
        }
      }));
    });
  });
  try {
    server.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.CAPE_API_URL = `http://127.0.0.1:${address.port}`;
    process.env.CAPE_API_KEY = 'test-cape-key';
    process.env.OPENAI_CAPE_TIMEOUT_MS = '30000';
    const result = await analyzeVideoKineticsWithCape({
      video: Buffer.from('synthetic video bytes'), filename: 'clip.mp4', mimeType: 'video/mp4',
      calibrationPoints: [[10, 10], [100, 10], [100, 200], [10, 200]],
      contactFrame: 42, handedness: 'left', shotType: 'forward_defence'
    });
    assert.equal(requestKey, 'test-cape-key');
    assert.match(requestBody, /name="calibration_points"\r?\n\r?\n\[\[10,10\],\[100,10\],\[100,200\],\[10,200\]\]/);
    assert.match(requestBody, /name="manual_frames"\r?\n\r?\n\{"pre_contact":\[\],"point_of_contact":\[42\],"post_contact":\[\]\}/);
    assert.equal(result.metrics.incomingBallSpeedKmh, 99);
    assert.equal(result.metrics.exitSpeedKmh, 70);
    assert.equal(result.metrics.batSwingSpeedKmh, 88);
    assert.equal(result.contactFrame, 42);
    assert.equal(result.contactSelectionSource, 'manual');

    requestBody = '';
    const parallelResult = await analyzeVideoKineticsWithCape({
      video: Buffer.from('synthetic video bytes'), filename: 'clip.mp4', mimeType: 'video/mp4',
      calibrationPoints: [[10, 10], [100, 10], [100, 200], [10, 200]],
      handedness: 'left', shotType: 'forward_defence'
    });
    assert.match(requestBody, /name="calibration_points"\r?\n\r?\n\[\[10,10\],\[100,10\],\[100,200\],\[10,200\]\]/);
    assert.doesNotMatch(requestBody, /name="manual_frames"/);
    assert.equal(parallelResult.contactFrame, 55);
    assert.equal(parallelResult.contactSelectionSource, 'detector');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previous.url === undefined) delete process.env.CAPE_API_URL;
    else process.env.CAPE_API_URL = previous.url;
    if (previous.key === undefined) delete process.env.CAPE_API_KEY;
    else process.env.CAPE_API_KEY = previous.key;
    if (previous.timeout === undefined) delete process.env.OPENAI_CAPE_TIMEOUT_MS;
    else process.env.OPENAI_CAPE_TIMEOUT_MS = previous.timeout;
  }
});
