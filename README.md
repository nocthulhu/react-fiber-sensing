# React Fiber Sensing

AI-powered React Fiber diagnostics skill for coding agents with Chrome DevTools MCP.

Inject `fiber_sense.js` into any React 18+ app and get:
- **55+ diagnostic commands** — render storms, stale state, hydration errors, effect leaks
- **JSON output** — agent-readable findings with severity, component, file:line
- **Infrastructure probes** — React Query cache, Zustand/Redux dispatch trace, route timing
- **Zero dependencies** — single JS file, no npm install needed

## Install

```bash
npx skills add nocthulhu/react-fiber-sensing -y -g
```

Or copy `skills/react-fiber-sensing/` into `.opencode/skills/`, `.claude/skills/`, or `.agents/skills/`.

## Usage

Requires [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) configured in your agent.

```
load react-fiber-sensing skill and audit localhost:3000 for performance issues
```

The agent will:
1. Start your app (`npm run dev`)
2. Open the page with Chrome MCP
3. Inject `fiber_sense.js` via `evaluate_script`
4. Run `FiberSense.agentEyes("your symptom")`
5. Report structured findings with file:line references

## Key Commands

| Command | Use When |
|---------|----------|
| `agentEyes("symptom")` | Any audit start — full anomaly sweep |
| `diagnose("input lag")` | Symptom → exact command sequence |
| `eventTrace("Comp", 5000)` | Track component events + duration |
| `queryAudit()` | Inspect React Query cache |
| `actionTrace()` | Intercept Zustand/Redux dispatches |
| `errorLog()` | Aggregate + deduplicate console errors |
| `routeTiming()` | Track Next.js route transitions |
| `rerenderReason("Comp")` | Why did this component re-render? |
| `destroy()` | Clean up all watchers + restore globals |

## Why Not React DevTools?

React DevTools is built for humans. Fiber Sensing is built for AI agents:
- **JSON output** — agents parse structured data, not UI panels
- **Automated triage** — `diagnose()` maps symptoms to exact commands
- **Remote access** — Chrome MCP reads Fiber tree without manual interaction
- **Batch analysis** — `scan()`, `report()`, `narrate()` give full-system snapshots

## Requirements

- React 18+ (Next.js, Vite, CRA)
- Chrome DevTools MCP server configured in your coding agent
- No npm install, no build step — just inject and run

## License

MIT
