# Cascade Router Architecture

> Deep dive into the architecture, design decisions, and internal workings of Cascade Router

---

## Overview

Cascade Router is a sophisticated LLM routing layer built on three core principles:

1. **Model Agnostic** - Work with any LLM provider through a unified interface
2. **Cost Optimized** - Intelligent routing based on cost, speed, quality, or balanced metrics
3. **Production Ready** - Built-in rate limiting, budget management, and automatic fallbacks

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Application                              │
│                    (Your AI Application)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ ChatRequest
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Router                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Strategy Selector                                        │  │
│  │  • Cost     → Cheapest available provider                 │  │
│  │  • Speed    → Fastest provider                           │  │
│  │  • Quality  → Highest priority provider                  │  │
│  │  • Balanced → Weighted score of all factors               │  │
│  │  • Priority → User-defined order                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Budget & Rate Limiter                                   │  │
│  │  • Daily/monthly token limits                            │  │
│  │  • Daily/monthly cost limits                             │  │
│  │  • Requests per minute                                   │  │
│  │  • Tokens per minute                                     │  │
│  │  • Concurrent requests (planned)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Progress Monitor                                        │  │
│  │  • Track request progress                                │  │
│  │  • Periodic check-ins                                    │  │
│  │  • Token usage updates                                   │  │
│  │  • Cost accumulation                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Provider Selection
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Provider Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   OpenAI    │  │  Anthropic  │  │   Ollama    │            │
│  │  Provider   │  │  Provider   │  │  Provider   │  ...        │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External APIs                                 │
│  • OpenAI API      • Anthropic API   • Ollama (local)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Router (`src/core/router.ts`)

**Responsibility:** Central coordinator for all LLM requests

**Key Features:**
- Provider selection based on strategy
- Fallback orchestration
- Metrics collection
- Request lifecycle management

**Design Pattern:** Strategy Pattern + Facade Pattern

```typescript
class Router {
  // Select provider based on strategy
  private selectProviders(request: ChatRequest): string[]

  // Execute request with monitoring
  private async executeWithMonitoring(provider, request): Promise<ChatResponse>

  // Update metrics after request
  private updateMetrics(providerId, response, duration): void
}
```

**Key Methods:**
- `route()` - Execute non-streaming request
- `routeStream()` - Execute streaming request
- `registerProvider()` - Add provider to router
- `initialize()` - Check provider availability
- `getMetrics()` - Retrieve router metrics
- `getStatus()` - Get current router status

---

### 2. TokenLimiter (`src/core/limiter.ts`)

**Responsibility:** Enforce budget and rate limits

**Key Features:**
- Daily/monthly token budgets
- Daily/monthly cost budgets
- Requests per minute limiting
- Tokens per minute limiting
- Automatic cleanup of old records

**Design Pattern:** Circuit Pattern + Checkpoint Pattern

```typescript
class TokenLimiter {
  // Check if request is within budget
  checkBudget(request: ChatRequest): BudgetCheck

  // Check if request is within rate limits
  checkRateLimits(): RateLimitCheck

  // Record usage after successful request
  recordUsage(tokens: TokenCount): void

  // Get current budget usage
  getBudgetUsage(): BudgetUsage
}
```

**Algorithm:**
```
1. Check budget limits (pre-request)
   ├─ Estimate tokens for request
   ├─ Calculate estimated cost
   ├─ Add to current usage
   └─ Compare against limits

2. Check rate limits (pre-request)
   ├─ Count requests in last minute
   ├─ Count tokens in last minute
   └─ Compare against limits

3. Record usage (post-request)
   ├─ Record actual token usage
   ├─ Record actual cost
   └─ Clean up old records (>24h, >30d, >1min)
```

**Known Issues:**
- ⚠️ Race condition: `checkRateLimits()` and `recordUsage()` not atomic
- ⚠️ Concurrent request limiting not enforced (planned for v1.1)

---

### 3. ProgressMonitor (`src/core/monitor.ts`)

**Responsibility:** Track and report request progress

**Key Features:**
- Real-time progress tracking
- Periodic check-ins
- Token usage updates
- Cost accumulation tracking

**Design Pattern:** Observer Pattern

```typescript
class ProgressMonitor {
  // Start tracking a request
  start(providerId: string, callback?: ProgressCallback): void

  // End tracking and send final update
  end(providerId: string): void

  // Track operation with automatic updates
  async track<T>(providerId: string, operation: () => Promise<T>): Promise<T>
}
```

**Progress Callbacks:**
```typescript
type ProgressCallback = (progress: ProgressUpdate) => void;

interface ProgressUpdate {
  provider: string;
  tokensUsed: number;
  costIncurred: number;
  duration: number;
  percentage: number;        // 0-100 (estimated)
  status: 'in-progress' | 'complete' | 'error';
  error?: string;
}
```

---

### 4. Provider Architecture

**Base Provider (`src/providers/base.ts`):**

Abstract base class defining the provider interface.

