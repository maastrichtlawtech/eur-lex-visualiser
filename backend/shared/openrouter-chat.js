const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

class ChatProviderError extends Error {
  constructor(message, { status = 500, code = null, details = null } = {}) {
    super(message);
    this.name = 'ChatProviderError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function readErrorBody(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    try { return { message: await res.text() }; } catch { return {}; }
  }
  try { return await res.json(); } catch { return {}; }
}

async function chatComplete({
  model,
  messages,
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  temperature = 0.2,
  maxTokens = 1500,
  signal,
}) {
  if (!apiKey) {
    throw new ChatProviderError('OPENROUTER_API_KEY is required', { status: 503, code: 'missing_api_key' });
  }
  const url = `${String(baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://legalviz.local',
      'X-Title': 'EUR-Lex Visualiser',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ChatProviderError(
      body?.error?.message || body?.message || res.statusText || 'Chat request failed',
      { status: res.status, code: body?.error?.code || null, details: body }
    );
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message || {};
  // Some reasoning models (e.g. gpt-oss) put the final answer in `content`
  // but burn tokens on `reasoning` first; if content is empty, fall back to reasoning.
  const text = (msg.content && String(msg.content).trim()) || msg.reasoning || '';
  return {
    text,
    usage: data?.usage || null,
    model: data?.model || model,
    finishReason: data?.choices?.[0]?.finish_reason || null,
  };
}

module.exports = { chatComplete, ChatProviderError };
