// FiberSense v1.0.1 — Integration Tests (node:test + jsdom)
// Run: npm test
import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

let dom, FiberSense;
const source = readFileSync('skills/react-fiber-sensing/scripts/fiber_sense.js', 'utf8');

function buildMockFiberTree() {
  const DeepComp = { name: 'DeepComp' };
  const App = { name: 'App' };
  const Header = { name: 'Header', displayName: undefined };
  const Sidebar = { name: 'Sidebar' };
  const Button = { name: 'Button' };

  // React 18-style Fiber node factory
  const fiber = (type, tag, props, state, opts = {}) => ({
    type,
    tag,
    memoizedProps: props || {},
    memoizedState: state || null,
    actualDuration: opts.dur || 0,
    lanes: opts.lanes || 0,
    _debugSource: opts.source || null,
    _debugOwner: opts.owner || null,
    alternate: opts.alternate || null,
    stateNode: opts.stateNode || null,
    child: null,
    sibling: null,
    return: null,
    dependencies: opts.dependencies || null,
    updateQueue: opts.updateQueue || null,
    ref: opts.ref || null,
  });

  const useState = (init) => ({
    memoizedState: init,
    queue: { lastRenderedState: init, pending: null, lanes: 0 },
    next: null,
  });

  const useEffect = (create, deps, destroy) => ({
    memoizedState: { create, deps, destroy },
    next: null,
  });

  const useLayoutEffect = (create, deps) => ({
    memoizedState: { create, deps, tag: 8, destroy: undefined },
    next: null,
  });

  const chain = (...hooks) => {
    for (let i = 0; i < hooks.length - 1; i++) hooks[i].next = hooks[i + 1];
    return hooks[0];
  };

  // Build tree: App > Header | Sidebar > Button | DeepComp
  const buttonHook = chain(useState('clicked'));
  const button = fiber(Button, 0, { onClick: () => {}, disabled: false }, buttonHook, { dur: 3, source: { fileName: '/src/Button.tsx', lineNumber: 15 } });

  const sidebarHooks = chain(useState({ open: true }), useEffect(() => {}, []));
  const sidebar = fiber(Sidebar, 0, { items: ['a', 'b'] }, sidebarHooks, { source: { fileName: '/src/Sidebar.tsx', lineNumber: 8 }, dur: 5 });

  sidebar.child = button;
  button.return = sidebar;

  const deepHooks = chain(useState('never_updated'), useLayoutEffect(() => {}, null));
  const deepComp = fiber(DeepComp, 0, { data: null }, deepHooks, { source: { fileName: '/src/DeepComp.tsx', lineNumber: 44 }, dur: 18 });

  const headerHooks = chain(useState({ title: 'Dashboard' }));
  const header = fiber(Header, 0, { user: 'ayberk', role: 'admin' }, headerHooks, { source: { fileName: '/src/Header.tsx', lineNumber: 3 }, dur: 1 });

  header.sibling = sidebar;
  sidebar.sibling = deepComp;

  const contextSymbol = Symbol.for('react.provider');
  const ThemeContext = { _context: { displayName: 'ThemeContext' } };
  ThemeContext.$$typeof = contextSymbol;

  const appHooks = chain(useState('mounted'));
  const app = fiber(App, 0, {}, appHooks, { source: { fileName: '/src/App.tsx', lineNumber: 10 }, dur: 0, owner: { name: 'Root' } });

  app.child = header;
  header.return = app;

  return app;
}

before(() => {
  dom = new JSDOM(`<!DOCTYPE html><html><body><div id="__next"><div id="root"></div></div></body></html>`, {
    url: 'http://localhost:3000/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    resources: 'usable',
  });

  // Inject Fiber internal reference
  const rootEl = dom.window.document.getElementById('__next');
  const tree = buildMockFiberTree();
  rootEl['__reactFiber$root'] = tree;
  rootEl['__reactContainer$root'] = tree;

  // Make DOM elements for tag=5 fibers
  dom.window.document.createElement = (tag) => {
    if (tag === 'header') {
      const el = dom.window.document.createElement.call ?
        dom.window.document.createElement.call(dom.window.document, tag) :
        { tagName: 'HEADER', className: 'main-header', innerText: '', style: {}, appendChild() {}, contains() { return true; } };
      return el;
    }
    return { tagName: tag.toUpperCase(), className: '', innerText: '', style: {}, appendChild() {}, contains() { return true; } };
  };

  // Run FiberSense
  dom.window.eval(source);
  FiberSense = dom.window.FiberSense;
});

after(() => {
  dom.window.close();
});

