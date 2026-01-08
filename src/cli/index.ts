#!/usr/bin/env node

/**
 * Cascade Router - CLI Interface
 *
 * Command-line interface for the Cascade Router
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Router } from '../core/router.js';
import { ProviderFactory } from '../providers/factory.js';
import type {
  RouterConfig,
  RoutingConfig,
  ProviderConfig,
  ChatRequest,
} from '../types.js';

// ============================================================================
// CLI PROGRAM
// ============================================================================

const program = new Command();

program
  .name('cascade-router')
  .description('Intelligent LLM routing with cost optimization')
  .version('1.0.0');

// ============================================================================
// INIT COMMAND
// ============================================================================

program
  .command('init')
  .description('Initialize a new cascade-router configuration')
  .option('-f, --force', 'Overwrite existing config')
  .action(async (options) => {
    const configPath = join(process.cwd(), 'cascade-router.config.json');

    if (existsSync(configPath) && !options.force) {
      console.log(chalk.yellow('Config file already exists. Use --force to overwrite.'));
      return;
    }

    console.log(chalk.bold.blue('\n🚀 Cascade Router Configuration\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'strategy',
        message: 'Routing strategy:',
        default: 'balanced',
        choices: ['cost', 'speed', 'quality', 'balanced', 'priority', 'fallback'],
      },
      {
        type: 'confirm',
        name: 'enableOpenAI',
        message: 'Enable OpenAI provider?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'enableAnthropic',
        message: 'Enable Anthropic provider?',
        default: false,
      },
      {
        type: 'confirm',
        name: 'enableOllama',
        message: 'Enable Ollama (local) provider?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'enableFallback',
        message: 'Enable automatic fallback on failure?',
        default: true,
      },
      {
        type: 'number',
        name: 'dailyBudget',
        message: 'Daily cost budget (USD, 0 for unlimited):',
        default: 10,
      },
    ]);

    const config: RouterConfig = createDefaultConfig(answers);

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.green(`\n✅ Configuration saved to ${configPath}`));
    console.log(chalk.gray('Edit this file to customize your routing configuration.\n'));
  });

// ============================================================================
// ROUTE COMMAND
// ============================================================================

program
  .command('route')
  .description('Route a request to the best provider')
  .argument('<prompt>', 'The prompt to route')
  .option('-c, --config <path>', 'Path to config file', 'cascade-router.config.json')
  .option('-s, --strategy <strategy>', 'Override routing strategy')
  .option('-p, --provider <provider>', 'Force specific provider')
  .option('-t, --max-tokens <number>', 'Max tokens', '500')
  .option('--temp <temperature>', 'Temperature', '0.7')
  .option('--stream', 'Stream the response', false)
  .action(async (prompt, options) => {
    const spinner = ora('Initializing router...').start();

    try {
      const config = loadConfig(options.config);
      const router = await initializeRouter(config, options);

      spinner.succeed('Router initialized');

      const requestSpinner = ora('Routing request...').start();

      const request: ChatRequest = {
        prompt,
        maxTokens: parseInt(options.maxTokens),
        temperature: parseFloat(options.temp),
        stream: options.stream,
      };

      const startTime = Date.now();

      let result;
      if (options.stream) {
        result = await router.routeStream(request, (chunk) => {
          process.stdout.write(chunk);
        });
      } else {
        result = await router.route(request);
      }

      const duration = Date.now() - startTime;

      requestSpinner.succeed(`Request routed to ${chalk.bold(result.provider)}`);

      // Display response details
      console.log(chalk.bold('\n📊 Response Details:'));
      console.log(`   Provider: ${chalk.cyan(result.provider)}`);
      console.log(`   Model: ${chalk.gray(result.response.model)}`);
      console.log(`   Tokens: ${chalk.yellow(result.response.tokens.total.toLocaleString())}`);
      console.log(`   Cost: ${chalk.green(`$${result.response.cost.toFixed(4)}`)}`);
      console.log(`   Duration: ${chalk.magenta(`${duration}ms`)}`);
      console.log(`   Strategy: ${chalk.blue(result.routingDecision.strategy)}`);

      if (result.routingDecision.fallbackTriggered) {
        console.log(chalk.yellow('   ⚠️  Fallback was triggered'));
      }

      if (!options.stream) {
        console.log(chalk.bold('\n💬 Response:'));
        console.log(chalk.white(result.response.content));
        console.log();
      }

      // Show metrics
      const metrics = router.getMetrics();
      console.log(chalk.bold('\n📈 Metrics:'));
      console.log(`   Total Requests: ${metrics.totalRequests}`);
      console.log(`   Total Cost: $${metrics.totalCost.toFixed(4)}`);
      console.log(`   Total Tokens: ${metrics.totalTokens.toLocaleString()}\n`);
    } catch (error) {
      spinner.fail('Error routing request');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// STATUS COMMAND
// ============================================================================

program
  .command('status')
  .description('Check router and provider status')
  .option('-c, --config <path>', 'Path to config file', 'cascade-router.config.json')
  .action(async (options) => {
    const spinner = ora('Loading configuration...').start();

    try {
      const config = loadConfig(options.config);
      const router = new Router(config.routing);

      // Register providers
      for (const providerConfig of config.providers) {
        try {
          const provider = ProviderFactory.createProvider(providerConfig);
          router.registerProvider(provider);
        } catch (error) {
          spinner.warn(`Failed to create provider: ${providerConfig.name}`);
        }
      }

      await router.initialize();

      spinner.succeed('Router initialized');

      const statusSpinner = ora('Checking provider status...').start();
      const status = await router.getStatus();
      statusSpinner.succeed('Status check complete');

      console.log(chalk.bold('\n🔍 Router Status:\n'));

      if (status.healthy) {
        console.log(chalk.green('✅ Router is healthy\n'));
      } else {
        console.log(chalk.red('❌ Router is unhealthy\n'));
      }

      console.log(chalk.bold('Available Providers:'));
      if (status.availableProviders.length > 0) {
        for (const provider of status.availableProviders) {
          console.log(`   ${chalk.green('✓')} ${chalk.cyan(provider)}`);
        }
      } else {
        console.log(chalk.gray('   None available'));
      }

      if (status.unavailableProviders.length > 0) {
        console.log(chalk.bold('\nUnavailable Providers:'));
        for (const provider of status.unavailableProviders) {
          console.log(`   ${chalk.red('✗')} ${chalk.gray(provider)}`);
        }
      }

      console.log(chalk.bold('\n💰 Budget Usage:'));
      console.log(`   Daily Tokens: ${status.currentBudget.dailyTokens.toLocaleString()}`);
      console.log(`   Daily Cost: $${status.currentBudget.dailyCost.toFixed(4)}`);
      console.log(`   Monthly Tokens: ${status.currentBudget.monthlyTokens.toLocaleString()}`);
      console.log(`   Monthly Cost: $${status.currentBudget.monthlyCost.toFixed(4)}\n`);
    } catch (error) {
      spinner.fail('Error checking status');
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// CONFIG COMMAND
// ============================================================================

program
  .command('config')
  .description('Manage router configuration')
  .option('-c, --config <path>', 'Path to config file', 'cascade-router.config.json')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    try {
      if (options.show) {
        const config = loadConfig(options.config);
        console.log(chalk.bold('\n⚙️  Current Configuration:\n'));
        console.log(JSON.stringify(config, null, 2));
        console.log();
      } else {
        console.log(chalk.gray('Use --show to display current configuration\n'));
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// PROVIDERS COMMAND
// ============================================================================

program
  .command('providers')
  .description('List available providers')
  .option('-c, --config <path>', 'Path to config file', 'cascade-router.config.json')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);

      console.log(chalk.bold('\n🔧 Configured Providers:\n'));

      for (const provider of config.providers) {
        const status = provider.enabled ? chalk.green('enabled') : chalk.red('disabled');
        const priority = chalk.yellow(`P${provider.priority}`);
        const cost = chalk.gray(`$${provider.costPerMillionTokens}/M tokens`);

        console.log(`${chalk.cyan(provider.name)} (${provider.type})`);
        console.log(`   Status: ${status}`);
        console.log(`   Priority: ${priority}`);
        console.log(`   Cost: ${cost}`);
        console.log(`   Model: ${chalk.gray(provider.model || 'default')}`);
        console.log();
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createDefaultConfig(answers: any): RouterConfig {
  const providers: ProviderConfig[] = [];

  if (answers.enableOpenAI) {
    providers.push({
      id: 'openai-default',
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
    });
  }

  if (answers.enableAnthropic) {
    providers.push({
      id: 'anthropic-default',
      name: 'Anthropic',
      type: 'anthropic',
      enabled: true,
      priority: 5,
      maxTokens: 200000,
      costPerMillionTokens: 0.25,
      latency: 600,
      availability: 0.99,
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-haiku-20240307',
    });
  }

  if (answers.enableOllama) {
    providers.push({
      id: 'ollama-default',
      name: 'Ollama',
      type: 'ollama',
      enabled: true,
      priority: 20,
      maxTokens: 4096,
      costPerMillionTokens: 0,
      latency: 2000,
      availability: 0.9,
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
    });
  }

  const routingConfig: RoutingConfig = {
    strategy: answers.strategy,
    providers,
    fallbackEnabled: answers.enableFallback,
    maxRetries: 3,
    timeout: 60000,
    budgetLimits: {
      dailyTokens: 0,
      dailyCost: answers.dailyBudget,
      monthlyTokens: 0,
      monthlyCost: answers.dailyBudget * 30,
      alertThreshold: 80,
    },
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
      concurrentRequests: 5,
    },
  };

  return {
    routing: routingConfig,
    monitoring: {
      enabled: true,
      logLevel: 'info',
      metricsRetention: 7,
    },
    providers,
  };
}

function loadConfig(configPath: string): RouterConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}\nRun 'cascade-router init' to create one.`);
  }

  const configData = readFileSync(configPath, 'utf-8');
  return JSON.parse(configData);
}

async function initializeRouter(
  config: RouterConfig,
  options: any
): Promise<Router> {
  const router = new Router(config.routing);

  // Override strategy if specified
  if (options.strategy) {
    (router as any).config.strategy = options.strategy;
  }

  // Register providers
  for (const providerConfig of config.providers) {
    try {
      const provider = ProviderFactory.createProvider(providerConfig);
      router.registerProvider(provider);
    } catch (error) {
      console.warn(`Failed to create provider: ${providerConfig.name}`);
    }
  }

  await router.initialize();

  return router;
}

// ============================================================================
// MAIN
// ============================================================================

program.parse();
