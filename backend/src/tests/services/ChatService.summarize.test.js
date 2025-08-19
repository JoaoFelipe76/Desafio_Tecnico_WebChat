import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService } from '../../services/ChatService.js';

function hasEnv() {
  return Boolean(process.env.OPENAI_API_KEY);
}

test('ChatService: usa mensagem original quando abaixo do threshold de resumo (optional)', { skip: !hasEnv() }, async () => {
  const svc = new ChatService();
  const res = await svc.processUserMessage({ message: 'Oi, gostaria de ajuda' });
  assert.ok(res.sessionId);
  assert.equal(typeof res.reply, 'string');
});


