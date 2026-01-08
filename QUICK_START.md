# Cascade Router Quick Start

> Get up and running with Cascade Router in 5 minutes

---

## Installation

```bash
npm install @superinstance/cascade-router
```

Or with CLI:
```bash
npm install -g @superinstance/cascade-router
```

---

## 1-Minute Setup

### Step 1: Initialize Config

```bash
npx cascade-router init
```

This creates `cascade-router.config.json` with your settings.

### Step 2: Set API Keys

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Step 3: Use It

```typescript
import { Router, ProviderFactory } from '@superinstance/cascade-router';

// Create router
const router = new Router({
  strategy: 'balanced',
  providers: [
    {
      id: 'openai',
      type: 'openai',
      enabled: true,
      priority: 10,
      maxTokens: 128000,
      costPerMillionTokens: 0.15,
      latency: 500,
      availability: 0.99,
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    }
  ],
  fallbackEnabled: true,
  maxRetries: 3,
  timeout: 60000,
});

// Register and initialize
const openai = ProviderFactory.createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
});

router.registerProvider(openai);
await router.initialize();

// Route a request
const result = await router.route({
  prompt: 'What is quantum computing?',
  maxTokens: 500,
  temperature: 0.7,
});

console.log(result.response.content);
console.log(`Provider: ${result.provider}`);
console.log(`Cost: $${result.response.cost.toFixed(4)}`);
```

---

## CLI Usage

### Initialize Config

```bash
cascade-router init
```

### Route Requests

```bash
# Basic routing
cascade-router route "Explain quantum computing"

# With options
cascade-router route "Your prompt" \
  --strategy cost \
  --max-tokens 1000 \
  --temp 0.5
```

### Check Status

```bash
cascade-router status
```

### List Providers

```bash
cascade-router providers
```

---

## Routing Strategies

### Cost (Cheapest)

```typescript
const router = new Router({
  strategy: 'cost',  // Routes to cheapest provider
  // ...
});
```

**Use case:** Budget-constrained applications

### Speed (Fastest)

```typescript
const router = new Router({
  strategy: 'speed',  // Routes to fastest provider
  // ...
});
```

**Use case:** Real-time applications

### Quality (Best)

```typescript
const router = new Router({
  strategy: 'quality',  // Routes to highest priority
  // ...
});
```

**Use case:** Quality-critical applications

### Balanced (Default)

```typescript
const router = new Router({
  strategy: 'balanced',  // Weighs cost, speed, quality
  // ...
});
```

**Use case:** General-purpose applications

---

## Budget Management

```typescript
const router = new Router({
  strategy: 'balanced',
  budgetLimits: {
    dailyTokens: 1000000,    // 1M tokens/day
    dailyCost: 10,           // $10/day
    monthlyTokens: 25000000, // 25M tokens/month
    monthlyCost: 300,        // $300/month
    alertThreshold: 80,      // Alert at 80%
  },
  // ...
});
```

---

## Rate Limiting

```typescript
const router = new Router({
  strategy: 'balanced',
  rateLimits: {
    requestsPerMinute: 60,     // Max 60 req/min
    tokensPerMinute: 100000,   // Max 100K tokens/min
    concurrentRequests: 5,     // Max 5 concurrent
  },
  // ...
});
```

---

## Multiple Providers

```typescript
// OpenAI
const openai = ProviderFactory.createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  priority: 10,
});

// Anthropic
const anthropic = ProviderFactory.createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-haiku-20240307',
  priority: 5,
});

// Ollama (local, free)
const ollama = ProviderFactory.createOllama({
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
  priority: 20,
});

router.registerProvider(openai);
router.registerProvider(anthropic);
router.registerProvider(ollama);
```

---

## Streaming

```typescript
await router.routeStream(
  {
    prompt: 'Tell me a story',
    maxTokens: 1000,
  },
  (chunk) => {
    process.stdout.write(chunk);  // Stream chunks
  }
);
```

---

## Metrics

```typescript
// Get router metrics
const metrics = router.getMetrics();

console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Total cost: $${metrics.totalCost.toFixed(4)}`);
console.log(`Total tokens: ${metrics.totalTokens.toLocaleString()}`);

// Per-provider metrics
for (const [id, providerMetrics] of metrics.providerMetrics) {
  console.log(`${id}:`);
  console.log(`  Requests: ${providerMetrics.requestCount}`);
  console.log(`  Success rate: ${(providerMetrics.successCount / providerMetrics.requestCount * 100).toFixed(1)}%`);
  console.log(`  Avg latency: ${providerMetrics.avgLatency.toFixed(0)}ms`);
  console.log(`  Total cost: $${providerMetrics.totalCost.toFixed(4)}`);
}
```

---

## Status Check

```typescript
const status = await router.getStatus();

