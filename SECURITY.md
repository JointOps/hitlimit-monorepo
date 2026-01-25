# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

**DO NOT** open a public GitHub issue for security vulnerabilities.

### How to Report

1. **Email**: Send details to [security@hitlimit.dev](mailto:security@hitlimit.dev)
2. **Subject**: Include "SECURITY" in the subject line
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release

### After Reporting

- We'll work with you to understand and validate the issue
- We'll develop and test a fix
- We'll release the fix and publicly disclose the vulnerability
- We'll credit you in the release notes (unless you prefer to remain anonymous)

## Security Best Practices

When using hitlimit:

1. **Use Redis in production** for distributed deployments
2. **Set appropriate limits** - too high defeats the purpose, too low affects users
3. **Monitor rate limit hits** - unusual patterns may indicate attacks
4. **Use HTTPS** - IP-based limiting relies on accurate client IPs
5. **Configure trusted proxies** - if behind a load balancer

Thank you for helping keep hitlimit secure!
