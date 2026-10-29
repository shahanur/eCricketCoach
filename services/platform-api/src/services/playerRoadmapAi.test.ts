import assert from 'node:assert/strict';
import test from 'node:test';
import OpenAI from 'openai';
import { generateOpenAiRoadmap } from './playerRoadmapAi.js';

function providerClient(text: string, status = 'completed') {
  return new OpenAI({
    apiKey: 'test-only', maxRetries: 0,
    fetch: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.text.format.type, 'json_object');
      assert.match(request.instructions, /untrusted data/);
      return new Response(JSON.stringify({
        id: 'response-test', object: 'response', created_at: 0, status, model: 'returned-test-model',
        output: [{ type: 'message', id: 'message-test', role: 'assistant', status: 'completed',
          content: [{ type: 'output_text', text, annotations: [] }] }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
}

test('OpenAI roadmap unwraps JSON and records the actual provider and model', async () => {
  const rows = [{ discipline: 'BATTING' }];
  const result = await generateOpenAiRoadmap('Test evidence', providerClient(JSON.stringify({ recommendations: rows })));
  assert.deepEqual(result, { data: rows, provider: 'OPENAI', model: 'returned-test-model' });
});

test('OpenAI roadmap rejects malformed, incomplete and extra-authority responses', async () => {
  for (const [body, status] of [
    ['not json', 'completed'], ['{"recommendations":[]}', 'incomplete'],
    ['{"recommendations":[],"score":100}', 'completed'],
  ]) {
    await assert.rejects(generateOpenAiRoadmap('Test evidence', providerClient(body, status)));
  }
});
