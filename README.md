## Webchat IA 

Assistente virtual de vendas com RAG, memória semântica e guardrails, exposto via API REST (Node.js/Express) e um widget frontend (Vue 3) que pode ser embutido como Web Component.

- **Backend**: Node.js + Express + LangChain + OpenAI + Supabase (pgvector)
- **Frontend**: Vue 3 + Vite (widget de chat e Web Component)


### Sumário
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Arquitetura do agente](#arquitetura-do-agente)
- [Componentes principais](#componentes-principais)
  - [Memória semântica](#memória-semântica)
  - [Guardrails](#guardrails)
  - [RAG](#rag)
  - [Sumarização](#sumarização)
- [Instalação e execução](#instalação-e-execução)
- [Banco de dados](#banco-de-dados)
- [Uso](#uso)
- [Variáveis de ambiente](#variáveis-de-ambiente)


### Tecnologias utilizadas
- **Node.js + Express**: Servidor HTTP, roteamento e middlewares. Endpoints REST sob `/api/v1` e rota de saúde `/health`.
- **LangChain (@langchain/core, @langchain/openai, @langchain/community)**: Construção da cadeia no padrão REACT (reasoning + act), prompts e pipeline (RunnableSequence).
- **OpenAI (chat, embeddings e moderation)**: Modelo conversacional (por padrão `gpt-4o-mini`), embeddings (`text-embedding-3-small`) e moderação de conteúdo (`omni-moderation-latest`).
- **Supabase + pgvector (@supabase/supabase-js)**: Armazenamento de documentos e memória de conversas, busca semântica via funções RPC.
- **Zod**: Validação do JSON estruturado retornado pelo agente.
- **CORS, morgan, cookie-parser, dotenv**: Infraestrutura de API (CORS, logs, sessão via cookie, variáveis de ambiente).
- **Vue 3 + Vite**: UI do widget de chat e empacotamento.
- **DOMPurify**: Saneamento de entrada do usuário no frontend.
- **Vitest + @vue/test-utils + jsdom**: Testes de frontend (unitários do widget).


### Arquitetura do agente
O agente é baseado em uma arquitetura REACT com RAG e memória semântica, onde a IA conduz a conversa simulando um vendedor humano. O agente raciocina sobre as respostas do cliente para decidir a próxima ação (REACT), utiliza RAG para consultar planos e preços atualizados em sua base de dados antes de fazer a oferta e apoia-se em memória semântica para recordar preferências, objeções e dados já informados. A memória semântica armazena cada turno vetorizado por `sessionId` (pgvector/Supabase) e é consultada por similaridade a cada passo para manter contexto de longo prazo.

Loop por turno:
1) Valida e protege a entrada (moderação, detecção de prompt injection e filtro de domínio),
2) Sumariza a mensagem caso exceda um limiar de tokens,
3) Recupera contexto híbrido: memória semântica da sessão (RPC `match_chat_memory`) + base de conhecimento (RPC `match_documents`),
4) O LLM raciocina sobre histórico e contexto para decidir a próxima ação (perguntar, argumentar ou ofertar) e gera saída em JSON validada por schema (Zod),
5) Persiste o turno na memória semântica (embeddings) e retorna a resposta ao cliente.

O agente (em `backend/src/utils/llm/salesAgent.js`) usa LangChain para montar uma cadeia:
- Prompt com persona “Ana”, instruções de vendas e formato JSON obrigatório
- Placeholder de histórico
- Contexto recuperado por similaridade
- Execução via `ChatOpenAI`

O resultado é sempre JSON válido com chaves: `response`, `step` (`greeting|needs|offer|closing|fallback`) e `topics` (subset de `speed,usage,budget,provider,wifi,installation,promotion`). O schema é definido em `backend/src/schemas/agentOutput.js`.


### Componentes principais

#### Memória semântica
- Implementada em `SupabaseVectorStore` (`backend/src/utils/llm/supabaseVectorStore.js`).
- Cada turno (user/assistant) é opcionalmente persistido (controlado por `MEMORY_PERSIST`).
- Busca semântica por sessão via RPC `match_chat_memory` (pgvector) para recuperar lembranças relevantes.
- Finalidade: manter contexto longo prazo sem depender apenas de histórico literal, melhorando continuidade e personalização.

#### Guardrails
- **Moderação OpenAI** (`backend/src/utils/moderation/openaiModeration.js`): bloqueia conteúdo inadequado.
- **Detecção de Prompt Injection** (`backend/src/utils/security/injectionDetector.js`): padrões comuns de jailbreak e bypass.
- **Filtro de domínio de saída** (`backend/src/utils/filters/contextFilter.js`): garante foco no tema “planos de internet”; permite saudações e dados de contato/CEP.
- **Validação de payload** (Zod) em `ChatController`.
- **Saneamento no frontend**: `DOMPurify` e verificação de HTTPS, além de rate limit local do widget.

#### RAG
- A cadeia do agente busca contexto de duas fontes usando `SupabaseVectorStore`:
  - `searchMemory`: memórias da sessão atual (conversa anterior) via `match_chat_memory`.
  - `searchKB`: base de conhecimento global via `match_documents`.
- Parâmetros ajustáveis por env: `RAG_K`, `MEMORY_K`, `RAG_MAX_CONTEXT_CHARS`.
- Normalização remove PII (e-mail/telefone) ao compor o bloco de contexto passado ao prompt.

#### Sumarização
- Função `summarizeIfNeeded` (`backend/src/utils/llm/summarize.js`):
  - Estima tokens e, se exceder `threshold` (padrão 256), pede ao LLM um resumo curto preservando intenção.
  - O resumo substitui temporariamente a entrada do usuário para economizar contexto e custo.


### Instalação e execução

Pré‑requisitos:
- Node.js 18+ (recomendado 20+)
- Conta e projeto Supabase com extensão `pgvector` habilitada
- Chave `OPENAI_API_KEY`

1) Clonar o repositório
```bash
git clone <url-do-repo>
cd projeto-webchat-ia
```

2) Configurar o backend
- Crie o arquivo `backend/.env` (exemplo completo em [Variáveis de ambiente](#variáveis-de-ambiente)).
- Instale dependências e suba o servidor:
```bash
cd backend
npm install
npm run dev
# Server em http://localhost:3000 (ou PORT definido)
```

3) Configurar o frontend
```bash
cd ../frontend
npm install
npm run dev
# Vite em http://localhost:5173 por padrão
```

4) Testes (opcional)
```bash
# Frontend
cd frontend
npm run test

# Backend (Node test runner)
cd ../backend
npm test
```


### Banco de dados
O projeto usa Supabase (Postgres) com `pgvector` para embeddings. Execute os scripts abaixo no SQL editor do Supabase.

1) Extensão e tipos
```sql
-- Habilitar extensão pgvector
create extension if not exists vector;
-- Necessária para gen_random_uuid()
create extension if not exists pgcrypto;
```

2) Tabela de documentos (base de conhecimento)
```sql
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536) -- ajuste se usar outro modelo de embedding
);

-- índice para busca aproximada
create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

3) Tabela de memória de chat
```sql
create table if not exists chat_memory (
  id bigserial primary key,
  conversation_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  embedding vector(1536)
);

create index if not exists chat_memory_conv_idx on chat_memory (conversation_id);
create index if not exists chat_memory_embedding_idx
  on chat_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

4) Funções RPC para similaridade
```sql
-- Busca na base de conhecimento
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int,
  filter jsonb default '{}'
)
returns table(
  content text,
  metadata jsonb,
  similarity float
)
language sql stable as $$
  select d.content,
         d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where (filter = '{}'::jsonb) or (d.metadata @> filter)
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Busca na memória da conversa
create or replace function match_chat_memory(
  query_embedding vector(1536),
  match_count int,
  p_conversation_id uuid
)
returns table(
  content text,
  role text,
  similarity float
)
language sql stable as $$
  select m.content,
         m.role,
         1 - (m.embedding <=> query_embedding) as similarity
  from chat_memory m
  where m.conversation_id = p_conversation_id
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
```

