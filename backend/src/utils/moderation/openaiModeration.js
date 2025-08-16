import OpenAI from 'openai';

const CATEGORY_BLOCK = 'Posso ajudar apenas com informações sobre nossos planos de internet.';

export async function runModerationCheck(message) {
  if (!process.env.OPENAI_API_KEY) return { ok: true };
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const result = await client.moderations.create({ model: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest', input: message });
    const flagged = Boolean(result?.results?.[0]?.flagged);
    if (flagged) return { ok: false, reason: 'moderation_flag', reply: CATEGORY_BLOCK };
    return { ok: true };
  } catch {
    return { ok: true };
  }
}