import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveConfig, complete, type LLMConfig } from '../src/provider.js';

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all relevant env vars
    delete process.env.GCC_PROVIDER;
    delete process.env.GCC_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GCC_OLLAMA_URL;
    delete process.env.GCC_OLLAMA_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when no provider is configured', () => {
    expect(resolveConfig()).toBeNull();
  });

  it('detects OpenAI from OPENAI_API_KEY', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const config = resolveConfig();
    expect(config).toEqual({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4.1-nano',
    });
  });

  it('detects Anthropic from ANTHROPIC_API_KEY', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const config = resolveConfig();
    expect(config).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('detects Ollama from GCC_OLLAMA_URL', () => {
    process.env.GCC_OLLAMA_URL = 'http://localhost:11434';
    const config = resolveConfig();
    expect(config).toEqual({
      provider: 'ollama',
      model: 'llama3.2',
      baseUrl: 'http://localhost:11434',
    });
  });

  it('prefers OpenAI over Anthropic when both present', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(resolveConfig()?.provider).toBe('openai');
  });

  it('respects GCC_PROVIDER explicit override', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.GCC_PROVIDER = 'anthropic';
    expect(resolveConfig()?.provider).toBe('anthropic');
  });

  it('respects GCC_MODEL override', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GCC_MODEL = 'gpt-4o';
    expect(resolveConfig()?.model).toBe('gpt-4o');
  });

  it('returns null for explicit provider without matching key', () => {
    process.env.GCC_PROVIDER = 'openai';
    // No OPENAI_API_KEY set
    expect(resolveConfig()).toBeNull();
  });

  it('uses GCC_OLLAMA_MODEL for ollama default model', () => {
    process.env.GCC_OLLAMA_URL = 'http://localhost:11434';
    process.env.GCC_OLLAMA_MODEL = 'mistral';
    expect(resolveConfig()?.model).toBe('mistral');
  });
});

describe('complete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls OpenAI endpoint correctly', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Test response' } }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: LLMConfig = {
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4.1-nano',
    };

    const result = await complete(config, {
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0,
    });

    expect(result).toBe('Test response');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer sk-test',
        }),
      })
    );
  });

  it('calls Anthropic endpoint correctly', async () => {
    const mockResponse = {
      content: [{ type: 'text', text: 'Anthropic response' }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: LLMConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
    };

    const result = await complete(config, {
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0,
    });

    expect(result).toBe('Anthropic response');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test',
          'anthropic-version': '2023-06-01',
        }),
      })
    );
  });

  it('calls Ollama endpoint correctly', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Ollama response' } }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: LLMConfig = {
      provider: 'ollama',
      model: 'llama3.2',
      baseUrl: 'http://localhost:11434',
    };

    const result = await complete(config, {
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0,
    });

    expect(result).toBe('Ollama response');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    const config: LLMConfig = {
      provider: 'openai',
      apiKey: 'bad-key',
      model: 'gpt-4.1-nano',
    };

    const result = await complete(config, {
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 100,
      temperature: 0,
    });
    expect(result).toBeNull();
  });

  it('separates system messages for Anthropic', async () => {
    const mockResponse = {
      content: [{ type: 'text', text: 'response' }],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: LLMConfig = {
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
    };

    await complete(config, {
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'hello' },
      ],
      maxTokens: 100,
      temperature: 0,
    });

    const callBody = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(callBody.system).toBe('You are helpful');
    expect(callBody.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });
});
