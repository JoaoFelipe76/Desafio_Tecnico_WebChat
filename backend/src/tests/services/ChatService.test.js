import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService } from '../../services/ChatService.js';

// Nota: Testes completos do ChatService exigem mock do agente/LLM.
// Para evitar chamadas reais à API, mantemos um teste básico com skip por padrão.

test('ChatService smoke test (skipped por padrão)', { skip: true }, async () => {
    const svc = new ChatService();
    const res = await svc.processUserMessage({ message: 'Oi' });
    assert.ok(res.sessionId);
    assert.equal(typeof res.reply, 'string');
});
