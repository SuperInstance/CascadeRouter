/**
 * Cost Optimization Example
 *
 * Example showing cost optimization with budget limits
 */

import { Router, ProviderFactory } from '../src/index.js';

async function main() {
  // Create a router with cost optimization and budget limits
  const router = new Router({
    strategy: 'cost', // Route to cheapest provider
    providers: [
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'ollama',
        enabled: true,
        priority: 20,
        maxTokens: 4096,
        costPerMillionTokens: 0, // Free!
        latency: 2000,
        availability: 0.9,
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
      },
      {
        id: 'openai',
        name: 'OpenAI',
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
    budgetLimits: {
      dailyTokens: 1000000,
      dailyCost: 5, // $5 per day
      monthlyTokens: 25000000,
      monthlyCost: 150, // $150 per month
      alertThreshold: 80,
    },
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      concurrentRequests: 5,
    },
  });

  // Create providers
  const ollama = ProviderFactory.createOllama();
  const openai = ProviderFactory.createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  router.registerProvider(ollama);
  router.registerProvider(openai);

  await router.initialize();

  // Route multiple requests
  const prompts = [
    'What is TypeScript?',
    'Explain async/await',
    'What is a Promise?',
    'Describe event loops',
  ];

  console.log('Routing requests with cost optimization...\n');

  for (const prompt of prompts) {
    const result = await router.route({
      prompt,
      maxTokens: 200,
      temperature: 0.5,
    });

    console.log(`Prompt: ${prompt}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Cost: $${result.response.cost.toFixed(4)}`);
    console.log(`Tokens: ${result.response.tokens.total}`);
    console.log(`---`);
  }

  // Show metrics
  const metrics = router.getMetrics();
  console.log('\nTotal Metrics:');
  console.log(`Total Requests: ${metrics.totalRequests}`);
  console.log(`Total Cost: $${metrics.totalCost.toFixed(4)}`);
  console.log(`Total Tokens: ${metrics.totalTokens.toLocaleString()}`);

  const budgetUsage = metrics.budgetUsage;
  console.log('\nBudget Usage:');
  console.log(`Daily Cost: $${budgetUsage.dailyCost.toFixed(2)} / $5 (${budgetUsage.dailyPercentage.toFixed(1)}%)`);
  console.log(`Monthly Cost: $${budgetUsage.monthlyCost.toFixed(2)} / $150 (${budgetUsage.monthlyPercentage.toFixed(1)}%)`);
}

main().catch(console.error);
