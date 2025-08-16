import { OpenAIEmbeddings } from '@langchain/openai';
import Redis from 'ioredis';

const DEFAULT_INDEX = process.env.REDIS_VECTOR_INDEX || 'idx:chat:embeddings';
const DEFAULT_PREFIX = process.env.REDIS_VECTOR_PREFIX || 'vec:chat:';

function getClient() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableReadyCheck: false });
  client.connect().catch(() => {});
  return client;
}

export class RedisVectorStore {
  constructor() {
    this.redis = getClient();
    this.embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    });
  }

  async ensureSchema(dim = 1536) {
    if (!this.redis) return false;
    try {
      await this.redis.call('FT.CREATE', DEFAULT_INDEX,
        'ON', 'HASH', 'PREFIX', '1', DEFAULT_PREFIX,
        'SCHEMA', 'text', 'TEXT', 'sessionId', 'TAG',
        'vector', 'VECTOR', 'HNSW', '6', 'TYPE', 'FLOAT32', 'DIM', String(dim), 'DISTANCE_METRIC', 'COSINE'
      );
    } catch (e) {
      if (!String(e?.message || '').includes('exists')) {}
    }
    return true;
  }

  async addText({ sessionId, text, id }) {
    if (!this.redis || !text) return;
    const vector = await this.embeddings.embedQuery(text);
    const key = `${DEFAULT_PREFIX}${id || Date.now()}`;
    const buf = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) buf.writeFloatLE(vector[i], i * 4);
    await this.redis.hset(key, { text, sessionId, vector: buf });
  }

  async similaritySearch({ sessionId, query, k = 4 }) {
    if (!this.redis || !query) return [];
    const vector = await this.embeddings.embedQuery(query);
    const buf = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) buf.writeFloatLE(vector[i], i * 4);
    const q = `@sessionId:{${sessionId}}=>[KNN ${k} @vector $BLOB AS score]`;
    const args = ['FT.SEARCH', DEFAULT_INDEX, q, 'PARAMS', '2', 'BLOB', buf, 'SORTBY', 'score', 'DIALECT', '2', 'RETURN', '1', 'text'];
    const res = await this.redis.callBuffer(...args);
    const items = [];
    if (Array.isArray(res)) {
      for (let i = 2; i < res.length; i += 2) {
        const hash = res[i + 1];
        if (hash && hash.text) items.push({ text: hash.text.toString() });
      }
    }
    return items;
  }
}