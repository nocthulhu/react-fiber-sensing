---
name: react-fiber-sensing
description: Use when debugging React performance issues, render storms, stale state, hydration errors, or unexplained re-renders in a running app. Requires Chrome DevTools MCP.
---

# React Fiber Sensing

Injects `fiber_sense.js` into the browser to read React Fiber tree directly. Replaces manual console.log debugging with automated diagnostics. Works with any React 18+ app using Next.js, Vite, or CRA.

## Quick Start (5 steps)

1. Start app: `npm run dev`
2. Open page with Chrome MCP: `navigate_page` → target URL
3. Inject: `evaluate_script` with `() => { const s=document.createElement('script'); s.src='/fiber_sense.js'; document.head.appendChild(s); return new Promise(r=>{s.onload=r;s.onerror=()=>{throw new Error('load failed')}}); }`
4. Verify: `evaluate_script` with `() => FiberSense.version()`
5. Run: `evaluate_script` with `() => FiberSense.agentEyes("symptom description")`

## Always Start Here

1. `diagnose("symptom")` — prints exact commands to run. **Never skip.**
2. Run the commands it tells you, in order.

## Symptom → Command Map

| User says | First command |
|-----------|--------------|
| "input lag" / "typing slow" | `agentEyes("input lag")` then `velocityWatch(null, 5000)` |
| "blank screen" / "nothing loads" | `suspenseMap()` + `errorBoundaryMap()` |
| "gets slower" / "memory leak" | `leaks()` + `effectAudit()` — filter: hasCleanup=false |
| "layout shift" / "flicker" | `layoutEffectAudit()` + `suspenseMap()` |
| "stale data" / "old fetch" | `queryAudit()` → stale queries? → `invalidateQuery("key")` + `network()` → `waterfall()` |
| "re-renders too much" | `rerenderReason("Comp")` + `propDiff("Comp")` |
| "hydration error" | `rscMap()` + `errorBoundaryMap()` + `errorLog().readErrorLog()` |
| "XSS" / "security" | `xssAudit()` |
| "trace what happened" | `eventTrace("Comp", 5000)` → interact → `readEventTrace()` |
| "where are my errors" | `errorLog()` → interact → `readErrorLog()` |
| "what's dispatching" | `actionTrace()` → interact → `readActionTrace()` |
| "route performance" | `routeTiming()` → navigate → `readRouteTiming()` |
| Unknown symptom | `narrate()` — paste output into chat |

## Core Commands

### React Diagnostics

| Command | When | Returns |
|---------|------|---------|
| `agentEyes("symptom")` | Any audit start | Full anomaly sweep |
| `diagnose("input lag")` | Symptom → investigation plan | Command sequence to run |
| `rerenderReason("Comp")` | Component re-renders unexpectedly | PROPS_CHANGED / STATE_CHANGED / CONTEXT / PARENT |
| `propDiff("Comp")` | Which prop triggered render | Diff of pending vs memoized props |
| `source("Comp")` | Mandatory before filing finding | file.tsx:lineNumber |
| `scan()` | System-wide health check | Heatmap + verdict |
| `effectAudit()` | Find runaway effects | All useEffect + dep arrays |
| `zombieScan()` | Find unused useState | Dead state hooks |
| `memorize("label")` | Before/after fix proof | Saved snapshot |
| `compareMemory("a","b")` | Prove fix worked | Delta of findings |

### Infrastructure Probes (Infrastructure)

| Command | When | Returns |
|---------|------|---------|
| `eventTrace("Comp", ms)` | Track which events fire + duration | Component event timeline |
| `errorLog()` | Aggregate console errors | Deduped by message, sorted by count |
| `queryAudit()` | Inspect React Query cache | Stale/fresh/fetching/error counts per query |
| `invalidateQuery("key")` | Force refetch stale queries | Number invalidated |
| `routeTiming()` | Track Next.js route transitions | Start→Complete timing per route |
| `actionTrace()` | Intercept Zustand/Redux dispatch | Which component dispatched what |
| `destroy()` | End of session cleanup | Stops all watchers, restores globals |

Each probe has a corresponding `.read*()` method for results and `.stop*()` where applicable.

## Error Handling

| Problem | Action |
|---------|--------|
| `FiberSense is not defined` | Script not injected — repeat step 3 |
| `source() returns Unknown` | Production/minified build — mark `where: "source unavailable (production build)"` |
| `actualDuration is 0` | No React Profiler build — use `velocityWatch()` + `effectAudit()` |
| Script load fails (CORS) | Read `scripts/fiber_sense.js` from skill directory, inject inline via `evaluate_script` |
| `waterfall()` returns error | Run `network()` or `startOmniWatch()` first |
| `queryAudit()` returns error | @tanstack/react-query not installed or QueryClientProvider not mounted |
| `storeRead()` returns empty | Store created outside React — normal for Zustand |

## Common Mistakes

- **Skipping `diagnose()`** — don't guess. Let the engine triage first.
- **Filing finding without `source()`** — no file:line = no finding.
- **Calling `waterfall()` before `network()`** — waterfall reads the log, network creates it.
- **Not cleaning up** — always call `destroy()` at session end.
- **Reporting framework components** — Next.js LayoutRouter, Context.Provider are noise.
- **Forgetting to interact** — probes like `eventTrace`, `actionTrace`, `network` only collect data when you interact with the page.

## Integration

Save findings in your preferred format:
- agentmemory: `agentmemory_memory_save { content, concepts, type: "bug" }`
- File: append to `docs/fiber-audit.md` or `Fiber_Memory.md`
- PR comment: paste as collapsible markdown
