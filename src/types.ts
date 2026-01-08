/**
 * Cascade Router - Core Type Definitions
 *
 * Model-agnostic LLM routing with cost optimization and progress monitoring
 */

// ============================================================================
// PROVIDER TYPES
// ============================================================================

export type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'mcp' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number; // Lower number = higher priority
  maxTokens: number;
  costPerMillionTokens: number;
  latency: number; // Average latency in ms
  availability: number; // 0-1 score
  timeout?: number; // Request timeout in ms
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  config?: Record<string, unknown>;
}

export interface ChatRequest {
  prompt: string;
  messages?: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
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

export interface Provider {
  id: string;
  config: ProviderConfig;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Process a chat request
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Process a streaming chat request
   */
  chatStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse>;

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number;

  /**
   * Get maximum context window
   */
  getMaxTokens(): number;
}

// ============================================================================
// ROUTING TYPES
// ============================================================================

export type RoutingStrategy =
  | 'cost' // Route to cheapest available
  | 'speed' // Route to fastest
  | 'quality' // Route to highest quality
  | 'balanced' // Balance cost, speed, and quality
  | 'priority' // Use provider priority order
  | 'fallback'; // Try in order, fallback on failure

export interface RoutingConfig {
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

export interface BudgetLimits {
  dailyTokens: number;
  dailyCost: number;
  monthlyTokens: number;
  monthlyCost: number;
  alertThreshold: number; // Alert at X% of budget
}

export interface RateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrentRequests: number;
}

export interface ProgressCheckpoint {
  tokenInterval: number; // Check every N tokens
  timeInterval: number; // Check every N ms
  callback: (progress: ProgressUpdate) => void;
}

export interface ProgressUpdate {
  provider: string;
  tokensUsed: number;
  costIncurred: number;
  duration: number;
  percentage: number;
  status: 'in-progress' | 'complete' | 'error';
  error?: string;
}

// ============================================================================
// ROUTING RESULT
// ============================================================================

export interface RoutingResult {
  provider: string;
  response: ChatResponse;
  routingDecision: RoutingDecision;
  attempts: RoutingAttempt[];
  totalCost: number;
  totalDuration: number;
}

export interface RoutingDecision {
  selectedProvider: string;
  strategy: RoutingStrategy;
  reasoning: string;
  alternatives: string[];
  fallbackTriggered: boolean;
}

export interface RoutingAttempt {
  provider: string;
  success: boolean;
  duration: number;
  error?: string;
}

// ============================================================================
// MONITORING TYPES
// ============================================================================

export interface ProviderMetrics {
  providerId: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  lastUsed: number;
}

export interface RouterMetrics {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  providerMetrics: Map<string, ProviderMetrics>;
  budgetUsage: BudgetUsage;
  rateLimitHits: number;
  fallbackCount: number;
}

export interface BudgetUsage {
  dailyTokens: number;
  dailyCost: number;
  monthlyTokens: number;
  monthlyCost: number;
  dailyPercentage: number;
  monthlyPercentage: number;
}

export interface RouterStatus {
  healthy: boolean;
  availableProviders: string[];
  degradedProviders: string[];
  unavailableProviders: string[];
  currentBudget: BudgetUsage;
  activeRateLimits: string[];
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface RouterConfig {
  routing: RoutingConfig;
  monitoring: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsRetention: number; // days
  };
  providers: ProviderConfig[];
}

export interface ConfigFile {
  version: string;
  config: RouterConfig;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class RouterError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class BudgetExceededError extends RouterError {
  constructor(
    message: string,
    public budgetType: 'daily' | 'monthly',
    public currentUsage: number,
    public limit: number
  ) {
    super(message, 'BUDGET_EXCEEDED');
    this.name = 'BudgetExceededError';
  }
}

export class RateLimitError extends RouterError {
  constructor(
    message: string,
    public provider: string,
    public retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}
