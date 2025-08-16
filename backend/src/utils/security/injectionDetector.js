const INJECTION_PATTERNS = [
  /ignore (all|the) (previous|prior) (instructions|rules)/i,
  /disregard (the )?(above|earlier) (instructions|rules)/i,
  /you are (now|no longer) bound/i,
  /jailbreak/i,
  /\bDAN\b/i,
  /act as/i,
  /system prompt/i,
  /reveal (the )?(system|hidden) (prompt|instructions)/i,
  /developer mode/i,
  /bypass (safety|guardrails|restrictions)/i,
];

export function detectPromptInjection(message) {
  const text = String(message || '');
  return INJECTION_PATTERNS.some((rx) => rx.test(text));
}

export const BLOCK_MESSAGE = 'Posso ajudar apenas com informações sobre nossos planos de internet.';