```typescript
abstract class BaseProvider implements Provider {
  abstract isAvailable(): Promise<boolean>
  abstract chat(request: ChatRequest): Promise<ChatResponse>
  abstract chatStream(request: ChatRequest, onChunk: (chunk: string) => void): Promise<ChatResponse>
  abstract estimateTokens(text: string): number

  // Shared utility methods
  protected calculateCost(tokens: number): number
  protected createResponse(...): ChatResponse
  protected estimateTokensSimple(text: string): number
  protected validateConfig(): void
  protected handleError(error: unknown, context: string): never
}
```

**Provider Implementations:**

1. **OpenAI Provider** (`src/providers/openai.ts`)
   - GPT-4, GPT-4 Turbo, GPT-4o Mini
   - Supports streaming
   - Full token tracking from API
   - Timeout support

2. **Anthropic Provider** (`src/providers/anthropic.ts`)
   - Claude 3 Opus, Sonnet, Haiku
   - System prompt support
   - Full token tracking from API
   - Timeout support

3. **Ollama Provider** (`src/providers/ollama.ts`)
   - Local models (Llama2, Mistral, etc.)
   - Free (no API costs)
   - Estimated token counting
   - Supports streaming

**Custom Provider Example:**
```typescript
import { BaseProvider } from '@superinstance/cascade-router';

class CustomProvider extends BaseProvider {
  readonly id = 'custom';
  config: ProviderConfig;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.validateConfig();
  }

  async isAvailable(): Promise<boolean> {
    // Check availability
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Implement chat logic
    return this.createResponse(...);
  }

  async chatStream(request: ChatRequest, onChunk: (chunk: string) => void): Promise<ChatResponse> {
    // Implement streaming logic
    return this.createResponse(...);
  }

  estimateTokens(text: string): number {
    // Estimate or count tokens
    return Math.ceil(text.length / 4);
  }
}
```

---

## Routing Strategies

### Cost Strategy

**Algorithm:** Sort providers by `costPerMillionTokens` (ascending)

**Use Case:** Budget-constrained applications

```typescript
// Pseudocode
providers.sort((a, b) =>
  a.costPerMillionTokens - b.costPerMillionTokens
)
```

**Example:**
```
Providers: OpenAI ($0.15/M), Anthropic ($0.25/M), Ollama ($0/M)
Selection: Ollama → OpenAI → Anthropic
```

---

### Speed Strategy

**Algorithm:** Sort providers by `latency` (ascending)

**Use Case:** Real-time applications, chatbots

```typescript
providers.sort((a, b) => a.latency - b.latency)
```

**Example:**
```
Providers: OpenAI (500ms), Anthropic (600ms), Ollama (2000ms)
Selection: OpenAI → Anthropic → Ollama
```

---

### Quality Strategy

**Algorithm:** Sort providers by `priority` (ascending, lower = higher quality)

**Use Case:** Quality-critical applications

```typescript
providers.sort((a, b) => a.priority - b.priority)
```

**Example:**
```
Providers: GPT-4 (priority: 5), Claude 3 Opus (priority: 3), Llama2 (priority: 20)
Selection: Claude 3 Opus → GPT-4 → Llama2
```

---

### Balanced Strategy (Default)

**Algorithm:** Weighted scoring of all factors

```typescript
// Normalize scores (0-1)
const costScore = 1 - (costPerMillionTokens / 100)
const speedScore = 1 - (latency / 10000)
const qualityScore = 1 - (priority / 100)
const availabilityScore = availability

// Weighted average
const score = (
  costScore * 0.4 +
  speedScore * 0.3 +
  qualityScore * 0.2 +
  availabilityScore * 0.1
)

providers.sort((a, b) => b.score - a.score)
```

**Weights:**
- Cost: 40%
- Speed: 30%
- Quality: 20%
- Availability: 10%

**Use Case:** General-purpose applications

---

### Priority Strategy

**Algorithm:** User-defined priority order

**Use Case:** Explicit control over provider selection

```typescript
providers.sort((a, b) => a.priority - b.priority)
```

---

## Request Lifecycle

### 1. Initialization

```
Application → new Router(config)
            → router.registerProvider(provider1)
            → router.registerProvider(provider2)
            → router.initialize()
               ├─ Check provider availability
               └─ Warn about unavailable providers
```

### 2. Request Execution

```
Application → router.route(request)
            ↓
         Router checks if initialized
            ↓
      Check budget limits (TokenLimiter)
         ├─ Estimate tokens
         ├─ Calculate cost
         └─ Compare to limits
            ↓
     Check rate limits (TokenLimiter)
         ├─ Count recent requests
         ├─ Count recent tokens
         └─ Compare to limits
            ↓
    Select providers (Strategy)
         └─ Sort by strategy
            ↓
    Try first provider
         ├─ Start monitoring (ProgressMonitor)
         ├─ Execute request (Provider)
         ├─ Success?
         │   ├─ Yes → Update metrics
         │   │        Record usage
         │   │        Return result
         │   └─ No  → Check fallback enabled
         │              ├─ Yes → Try next provider
         │              └─ No  → Throw error
         └─ End monitoring
```

