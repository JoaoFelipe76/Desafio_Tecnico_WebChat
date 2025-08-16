const DOMAIN_KEYWORDS = [
  'internet', 'banda larga', 'fibra', 'velocidade', 'mbps', 'plano', 'planos', 'wifi', 'wi-fi',
  'roteador', 'instalação', 'preço', 'promoção', 'venda', 'proposta', 'contratar', 'orçamento',
  'streaming', 'home office', 'jogos', 'ping', 'latência', 'download', 'upload',
  // cobertura/cep
  'cobertura', 'cep', 'endereço', 'endereco'
];

const BLOCK_MESSAGE = 'Posso ajudar apenas com informações sobre nossos planos de internet.';

export function isInDomain(text) {
  const lower = (text || '').toLowerCase();
  return DOMAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

export function applyContextOutputFilter(text, input) {
  const t = (text || '').toLowerCase();
  const i = (input || '').toLowerCase();
  const emailRx = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/i;
  const phoneRx = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s]?\d{4}/;
  const cepRx = /\b\d{5}-?\d{3}\b/;
  const nameHints = ['meu nome', 'nome completo', 'me chamo', 'sou '];
  const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];

  // allow greetings
  if (greetings.some((g) => i.startsWith(g) || t.startsWith(g))) return { ok: true };
  // allow contact/cobertura flows
  if (emailRx.test(i) || phoneRx.test(i) || cepRx.test(i) || nameHints.some((h) => i.includes(h))) return { ok: true };
  if (emailRx.test(t) || phoneRx.test(t) || cepRx.test(t)) return { ok: true };

  return isInDomain(text) || isInDomain(input)
    ? { ok: true }
    : { ok: false, reason: 'drifted_output', reply: BLOCK_MESSAGE };
}


