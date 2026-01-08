/**
 * Provider Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFactory } from '../src/providers/factory.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';
import { OllamaProvider } from '../src/providers/ollama.js';
import type { ProviderConfig, ChatRequest } from '../src/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ProviderFactory', () => {
  describe('createProvider', () => {
    it('should create OpenAI provider', () => {
      const config: ProviderConfig = {
        id: 'openai-test',
        name: 'OpenAI Test',
        type: 'openai',
        enabled: true,
        priority: 10,
        maxTokens: 128000,
        costPerMillionTokens: 0.15,
        latency: 500,
        availability: 0.99,
        apiKey: 'sk-test',
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.id).toBe('openai-test');
    });

    it('should create Anthropic provider', () => {
      const config: ProviderConfig = {
        id: 'anthropic-test',
        name: 'Anthropic Test',
        type: 'anthropic',
        enabled: true,
        priority: 10,
        maxTokens: 200000,
        costPerMillionTokens: 0.25,
        latency: 600,
        availability: 0.99,
        apiKey: 'sk-ant-test',
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.id).toBe('anthropic-test');
    });

    it('should create Ollama provider', () => {
      const config: ProviderConfig = {
        id: 'ollama-test',
        name: 'Ollama Test',
        type: 'ollama',
        enabled: true,
        priority: 20,
        maxTokens: 4096,
        costPerMillionTokens: 0,
        latency: 2000,
        availability: 0.9,
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
      };

      const provider = ProviderFactory.createProvider(config);
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.id).toBe('ollama-test');
    });

    it('should throw error for unknown provider type', () => {
      const config: ProviderConfig = {
        id: 'unknown-test',
        name: 'Unknown Test',
        type: 'custom',
        enabled: true,
        priority: 10,
        maxTokens: 128000,
        costPerMillionTokens: 0.15,
        latency: 500,
        availability: 0.99,
      };

      expect(() => ProviderFactory.createProvider(config)).toThrow();
    });
  });

  describe('createOpenAI', () => {
    it('should create OpenAI provider with defaults', () => {
      const provider = ProviderFactory.createOpenAI();
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.config.model).toBe('gpt-4o-mini');
    });

    it('should create OpenAI provider with custom config', () => {
      const provider = ProviderFactory.createOpenAI({
        model: 'gpt-4-turbo',
        priority: 5,
      });

      expect(provider.config.model).toBe('gpt-4-turbo');
      expect(provider.config.priority).toBe(5);
    });
  });

  describe('createAnthropic', () => {
    it('should create Anthropic provider with defaults', () => {
      const provider = ProviderFactory.createAnthropic();
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.config.model).toBe('claude-3-haiku-20240307');
    });

    it('should create Anthropic provider with custom config', () => {
      const provider = ProviderFactory.createAnthropic({
        model: 'claude-3-opus-20240229',
        priority: 3,
      });

      expect(provider.config.model).toBe('claude-3-opus-20240229');
      expect(provider.config.priority).toBe(3);
    });
  });

  describe('createOllama', () => {
    it('should create Ollama provider with defaults', () => {
      const provider = ProviderFactory.createOllama();
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.config.model).toBe('llama2');
      expect(provider.config.baseUrl).toBe('http://localhost:11434');
    });

    it('should create Ollama provider with custom config', () => {
      const provider = ProviderFactory.createOllama({
        model: 'mistral',
        baseUrl: 'http://localhost:11435',
      });

      expect(provider.config.model).toBe('mistral');
      expect(provider.config.baseUrl).toBe('http://localhost:11435');
    });
  });
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider({
      id: 'openai-test',
      name: 'OpenAI Test',
      type: 'openai',
      enabled: true,
      priority: 10,
      maxTokens: 128000,
      costPerMillionTokens: 0.15,
      latency: 500,
      availability: 0.99,
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is set', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when no API key', async () => {
      const noKeyProvider = new OpenAIProvider({
        id: 'openai-test',
        name: 'OpenAI Test',
        type: 'openai',
        enabled: true,
        priority: 10,
        maxTokens: 128000,
        costPerMillionTokens: 0.15,
        latency: 500,
        availability: 0.99,
        apiKey: '',
      });

      const available = await noKeyProvider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Test response',
              },
              finish_reason: 'stop',
            },
          ],
          model: 'gpt-4o-mini',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        }),
      });

      const request: ChatRequest = {
        prompt: 'Hello',
        maxTokens: 100,
        temperature: 0.7,
      };

      const response = await provider.chat(request);

      expect(response.content).toBe('Test response');
      expect(response.model).toBe('gpt-4o-mini');
      expect(response.tokens.total).toBe(30);
      expect(response.cost).toBeGreaterThan(0);
    });

    it('should estimate tokens correctly', () => {
      const tokens = provider.estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should get max tokens', () => {
      const maxTokens = provider.getMaxTokens();
      expect(maxTokens).toBe(128000);
    });
  });
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider({
      id: 'anthropic-test',
      name: 'Anthropic Test',
      type: 'anthropic',
      enabled: true,
      priority: 10,
      maxTokens: 200000,
      costPerMillionTokens: 0.25,
      latency: 600,
      availability: 0.99,
      apiKey: 'sk-ant-test',
      model: 'claude-3-haiku-20240307',
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is set', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              text: 'Test response',
            },
          ],
          model: 'claude-3-haiku-20240307',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        }),
      });

      const request: ChatRequest = {
        prompt: 'Hello',
        maxTokens: 100,
        temperature: 0.7,
      };

      const response = await provider.chat(request);

      expect(response.content).toBe('Test response');
      expect(response.model).toBe('claude-3-haiku-20240307');
      expect(response.tokens.total).toBe(30);
      expect(response.cost).toBeGreaterThan(0);
    });
  });
});

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider({
      id: 'ollama-test',
      name: 'Ollama Test',
      type: 'ollama',
      enabled: true,
      priority: 20,
      maxTokens: 4096,
      costPerMillionTokens: 0,
      latency: 2000,
      availability: 0.9,
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is running', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when Ollama is not running', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'));

      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Test response',
          model: 'llama2',
          done: true,
        }),
      });

      const request: ChatRequest = {
        prompt: 'Hello',
        maxTokens: 100,
        temperature: 0.7,
      };

      const response = await provider.chat(request);

      expect(response.content).toBe('Test response');
      expect(response.model).toBe('llama2');
      expect(response.tokens.total).toBeGreaterThan(0);
      expect(response.cost).toBe(0); // Ollama is free
    });
  });
});
