# Cascade Router

> Intelligent LLM routing with cost optimization and progress monitoring

Cascade Router is a model-agnostic routing layer for Large Language Model (LLM) applications. It intelligently routes requests to the most appropriate provider based on cost, speed, quality, or balanced metrics - all while managing budgets, rate limits, and automatic fallbacks.

## Features

- **Multiple Routing Strategies**: Route by cost, speed, quality, priority, or balanced metrics
- **Budget Management**: Set daily/monthly token and cost limits with automatic enforcement
- **Rate Limiting**: Built-in rate limiting for requests and tokens per minute
- **Automatic Fallback**: Gracefully fallback to alternative providers on failure
- **Progress Monitoring**: Real-time progress tracking with periodic check-ins
- **Provider Abstraction**: Support for OpenAI, Anthropic, Ollama, and custom providers
- **Cost Optimization**: Track and optimize token usage across all providers
- **CLI Interface**: Simple command-line interface for easy integration
- **TypeScript**: Fully typed for excellent developer experience

## Installation

```bash
npm install @superinstance/cascade-router
```

## Quick Start

### 1. Initialize Configuration

```bash
npx cascade-router init
```

This creates a `cascade-router.config.json` file with your settings.

### 2. Use via CLI

```bash
# Route a request to the best provider
cascade-router route "Explain quantum computing"

# Check provider status
cascade-router status

# List configured providers
cascade-router providers
```

### 3. Use Programmatically

```typescript
import { Router, ProviderFactory } from '@superinstance/cascade-router';

// Create router with configuration
const router = new Router({
  strategy: 'balanced',
  providers: [
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
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
    },
    // Add more providers...
  ],
  fallbackEnabled: true,
  maxRetries: 3,
  timeout: 60000,
});

// Register providers
const openai = ProviderFactory.createOpenAI({ apiKey: 'sk-...' });
router.registerProvider(openai);

await router.initialize();

// Route a request
const result = await router.route({
  prompt: 'Explain quantum computing',
  maxTokens: 500,
  temperature: 0.7,
});

console.log(result.response.content);
console.log(`Cost: $${result.response.cost}`);
console.log(`Provider: ${result.provider}`);
```

## Routing Strategies

### Cost Strategy

Routes to the cheapest available provider:

```typescript
const router = new Router({
  strategy: 'cost',
  // ... config
});
```

**Use case**: Budget-conscious applications where cost is the primary concern.

### Speed Strategy

Routes to the fastest provider:

```typescript
const router = new Router({
  strategy: 'speed',
  // ... config
});
```

**Use case**: Real-time applications where latency is critical.

### Quality Strategy

Routes to the highest quality provider (based on priority):

```typescript
const router = new Router({
  strategy: 'quality',
  // ... config
});
```

**Use case**: Applications where response quality is most important.

### Balanced Strategy (Default)

Balances cost, speed, and quality:

```typescript
const router = new Router({
  strategy: 'balanced',
  // ... config
});
```

**Use case**: General-purpose applications requiring a balance of all factors.

### Priority Strategy

Routes based on explicit provider priority order:

```typescript
const router = new Router({
  strategy: 'priority',
  // ... config
});
```

**Use case**: When you want explicit control over provider selection order.

## Budget Management

Set limits on token usage and costs:

```typescript
const router = new Router({
  strategy: 'balanced',
  budgetLimits: {
    dailyTokens: 1000000,    // 1M tokens per day
    dailyCost: 10,           // $10 per day
    monthlyTokens: 25000000, // 25M tokens per month
    monthlyCost: 300,        // $300 per month
    alertThreshold: 80,      // Alert at 80% of budget
  },
  // ... config
});
```

When limits are exceeded, the router will throw a `BudgetExceededError`.

## Rate Limiting

Configure rate limits to prevent API abuse:

```typescript
const router = new Router({
  strategy: 'balanced',
  rateLimits: {
    requestsPerMinute: 60,     // Max 60 requests per minute
    tokensPerMinute: 100000,   // Max 100K tokens per minute
    concurrentRequests: 5,     // Max 5 concurrent requests
  },
  // ... config
});
```

## Progress Monitoring

Track progress of long-running requests:

