import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseVectorStore } from '../../utils/llm/supabaseVectorStore.js';

function hasEnv() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OPENAI_API_KEY);
}

test('Memória via Supabase: addMemoryTurn + searchMemory (optional)', { skip: !hasEnv() }, async () => {
  const store = new SupabaseVectorStore();
  const marker = `mem_${Math.random().toString(36).slice(2)}`;

  const add1 = await store.addMemoryTurn({ sessionId: 'test-session', role: 'user', text: `Quero saber sobre ${marker}` });
  const add2 = await store.addMemoryTurn({ sessionId: 'test-session', role: 'assistant', text: `Claro, detalhes sobre ${marker}` });
  assert.equal(add1.ok, true);
  assert.equal(add2.ok, true);

  const res = await store.searchMemory({ sessionId: 'test-session', query: marker, k: 5 });
  assert.ok(Array.isArray(res));
  assert.ok(res.some(r => (r.text || '').includes(marker)), 'Resultado deve conter o conteúdo inserido');
});


