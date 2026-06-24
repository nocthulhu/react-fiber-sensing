# Changelog

## [1.0.0] - 2026-06-15

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
