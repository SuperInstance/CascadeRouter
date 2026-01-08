# Troubleshooting Guide & FAQ

> Common issues, solutions, and frequently asked questions for Cascade Router

---

## Quick Links

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Routing Issues](#routing-issues)
- [Provider Issues](#provider-issues)
- [Budget & Rate Limiting](#budget--rate-limiting)
- [Performance Issues](#performance-issues)
- [Error Messages](#error-messages)
- [FAQ](#faq)

---

## Installation Issues

### Module not found errors

**Problem:** Cannot find module '@superinstance/cascade-router'

**Solutions:**

1. **Ensure you've installed the package:**
```bash
npm install @superinstance/cascade-router
```

2. **Check Node.js version:**
```bash
node --version  # Should be >=18.0.0
```

3. **Clear npm cache and reinstall:**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

4. **Check for TypeScript version conflicts:**
```bash
npm list typescript
# Should be compatible with your project's TypeScript version
```

---

### CLI command not found

**Problem:** `cascade-router` command not found after installation

**Solutions:**

1. **Install globally:**
```bash
npm install -g @superinstance/cascade-router
```

2. **Or use npx:**
```bash
npx cascade-router init
```

3. **Check npm bin directory:**
```bash
npm bin -g
# Ensure this path is in your PATH
```

---

### TypeScript errors in your project

**Problem:** Type errors when importing Cascade Router

**Solutions:**

1. **Ensure you have TypeScript installed:**
```bash
npm install --save-dev typescript @types/node
```

2. **Check your tsconfig.json:**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

3. **Import correctly:**
```typescript
// For ESM projects
import { Router } from '@superinstance/cascade-router';

// For CommonJS projects
const { Router } = require('@superinstance/cascade-router');
```

---

## Configuration Problems

### Config file not found

**Problem:** `Config file not found: cascade-router.config.json`

**Solutions:**

1. **Create config file:**
```bash
cascade-router init
```

2. **Or specify custom path:**
```bash
cascade-router route "test" --config /path/to/config.json
```

3. **Or use programmatic config:**
```typescript
const router = new Router({
  strategy: 'balanced',
  providers: [...],
  // No config file needed
});
```

---

### Invalid configuration

**Problem:** Configuration validation errors

**Common Issues:**

1. **Missing required fields:**
```json
{
  "routing": {
    "strategy": "balanced",  // ✅ Valid
    "providers": []          // ❌ Empty - need at least one provider
  }
}
```

2. **Invalid strategy:**
```json
{
  "strategy": "fast"  // ❌ Invalid
}
```
**Valid strategies:** `cost`, `speed`, `quality`, `balanced`, `priority`, `fallback`

3. **Missing API keys:**
```bash
# Set environment variables
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Or in config (not recommended for production)
{
  "apiKey": "sk-..."  // ⚠️ Security risk
}
```

---

### Provider not available

**Problem:** Provider shows as unavailable

**Diagnosis:**

1. **Check API key:**
```bash
# Test API key manually
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

2. **Check provider configuration:**
```typescript
const provider = ProviderFactory.createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',  // ✅ Valid model
});

const available = await provider.isAvailable();
console.log('Available:', available);
```

3. **Test with simple request:**
```typescript
try {
  const result = await router.route({ prompt: 'test' });
  console.log('Success!');
} catch (error) {
  console.error('Error:', error.message);
}
```

---

## Routing Issues

### Always routes to same provider

**Problem:** Router always selects first provider regardless of strategy

**Causes:**

1. **Provider configuration identical:**
```typescript
// All providers have same cost/latency/priority
// Router will pick first one in list
```

2. **Strategy not applied:**
```typescript
const router = new Router({
  strategy: 'cost',  // ✅ Set here
  providers: [...]
});

// NOT here
router.route({ prompt: 'test' });
```

3. **Only one provider available:**
```bash
cascade-router status
# Check "Available Providers" count
```

**Solution:** Ensure provider configs have different values:

```typescript
const providers = [
  {
    id: 'openai',
    costPerMillionTokens: 0.15,  // Different cost
    latency: 500,                // Different latency
    priority: 10,                // Different priority
    // ...
  },
  {
    id: 'anthropic',
    costPerMillionTokens: 0.25,  // Different cost
    latency: 600,                // Different latency
    priority: 5,                 // Different priority
    // ...
  }
];
```

---

### Fallback not working

**Problem:** Router doesn't fallback when provider fails

**Solution:**

1. **Enable fallback:**
```typescript
const router = new Router({
  fallbackEnabled: true,  // ✅ Must be true
  providers: [...]
});
```

2. **Configure multiple providers:**
```typescript
// Need at least 2 providers for fallback
router.registerProvider(provider1);
router.registerProvider(provider2);
```

3. **Check attempts in result:**
```typescript
const result = await router.route({ prompt: 'test' });

console.log('Attempts:', result.attempts);
console.log('Fallback triggered:', result.routingDecision.fallbackTriggered);

// If fallbackTriggered is false, first provider succeeded
// If true, first provider failed and second was tried
```

---

## Provider Issues

### OpenAI API errors

**Problem:** `OpenAI API error: 401 Unauthorized`

**Solutions:**

1. **Check API key:**
```bash
echo $OPENAI_API_KEY  # Should start with "sk-"
```

2. **Verify key is valid:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

3. **Check key has quota:**
- Visit https://platform.openai.com/usage
- Ensure you have available credits

---

**Problem:** `OpenAI API error: 429 Too Many Requests`

**Solutions:**

1. **Reduce rate limits:**
```typescript
const router = new Router({
  rateLimits: {
    requestsPerMinute: 10,    // Reduce from 60
    tokensPerMinute: 10000,   // Reduce from 100K
    concurrentRequests: 2,     // Reduce from 5
  }
});
```

2. **Add exponential backoff:**
```typescript
// Router will automatically retry with different providers
// if fallback is enabled
```

3. **Use cheaper/faster model:**
```typescript
{
  model: 'gpt-4o-mini'  // Instead of 'gpt-4-turbo'
}
```

---

### Anthropic API errors

**Problem:** `Anthropic API error: 400 Bad Request`

**Common causes:**

1. **Invalid model name:**
```typescript
{
  model: 'claude-3-haiku-20240307'  // ✅ Valid
}
```
**Valid models:** `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`

2. **Exceed context window:**
```typescript
{
  maxTokens: 200000  // Must be <= model's max tokens
}
```

3. **Invalid system prompt:**
```typescript
// Anthropic handles system prompts separately
// Don't include in messages array
```

---

### Ollama connection errors

**Problem:** `Ollama error: Failed to fetch` or `ECONNREFUSED`

**Solutions:**

1. **Ensure Ollama is running:**
```bash
ollama list
# Should show installed models
```

2. **Start Ollama:**
```bash
ollama serve
# Runs on http://localhost:11434 by default
```

3. **Check baseUrl:**
```typescript
{
  baseUrl: 'http://localhost:11434',  // Default
  // Or custom:
  baseUrl: 'http://192.168.1.100:11434'
}
```

4. **Test Ollama API directly:**
```bash
curl http://localhost:11434/api/tags
# Should return list of models
```

---

## Budget & Rate Limiting

### Budget exceeded errors

**Problem:** `BudgetExceededError: Daily cost limit would be exceeded`

**Solutions:**

1. **Increase budget:**
```typescript
{
  budgetLimits: {
    dailyCost: 100,      // Increase from $10
    monthlyCost: 3000,   // Increase from $300
  }
}
```

2. **Use cheaper providers:**
```typescript
{
  strategy: 'cost',  // Route to cheapest provider
}
```

3. **Reduce token usage:**
```typescript
{
  maxTokens: 250,  // Instead of 1000
}
```

4. **Check current usage:**
```typescript
const usage = router.getMetrics();
console.log('Daily cost:', usage.budgetUsage.dailyCost);
console.log('Monthly cost:', usage.budgetUsage.monthlyCost);
```

---

### Rate limit errors

**Problem:** `RateLimitError: Rate limit exceeded`

**Solutions:**

1. **Increase rate limits:**
```typescript
{
  rateLimits: {
    requestsPerMinute: 100,  // Increase
    tokensPerMinute: 200000,  // Increase
  }
}
```

2. **Add delays between requests:**
```typescript
for (const prompt of prompts) {
  await router.route({ prompt });
  await new Promise(resolve => setTimeout(resolve, 1000));  // 1 second delay
}
```

3. **Use queue for batch processing:**
```typescript
// Process prompts sequentially with rate limiting
async function processBatch(prompts: string[]) {
  const results = [];
  for (const prompt of prompts) {
    const result = await router.route({ prompt });
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return results;
}
```

---

## Performance Issues

### Slow responses

**Problem:** Requests take too long

**Diagnosis:**

1. **Check provider latency:**
```typescript
const status = await router.getStatus();
// Check individual provider response times
```

2. **Use speed strategy:**
```typescript
{
  strategy: 'speed',  // Route to fastest provider
}
```

3. **Use local provider:**
```typescript
{
  type: 'ollama',  // Faster than API calls
  baseUrl: 'http://localhost:11434',
  model: 'llama2'
}
```

4. **Reduce max tokens:**
```typescript
{
  maxTokens: 250,  // Faster responses
}
```

---

### High memory usage

**Problem:** Memory usage grows over time

**Causes:**

1. **Request history not cleaned up:**
```typescript
// Automatic cleanup should happen, but you can force it:
limiter.resetDailyUsage();
limiter.resetMonthlyUsage();
```

2. **Metrics accumulation:**
```typescript
// Reset metrics periodically:
router.resetMetrics();
```

3. **Large response caching:**
```typescript
// Don't cache full responses in memory
// Cache only necessary data
```

---

## Error Messages

### "Router not initialized"

**Cause:** Calling `route()` before `initialize()`

**Solution:**
```typescript
const router = new Router(config);
await router.initialize();  // ✅ Call this first

await router.route({ prompt: 'test' });  // ✅ Now it works
```

---

### "No available providers"

**Cause:** All providers are disabled or unavailable

**Solution:**
```typescript
// 1. Check provider status
const status = await router.getStatus();
console.log('Available:', status.availableProviders);
console.log('Unavailable:', status.unavailableProviders);

// 2. Enable providers in config
{
  providers: [
    {
      enabled: true,  // ✅ Must be true
      // ...
    }
  ]
}

// 3. Check API keys
console.log('OpenAI key:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');
```

---

### "All providers failed"

**Cause:** Every provider threw an error

**Solution:**
```typescript
// 1. Check individual provider errors
const result = await router.route({ prompt: 'test' })
  .catch(error => {
    console.error('Error:', error);
    // Check error.details.attempts for individual failures
  });

// 2. Test providers individually
for (const [id, provider] of providers) {
  try {
    await provider.isAvailable();
    console.log(`${id}: Available`);
  } catch (error) {
    console.error(`${id}:`, error.message);
  }
}
```

---

## FAQ

### General Questions

**Q: What is Cascade Router?**
A: Cascade Router is an intelligent LLM routing layer that automatically selects the best provider (OpenAI, Anthropic, Ollama, etc.) based on cost, speed, quality, or custom criteria.

**Q: Why should I use it?**
A:
- **Cost Optimization:** Automatically route to cheapest provider
- **Reliability:** Automatic fallback on failures
- **Budget Control:** Enforce cost and token limits
- **Flexibility:** Easy to add new providers
- **Observability:** Built-in metrics and monitoring

**Q: Is it free?**
A: Cascade Router is open-source (MIT license), but you still pay for the underlying LLM APIs (OpenAI, Anthropic, etc.). Ollama is free if running locally.

**Q: Can I use it in production?**
A: Yes! Cascade Router is production-ready with:
- Comprehensive error handling
- Automatic fallbacks
- Budget enforcement
- Rate limiting
- TypeScript for type safety

---

### Configuration Questions

**Q: How do I add a new provider?**
A:
```typescript
import { ProviderFactory } from '@superinstance/cascade-router';

const customProvider = ProviderFactory.createProvider({
  id: 'custom',
  name: 'Custom Provider',
  type: 'custom',
  enabled: true,
  priority: 10,
  maxTokens: 128000,
  costPerMillionTokens: 0.15,
  latency: 500,
  availability: 0.99,
  apiKey: process.env.CUSTOM_API_KEY,
  model: 'custom-model',
});

router.registerProvider(customProvider);
```

**Q: How do I change routing strategy?**
A:
```typescript
// In config
const router = new Router({
  strategy: 'cost',  // or 'speed', 'quality', 'balanced', 'priority'
  // ...
});

// Or override per-request
router.config.strategy = 'speed';
```

**Q: Can I limit daily spend?**
A:
```typescript
{
  budgetLimits: {
    dailyCost: 10,      // $10 per day
    dailyTokens: 1000000,  // 1M tokens per day
    alertThreshold: 80,   // Alert at 80% of budget
  }
}
```

---

### Performance Questions

**Q: Which strategy is fastest?**
A: The `speed` strategy routes to the provider with lowest latency, typically:
1. Ollama (local, ~500ms)
2. OpenAI (cloud, ~500ms)
3. Anthropic (cloud, ~600ms)

**Q: Which strategy is cheapest?**
A: The `cost` strategy routes to:
1. Ollama (free)
2. OpenAI Mini ($0.15/M tokens)
3. Anthropic Haiku ($0.25/M tokens)

**Q: How do I optimize for both cost and speed?**
A: Use the `balanced` strategy (default):
```typescript
{
  strategy: 'balanced',  // Weights cost (40%) and speed (30%)
}
```

**Q: Can I cache responses?**
A: Yes, implement caching at application level:
```typescript
const cache = new Map();

async function cachedRoute(prompt: string) {
  if (cache.has(prompt)) {
    return cache.get(prompt);
  }

  const result = await router.route({ prompt });
  cache.set(prompt, result);
  return result;
}
```

---

### Technical Questions

**Q: Does it support streaming?**
A: Yes!
```typescript
await router.routeStream(
  { prompt: 'test' },
  (chunk) => console.log(chunk)  // Called for each chunk
);
```

**Q: How are tokens counted?**
A:
- **OpenAI/Anthropic:** Actual token counts from API
- **Ollama:** Estimated (1 token ≈ 4 characters)

**Q: Can I use it with Next.js?**
A: Yes! Create API routes:
```typescript
// pages/api/chat.ts
import { Router } from '@superinstance/cascade-router';

const router = new Router(config);
await router.initialize();

export default async function handler(req, res) {
  const result = await router.route({
    prompt: req.body.prompt,
  });
  res.json(result);
}
```

**Q: Does it work in the browser?**
A: No, Cascade Router is Node.js-only (requires server-side APIs). For browser use, create API routes in Next.js or similar.

---

### Troubleshooting Questions

**Q: Why is my provider unavailable?**
A: Common reasons:
1. Missing or invalid API key
2. Network connectivity issues
3. API service is down
4. Rate limit exceeded
5. Invalid configuration

Check with:
```typescript
const status = await router.getStatus();
console.log(status.unavailableProviders);
```

**Q: Why is fallback not triggering?**
A: Ensure:
1. `fallbackEnabled: true`
2. Multiple providers registered
3. At least one provider is available
4. Check `result.routingDecision.fallbackTriggered`

**Q: How do I debug routing decisions?**
A:
```typescript
const result = await router.route({ prompt: 'test' });

console.log('Selected provider:', result.provider);
console.log('Routing decision:', result.routingDecision);
console.log('Attempts:', result.attempts);
console.log('Reasoning:', result.routingDecision.reasoning);
```

---

### Advanced Questions

**Q: Can I create custom routing strategies?**
A: Yes! Extend the Router class:
```typescript
class CustomRouter extends Router {
  private selectProviders(request: ChatRequest): string[] {
    // Custom logic here
    return ['provider-1', 'provider-2'];
  }
}
```

**Q: How do I implement custom provider?**
A: Extend BaseProvider:
```typescript
import { BaseProvider } from '@superinstance/cascade-router';

class MyProvider extends BaseProvider {
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Your implementation
  }
  // ... implement other methods
}
```

**Q: Can I use it with multiple API keys for same provider?**
A: Yes! Create multiple provider instances:
```typescript
const openai1 = ProviderFactory.createOpenAI({
  id: 'openai-account-1',
  apiKey: process.env.OPENAI_API_KEY_1,
});

const openai2 = ProviderFactory.createOpenAI({
  id: 'openai-account-2',
  apiKey: process.env.OPENAI_API_KEY_2,
});

router.registerProvider(openai1);
router.registerProvider(openai2);
```

---

## Getting Help

Still having issues? Here's how to get help:

1. **Check documentation:**
   - [README.md](README.md) - Quick start and overview
   - [ARCHITECTURE.md](ARCHITECTURE.md) - Deep dive into architecture
   - [API.md](docs/API.md) - Complete API reference

2. **Search existing issues:**
   - [GitHub Issues](https://github.com/SuperInstance/CascadeRouter/issues)

3. **Create a new issue:**
   - Include your configuration
   - Include error messages
   - Include steps to reproduce
   - Include your environment (Node.js version, OS, etc.)

4. **Community:**
   - GitHub Discussions
   - Discord (coming soon)

---

**Last Updated:** 2026-01-07
**Version:** 1.0.0-beta.1
**Maintainer:** SuperInstance Team
