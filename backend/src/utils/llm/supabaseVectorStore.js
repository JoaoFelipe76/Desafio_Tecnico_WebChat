import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';

export class SupabaseVectorStore {
  constructor() {
    this.sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    this.emb = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    });

 
    this.documentsTable = process.env.SUPABASE_DOCUMENTS_TABLE || 'documents';
    this.memoriesTable = process.env.SUPABASE_MEMORIES_TABLE || 'chat_memory';
    this.matchDocsFn = process.env.SUPABASE_MATCH_DOCS_FN || 'match_documents';
    this.matchMemsFn = process.env.SUPABASE_MATCH_MEMS_FN || 'match_chat_memory';
  }

  async similaritySearch({ query, k = 4, filter = {}, rpc = this.matchDocsFn }) {
    if (!query) return [];
    const queryEmbedding = await this.emb.embedQuery(query);
    const { data, error } = await this.sb.rpc(rpc, {
      query_embedding: queryEmbedding,
      match_count: k,
      filter,
    });
    if (error) return [];
    return (data || []).map((r) => ({ text: r.content, metadata: r.metadata, similarity: r.similarity }));
  }

  async addDocument({ content, metadata }) {
    if (!content) return { ok: false };
    const [embedding] = await this.emb.embedDocuments([String(content)]);
    const { error } = await this.sb.from(this.documentsTable).insert({ content, metadata: metadata || {}, embedding });
    return { ok: !error, error };
  }

  async addMemoryTurn({ sessionId, role, text }) {
    const content = String(text ?? '');
    const trimmed = content.trim();
    const isUuid = typeof sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId);
    if (!isUuid) {
      console.warn('[mem] addMemoryTurn called without valid sessionId');
      return { ok: false, error: new Error('invalid sessionId') };
    }
    if (trimmed.length === 0) {
      console.warn('[mem] addMemoryTurn called with empty content, skipping insert');
      return { ok: false, error: new Error('empty content') };
    }
    let embedding = null;
    if (trimmed.length > 0) {
      try {
        const arr = await this.emb.embedDocuments([trimmed]);
        embedding = Array.isArray(arr) ? arr[0] : null;
      } catch (e) {
        console.warn('[mem] embedDocuments failed, inserting without embedding:', e?.message);
      }
    }
    const payload = embedding ?
      { conversation_id: sessionId, role, content: trimmed, embedding } :
      { conversation_id: sessionId, role, content: trimmed };
    const { error } = await this.sb.from(this.memoriesTable).insert(payload);
    return { ok: !error, error };
  }

  async searchMemory({ sessionId, query, k = 4 }) {
    if (!query) return [];
    const isUuid = typeof sessionId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId);
    if (!isUuid) return [];
    const queryEmbedding = await this.emb.embedQuery(query);
    const { data, error } = await this.sb.rpc(this.matchMemsFn, {
      query_embedding: queryEmbedding,
      match_count: k,
      p_conversation_id: sessionId,
    });
    if (error) return [];
    return (data || []).map((r) => ({ text: r.content, role: r.role, similarity: r.similarity }));
  }

  async searchKB({ query, k = 4 }) {
    
    return this.similaritySearch({ query, k, rpc: this.matchDocsFn });
  }
}


