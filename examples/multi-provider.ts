/**
 * Multi-Provider Example
 *
 * Example showing how to use multiple providers with different strategies
 */

import { Router, ProviderFactory } from '../src/index.js';

async function main() {
  // Create providers
  const ollama = ProviderFactory.createOllama({
    model: 'llama2',
    priority: 30, // Lowest priority (will be used last)
  });

  const openai = ProviderFactory.createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    priority: 10, // Medium priority
  });

  const anthropic = ProviderFactory.createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-haiku-20240307',
    priority: 5, // High priority (will be used first for quality strategy)
  });

  // Test different strategies
  const strategies: Array<'cost' | 'speed' | 'quality' | 'balanced'> = [
    'cost',
    'speed',
    'quality',
    'balanced',
  ];

  for (const strategy of strategies) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing strategy: ${strategy.toUpperCase()}`);
    console.log('='.repeat(50));

    const router = new Router({
      strategy,
      providers: [
        ollama.config,
        openai.config,
        anthropic.config,
      ],
      fallbackEnabled: true,
      maxRetries: 3,
      timeout: 60000,
    });

    router.registerProvider(ollama);
    router.registerProvider(openai);
    router.registerProvider(anthropic);

    await router.initialize();

    const result = await router.route({
      prompt: 'What is the capital of France?',
      maxTokens: 100,
      temperature: 0.5,
    });

    console.log(`Selected Provider: ${result.provider}`);
    console.log(`Model: ${result.response.model}`);
    console.log(`Cost: $${result.response.cost.toFixed(4)}`);
    console.log(`Duration: ${result.response.duration}ms`);
    console.log(`Reasoning: ${result.routingDecision.reasoning}`);
  }
}

main().catch(console.error);
