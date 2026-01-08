/**
 * Basic Routing Example
 *
 * Simple example showing how to use Cascade Router
 */

import { Router, ProviderFactory } from '../src/index.js';

async function main() {
  // Create a router with balanced strategy
  const router = new Router({
    strategy: 'balanced',
    providers: [
      {
        id: 'openai-mini',
        name: 'OpenAI GPT-4o Mini',
        type: 'openai',
        enabled: true,
        priority: 10,
        maxTokens: 128000,
        costPerMillionTokens: 0.15,
        latency: 500,
        availability: 0.99,
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'gpt-4o-mini',
      },
    ],
    fallbackEnabled: true,
    maxRetries: 3,
    timeout: 60000,
  });

  // Create and register provider
  const openai = ProviderFactory.createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  });

  router.registerProvider(openai);

  // Initialize router
  await router.initialize();

  // Route a simple request
  const result = await router.route({
    prompt: 'What is Cascade Router?',
    maxTokens: 500,
    temperature: 0.7,
  });

  // Display results
  console.log('Response:', result.response.content);
  console.log('Provider:', result.provider);
  console.log('Model:', result.response.model);
  console.log('Tokens:', result.response.tokens.total);
  console.log('Cost:', `$${result.response.cost.toFixed(4)}`);
  console.log('Duration:', `${result.response.duration}ms`);
  console.log('Strategy:', result.routingDecision.strategy);
}

main().catch(console.error);
