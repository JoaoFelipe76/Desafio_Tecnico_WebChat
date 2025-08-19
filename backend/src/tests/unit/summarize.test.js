import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeIfNeeded } from '../../../utils/llm/summarize.js';

test('summarizeIfNeeded returns null when below threshold', async () => {
  const shortText = 'Olá, tudo bem?';
  const res = await summarizeIfNeeded(shortText, 256);
  assert.equal(res, null);
});

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

test('summarizeIfNeeded summarizes when above threshold (optional)', { skip: !hasOpenAI() }, async () => {
  const longText = 'X'.repeat(2000);
  const res = await summarizeIfNeeded(longText, 10);
  assert.equal(typeof res, 'string');
  assert.ok(res.length > 0);
});