Observações:
- A dimensão `1536` corresponde ao `text-embedding-3-small`. Se trocar o modelo, ajuste a dimensão.
- As funções são chamadas pelo servidor via `rpc()` com os nomes configurados em variáveis de ambiente.

5) (Opcional) Ingestão de documentos com embeddings via Node.js
Crie um pequeno script para popular `documents` usando a classe já existente:
```js
// scripts/ingest.js
import 'dotenv/config'
import { SupabaseVectorStore } from '../backend/src/utils/llm/supabaseVectorStore.js'

const store = new SupabaseVectorStore()
await store.addDocument({
  content: 'Planos TurboNet: 200 Mbps, 300 Mbps, 500 Mbps. Instalação em até 48h.',
  metadata: { source: 'catalogo', plan: true }
})
console.log('OK')
```
Execute com:
```bash
node scripts/ingest.js
```


### Uso

#### Via API REST
Endpoint: `POST /api/v1/chat`
```bash
curl -i \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: <opcional-uuid>" \
  -d '{"message":"Quero um plano para home office com 300 Mbps"}' \
  http://localhost:3000/api/v1/chat
```
Resposta (exemplo):
```json
{
  "sessionId": "1b2c3d4e-...",
  "reply": "Pelo seu uso de home office, recomendo o plano de 300 Mbps com Wi‑Fi incluso e instalação rápida.",
  "meta": { "step": "offer", "topics": ["speed","usage"], "assistantPersisted": true, "userPersisted": true }
}
```

