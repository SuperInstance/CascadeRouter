# Cascade Router API Documentation

Complete API reference for Cascade Router.

## Table of Contents

- [Router](#router)
- [Providers](#providers)
- [Token Limiter](#token-limiter)
- [Progress Monitor](#progress-monitor)
- [Types](#types)

---

## Router

Main router class for managing LLM requests with intelligent routing.

### Constructor

```typescript
constructor(config: RoutingConfig)
```

Creates a new Router instance.

**Parameters:**
- `config: RoutingConfig` - Router configuration

**Example:**
```typescript
const router = new Router({
  strategy: 'balanced',
  providers: [ /* provider configs */ ],
  fallbackEnabled: true,
  maxRetries: 3,
  timeout: 60000,
});
```

### Methods

#### registerProvider

```typescript
registerProvider(provider: Provider): void
```

Register a provider with the router.

**Parameters:**
- `provider: Provider` - Provider instance

**Example:**
```typescript
const openai = ProviderFactory.createOpenAI({ apiKey: 'sk-...' });
router.registerProvider(openai);
```

#### initialize

```typescript
async initialize(): Promise<void>
```

Initialize the router and check provider availability.

**Example:**
```typescript
await router.initialize();
```

#### route

```typescript
async route(request: ChatRequest): Promise<RoutingResult>
```

Route a request to the best available provider.

**Parameters:**
- `request: ChatRequest` - Chat request

**Returns:** `RoutingResult`

**Example:**
```typescript
const result = await router.route({
  prompt: 'Explain quantum computing',
  maxTokens: 500,
  temperature: 0.7,
});
```

#### routeStream

```typescript
async routeStream(
  request: ChatRequest,
  onChunk: (chunk: string) => void
): Promise<RoutingResult>
```

Route a streaming request.

**Parameters:**
- `request: ChatRequest` - Chat request
- `onChunk: (chunk: string) => void` - Callback for each chunk

**Returns:** `RoutingResult`

**Example:**
```typescript
const result = await router.routeStream(
  { prompt: 'Tell me a story' },
  (chunk) => process.stdout.write(chunk)
);
```

#### getMetrics

```typescript
getMetrics(): RouterMetrics
```

Get router metrics.

**Returns:** `RouterMetrics`

**Example:**
```typescript
const metrics = router.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Total cost: $${metrics.totalCost}`);
```

#### getStatus

```typescript
async getStatus(): Promise<RouterStatus>
```

Get router status and provider availability.

**Returns:** `RouterStatus`

**Example:**
```typescript
const status = await router.getStatus();
console.log(`Healthy: ${status.healthy}`);
console.log(`Available: ${status.availableProviders}`);
```

#### resetMetrics

```typescript
resetMetrics(): void
```

Reset all router metrics.

**Example:**
```typescript
router.resetMetrics();
```

---

## Providers

### ProviderFactory

Factory for creating provider instances.

#### createProvider

```typescript
static createProvider(config: ProviderConfig): Provider
```

Create a provider from configuration.

**Parameters:**
- `config: ProviderConfig` - Provider configuration

**Returns:** `Provider`

#### createOpenAI

```typescript
static createOpenAI(config?: Partial<ProviderConfig>): OpenAIProvider
```

Create an OpenAI provider.

**Parameters:**
- `config?: Partial<ProviderConfig>` - Optional configuration

**Returns:** `OpenAIProvider`

**Example:**
```typescript
const openai = ProviderFactory.createOpenAI({
  apiKey: 'sk-...',
  model: 'gpt-4-turbo',
  priority: 5,
});
```

#### createAnthropic

```typescript
static createAnthropic(config?: Partial<ProviderConfig>): AnthropicProvider
```

Create an Anthropic provider.

**Parameters:**
- `config?: Partial<ProviderConfig>` - Optional configuration

**Returns:** `AnthropicProvider`

**Example:**
```typescript
const anthropic = ProviderFactory.createAnthropic({
  apiKey: 'sk-ant-...',
  model: 'claude-3-opus-20240229',
});
```

#### createOllama

```typescript
static createOllama(config?: Partial<ProviderConfig>): OllamaProvider
```

Create an Ollama (local) provider.

**Parameters:**
- `config?: Partial<ProviderConfig>` - Optional configuration

**Returns:** `OllamaProvider`

**Example:**
```typescript
const ollama = ProviderFactory.createOllama({
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
});
```

### Provider Interface

All providers implement the `Provider` interface:

```typescript
interface Provider {
  id: string;
  config: ProviderConfig;
  isAvailable(): Promise<boolean>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest, onChunk: (chunk: string) => void): Promise<ChatResponse>;
  estimateTokens(text: string): number;
  getMaxTokens(): number;
}
```

---

## Token Limiter

Manages token budgets and rate limits.

### Constructor

```typescript
constructor(budgetLimits?: BudgetLimits, rateLimits?: RateLimits)
```

**Parameters:**
- `budgetLimits?: BudgetLimits` - Optional budget limits
- `rateLimits?: RateLimits` - Optional rate limits

### Methods

#### checkBudget

```typescript
checkBudget(request: ChatRequest): BudgetCheck
```

Check if a request is allowed based on budget limits.

**Parameters:**
- `request: ChatRequest` - Chat request

**Returns:** `BudgetCheck`

**Example:**
```typescript
const check = limiter.checkBudget(request);
if (!check.allowed) {
  console.log(`Budget exceeded: ${check.reason}`);
}
```

#### checkRateLimits

```typescript
checkRateLimits(): RateLimitCheck
```

Check rate limits.

**Returns:** `RateLimitCheck`

#### recordUsage

```typescript
recordUsage(tokens: { input: number; output: number; total: number }): void
```

Record token usage after a request.

**Parameters:**
- `tokens: { input: number; output: number; total: number }` - Token usage

#### getBudgetUsage

```typescript
getBudgetUsage(): BudgetUsage
```

Get current budget usage.

**Returns:** `BudgetUsage`

---

## Progress Monitor

Tracks progress of requests with periodic check-ins.

### Constructor

```typescript
constructor(checkpoints: ProgressCheckpoint[] = [])
```

**Parameters:**
- `checkpoints: ProgressCheckpoint[]` - Array of progress checkpoints

### Methods

#### start

```typescript
start(providerId: string, callback?: (progress: ProgressUpdate) => void): void
```

Start tracking a request.

**Parameters:**
- `providerId: string` - Provider ID
- `callback?: (progress: ProgressUpdate) => void` - Optional progress callback

#### end

```typescript
end(providerId: string): void
```

End tracking a request.

**Parameters:**
- `providerId: string` - Provider ID

#### track

```typescript
async track<T>(providerId: string, operation: () => Promise<T>): Promise<T>
```

Track an async operation with automatic progress updates.

**Parameters:**
- `providerId: string` - Provider ID
- `operation: () => Promise<T>` - Async operation to track

**Returns:** `Promise<T>`

#### updateTokens

```typescript
updateTokens(tokens: number, cost: number): void
```

Manually update token usage.

**Parameters:**
- `tokens: number` - Number of tokens
- `cost: number` - Cost in USD

---

## Types

### ChatRequest

```typescript
interface ChatRequest {
  prompt: string;
  messages?: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}
```

### ChatResponse

```typescript
interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  duration: number;
  finishReason: string;
  cached?: boolean;
}
```

### RoutingConfig

```typescript
interface RoutingConfig {
  strategy: RoutingStrategy;
  providers: ProviderConfig[];
  defaultProvider?: string;
  fallbackEnabled: boolean;
  maxRetries: number;
  timeout: number;
  budgetLimits?: BudgetLimits;
  rateLimits?: RateLimits;
  progressCheckpoints?: ProgressCheckpoint[];
}
```

### ProviderConfig

```typescript
interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number;
  maxTokens: number;
  costPerMillionTokens: number;
  latency: number;
  availability: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  config?: Record<string, unknown>;
}
```

### BudgetLimits

```typescript
interface BudgetLimits {
  dailyTokens: number;
  dailyCost: number;
  monthlyTokens: number;
  monthlyCost: number;
  alertThreshold: number;
}
```

### RateLimits

```typescript
interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrentRequests: number;
}
```

### RoutingResult

```typescript
interface RoutingResult {
  provider: string;
  response: ChatResponse;
  routingDecision: RoutingDecision;
  attempts: RoutingAttempt[];
  totalCost: number;
  totalDuration: number;
}
```

### RouterMetrics

```typescript
interface RouterMetrics {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  providerMetrics: Map<string, ProviderMetrics>;
  budgetUsage: BudgetUsage;
  rateLimitHits: number;
  fallbackCount: number;
}
```

### RouterStatus

```typescript
interface RouterStatus {
  healthy: boolean;
  availableProviders: string[];
  degradedProviders: string[];
  unavailableProviders: string[];
  currentBudget: BudgetUsage;
  activeRateLimits: string[];
}
```

---

## Error Types

### RouterError

Base error for router-related errors.

```typescript
class RouterError extends Error {
  constructor(message: string, code: string, details?: Record<string, unknown>)
}
```

### ProviderError

Error for provider-specific failures.

```typescript
class ProviderError extends Error {
  constructor(message: string, provider: string, code: string, details?: Record<string, unknown>)
}
```

### BudgetExceededError

Error when budget limits are exceeded.

```typescript
class BudgetExceededError extends RouterError {
  constructor(message: string, budgetType: 'daily' | 'monthly', currentUsage: number, limit: number)
}
```

### RateLimitError

Error when rate limits are exceeded.

```typescript
class RateLimitError extends RouterError {
  constructor(message: string, provider: string, retryAfter?: number)
}
```

---

For more examples, see the [examples](../examples/) directory.