```typescript
import { ProgressMonitor } from '@superinstance/cascade-router';

const monitor = new ProgressMonitor([
  {
    tokenInterval: 1000,    // Check every 1000 tokens
    timeInterval: 5000,     // Check every 5 seconds
    callback: (progress) => {
      console.log(`Progress: ${progress.percentage}%`);
      console.log(`Tokens: ${progress.tokensUsed}`);
      console.log(`Cost: $${progress.costIncurred}`);
    },
  },
]);

// Monitor is automatically used by the router
```

## Provider Configuration

### OpenAI

```typescript
const openai = ProviderFactory.createOpenAI({
  id: 'openai-gpt4',
  name: 'OpenAI GPT-4',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4-turbo',
  priority: 5,
  costPerMillionTokens: 10,
});
```

### Anthropic

```typescript
const anthropic = ProviderFactory.createAnthropic({
  id: 'anthropic-claude',
  name: 'Anthropic Claude',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-opus-20240229',
  priority: 5,
  costPerMillionTokens: 15,
});
```

### Ollama (Local)

```typescript
const ollama = ProviderFactory.createOllama({
  id: 'ollama-llama',
  name: 'Ollama Llama2',
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
  priority: 20,
  costPerMillionTokens: 0, // Free!
});
```

## Metrics & Monitoring

Get detailed metrics about router performance:

```typescript
const metrics = router.getMetrics();

console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Total cost: $${metrics.totalCost}`);
console.log(`Total tokens: ${metrics.totalTokens}`);
console.log(`Fallback count: ${metrics.fallbackCount}`);

// Per-provider metrics
for (const [id, providerMetrics] of metrics.providerMetrics) {
  console.log(`${id}:`);
  console.log(`  Requests: ${providerMetrics.requestCount}`);
  console.log(`  Success rate: ${providerMetrics.successCount / providerMetrics.requestCount}`);
  console.log(`  Avg latency: ${providerMetrics.avgLatency}ms`);
  console.log(`  Total cost: $${providerMetrics.totalCost}`);
}
```

Check router status:

```typescript
const status = await router.getStatus();

console.log(`Healthy: ${status.healthy}`);
console.log(`Available: ${status.availableProviders}`);
console.log(`Budget usage: ${status.currentBudget.dailyPercentage}%`);
```

## CLI Commands

### Initialize Config

```bash
cascade-router init
```

### Route Request

```bash
# Basic routing
cascade-router route "Your prompt here"

# With options
cascade-router route "Your prompt" \
  --strategy cost \
  --provider openai \
  --max-tokens 1000 \
  --temp 0.5 \
  --stream
```

### Check Status

```bash
cascade-router status
```

### List Providers

```bash
cascade-router providers
```

### Show Config

```bash
cascade-router config --show
```

## Configuration File

Example `cascade-router.config.json`:

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

## API Reference

### Router

Main router class for managing LLM requests.

#### Constructor

```typescript
constructor(config: RoutingConfig)
```

#### Methods

- `registerProvider(provider: Provider): void` - Register a provider
- `initialize(): Promise<void>` - Initialize router and check provider availability
- `route(request: ChatRequest): Promise<RoutingResult>` - Route a request
- `routeStream(request: ChatRequest, onChunk: (chunk: string) => void): Promise<RoutingResult>` - Route with streaming
- `getMetrics(): RouterMetrics` - Get router metrics
- `getStatus(): Promise<RouterStatus>` - Get router status
- `resetMetrics(): void` - Reset all metrics

### ProviderFactory

Factory for creating provider instances.

#### Methods

- `createProvider(config: ProviderConfig): Provider` - Create provider from config
- `createProviders(configs: ProviderConfig[]): Provider[]` - Create multiple providers
- `createOpenAI(config?: Partial<ProviderConfig>): OpenAIProvider` - Create OpenAI provider
- `createAnthropic(config?: Partial<ProviderConfig>): AnthropicProvider` - Create Anthropic provider
- `createOllama(config?: Partial<ProviderConfig>): OllamaProvider` - Create Ollama provider
- `createDefaultProviders(): Provider[]` - Create providers from environment variables

## Examples

See the `/examples` directory for complete examples:

- Basic routing
- Cost optimization
- Multi-provider setup
- Custom providers
- Advanced monitoring

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

- GitHub Issues: https://github.com/SuperInstance/CascadeRouter/issues
- Documentation: https://github.com/SuperInstance/CascadeRouter

---

Made with ❤️ by the SuperInstance team
