---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

## Describe the Bug

A clear description of what the bug is.

## Environment

- **hitlimit version**:
- **Runtime**: Node.js X.X.X / Bun X.X.X
- **Framework**: Express / NestJS / Elysia / None
- **Store**: Memory / SQLite / Redis
- **OS**:

## To Reproduce

Steps to reproduce the behavior:

1. Configure hitlimit with '...'
2. Send request to '...'
3. See error

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened.

## Code Example

```javascript
// Minimal reproduction code
import { hitlimit } from 'hitlimit'

app.use(hitlimit({
  // your config
}))
```

## Error Output

```
Paste any error messages here
```

## Additional Context

Any other context about the problem.