console.log(`Healthy: ${status.healthy}`);
console.log(`Available providers: ${status.availableProviders.join(', ')}`);
console.log(`Budget usage: ${status.currentBudget.dailyPercentage.toFixed(1)}%`);
```

---

## Error Handling

```typescript
try {
  const result = await router.route({
    prompt: 'Your prompt',
    maxTokens: 500,
  });
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.error(`Budget exceeded: ${error.budgetType}`);
    console.error(`Current usage: ${error.currentUsage}`);
    console.error(`Limit: ${error.limit}`);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limit exceeded: ${error.retryAfter}s`);
  } else if (error instanceof RouterError) {
    console.error(`Router error: ${error.code}`);
  }
}
```

---

## Progress Monitoring

```typescript
import { ProgressMonitor } from '@superinstance/cascade-router';

const monitor = new ProgressMonitor([
  {
    tokenInterval: 1000,   // Check every 1000 tokens
    timeInterval: 5000,    // Check every 5 seconds
    callback: (progress) => {
      console.log(`Progress: ${progress.percentage}%`);
      console.log(`Tokens: ${progress.tokensUsed}`);
      console.log(`Cost: $${progress.costIncurred.toFixed(4)}`);
    },
  },
]);

// Monitor is automatically used by router
```

---

## Configuration File

**cascade-router.config.json:**

```json
{
  "routing": {
    "strategy": "balanced",
    "providers": [
      {
        "id": "openai-gpt4",
        "name": "OpenAI GPT-4",
        "type": "openai",
        "enabled": true,
        "priority": 5,
        "maxTokens": 128000,
        "costPerMillionTokens": 10,
        "latency": 500,
        "availability": 0.99,
        "apiKey": "${OPENAI_API_KEY}",
        "model": "gpt-4-turbo"
      },
      {
        "id": "ollama-llama",
        "name": "Ollama Llama2",
        "type": "ollama",
        "enabled": true,
        "priority": 20,
        "maxTokens": 4096,
        "costPerMillionTokens": 0,
        "latency": 2000,
        "availability": 0.9,
        "baseUrl": "http://localhost:11434",
        "model": "llama2"
      }
    ],
    "fallbackEnabled": true,
    "maxRetries": 3,
    "timeout": 60000,
    "budgetLimits": {
      "dailyTokens": 1000000,
      "dailyCost": 10,
      "monthlyTokens": 25000000,
      "monthlyCost": 300,
      "alertThreshold": 80
    },
    "rateLimits": {
      "requestsPerMinute": 60,
      "tokensPerMinute": 100000,
      "concurrentRequests": 5
    }
  },
  "monitoring": {
    "enabled": true,
    "logLevel": "info",
    "metricsRetention": 7
  },
  "providers": []
}
```

---

## Environment Variables

```bash
# Required for cloud providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
CASCADE_ROUTER_STRATEGY=balanced
CASCADE_ROUTER_LOG_LEVEL=info
```

---

## Common Patterns

### Sequential Requests

```typescript
const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];

for (const prompt of prompts) {
  const result = await router.route({ prompt });
  console.log(result.response.content);
}
```

### Parallel Requests

```typescript
const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];

const results = await Promise.all(
  prompts.map(prompt => router.route({ prompt }))
);

results.forEach(result => {
  console.log(result.response.content);
});
```

### Batch Processing with Rate Limits

```typescript
async function processBatch(prompts: string[]) {
  const results = [];

  for (const prompt of prompts) {
    try {
      const result = await router.route({ prompt });
      results.push(result);
    } catch (error) {
      console.error(`Failed: ${prompt}`, error.message);
    }

    // Rate limiting: 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
```

---

## Next Steps

- 📖 Read [README.md](README.md) for full documentation
- 🏗️ Read [ARCHITECTURE.md](ARCHITECTURE.md) for deep dive
- ❓ Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for help
- 📝 Check [examples/](examples/) directory for more examples

---

## Need Help?

- **Issues:** https://github.com/SuperInstance/CascadeRouter/issues
- **Discussions:** https://github.com/SuperInstance/CascadeRouter/discussions
- **Documentation:** https://github.com/SuperInstance/CascadeRouter

---

**Version:** 1.0.0-beta.1
**Last Updated:** 2026-01-07
