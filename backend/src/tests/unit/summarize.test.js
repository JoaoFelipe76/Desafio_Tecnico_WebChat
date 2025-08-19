import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeIfNeeded } from '../../utils/llm/summarize.js';

function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// === CENÁRIOS POSITIVOS ===

test('summarizeIfNeeded: retorna null para texto curto (abaixo do threshold)', async () => {
  const shortText = 'Olá, quero contratar internet fibra';
  const res = await summarizeIfNeeded(shortText, 256);
  assert.equal(res, null);
});

test('summarizeIfNeeded: resume texto longo com threshold baixo (optional)', { skip: !hasOpenAI() }, async () => {
  const longText = 'Olá, eu gostaria de contratar um plano de internet fibra para minha casa. ' +
                   'Moro em um apartamento de 3 quartos e trabalho home office, então preciso de uma velocidade boa. ' +
                   'Atualmente pago R$ 120 por mês para outra operadora mas a velocidade é muito baixa. ' +
                   'Vocês têm algum plano que atenda minhas necessidades? Preciso de pelo menos 100 Mbps. ' +
                   'Também gostaria de saber sobre a instalação e se há taxa de adesão.';
  const res = await summarizeIfNeeded(longText, 50);
  assert.equal(typeof res, 'string');
  assert.ok(res.length > 0);
  assert.ok(res.length < longText.length);
});

test('summarizeIfNeeded: processa texto com caracteres especiais (optional)', { skip: !hasOpenAI() }, async () => {
  const textWithSpecialChars = 'Olá! Preciso de internet 🌐 para streaming 📺 e jogos 🎮. ' +
                               'Minha velocidade atual é 10Mbps mas preciso de pelo menos 200Mbps. ' +
                               'Quanto custa o plano premium? Há desconto para estudantes? ' +
                               'Também quero saber sobre Wi-Fi 6 e roteador incluso no pacote.'.repeat(10);
  const res = await summarizeIfNeeded(textWithSpecialChars, 100);
  assert.equal(typeof res, 'string');
  assert.ok(res.length > 0);
});

// === CENÁRIOS NEGATIVOS ===

test('summarizeIfNeeded: retorna null para string vazia', async () => {
  const res = await summarizeIfNeeded('', 100);
  assert.equal(res, null);
});

test('summarizeIfNeeded: retorna null para texto null/undefined', async () => {
  const resNull = await summarizeIfNeeded(null, 100);
  const resUndefined = await summarizeIfNeeded(undefined, 100);
  assert.equal(resNull, null);
  assert.equal(resUndefined, null);
});

test('summarizeIfNeeded: retorna null para texto só com espaços', async () => {
  const whitespaceText = '   \n\t   \n  ';
  const res = await summarizeIfNeeded(whitespaceText, 10);
  assert.equal(res, null);
});
