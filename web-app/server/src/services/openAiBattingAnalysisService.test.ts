import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { analyzeBattingVideoWithOpenAI, calculateProjectedAngle, OpenAiBattingAnalysisError } from './openAiBattingAnalysisService.js';

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

test('projected joint angles are calculated deterministically in image pixels', () => {
  assert.equal(calculateProjectedAngle({ x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), 90);
  assert.equal(calculateProjectedAngle(null, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), null);
  assert.equal(calculateProjectedAngle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 1 }, 100, 100), null);
});

test('detailed strict schema includes phase landmark provenance and rejects extra root properties', async () => {
  const schema = JSON.parse(await readFile(path.join(process.cwd(), 'src/services/openai_inputs/detailed.schema.v1.json'), 'utf8'));
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.required.includes('landmarksByFrame'));
  assert.equal(schema.properties.landmarksByFrame.maxItems, 6);
  assert.equal(schema.properties.shotIdentification.additionalProperties, false);
  const overview = JSON.parse(await readFile(path.join(process.cwd(), 'src/services/openai_inputs/overview.schema.v1.json'), 'utf8'));
  const finding = overview.$defs.observation;
  assert.ok(finding.required.includes('frameIndices'));
  assert.equal(finding.additionalProperties, false);
});