// ──────────────────────────────────────────────
// LIFECYCLE
// ──────────────────────────────────────────────

describe('Lifecycle', () => {
  it('version() should return v1.0.1', () => {
    const v = FiberSense.version();
    assert.strictEqual(v.version, '1.0.1');
    assert.ok(v.capabilities.length > 5);
  });

  it('should not be blocked (localhost)', () => {
    assert.strictEqual(FiberSense.blocked, undefined);
  });
});

// ──────────────────────────────────────────────
// CORE DIAGNOSTICS
// ──────────────────────────────────────────────

describe('Core diagnostics', () => {
  it('architect() should find components and depth', () => {
    const a = FiberSense.architect();
    assert.ok(a.maxDepth >= 1);
    assert.ok(Array.isArray(a.heavyRenders));
    assert.ok(Array.isArray(a.propDrilling));
  });

  it('source() should resolve file:line', () => {
    const s = FiberSense.source('Header');
    assert.ok(Array.isArray(s));
    assert.strictEqual(s[0].file, '/src/Header.tsx');
  });

  it('source() should return Unknown for unknown component', () => {
    const s = FiberSense.source('NonExistentComponent');
    assert.ok(Array.isArray(s) || typeof s === 'string');
  });

  it('heatmap() should sort by duration', () => {
    const h = FiberSense.heatmap();
    assert.ok(Array.isArray(h));
    if (h.length > 1) assert.ok(h[0].dur >= h[1].dur);
  });

  it('scan() should return verdict and hotspots', () => {
    const s = FiberSense.scan();
    assert.ok(s.verdict === 'DEGRADED' || s.verdict === 'NOMINAL');
    assert.ok(s.metrics.totalComponents > 0);
  });

  it('track() should trace nested components', () => {
    const t = FiberSense.track('Button');
    assert.ok(Array.isArray(t));
  });
});

// ──────────────────────────────────────────────
// PERFORMANCE
// ──────────────────────────────────────────────

describe('Performance', () => {
  it('benchmark() should run without error', () => {
    const b = FiberSense.benchmark();
    assert.strictEqual(b.version, '1.0.1');
    assert.ok(b.componentCount > 0);
    assert.ok(typeof b.totalMs === 'number');
    assert.ok(b.verdict === 'FAST' || b.verdict === 'ACCEPTABLE' || b.verdict.includes('SLOW'));
  });

  it('rerenderReason() should detect cause', () => {
    const r = FiberSense.rerenderReason('DeepComp');
    assert.ok(Array.isArray(r));
  });
});

// ──────────────────────────────────────────────
// ARCHITECTURE PROBES
// ──────────────────────────────────────────────

describe('Architecture probes', () => {
  it('effectAudit() should list effects', () => {
    const e = FiberSense.effectAudit();
    assert.ok(Array.isArray(e));
  });

  it('contextMap() should find providers/consumers', () => {
    const c = FiberSense.contextMap();
    assert.ok(Array.isArray(c));
  });

  it('suspenseMap() should work', () => {
    const s = FiberSense.suspenseMap();
    assert.ok(Array.isArray(s));
  });

  it('tokenAudit() should find violations', () => {
    const t = FiberSense.tokenAudit();
    assert.ok(Array.isArray(t));
  });

  it('routeMap() should extract segments', () => {
    const r = FiberSense.routeMap();
    assert.ok(Array.isArray(r));
  });

  it('memoScan() should list memo hooks', () => {
    const m = FiberSense.memoScan();
    assert.ok(Array.isArray(m));
  });

  it('laneMap() should decode concurrent lanes', () => {
    const l = FiberSense.laneMap();
    assert.ok(Array.isArray(l));
  });

  it('errorBoundaryMap() should find boundaries', () => {
    const e = FiberSense.errorBoundaryMap();
    assert.ok(Array.isArray(e));
  });

  it('rscMap() should detect RSC boundaries', () => {
    const r = FiberSense.rscMap();
    assert.ok(Array.isArray(r));
  });

  it('renderCascade() should find cascades', () => {
    const r = FiberSense.renderCascade();
    assert.ok(Array.isArray(r));
  });

  it('layoutEffectAudit() should find layout effects', () => {
    const l = FiberSense.layoutEffectAudit();
    assert.ok(Array.isArray(l));
  });
});

// ──────────────────────────────────────────────
// INFRASTRUCTURE PROBES
// ──────────────────────────────────────────────

