# Security Policy

## Production Guard

FiberSense automatically blocks execution in production environments (non-localhost domains). This prevents accidental exposure of React internals. To explicitly enable in production:

```js
window.FIBERSENSE_PRODUCTION = 'allow';
// then inject fiber_sense.js
```

## Data Sanitization

- All logged values are truncated (300 chars for error messages, 120 chars for individual values)
- Sensitive keys (`password`, `token`, `secret`, `credential`, `apikey`) are redacted to `[REDACTED]`
- Objects are never logged in full — only first 8 keys, nested objects show as `[Object]`
- Console interceptor passes through to original `console.error`/`console.warn` — no data is held

## Global State Cleanup

- `destroy()` restores all patched globals: `fetch`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `XMLHttpRequest`
- `beforeunload` event listener auto-calls `destroy()`
- All `window.__fs*` variables are enumerated and deleted on destroy

## Reporting a Vulnerability

Open an issue at https://github.com/nocthulhu/react-fiber-sensing/issues

Do NOT include sensitive application data in bug reports. Provide the `FiberSense.version()` output and a sanitized stack trace.
