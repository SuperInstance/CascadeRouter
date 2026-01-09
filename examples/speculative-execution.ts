/**
 * Speculative Execution Example
 *
 * This example demonstrates how to use the speculative execution routing strategy
 * to race multiple LLM providers and use the fastest response.
 */

import { Router } from '../src/core/router.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';

async function main() {
  console.log('=== Speculative Execution Example ===\n');

  // Initialize router with speculative execution strategy
  const router = new Router({
    strategy: 'speculative',
    providers: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        type: 'openai',
        enabled: true,
        priority: 1,
        maxTokens: 8192,
        costPerMillionTokens: 30,
        latency: 2000,
        availability: 0.95,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        type: 'anthropic',
        enabled: true,
        priority: 2,
        maxTokens: 8192,
        costPerMillionTokens: 75,
        latency: 1500,
        availability: 0.98,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-opus-20240229',
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        type: 'openai',
        enabled: true,
        priority: 3,
        maxTokens: 4096,
        costPerMillionTokens: 2,
        latency: 800,
        availability: 0.99,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
      },
    ],
    fallbackEnabled: true,
    maxRetries: 3,
    timeout: 10000,
    speculativeConfig: {
      // Race the 2 fastest providers
      candidateCount: 2,

      // Select candidates based on speed
      candidateStrategy: 'speed',

      // Enable cost tracking
      enableCostTracking: true,

      // Allow up to 1.5x the cost of single provider
      maxCostMultiplier: 150,
    },
  });

  // Register providers
  router.registerProvider(new OpenAIProvider({
    id: 'gpt-4',
    name: 'GPT-4',
    type: 'openai',
    enabled: true,
    priority: 1,
    maxTokens: 8192,
    costPerMillionTokens: 30,
    latency: 2000,
    availability: 0.95,
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
  }));

  router.registerProvider(new AnthropicProvider({
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    type: 'anthropic',
    enabled: true,
    priority: 2,
    maxTokens: 8192,
    costPerMillionTokens: 75,
    latency: 1500,
    availability: 0.98,
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-3-opus-20240229',
  }));

  router.registerProvider(new OpenAIProvider({
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    type: 'openai',
    enabled: true,
    priority: 3,
    maxTokens: 4096,
    costPerMillionTokens: 2,
    latency: 800,
    availability: 0.99,
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-3.5-turbo',
  }));

  // Initialize router
  console.log('Initializing router...\n');
  await router.initialize();

  // Check status
  const status = await router.getStatus();
  console.log('Router Status:');
  console.log(`  Healthy: ${status.healthy}`);
  console.log(`  Available Providers: ${status.availableProviders.join(', ')}`);
  console.log();

  // Example 1: Basic speculative execution
  console.log('Example 1: Basic Speculative Execution');
  console.log('Racing GPT-3.5 Turbo vs GPT-4...\n');

  const startTime = Date.now();
  const result1 = await router.route({
    prompt: 'What is speculative execution in simple terms?',
    maxTokens: 100,
  });
  const duration1 = Date.now() - startTime;

  console.log('Response:');
  console.log(`  Provider: ${result1.provider}`);
  console.log(`  Duration: ${result1.totalDuration}ms`);
  console.log(`  Cost: $${result1.totalCost.toFixed(6)}`);
  console.log(`  Content: ${result1.response.content.substring(0, 100)}...`);
  console.log();

  // Example 2: Quality-based speculative execution
  console.log('Example 2: Quality-Based Speculative Execution');
  console.log('Racing highest quality providers...\n');

  // Update config to prioritize quality
  const qualityRouter = new Router({
    strategy: 'speculative',
    providers: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        type: 'openai',
        enabled: true,
        priority: 1,
        maxTokens: 8192,
        costPerMillionTokens: 30,
        latency: 2000,
        availability: 0.95,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        type: 'anthropic',
        enabled: true,
        priority: 2,
        maxTokens: 8192,
        costPerMillionTokens: 75,
        latency: 1500,
        availability: 0.98,
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-opus-20240229',
      },
    ],
    fallbackEnabled: true,
    maxRetries: 3,
    timeout: 10000,
    speculativeConfig: {
      candidateCount: 2,
      candidateStrategy: 'quality', // Use quality instead of speed
      enableCostTracking: true,
      maxCostMultiplier: 150,
    },
  });

  qualityRouter.registerProvider(new OpenAIProvider({
    id: 'gpt-4',
    name: 'GPT-4',
    type: 'openai',
    enabled: true,
    priority: 1,
    maxTokens: 8192,
    costPerMillionTokens: 30,
    latency: 2000,
    availability: 0.95,
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
  }));

  qualityRouter.registerProvider(new AnthropicProvider({
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    type: 'anthropic',
    enabled: true,
    priority: 2,
    maxTokens: 8192,
    costPerMillionTokens: 75,
    latency: 1500,
    availability: 0.98,
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-3-opus-20240229',
  }));

  await qualityRouter.initialize();

  const startTime2 = Date.now();
  const result2 = await qualityRouter.route({
    prompt: 'Explain quantum computing in 50 words',
    maxTokens: 100,
  });
  const duration2 = Date.now() - startTime2;

  console.log('Response:');
  console.log(`  Provider: ${result2.provider}`);
  console.log(`  Duration: ${result2.totalDuration}ms`);
  console.log(`  Cost: $${result2.totalCost.toFixed(6)}`);
  console.log(`  Content: ${result2.response.content.substring(0, 100)}...`);
  console.log();

  // Example 3: Show metrics
  console.log('Example 3: Speculative Execution Metrics');
  console.log('Performance statistics:\n');

  const metrics = router.getMetrics();

  if (metrics.speculativeExecutionMetrics) {
    const specMetrics = metrics.speculativeExecutionMetrics;
    console.log(`  Total Speculative Requests: ${specMetrics.totalSpeculativeRequests}`);
    console.log(`  Average Time Saved: ${specMetrics.avgTimeSaved.toFixed(0)}ms`);
    console.log(`  Average Cost Increase: $${specMetrics.avgCostIncrease.toFixed(6)}`);
    console.log(`  Faster Than Sequential: ${specMetrics.fasterThanSequentialCount}/${specMetrics.totalSpeculativeRequests}`);
    console.log(`  Average Candidates Raced: ${specMetrics.avgCandidatesRaced.toFixed(1)}`);
    console.log(`  Total Additional Cost: $${specMetrics.totalAdditionalCost.toFixed(6)}`);
  }

  console.log();

  // Example 4: Compare with sequential routing
  console.log('Example 4: Performance Comparison');
  console.log('Comparing speculative vs sequential execution...\n');

  // Sequential routing (fallback strategy)
  const sequentialRouter = new Router({
    strategy: 'fallback',
    providers: [
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        type: 'openai',
        enabled: true,
        priority: 3,
        maxTokens: 4096,
        costPerMillionTokens: 2,
        latency: 800,
        availability: 0.99,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        type: 'openai',
        enabled: true,
        priority: 1,
        maxTokens: 8192,
        costPerMillionTokens: 30,
        latency: 2000,
        availability: 0.95,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
      },
    ],
    fallbackEnabled: true,
    maxRetries: 3,
    timeout: 10000,
  });

  sequentialRouter.registerProvider(new OpenAIProvider({
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    type: 'openai',
    enabled: true,
    priority: 3,
    maxTokens: 4096,
    costPerMillionTokens: 2,
    latency: 800,
    availability: 0.99,
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-3.5-turbo',
  }));

  sequentialRouter.registerProvider(new OpenAIProvider({
    id: 'gpt-4',
    name: 'GPT-4',
    type: 'openai',
    enabled: true,
    priority: 1,
    maxTokens: 8192,
    costPerMillionTokens: 30,
    latency: 2000,
    availability: 0.95,
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
  }));

  await sequentialRouter.initialize();

  const testPrompt = 'What is the capital of France?';

  // Measure sequential
  const seqStart = Date.now();
  const seqResult = await sequentialRouter.route({
    prompt: testPrompt,
    maxTokens: 50,
  });
  const seqDuration = Date.now() - seqStart;

  // Measure speculative
  const specStart = Date.now();
  const specResult = await router.route({
    prompt: testPrompt,
    maxTokens: 50,
  });
  const specDuration = Date.now() - specStart;

  console.log('Sequential Execution:');
  console.log(`  Duration: ${seqDuration}ms`);
  console.log(`  Provider: ${seqResult.provider}`);
  console.log(`  Cost: $${seqResult.totalCost.toFixed(6)}`);
  console.log();

  console.log('Speculative Execution:');
  console.log(`  Duration: ${specDuration}ms`);
  console.log(`  Provider: ${specResult.provider}`);
  console.log(`  Cost: $${specResult.totalCost.toFixed(6)}`);
  console.log();

  const timeDiff = seqDuration - specDuration;
  const costDiff = specResult.totalCost - seqResult.totalCost;

  console.log('Comparison:');
  console.log(`  Time Saved: ${timeDiff}ms (${((timeDiff / seqDuration) * 100).toFixed(1)}% faster)`);
  console.log(`  Additional Cost: $${costDiff.toFixed(6)} (${((costDiff / seqResult.totalCost) * 100).toFixed(1)}% increase)`);
  console.log();

  console.log('=== Examples Complete ===');
}

// Run the example
main().catch(console.error);