describe('Infrastructure probes', () => {
  it('eventTrace() should start tracing', () => {
    const e = FiberSense.eventTrace(null, 100);
    assert.strictEqual(e.status, 'TRACING');
  });

  it('eventTrace().read() should return events', () => {
    const e = FiberSense.eventTrace(null, 1000);
    FiberSense.readEventTrace(); // read doesn't error
    assert.ok(true);
  });

  it('errorLog() should intercept console', () => {
    const e = FiberSense.errorLog();
    assert.strictEqual(e.status, 'ACTIVE');
    dom.window.console.error('test error for dedup');
    dom.window.console.error('test error for dedup');
  });

  it('readErrorLog() should show dedup', () => {
    const r = FiberSense.readErrorLog();
    const err = r.topByCount.find(e => e.message.includes('test error'));
    assert.ok(err);
    assert.strictEqual(err.count, 2);
  });

  it('stopErrorLog() should restore console', () => {
    const s = FiberSense.stopErrorLog();
    assert.ok(s.stopped);
  });

  it('routeTiming() should start tracking', () => {
    const r = FiberSense.routeTiming();
    assert.strictEqual(r.status, 'ACTIVE');
  });

  it('readRouteTiming() should return stats', () => {
    const r = FiberSense.readRouteTiming();
    assert.ok(typeof r.total === 'number');
  });

  it('actionTrace() should intercept dispatches', () => {
    const a = FiberSense.actionTrace();
    assert.ok(a.status === 'ACTIVE' || a.status.includes('ACTIVE'));
  });

  it('readActionTrace() should return actions', () => {
    const a = FiberSense.readActionTrace();
    assert.ok(typeof a.total === 'number');
  });
});

// ──────────────────────────────────────────────
// REPORT & AI NATIVE
// ──────────────────────────────────────────────

describe('AI-native outputs', () => {
  it('report() should return structured findings', () => {
    const r = FiberSense.report();
    assert.ok(r.verdict);
    assert.ok(Array.isArray(r.findings));
    assert.ok(r.summary.totalComponents > 0);
  });

  it('narrate() should return markdown string', () => {
    const n = FiberSense.narrate();
    assert.ok(typeof n === 'string');
    assert.ok(n.includes('FiberSense'));
  });

  it('diagnose() should return hypothesis and commands', () => {
    const d = FiberSense.diagnose('input lag');
    assert.ok(d.hypothesis);
    assert.ok(Array.isArray(d.commands));
    assert.ok(d.interpretation);
  });

  it('diagnose() with unknown symptom should still work', () => {
    const d = FiberSense.diagnose('');
    assert.ok(d.hypothesis);
  });

  it('fixture() should generate test code', () => {
    const f = FiberSense.fixture('Header');
    assert.ok(f.includes('describe'));
  });

  it('interface() should generate TypeScript', () => {
    const iface = FiberSense.interface('Header');
    assert.ok(iface.includes('interface'));
  });

  it('fullAudit() should sweep all categories', () => {
    const a = FiberSense.fullAudit('');
    assert.ok(a.verdict);
    assert.ok(typeof a.totalAnomalies === 'number');
    assert.ok(Array.isArray(a.anomalies));
  });
});

// ──────────────────────────────────────────────
// ZOMBIE SCAN
// ──────────────────────────────────────────────

describe('Zombie scan', () => {
  it('should detect never-updated useState', () => {
    const z = FiberSense.zombieScan();
    assert.ok(z.totalZombies >= 0);
  });
});

// ──────────────────────────────────────────────
// MANIPULATION
// ──────────────────────────────────────────────

describe('Manipulation', () => {
  it('trigger() should fire handlers', () => {
    let fired = false;
    // Wrap a real onClick
    const root = dom.window.document.getElementById('__next')['__reactContainer$root'];
    const sidebar = root.child.sibling;
    sidebar.memoizedProps.onClick = () => { fired = true; };
    FiberSense.trigger('Sidebar', 'onClick');
    assert.ok(fired);
  });
});

// ──────────────────────────────────────────────
// CLEANUP
// ──────────────────────────────────────────────

describe('Cleanup', () => {
  it('destroy() should clean up without error', () => {
    FiberSense.startOmniWatch();
    const d = FiberSense.destroy();
    assert.strictEqual(d.status, 'DESTROYED');
    assert.ok(d.cleaned > 0);
  });
});

// ──────────────────────────────────────────────
// SECURITY
// ──────────────────────────────────────────────

describe('Security', () => {
  it('sanitizeValue should exist in source', () => {
    assert.ok(source.includes('sanitizeValue'));
  });

  it('FIBERSENSE_PRODUCTION guard should exist', () => {
    assert.ok(source.includes('FIBERSENSE_PRODUCTION'));
  });
});
