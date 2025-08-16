import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { AgentOutputSchema } from '../../schemas/agentOutput.js';
import { RedisVectorStore } from './redisVectorStore.js';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

function createMemory() {
    const history = [];
    return {
        addUser(message) { history.push({ role: 'user', content: message }); },
        addAI(message) { history.push({ role: 'assistant', content: message }); },
        toMessages() { return history.map((m) => ({ ...m })); },
        replaceWith(messages) { history.length = 0; for (const m of messages) history.push(m); },
    };
}


export function createSalesAgent() {
    const llm = new ChatOpenAI({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        apiKey: process.env.OPENAI_API_KEY,
    });

    const memory = createMemory();
    const vectorStoreRedis = new RedisVectorStore();
    vectorStoreRedis.ensureSchema().catch(() => {});
    

    const PLANOS_DATABASE = `
PORTFÓLIO DE PLANOS DISPONÍVEIS:

1. Plano Essencial 200 Mbps
   - Preço: R$ 79,90/mês
   - Wi-Fi AC incluído
   - Instalação grátis parcelada em 12x
   - Ideal para: navegação básica, redes sociais, streaming Full HD
   - Perfil: 1-2 pessoas, uso básico

2. Plano Turbo 400 Mbps
   - Preço: R$ 99,90/mês
   - Wi-Fi 5 incluído
   - Roteador incluso
   - Ideal para: família pequena, home office leve, streaming 4K ocasional
   - Perfil: 2-3 pessoas, uso moderado

3. Plano Power 600 Mbps
   - Preço: R$ 119,90/mês
   - Wi-Fi 6 de última geração
   - Upload de 300 Mbps
   - Ideal para: home office intenso, chamadas de vídeo, jogos, streaming 4K frequente
   - Perfil: 3-4 pessoas, uso intenso

4. Plano Ultra 1 Gbps
   - Preço: R$ 299,90/mês
   - Wi-Fi 6 premium
   - ONT + roteador Mesh (1 ponto adicional)
   - Ideal para: muitos dispositivos, gamers profissionais, criadores de conteúdo
   - Perfil: 4+ pessoas, uso profissional/empresarial
`;

    const ATENDENTE_PROMPT = `
Você é Ana, uma atendente virtual especializada em vendas de planos de internet da empresa TurboNet.

PERSONALIDADE:
- Simpática, prestativa e profissional
- Usa emojis moderadamente para ser mais calorosa
- Faz perguntas direcionadas para identificar necessidades
- É persuasiva mas não insistente
- Adapta a linguagem ao perfil do cliente

PORTFÓLIO DE PLANOS:
{planos_info}

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

    const systemInstruction = `${ATENDENTE_PROMPT.replace('{planos_info}', PLANOS_DATABASE)}\n\nRegras adicionais:\n- Não repita pedidos de dados já informados (use os campos conhecidos).\n- Quando for encerrar (step = \"closing\"), diga: \"Nossa equipe entrará em contato com você para finalizar a contratação e orientar os próximos passos.\"`;

    const prompt = ChatPromptTemplate.fromMessages([
        ['system', `${systemInstruction}\n\nPLANOS:\n{planos}\n\nHistórico:\n{history_text}\n\nFormate SEMPRE a resposta em JSON puro com as chaves: response (string), step (greeting|needs|offer|closing|fallback), topics (array dentre [speed,usage,budget,provider,wifi,installation,promotion]). Não inclua texto fora do JSON.`],
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

            let context = ' ';
            try {
                const redisHits = await vectorStoreRedis.similaritySearch({ sessionId: input.sessionId || 'global', query: inputText, k: 4 });
                if (redisHits?.length) {
                    context = redisHits.map((s) => `- ${s.text}`).join('\n');
                }
            } catch { }

            const historyText = historyMessages.map((m) => `${m.role}: ${m.content}`).join('\n');

            return {
                input: inputText,
                history: normalizedHistory,
                history_text: historyText,
                context,
                planos: PLANOS_DATABASE,
                sessionId: input.sessionId,
            };
        },
        prompt,
        llm,
        async (aiMessage, input) => {
            memory.addUser(input.input);
            const raw = aiMessage.content?.toString?.() || aiMessage.content || '';
            const content = sanitizeToJsonString(raw);
            const sessionKey = input.sessionId || 'global';
            try {
                const parsed = AgentOutputSchema.parse(JSON.parse(content));
                memory.addAI(parsed.response);
                try {
                    await vectorStoreRedis.addText({ sessionId: sessionKey, text: `user: ${input.input}` });
                    await vectorStoreRedis.addText({ sessionId: sessionKey, text: `assistant: ${parsed.response}` });
                } catch {}
                return { output: parsed.response, meta: parsed };
            } catch (_e) {
                memory.addAI(raw);
                try {
                    await vectorStoreRedis.addText({ sessionId: sessionKey, text: `user: ${input.input}` });
                    await vectorStoreRedis.addText({ sessionId: sessionKey, text: `assistant: ${raw}` });
                } catch {}
                return { output: raw, meta: { step: 'fallback', topics: [] } };
            }
        },
    ]);

    function sanitizeToJsonString(text) {
        if (!text) return text;
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : text;
        const objMatch = candidate.match(/\{[\s\S]*\}/);
        return objMatch ? objMatch[0] : candidate;
    }

    return {
        async call(args) {
            return chain.invoke(args);
        },
    };
}


