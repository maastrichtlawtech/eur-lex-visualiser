const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_BATCH_ITEMS = 96;
const MAX_BATCH_CHARS = 250_000;
const RETRY_DELAY_MS = 300;

class MissingApiKeyError extends Error {
  constructor(message = 'OPENROUTER_API_KEY is required') {
    super(message);
    this.name = 'MissingApiKeyError';
    this.code = 'missing_api_key';
  }
}

class EmbeddingProviderError extends Error {
  constructor(message, { status = 500, code = null, details = null } = {}) {
    super(message);
    this.name = 'EmbeddingProviderError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoChunks(texts) {
  const chunks = [];
  let current = [];
  let currentChars = 0;

  for (const text of texts) {
    const value = String(text || '');
    const nextChars = currentChars + value.length;
    if (current.length >= MAX_BATCH_ITEMS || (current.length > 0 && nextChars > MAX_BATCH_CHARS)) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(value);
    currentChars += value.length;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function readErrorBody(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    try {
      return { message: await res.text() };
    } catch {
      return {};
    }
  }

  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function fetchEmbeddings(texts, { model, apiKey, baseUrl, signal, retry = true }) {
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const url = `${normalizeBaseUrl(baseUrl)}/embeddings`;
  const payload = {
    model,
    input: texts,
    encoding_format: 'float',
  };

  const doRequest = async () => {
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://legalviz.local',
        'X-Title': 'EUR-Lex Visualiser',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await readErrorBody(res);
      throw new EmbeddingProviderError(body?.error?.message || body?.message || res.statusText || 'Embedding request failed', {
        status: res.status,
        code: body?.error?.code || body?.code || null,
        details: body,
      });
    }

    return res.json();
  };

  try {
    return await doRequest();
  } catch (err) {
    const isRetryable = err instanceof EmbeddingProviderError && (err.status === 429 || err.status >= 500);
    if (!retry || !isRetryable) {
      throw err;
    }

    await sleep(RETRY_DELAY_MS);
    return doRequest();
  }
}

async function embedBatch(texts, { model, apiKey, baseUrl, signal } = {}) {
  const chunks = splitIntoChunks(Array.isArray(texts) ? texts : []);
  const embeddings = [];
  let totalTokens = 0;

  for (const chunk of chunks) {
    const response = await fetchEmbeddings(chunk, { model, apiKey, baseUrl, signal });
    const rows = Array.isArray(response?.data) ? response.data : [];
    const chunkEmbeddings = rows
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((row) => row.embedding);

    embeddings.push(...chunkEmbeddings);
    totalTokens += response?.usage?.total_tokens || 0;
  }

  return {
    embeddings,
    usage: {
      total_tokens: totalTokens,
    },
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  EmbeddingProviderError,
  MissingApiKeyError,
  embedBatch,
};
