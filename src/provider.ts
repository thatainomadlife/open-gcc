/**
 * LLM provider abstraction for GCC.
 *
 * Uses Node.js built-in fetch (Node 18+). Zero runtime dependencies.
 * Supports OpenAI, Anthropic, and Ollama (OpenAI-compatible endpoint).
 */

export type ProviderName = 'openai' | 'anthropic' | 'ollama';

export interface LLMConfig {
  provider: ProviderName;
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4.1-nano',
  anthropic: 'claude-haiku-4-5-20251001',
  ollama: 'llama3.2',
};

/**
 * Resolve provider config from environment variables and optional config overrides.
 * Returns null if no provider is configured.
 *
 * Priority: env vars > configProvider/configModel > defaults
 * Detection: GCC_PROVIDER > OPENAI_API_KEY > ANTHROPIC_API_KEY > GCC_OLLAMA_URL
 */
export function resolveConfig(configProvider?: string, configModel?: string): LLMConfig | null {
  const explicit = (process.env.GCC_PROVIDER || configProvider || '') as ProviderName | '';
  const modelOverride = process.env.GCC_MODEL || configModel || '';

  if (explicit === 'openai' || (!explicit && process.env.OPENAI_API_KEY)) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return {
      provider: 'openai',
      apiKey,
      model: modelOverride || DEFAULT_MODELS.openai,
    };
  }

  if (explicit === 'anthropic' || (!explicit && process.env.ANTHROPIC_API_KEY)) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return {
      provider: 'anthropic',
      apiKey,
      model: modelOverride || DEFAULT_MODELS.anthropic,
    };
  }

  if (explicit === 'ollama' || (!explicit && process.env.GCC_OLLAMA_URL)) {
    return {
      provider: 'ollama',
      model: modelOverride || process.env.GCC_OLLAMA_MODEL || DEFAULT_MODELS.ollama,
      baseUrl: process.env.GCC_OLLAMA_URL ?? 'http://localhost:11434',
    };
  }

  return null;
}

/**
 * Call the configured LLM provider and return the text response.
 * Returns null on any failure (network errors, API errors, empty responses).
 */
export async function complete(
  config: LLMConfig,
  request: CompletionRequest
): Promise<string | null> {
  try {
    switch (config.provider) {
      case 'openai':
        return await callOpenAI(config, request);
      case 'anthropic':
        return await callAnthropic(config, request);
      case 'ollama':
        return await callOllama(config, request);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function callOpenAI(
  config: LLMConfig,
  request: CompletionRequest
): Promise<string | null> {
  const baseUrl = config.baseUrl ?? 'https://api.openai.com';
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenAI ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content?.trim() ?? null;
}

async function callAnthropic(
  config: LLMConfig,
  request: CompletionRequest
): Promise<string | null> {
  const systemMessages = request.messages.filter(m => m.role === 'system');
  const nonSystemMessages = request.messages.filter(m => m.role !== 'system');

  const body: Record<string, unknown> = {
    model: config.model,
    messages: nonSystemMessages,
    max_tokens: request.maxTokens,
  };

  if (systemMessages.length > 0) {
    body.system = systemMessages.map(m => m.content).join('\n');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Anthropic ${response.status}: ${errBody}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim() || null;
}

async function callOllama(
  config: LLMConfig,
  request: CompletionRequest
): Promise<string | null> {
  const baseUrl = (config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Ollama ${response.status}: ${errBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content?.trim() ?? null;
}
