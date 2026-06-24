# Contributing

## Development

`fiber_sense.js` is a standalone browser script with zero dependencies. Edit it directly.

```bash
# Test in browser console — paste the file content
# No build step required
```

## Pull Requests

1. Ensure production guard (`window.FIBERSENSE_PRODUCTION`) is respected
2. Don't break the block-on-production detection
3. Add the new method to `version().capabilities` list
4. If adding a `read*()` method, follow the pattern: `{ total, ...data, recent }` JSON shape
5. Any global state must be added to `destroy()` for cleanup

## Add New Probe Pattern

```js
// 1. Activation method
myProbe: () => { /* init global state, return { status: 'ACTIVE' } */ },

// 2. Read results (agent calls after interaction)
readMyProbe: () => { /* return structured JSON */ },

// 3. Stop/cleanup (optional)
stopMyProbe: () => { /* restore originals */ },
```

## Security

Never log raw objects to `window.__fs*` state without sanitization. Use `sanitizeValue()` for any user data. Production guard must be checked for any method that patches globals.

## License

MIT — see LICENSE file.