### 3. Metrics Collection

```
After each request:
  ├─ Total requests +1
  ├─ Total cost + response.cost
  ├─ Total tokens + response.tokens.total
  ├─ Provider metrics updated
  │   ├─ Request count +1
  │   ├─ Success/failure count +1
  │   ├─ Total tokens + response.tokens.total
  │   ├─ Total cost + response.cost
  │   ├─ Average latency updated
  │   └─ Last used timestamp updated
  └─ Budget usage updated
      ├─ Daily tokens + response.tokens.total
      ├─ Daily cost + response.cost
      ├─ Monthly tokens + response.tokens.total
      └─ Monthly cost + response.cost
```

---

## Error Handling

### Error Types

```typescript
// Base router error
class RouterError extends Error {
  code: string;
  details?: Record<string, unknown>;
}

// Budget exceeded
class BudgetExceededError extends RouterError {
  budgetType: 'daily' | 'monthly';
  currentUsage: number;
  limit: number;
}

// Rate limit exceeded
class RateLimitError extends RouterError {
  provider: string;
  retryAfter?: number;
}

// Provider-specific error
class ProviderError extends Error {
  provider: string;
  code: string;
  details?: Record<string, unknown>;
}
```

### Error Handling Flow

```
Request → Provider Error
           ↓
        Check fallback enabled?
           ├─ Yes → Try next provider
           │         ↓
           │      All providers failed?
           │         ├─ Yes → Throw RouterError("All providers failed")
           │         └─ No  → Continue with next
           └─ No  → Throw provider error immediately
```

---

## Performance Considerations

### Memory Management

- **Request History:** Cleaned up every 1 minute
- **Daily Usage:** Cleaned up every 24 hours
- **Monthly Usage:** Cleaned up every 30 days
- **Metrics:** Stored in memory (consider external storage for production)

### CPU Performance

- **Provider Selection:** O(n log n) due to sorting
- **Rate Limiting:** O(n) where n = request history length
- **Budget Checking:** O(1) after initial calculation

### Optimization Opportunities

1. **Circular Buffer for Rate Limiting**
   - Current: Array filtering on every check (O(n))
   - Proposed: Circular buffer with expiry (O(1))

2. **Lazy Provider Selection**
   - Current: Sort all providers on every request
   - Proposed: Cache sorted order, invalidate on config change

3. **Metrics Aggregation**
   - Current: In-memory storage
   - Proposed: External metrics backend (Prometheus, Datadog)

---

## Security Considerations

### API Key Management

✅ **DO:**
- Use environment variables for API keys
- Store keys in secure vaults (AWS Secrets Manager, Azure Key Vault)
- Rotate keys regularly

❌ **DON'T:**
- Commit API keys to version control
- Store keys in config files
- Log API keys

### Request Sanitization

- Remove sensitive data from prompts before logging
- Sanitize error messages before displaying
- Validate all user inputs

### Rate Limiting

- Implement both client-side and server-side rate limiting
- Use backoff strategies for retries
- Monitor for abuse patterns

---

## Testing Strategy

### Unit Tests

- **Router Tests:** Strategy selection, fallback, metrics
- **Limiter Tests:** Budget checking, rate limiting, cleanup
- **Monitor Tests:** Progress tracking, callbacks
- **Provider Tests:** API calls, streaming, error handling

### Integration Tests

- End-to-end request flows
- Multi-provider scenarios
- Budget and rate limit enforcement
- Fallback behavior

### Test Coverage

- **Current:** 95% pass rate (60/63 tests)
- **Target:** >98% coverage
- **Missing:** Integration tests, load tests

---

## Future Enhancements

### v1.1.0 (Planned)

- [ ] Atomic rate limiting (fix race conditions)
- [ ] Concurrent request limiting
- [ ] Structured logging (pino/winston)
- [ ] Configuration schema validation
- [ ] Specific error types (TimeoutError, AuthenticationError, NetworkError)

### v1.2.0 (Considered)

- [ ] Connection pooling
- [ ] Request queuing
- [ ] Advanced metrics (queue depth, wait times)
- [ ] Health check endpoint
- [ ] Metrics export (Prometheus format)

### v2.0.0 (Future)

- [ ] Distributed routing (multi-instance)
- [ ] Machine learning-based provider selection
- [ ] Dynamic priority adjustment
- [ ] Provider health scoring
- [ ] Advanced caching strategies

---

## Design Philosophy

**Simplicity over Complexity**
- Clear, straightforward code
- Minimal dependencies
- Easy to understand and modify

**Type Safety**
- Full TypeScript coverage
- No `any` types (except unavoidable cases)
- Strict mode enabled

**Performance**
- Efficient algorithms
- Minimal overhead
- Async/await throughout

**Reliability**
- Comprehensive error handling
- Graceful degradation
- Automatic fallbacks

**Extensibility**
- Plugin architecture for providers
- Configurable strategies
- Easy to add features

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to Cascade Router.

---

**Last Updated:** 2026-01-07
**Version:** 1.0.0-beta.1
**Maintainer:** SuperInstance Team
