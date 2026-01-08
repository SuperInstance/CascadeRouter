# Contributing to Cascade Router

First off, thank you for considering contributing to Cascade Router! It's people like you that make Cascade Router such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by the Cascade Router Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [support@superinstance.github.io](mailto:support@superinstance.github.io).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find that the problem has already been reported. When you create a bug report, include as many details as possible:

**Provide a descriptive title**

**Describe the exact steps to reproduce the problem**
1. Go to '...'
2. Run '....'
3. Scroll down to '....'
4. See error

**Provide specific examples to demonstrate the steps**
- Include screenshots or code samples
- Share your router configuration
- Include error logs and stack traces

**Describe the behavior you observed and what you expected**

**Describe your environment**
- OS: [e.g. macOS 13.0]
- Node version: [e.g. 18.0.0]
- Cascade Router version: [e.g. 1.0.0]
- Providers configured: [e.g. OpenAI, Anthropic, Ollama]

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Explain why this enhancement would be useful**
- **List some examples of how this feature would be used**
- **Include mock-ups or examples if applicable**

### Pull Requests

1. **Fork the repository** and create your branch from `main`.
2. **Install dependencies**: `npm install`
3. **Make your changes** with clear, descriptive commit messages.
4. **Write or update tests** for your changes.
5. **Ensure all tests pass**: `npm test`
6. **Run linting**: `npm run lint`
7. **Build the project**: `npm run build`
8. **Update documentation** if you've changed functionality.
9. **Submit a pull request** with a clear description of the changes.

#### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/CascadeRouter.git
cd CascadeRouter

# Install dependencies
npm install

# Watch mode for development
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Run linter
npm run lint
```

#### Code Style

- Use TypeScript strict mode
- Follow existing code structure and patterns
- Write meaningful comments for complex logic
- Use descriptive variable and function names
- Keep functions small and focused
- Write tests for new features

#### Commit Messages

Follow the Conventional Commits specification:

```
feat: add support for new provider
fix: resolve issue with routing strategy
docs: update API documentation
test: add tests for provider connection
refactor: simplify routing logic
```

### Adding Features

When adding new features:

1. **Discuss in an issue first** to get feedback
2. **Break the feature into small, manageable PRs**
3. **Write tests first** (Test-Driven Development)
4. **Update documentation** (README, API docs, examples)
5. **Add examples** demonstrating the new feature

### Provider Integration

When adding support for a new LLM provider:

1. **Implement the provider interface**
   ```typescript
   interface Provider {
     name: string;
     initialize(config: ProviderConfig): Promise<void>;
     complete(prompt: string, options?: CompletionOptions): Promise<string>;
     estimateTokens(text: string): number;
     getCost(tokens: number): number;
   }
   ```

2. **Add configuration validation** using Zod schemas

3. **Write comprehensive tests** including:
   - Unit tests for provider methods
   - Integration tests with real API (use environment variables)
   - Mock tests for offline development

4. **Update documentation**:
   - Add provider to README
   - Create configuration example
   - Document any special behaviors or limitations

5. **Add example routing config** using the new provider

## Project Structure

```
cascade-router/
├── src/
│   ├── cli/              # Command-line interface
│   ├── core/             # Core routing logic
│   ├── providers/        # LLM provider implementations
│   ├── monitoring/       # Progress monitoring
│   └── types.ts          # TypeScript type definitions
├── tests/                # Test files
├── examples/             # Example router configurations
├── docs/                 # Documentation
└── dist/                 # Compiled JavaScript (generated)
```

## Testing

We use Vitest for testing. Run tests with:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- router.test.ts
```

### Writing Tests

- Write descriptive test names
- Test both success and failure cases
- Use mocks for external dependencies
- Keep tests independent and focused
- Aim for high code coverage (>80%)

## Documentation

Documentation is crucial for the project's success. When contributing:

- **README.md**: Update for new features or breaking changes
- **API.md**: Document new APIs or changes
- **Examples**: Add examples for new features
- **Comments**: Comment complex code sections
- **CHANGELOG.md**: Document changes in each version

## Release Process

Releases are managed by the maintainers:

1. Update version in package.json
2. Update CHANGELOG.md
3. Create a git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will publish to npm

## Community Guidelines

- Be respectful and inclusive
- Provide constructive feedback
- Help others when you can
- Follow the Code of Conduct
- Focus on what is best for the community

## Getting Help

- **Documentation**: Start with the README and docs/
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Email**: [support@superinstance.github.io](mailto:support@superinstance.github.io)

## Recognition

Contributors will be recognized in:
- The CONTRIBUTORS.md file
- Release notes for significant contributions
- The project's README

Thank you for contributing to Cascade Router!
