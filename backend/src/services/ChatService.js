import { v4 as uuidv4 } from 'uuid';
import { createSalesAgent } from '../utils/llm/salesAgent.js';
import { runModerationCheck } from '../utils/moderation/openaiModeration.js';
import { applyContextOutputFilter } from '../utils/filters/contextFilter.js';
import { detectPromptInjection, BLOCK_MESSAGE } from '../utils/security/injectionDetector.js';
import { summarizeIfNeeded } from '../utils/llm/summarize.js';

export class ChatService {
  constructor() {
    this.sessions = new Map();
  }

  getOrCreate(sessionId) {
    if (sessionId && this.sessions.has(sessionId)) return { id: sessionId, agent: this.sessions.get(sessionId) };
    const id = sessionId || uuidv4();
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
    const ai = await agent.call({ input: inputForAgent, sessionId: id });
    const finalText = ai.output || String(ai);

    const out = applyContextOutputFilter(finalText);
    if (!out.ok) return { sessionId: id, reply: out.reply, guarded: true, reason: out.reason };

    return { sessionId: id, reply: finalText, meta: ai.meta };
  }
}
