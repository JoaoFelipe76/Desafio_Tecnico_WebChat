import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService } from '../../src/services/ChatService.js';

test('ChatService creates session and returns reply', async () => {
  const svc = new ChatService();
  const res = await svc.processUserMessage({ message: 'Oi', sessionId: undefined });
  assert.ok(res.sessionId);
  assert.equal(typeof res.reply, 'string');
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from '../../services/ChatService.js';

let callImpl;
vi.mock('../../src/utils/llm/salesAgent.js', () => ({
    createSalesAgent: () => ({
        call: (...args) => callImpl(...args),
    }),
}));

describe('ChatService', () => {
    let service;
    beforeEach(() => { service = new ChatService(); callImpl = vi.fn().mockResolvedValue({ output: 'Resposta simulada' }); });

    it('cria sessão quando não há sessionId', async () => {
        const result = await service.processUserMessage({ message: 'Oi' });
        expect(result.sessionId).toBeTruthy();
        expect(result.reply).toBe('Resposta simulada');
    });

    it('reutiliza sessão existente', async () => {
        const first = await service.processUserMessage({ message: 'Oi' });
        const second = await service.processUserMessage({ message: 'Tudo bem?', sessionId: first.sessionId });
        expect(second.sessionId).toBe(first.sessionId);
    });

    it('usa reply.text quando não há output', async () => {
        callImpl = vi.fn().mockResolvedValue({ text: 'Texto alternativo' });
        const result = await service.processUserMessage({ message: 'Teste' });
        expect(result.reply).toBe('Texto alternativo');
    });

    it('converte retorno primitivo em string quando sem output/text', async () => {
        callImpl = vi.fn().mockResolvedValue('bruto');
        const result = await service.processUserMessage({ message: 'Teste' });
        expect(result.reply).toBe('bruto');
    });

    it('propaga erro do agente', async () => {
        callImpl = vi.fn().mockRejectedValue(new Error('falha no llm'));
        await expect(service.processUserMessage({ message: 'Teste' })).rejects.toThrow('falha no llm');
    });

    it('concorrência com mesma sessão não quebra', async () => {
        const created = await service.processUserMessage({ message: 'primeira' });
        const [r1, r2] = await Promise.all([
            service.processUserMessage({ message: 'A', sessionId: created.sessionId }),
            service.processUserMessage({ message: 'B', sessionId: created.sessionId }),
        ]);
        expect(r1.sessionId).toBe(created.sessionId);
        expect(r2.sessionId).toBe(created.sessionId);
    });
});


