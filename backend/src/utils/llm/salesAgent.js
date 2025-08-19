import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AgentOutputSchema } from '../../schemas/agentOutput.js';
import { SupabaseVectorStore } from './supabaseVectorStore.js';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

function createMemory() {
    const history = [];
    return {
        addUser(message) { history.push({ role: 'user', content: message }); },
        addAI(message) { history.push({ role: 'assistant', content: message }); },
        toMessages() { return history.map((m) => ({ ...m })); },
    };
}


export function createSalesAgent() {
    const llm = new ChatOpenAI({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        apiKey: process.env.OPENAI_API_KEY,
    });

    const memory = createMemory();
    const vectorStore = new SupabaseVectorStore();
    let currentSessionId = null;
    

    const ATENDENTE_PROMPT = `
Você é Ana, uma atendente virtual especializada em vendas de planos de internet da empresa TurboNet.

PERSONALIDADE:
- Simpática, prestativa e profissional
- Usa emojis moderadamente para ser mais calorosa
- Faz perguntas direcionadas para identificar necessidades
- É persuasiva mas não insistente
- Adapta a linguagem ao perfil do cliente

OBJETIVOS DA CONVERSA:
1. Saudar o cliente e se apresentar
2. Identificar necessidades (quantas pessoas, tipo de uso, dispositivos, orçamento)
3. Recomendar 1-2 planos mais adequados ao perfil
4. Destacar benefícios e vantagens
5. Conduzir para fechamento solicitando dados de contato
6. Superar objeções com argumentos técnicos

INSTRUÇÕES IMPORTANTES:
- Se o cliente não informou nome, pergunte primeiro
- Identifique o perfil de uso: básico, moderado, intenso ou profissional
- Sempre justifique suas recomendações baseado nas necessidades
- Use técnicas de vendas: escassez, benefícios, comparações
- Se o cliente demonstrar interesse, peça dados para finalizar
- Não invente preços ou características não listadas
- Mantenha o foco na venda durante toda conversa
`;

    const systemInstruction = `${ATENDENTE_PROMPT}\n\nRegras adicionais:\n- Não repita pedidos de dados já informados (use os campos conhecidos).\n- Quando for encerrar (step = \"closing\"), diga: \"Nossa equipe entrará em contato com você para finalizar a contratação e orientar os próximos passos.\"`;

    const prompt = ChatPromptTemplate.fromMessages([
        ['system', `${systemInstruction}\n\nFormate SEMPRE a resposta em JSON puro (sem markdown, sem cercas de código), com as chaves: response (string), step (greeting|needs|offer|closing|fallback), topics (array dentre [speed,usage,budget,provider,wifi,installation,promotion]). Não inclua texto fora do JSON e garanta que seja JSON válido.`],
        new MessagesPlaceholder('history'),
        ['system', 'Contexto relevante (recuperado por similaridade):\n{context}'],
        ['human', '{input}'],
    ]);

   
    const chain = RunnableSequence.from([
        async (input) => {
            const inputText = input.input ?? '';
            const externalHistory = Array.isArray(input.history) ? input.history : [];
            const historyMessages = externalHistory.length > 0 ? externalHistory : memory.toMessages();

            const normalizedHistory = historyMessages.map((m) => {
                const role = m.role || m._getType?.();
                const content = (m.content ?? '').toString();
                if (!role || role === 'human' || role === 'user') return new HumanMessage({ content });
                if (role === 'ai' || role === 'assistant') return new AIMessage({ content });
                if (role === 'system') return new SystemMessage({ content });
                return new HumanMessage({ content });
            });

            
            const sid = input.sessionId;
            const isUuid = typeof sid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sid);
            currentSessionId = isUuid ? sid : null;

            let context = ' ';
            let userPersisted = false;
            if (process.env.MEMORY_PERSIST !== 'false') {
                try {
                    const cleanedUser = String(inputText || '').trim();
                    const resUser = cleanedUser ? await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'user', text: cleanedUser }) : { ok: false };
                    userPersisted = !!(resUser && resUser.ok);
                    if (!userPersisted && resUser && resUser.error) {
                        console.warn('[mem] persist user insert error:', resUser.error?.message || resUser.error);
                    }
                } catch (e) { console.warn('[mem] failed to persist user turn:', e?.message); }
            }
            try {
                const kKb = Number(process.env.RAG_K || 4) || 4;
                const kMem = Number(process.env.MEMORY_K || 3) || 3;
                const memHits = await vectorStore.searchMemory({ sessionId: currentSessionId, query: inputText, k: kMem });
                const kbHits = await vectorStore.searchKB({ query: inputText, k: kKb });
                const texts = [];
                if (memHits?.length) texts.push(...memHits.map(s => s.text));
                if (kbHits?.length) texts.push(...kbHits.map(s => s.text));
                if (!texts.length) console.warn('[rag] no hits for query');
                context = normalizeContext(texts);
            } catch (e) { console.warn('[rag] error', e?.message); }

            return {
                input: inputText,
                history: normalizedHistory,
                context,
                sessionId: input.sessionId,
                userPersisted,
            };
        },
        prompt,
        llm,
        async (aiMessage, input) => {
            memory.addUser(input.input);
            const raw = aiMessage.content?.toString?.() || aiMessage.content || '';
            const content = sanitizeToJsonString(raw);
            let assistantPersisted = false;
            if (process.env.MEMORY_PERSIST !== 'false') {
                try {
                    const toPersistEarly = getAssistantPlainText(raw);
                    const resEarly = toPersistEarly ? await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'assistant', text: toPersistEarly }) : { ok: false };
                    assistantPersisted = !!(resEarly && resEarly.ok);
                    if (!assistantPersisted && resEarly && resEarly.error) {
                        console.warn('[mem] early persist assistant insert error:', resEarly.error?.message || resEarly.error);
                    }
                } catch (e) { console.warn('[mem] early persist assistant failed:', e?.message); }
            }
            try {
                const parsed = AgentOutputSchema.parse(JSON.parse(content));
                memory.addAI(parsed.response);
                if (process.env.MEMORY_PERSIST !== 'false') {
                    try {
                        if (!input.userPersisted) {
                            const cleanedUser2 = String(input.input || '').trim();
                            if (cleanedUser2) {
                                await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'user', text: cleanedUser2 });
                            }
                        }
                        if (!assistantPersisted) {
                            const cleanedAssistantParsed = getAssistantPlainText(parsed.response);
                            const resParsed = cleanedAssistantParsed ? await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'assistant', text: cleanedAssistantParsed }) : { ok: false };
                            assistantPersisted = !!(resParsed && resParsed.ok);
                            if (!assistantPersisted && resParsed && resParsed.error) {
                                console.warn('[mem] assistant persist (parsed) insert error:', resParsed.error?.message || resParsed.error);
                            }
                        }
                    } catch (e) { console.warn('[mem] failed to persist assistant turn (parsed):', e?.message); }
                }
                return { output: parsed.response, meta: { ...parsed, assistantPersisted, userPersisted: !!input.userPersisted } };
            } catch (e1) {
                console.warn('[agent] JSON parse failed, attempting repair');
                const repaired = tryRepairJson(content);
                if (repaired) {
                    try {
                        const parsed2 = AgentOutputSchema.parse(JSON.parse(repaired));
                        memory.addAI(parsed2.response);
                        try {
                            if (!input.userPersisted) {
                                const cleanedUser3 = String(input.input || '').trim();
                                if (cleanedUser3) {
                                    await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'user', text: cleanedUser3 });
                                }
                            }
                            if (!assistantPersisted) {
                                const cleanedAssistantRepaired = getAssistantPlainText(parsed2.response);
                                const resRepaired = cleanedAssistantRepaired ? await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'assistant', text: cleanedAssistantRepaired }) : { ok: false };
                                assistantPersisted = !!(resRepaired && resRepaired.ok);
                                if (!assistantPersisted && resRepaired && resRepaired.error) {
                                    console.warn('[mem] assistant persist (repaired) insert error:', resRepaired.error?.message || resRepaired.error);
                                }
                            }
                        } catch (e) { console.warn('[mem] failed to persist assistant turn (repaired):', e?.message); }
                        return { output: parsed2.response, meta: { ...parsed2, assistantPersisted, userPersisted: !!input.userPersisted } };
                    } catch (e2) { console.warn('[agent] repair parse failed'); }
                }
                memory.addAI(raw);
                if (process.env.MEMORY_PERSIST !== 'false') {
                    try {
                        if (!input.userPersisted) {
                            await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'user', text: input.input });
                        }
                        if (!assistantPersisted) {
                            const resRaw = await vectorStore.addMemoryTurn({ sessionId: currentSessionId, role: 'assistant', text: raw });
                            assistantPersisted = !!(resRaw && resRaw.ok);
                            if (!assistantPersisted && resRaw && resRaw.error) {
                                console.warn('[mem] assistant persist (raw) insert error:', resRaw.error?.message || resRaw.error);
                            }
                        }
                    } catch (e) { console.warn('[mem] failed to persist assistant turn (raw):', e?.message); }
                }
                return { output: raw, meta: { step: 'fallback', topics: [], assistantPersisted, userPersisted: !!input.userPersisted } };
            }
        },
    ]);

    function getAssistantPlainText(rawText) {
        const sanitized = sanitizeToJsonString(String(rawText || ''));
        try {
            const obj = JSON.parse(sanitized);
            const response = String(obj?.response ?? '').trim();
            if (response) return response;
        } catch (_) { /* ignore parse errors */ }
        return String(sanitized || '').trim();
    }

    function sanitizeToJsonString(text) {
        if (!text) return text;
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : text;
        const objMatch = candidate.match(/\{[\s\S]*\}/);
        return objMatch ? objMatch[0] : candidate;
    }

    function tryRepairJson(text) {
        if (!text) return null;
        let t = String(text)
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/,\s*([}\]])/g, '$1'); 
        const m = t.match(/\{[\s\S]*\}/);
        return m ? m[0] : null;
    }

    function normalizeContext(texts) {
        const seen = new Set();
        const emailRx = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/g;
        const phoneRx = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4})[-\s]?\d{4}/g;
        const maxChars = Number(process.env.RAG_MAX_CONTEXT_CHARS || 1200) || 1200;
        const chunks = [];
        for (const t of texts) {
            if (!t) continue;
            const key = t.trim();
            if (seen.has(key)) continue;
            seen.add(key);
            const scrubbed = key.replace(emailRx, '[email]').replace(phoneRx, '[telefone]');
            chunks.push(`- ${scrubbed}`);
            if (chunks.join('\n').length >= maxChars) break;
        }
        return chunks.join('\n').slice(0, maxChars);
    }

    return {
        async call(args) {
            return chain.invoke(args);
        },
    };
}


