## [1.0.1] - 2026-06-24

### Fixed
- spy(): removed dead event-wrapping duplicate, _stopSpy now tracks all intervals
- reflex(): skip HTML elements, try/catch around spy calls
- findRoot(): try/catch for null body, fallback to #root/#app
- traverse(): try/catch callback to prevent silent abortion
- destroy(): full cleanup of spy intervals, pushState, popstate, probes, PerformanceObserver
- radar(): removed DOM element references preventing JSON serialization
- probe(): auto-stop after 60s, source() removed from hot path
- contextMap(): single-pass optimization
- hydration(): String() coercion for className comparison
- omni(): depth limit 50, skip host components
- safeClone: instanceof Element for SVG support
- mountUI: removed duplicate border CSS
- benchmark: removed unused label parameter

# Changelog

## [1.0.1] - 2026-06-15

### First Release
- 60+ diagnostic primitives for React Fiber tree inspection
- Chrome MCP integration via evaluate_script
- Infrastructure probes: queryAudit, actionTrace, errorLog, routeTiming, eventTrace
- Production guard: auto-blocks on non-localhost
- Data sanitization: SENSITIVE keys redacted, objects truncated
- benchmark(): overhead measurement for all probe methods
- agentEyes(), fullAudit(), report(), narrate() — one-call audit entry points
- Destroy/cleanup: full global state restoration
- TypeScript definitions (.d.ts)
- GitHub Actions CI: syntax check, SKILL.md validation, security checks
- Agent-optimized SKILL.md with symptom->command decision tree
- React 18+ support (Next.js, Vite, CRA)
- Zero dependencies, single JS file injection
