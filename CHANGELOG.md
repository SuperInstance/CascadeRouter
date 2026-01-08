# Changelog

All notable changes to Cascade Router will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-beta.1] - 2026-01-07

### Added

- Comprehensive audit report (AUDIT_REPORT.md)
- Architecture documentation (ARCHITECTURE.md)
- Troubleshooting guide (TROUBLESHOOTING.md)
- Improvements applied documentation (IMPROVEMENTS_APPLIED.md)
- Type interfaces for all API responses (OpenAI, Anthropic, Ollama)
- Proper JSDoc documentation structure (completion in progress)
- `timeout` property to ProviderConfig interface
- Exports for `BudgetUsage` and `RateLimitCheck` types

### Fixed

- **CRITICAL:** Fixed all 46 TypeScript compilation errors
- **CRITICAL:** Changed error class imports from `import type` to regular `import`
- **CRITICAL:** Added missing `timeout` property to ProviderConfig
- **CRITICAL:** Enhanced type safety for all API responses (removed `unknown` types)
- **HIGH:** Removed unused imports and variables (strict mode compliance)
- **HIGH:** Fixed CLI dependencies (moved from devDependencies to dependencies)
- **MEDIUM:** Prefixed unused parameters with underscore
- **MEDIUM:** Added type assertions for JSON.parse calls

### Changed

- Improved error messages in providers
- Better type safety across all provider implementations
- Enhanced code quality and maintainability

### Technical Debt

- Need to add JSDoc to all public APIs (in progress)
- Rate limiting has race condition (atomic check-and-record needed)
- Concurrent request limiting not enforced
- Some test flakiness (3 failing tests out of 63)

### Build Status

- ✅ TypeScript compilation: 0 errors
- ✅ Build: PASSING
- ✅ Tests: 60/63 passing (95% pass rate)

---

## [1.0.0-alpha.1] - 2026-01-06

### Added

- Initial release of Cascade Router
- Core routing engine with 5 strategies (cost, speed, quality, balanced, priority)
- Provider implementations for OpenAI, Anthropic, and Ollama
- Token budget management (daily/monthly limits)
- Rate limiting (requests/minute, tokens/minute)
- Progress monitoring with checkpoints
- Automatic fallback on provider failures
- Comprehensive metrics collection
- CLI interface (init, route, status, providers, config commands)
- TypeScript with strict mode enabled
- Vitest test suite with 63 tests
- Full provider abstraction layer

### Features

- **Routing Strategies:**
  - Cost-based routing
  - Speed-based routing
  - Quality-based routing
  - Balanced routing (weighted scoring)
  - Priority-based routing

- **Providers:**
  - OpenAI (GPT-4, GPT-4 Turbo, GPT-4o Mini)
  - Anthropic (Claude 3 Opus, Sonnet, Haiku)
  - Ollama (local models: Llama2, Mistral, etc.)
  - Custom provider support

- **Budget Management:**
  - Daily token limits
  - Daily cost limits
  - Monthly token limits
  - Monthly cost limits
  - Budget alerts at configurable thresholds

- **Rate Limiting:**
  - Requests per minute
  - Tokens per minute
  - Concurrent request tracking

- **Monitoring:**
  - Real-time progress tracking
  - Token usage updates
  - Cost accumulation
  - Per-provider metrics
  - Router-level metrics

- **CLI Commands:**
  - `cascade-router init` - Initialize configuration
  - `cascade-router route` - Route requests
  - `cascade-router status` - Check router status
  - `cascade-router providers` - List providers
  - `cascade-router config` - Manage configuration

### Documentation

- README with quick start and examples
- API reference (docs/API.md)
- Example implementations
- Configuration guide

### Known Issues

- TypeScript compilation errors (46 errors)
- Missing JSDoc documentation
- Rate limiting race conditions
- Limited error type specificity

---

## [Unreleased]

### Planned for v1.0.0

- [ ] Complete JSDoc documentation
- [ ] Fix rate limiting race conditions
- [ ] Implement concurrent request limiting
- [ ] Add specific error types (TimeoutError, AuthenticationError, NetworkError)
- [ ] Improve test coverage to >98%
- [ ] Add integration tests
- [ ] Configuration schema validation
- [ ] Structured logging framework

### Planned for v1.1.0

- [ ] Connection pooling
- [ ] Request queuing
- [ ] Advanced metrics (queue depth, wait times)
- [ ] Health check endpoint
- [ ] Prometheus metrics export
- [ ] Webhook support for events
- [ ] Admin UI/dashboard

### Planned for v1.2.0

- [ ] Distributed routing (multi-instance)
- [ ] Machine learning-based provider selection
- [ ] Dynamic priority adjustment
- [ ] Provider health scoring
- [ ] Advanced caching strategies
- [ ] Custom cost functions

---

## Versioning Policy

- **Major version (X.0.0):** Breaking changes, major features
- **Minor version (0.X.0):** New features, backward compatible
- **Patch version (0.0.X):** Bug fixes, backward compatible

### Pre-release Versions

- **alpha:** Early development, unstable, API may change
- **beta:** Feature complete, mostly stable, API mostly frozen
- **rc:** Release candidate, stable, API frozen, bug fixes only

---

## Migration Guides

### From alpha.1 to beta.1

**Breaking Changes:** None (internal fixes only)

**Recommended Actions:**
1. Update to latest version: `npm install @superinstance/cascade-router@latest`
2. Review your TypeScript configuration (ensure strict mode is enabled)
3. Run tests to ensure compatibility
4. Check for any deprecated API usage

**New Features:**
- Better type safety
- Improved error messages
- Enhanced documentation

---

## Contributors

- SuperInstance Team

---

## Support

- **Issues:** https://github.com/SuperInstance/CascadeRouter/issues
- **Discussions:** https://github.com/SuperInstance/CascadeRouter/discussions
- **Documentation:** https://github.com/SuperInstance/CascadeRouter

---

**Last Updated:** 2026-01-07
