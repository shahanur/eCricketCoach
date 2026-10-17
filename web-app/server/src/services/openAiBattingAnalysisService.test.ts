import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBattingVideoWithOpenAI, OpenAiBattingAnalysisError } from './openAiBattingAnalysisService.js';

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