Notas:
- Se `sessionId` não for enviado, o servidor cria um e devolve em `X-Session-Id` e no corpo.
- O campo `reply` é texto (a mensagem para o usuário). Os campos estruturados vão em `meta`.

#### Via Web Component (frontend)
No HTML da sua aplicação:
```html
<script type="module" src="/src/web-component/index.js"></script>

<turbonet-chatbot
  api-base="http://localhost:3000"
  agent-name="Ana"
  agent-avatar="/ana.png">
</turbonet-chatbot>
```

#### Como componente Vue
```vue
<template>
  <ChatWidget
    apiBase="http://localhost:3000"
    agentName="Ana"
    :persist="true"
  />
  </template>
<script setup>
import ChatWidget from './components/ChatWidget.vue'
</script>
```


### Variáveis de ambiente

Backend (`backend/.env`):
```env
PORT=3000

# OpenAI
OPENAI_API_KEY=seu_token
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small
OPENAI_MODERATION_MODEL=omni-moderation-latest

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=chave_service_role
SUPABASE_DOCUMENTS_TABLE=documents
SUPABASE_MEMORIES_TABLE=chat_memory
SUPABASE_MATCH_DOCS_FN=match_documents
SUPABASE_MATCH_MEMS_FN=match_chat_memory

# RAG / Memória
MEMORY_PERSIST=true
RAG_K=4
MEMORY_K=3
RAG_MAX_CONTEXT_CHARS=1200
```

Frontend: não requer `.env` obrigatório. Configure o atributo `api-base` do Web Component ou a prop `apiBase` do `ChatWidget` apontando para o backend.


### Endpoints úteis
- `GET /health`: verificação de saúde do serviço.
- `POST /api/v1/chat`: envio de mensagem do usuário.


### Segurança e privacidade
- Moderação e filtros no backend evitam respostas indevidas e mantêm o foco no domínio.
- PII (e-mail/telefone) é ofuscada ao compor o contexto do RAG.
- No frontend, entradas são sanitizadas e há verificação de HTTPS.


### Estrutura do projeto
- `backend/`: API Express, agente, RAG, memória e guardrails
- `frontend/`: Widget Vue 3 e Web Component


### Licença
Defina a licença do projeto conforme a sua necessidade (MIT, Apache-2.0, etc.).


