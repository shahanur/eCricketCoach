import assert from 'node:assert/strict';
import test from 'node:test';
import { makeJointAlignmentSvg, makeMovementSequenceSvg, type SequencePhase, type VisualFrame } from './openAiBattingVisuals.js';

const image: VisualFrame = {
  frameIndex: 240,
  timestampSeconds: 8.0129,
  width: 200,
  height: 400,
  imageDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
  playerBoxNorm: { left: 0.35, top: 0.2, right: 0.75, bottom: 0.9 }
};

test('movement sequence SVG contains four phases without technical frame labels', () => {
  const phases: SequencePhase[] = ['Preparation', 'Downswing', 'Near contact', 'Follow-through']
    .map((label, index) => ({ label, frame: { ...image, frameIndex: 200 + index, timestampSeconds: 6.9 + index } }));
  const svg = makeMovementSequenceSvg(phases);

  for (const label of ['Preparation', 'Downswing', 'Near contact', 'Follow-through']) assert.ok(svg.includes(label));
  assert.equal(svg.includes('Frame #200'), false);
  assert.equal(svg.includes('6.900 s'), false);
  assert.ok(svg.includes(image.imageDataUrl));
});

test('joint alignment SVG includes approximate landmarks and illustrative-force disclaimer', () => {
  const svg = makeJointAlignmentSvg({
    frame: image,
    landmarks: {
      head: { x: 0.55, y: 0.25 },
      leftShoulder: { x: 0.48, y: 0.35 },
      rightShoulder: { x: 0.62, y: 0.35 },
      leftElbow: null,
      rightElbow: null,
      leftWrist: null,
      rightWrist: null,
      leftHip: null,
      rightHip: null,
      leftKnee: null,
      rightKnee: null,
      leftAnkle: null,
      rightAnkle: null,
      frontToe: { x: 0.58, y: 0.86 }
    },
    contactPoint: { x: 0.57, y: 0.7 },
    observations: [{ title: 'Head position', observation: 'Head is screen-left of front toe.', coachingImplication: 'Test movement with a side-on clip.', confidence: 'moderate' }],
    errors: [],
    priorityCue: 'Step to the line.',
    limitations: ['Exact impact is blurred.']
  });

  assert.ok(svg.includes('CONTACT CANDIDATE'));
  assert.ok(svg.includes('Head position'));
  assert.ok(svg.includes('Step to the line.'));
  assert.ok(svg.includes('KINETICS · ILLUSTRATIVE ONLY'));
  assert.equal(svg.includes('Near-contact frame #240'), false);
  assert.equal(svg.includes('Confidence: moderate'), false);
  const visibleText = svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(visibleText.includes('No force, torque, power'));
  assert.ok(svg.includes(image.imageDataUrl));
});
