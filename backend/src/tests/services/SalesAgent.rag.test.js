import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesAgent } from '../../utils/llm/salesAgent.js';

function hasEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OPENAI_API_KEY);
}

test('SalesAgent: smoke com RAG (optional)', { skip: !hasEnv() }, async () => {
  const agent = createSalesAgent();
  const res = await agent.call({ input: 'Olá, quais planos vocês oferecem?', sessionId: 'test-session' });
  assert.ok(typeof res.output === 'string');
});


