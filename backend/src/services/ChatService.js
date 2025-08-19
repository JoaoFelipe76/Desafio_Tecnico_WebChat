import { v4 as uuidv4 } from 'uuid';
import { createSalesAgent } from '../utils/llm/salesAgent.js';
import { runModerationCheck } from '../utils/moderation/openaiModeration.js';
import { applyContextOutputFilter } from '../utils/filters/contextFilter.js';
import { detectPromptInjection, BLOCK_MESSAGE } from '../utils/security/injectionDetector.js';
import { summarizeIfNeeded } from '../utils/llm/summarize.js';
import { SupabaseVectorStore } from '../utils/llm/supabaseVectorStore.js';
import { LlmProviderError } from '../exceptions/HttpError.js';

export class ChatService {
  constructor() {
    this.sessions = new Map();
  }

  getOrCreate(sessionId) {
    const isUuid = typeof sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId);
    const validId = isUuid ? sessionId : null;
    if (validId && this.sessions.has(validId)) return { id: validId, agent: this.sessions.get(validId) };
    const id = validId || uuidv4();
    const agent = createSalesAgent();
    this.sessions.set(id, agent);
    return { id, agent };
  }

  async processUserMessage({ message, sessionId }) {
    const mod = await runModerationCheck(message);
    if (!mod.ok) return { sessionId, reply: mod.reply, guarded: true, reason: mod.reason };
    if (detectPromptInjection(message)) {
      return { sessionId, reply: BLOCK_MESSAGE, guarded: true, reason: 'prompt_injection' };
    }

    const { id, agent } = this.getOrCreate(sessionId);
    const maybeSummary = await summarizeIfNeeded(message, 256);
    const inputForAgent = maybeSummary || message;
    let ai;
    try {
      ai = await agent.call({ input: inputForAgent, sessionId: id });
    } catch (e) {
      throw new LlmProviderError('Falha ao chamar o provedor de LLM', { cause: e?.message, provider: 'agent' });
    }
    const finalText = ai.output || String(ai);

    const out = applyContextOutputFilter(finalText, message);
    if (!out.ok) return { sessionId: id, reply: out.reply, guarded: true, reason: out.reason };

    
    if (process.env.MEMORY_PERSIST !== 'false' && !(ai?.meta && ai.meta.assistantPersisted === true)) {
      try {
        const store = new SupabaseVectorStore();
        await store.addMemoryTurn({ sessionId: id, role: 'assistant', text: finalText });
      } catch (e) {
        console.warn('[mem] ChatService assistant persist failed:', e?.message);
      }
    }

    return { sessionId: id, reply: finalText, meta: ai.meta };
  }
}
