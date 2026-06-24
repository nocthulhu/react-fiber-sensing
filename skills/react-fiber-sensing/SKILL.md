---
name: react-fiber-sensing
description: Use when debugging a running React app — performance issues, render storms, stale state, hydration errors, unexpected re-renders, slow interactions, wrong data, console errors, memory leaks, or any "something is wrong" symptom. Use when the user wants to inspect component state, trace data flow, profile render costs, or understand what a page is doing at runtime. Requires Chrome DevTools MCP.
---

# React Fiber Sensing

Injects `fiber_sense.js` into the browser to read React Fiber tree directly.

**First decision:**
- User described a specific symptom? → `diagnose("symptom")` and follow its output
- User said "check this page" / "something is wrong" / no specific symptom? → `agentEyes("")` for a full autonomous sweep
- User wants to understand/inspect (not debug)? → see Workflow Patterns below

## Quick Start (5 steps)

1. Start app: `npm run dev`
2. Open page with Chrome MCP: `navigate_page` → target URL
3. Inject: `evaluate_script` with `() => { const s=document.createElement('script'); s.src='/fiber_sense.js'; document.head.appendChild(s); return new Promise(r=>{s.onload=r;s.onerror=()=>{throw new Error('load failed')}}); }`
4. Verify: `evaluate_script` with `() => FiberSense.version()`
5. Decide: follow the first-decision logic above, then execute

## Workflow Patterns

Don't fire isolated commands. Match the situation to a pattern:

### Observation — "I need to see what's happening"
Something changes: event, state update, network call, console error.
```
eventTrace(comp, ms) | actionTrace() | errorLog() | network()
→ interact (use trigger() for simple clicks, ask user for complex flows)
→ .read() → analyze timing, frequency, origin
```
### Blind sweep — "I don't know what's wrong"
```
agentEyes("") or fullAudit("")
→ read verdict + severity counts
→ for CRITICAL/HIGH: rerenderReason() + propDiff()
→ source() for file:line before reporting
```
### State inspection — "Data looks wrong"
```
queryAudit() → storeRead() → zombieScan() → contextMap()
→ stale? invalidateQuery("key")
→ wrong? source("Comp") → open file
```
### Performance — "This feels slow"
```
benchmark() → scan() + heatmap()
→ rerenderReason("Comp") + propDiff("Comp") + renderCascade()
→ effects: effectAudit() + layoutEffectAudit()
→ live measurement: velocityWatch("Comp", 5000) → user interacts
```
### Route transitions — "Navigation is slow/broken"
```
routeTiming() → navigate → readRouteTiming()
→ slow? waterfall() for network, heatmap() for render
```
### Before/after — "Did the fix work?"
```
memorize("before") → apply fix → reload + re-inject → memorize("after")
→ compareMemory("before", "after")
```
### Always end with: `destroy()`

## Symptom → Command Map

| Symptom | First move |
|---------|-----------|
| "input lag" / "typing slow" | `diagnose("input lag")` → `velocityWatch(null, 5000)` |
| "blank screen" / "nothing loads" | `suspenseMap()` + `errorBoundaryMap()` |
| "gets slower" / "memory leak" | `leaks()` + `effectAudit()` |
| "layout shift" / "flicker" | `layoutEffectAudit()` + `suspenseMap()` |
| "stale data" / "old fetch" | `queryAudit()` → `network()` → `waterfall()` |
| "re-renders too much" | `rerenderReason("Comp")` + `propDiff("Comp")` |
| "hydration error" | `rscMap()` + `errorBoundaryMap()` + `errorLog()` |
| "XSS" / "security" | `xssAudit()` |
| "route problem" | `routeTiming()` → navigate → `readRouteTiming()` |
| Unknown | `agentEyes("")` or `narrate()` |

## Full Command Reference

| What you want | Commands |
|---------------|----------|
| **Audit everything** | `agentEyes("")`, `fullAudit("")`, `report()`, `narrate()`, `benchmark()` |
| **Find what's slow** | `scan()`, `heatmap()`, `renderCascade()`, `architect()`, `velocityWatch("Comp", ms)` |
| **Understand state** | `dump()`, `storeRead()`, `zombieScan()`, `sandbox("Comp")`, `interface("Comp")`, `memorize("label")`, `compareMemory("a","b")` |
| **Trace effects/hooks** | `effectAudit()`, `layoutEffectAudit()`, `memoScan()`, `staleClosures()` |
| **Map architecture** | `contextMap()`, `routeMap()`, `rscMap()`, `errorBoundaryMap()`, `suspenseMap()`, `laneMap()` |
| **Debug re-renders** | `rerenderReason("Comp")`, `propDiff("Comp")`, `source("Comp")`, `debugOwner("Comp")`, `track("Comp")` |
| **Security & a11y** | `xssAudit()`, `a11y()`, `tokenAudit()`, `leaks()` |
| **Network & data** | `network()`, `waterfall()`, `queryAudit()`, `invalidateQuery("key")` |
| **Live monitoring** | `eventTrace("Comp", ms)`, `errorLog()`, `actionTrace()`, `routeTiming()` (+ `.read*()`) |
| **Time-travel** | `record("Comp","event")`, `rewind(steps)`, `replay()`, `chronosDump()`, `snap()`, `diff()` |
| **Interactive** | `probe(on/off)`, `spy("Comp","prop",ms)`, `discoverIntent("word")`, `mountUI()`, `unmountUI()` |
| **Manipulation** ⚠ | `trigger("Comp","event")`, `inject("Comp",idx,val)`, `spoof("Provider",val)`, `mutate("Comp",props)` — React dev mode warns |
| **Cleanup** | `destroy()`, `stopOmniWatch()`, `stopPulse()`, `stopErrorLog()`, `heal()` |

## Error Handling

| Problem | Action |
|---------|--------|
| `FiberSense is not defined` | Script not injected — repeat step 3 |
| `source() returns Unknown` | Production/minified build — mark `where: "source unavailable (production build)"` |
| `actualDuration is 0` | No React Profiler build — use `velocityWatch()` + `effectAudit()` |
| Script load fails (CORS) | Read `scripts/fiber_sense.js` from skill directory, inject inline via `evaluate_script` |
| `waterfall()` returns error | Run `network()` or `startOmniWatch()` first |
| `queryAudit()` returns error | @tanstack/react-query not installed or QueryClientProvider not mounted |
| `sandbox()` returns error | DOM circular JSON — use `interface()` instead |
| React dev mode warnings | `inject()`, `mutate()`, `spoof()`, `reflex()` modify Fiber directly. Normal. |

## Common Mistakes

- **Skipping `diagnose()`** — it prints the exact commands. Don't guess.
- **Filing finding without `source()`** — no file:line = don't report it.
- **Calling `.read*()` before the probe** — start the probe first, interact, then read.
- **Not cleaning up** — `destroy()` at session end. Every time.
- **Reporting framework components** — `LayoutRouter`, `Context.Provider` are React internals. Filter them.

## Integration

Save findings wherever appropriate:
- agentmemory: `agentmemory_memory_save`
- File: `docs/fiber-audit.md`
- PR comment: paste as collapsible markdown
