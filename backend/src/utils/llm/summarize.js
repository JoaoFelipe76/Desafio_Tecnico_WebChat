import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

export async function summarizeIfNeeded(text, thresholdTokens = 256) {
  if (!text || estimateTokens(text) <= thresholdTokens) return null;
  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    apiKey: process.env.OPENAI_API_KEY,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', 'Resuma o texto do cliente mantendo apenas a intenção e os pontos essenciais para atendimento de vendas de internet. Seja breve e objetivo.'],
    ['human', '{input}'],
  ]);
  const chain = RunnableSequence.from([
    { input: () => text },
    prompt,
    llm,
  ]);
  const msg = await chain.invoke({});
  return msg.content?.toString?.() || msg.content || '';
}


