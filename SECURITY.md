# Security Policy

## Supported Versions

Currently, only the latest version of Cascade Router is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: Yes |

## Reporting a Vulnerability

If you discover a security vulnerability in Cascade Router, please report it to us responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please send an email to [security@superinstance.github.io](mailto:security@superinstance.github.io) with:

* A description of the vulnerability
* Steps to reproduce the issue
* Any potential impact you've identified
* If possible, a suggested fix or mitigation

### What to Expect

Once you've submitted a vulnerability report:

1. **Acknowledgment**: We will respond within 48 hours to acknowledge receipt
2. **Investigation**: We will investigate the issue and determine severity
3. **Resolution**: We will work on a fix and aim to release a patch within 7 days for critical issues
4. **Disclosure**: We will coordinate public disclosure with you

### Security Best Practices for Users

#### API Keys and Credentials

- **Never commit API keys** to version control
- Use environment variables for sensitive configuration
- Rotate API keys regularly
- Use `.env` files (which are gitignored) for local development
- Consider using secret management tools for production deployments

#### Environment Variables

Cascade Router expects the following environment variables:

```bash
# Anthropic API Key
ANTHROPIC_API_KEY=your_key_here

# OpenAI API Key
OPENAI_API_KEY=your_key_here

# Ollama (if using local models)
OLLAMA_BASE_URL=http://localhost:11434

# Optional: Custom API endpoints
ANTHROPIC_API_BASE=https://api.anthropic.com
OPENAI_API_BASE=https://api.openai.com
```

#### Configuration Security

- Ensure appropriate file permissions for router configuration files
- Be cautious when loading configurations from untrusted sources
- Validate configurations before applying them
- Review routing rules for security implications

#### Dependency Management

- Regularly update dependencies: `npm update`
- Audit dependencies for vulnerabilities: `npm audit`
- Review security advisories for dependencies
- Keep Node.js updated to the latest stable version

#### Input Validation

- Validate and sanitize all inputs before processing
- Be cautious with router configurations from untrusted sources
- Review provider configurations for security implications
- Implement rate limiting to prevent abuse

## Security Features

### Current Security Measures

- **Input Validation**: All configuration inputs are validated using Zod schemas
- **Environment Variable Protection**: Sensitive data is never logged
- **Dependency Auditing**: Regular security audits of dependencies
- **Type Safety**: TypeScript strict mode catches many potential issues at compile time
- **Provider Security**: Secure communication with LLM providers via HTTPS

### Known Limitations

- **LLM Provider Security**: Cascade Router relies on the security practices of configured LLM providers
- **Configuration Access**: Router requires read access to configuration files
- **Network Access**: Cascade Router requires network access to communicate with LLM providers
- **Token Estimation**: Token counting is approximate and may vary by provider

## Security Audits

This project has not yet undergone a formal security audit. We welcome contributions from security researchers and encourage responsible disclosure of any vulnerabilities found.

## Dependency Security

We actively monitor our dependencies for security vulnerabilities:

- Automated dependency updates via Dependabot
- Regular `npm audit` checks
- Immediate action on high-severity vulnerabilities
- Minimal dependency footprint to reduce attack surface

## Contact Information

For security-related inquiries:

* **Security Vulnerabilities**: [security@superinstance.github.io](mailto:security@superinstance.github.io)
* **General Inquiries**: [support@superinstance.github.io](mailto:support@superinstance.github.io)

## Response Time Commitments

* **Critical Vulnerabilities**: 48 hours initial response, 7 days for fix
* **High Severity**: 72 hours initial response, 14 days for fix
* **Medium Severity**: 1 week initial response, 30 days for fix
* **Low Severity**: 2 weeks initial response, next release for fix

Thank you for helping keep Cascade Router and its users safe!
