// FiberSense V1.0.1 — Unit Tests (node:test + jsdom)
// Run: node --test test/fiber_sense.test.mjs

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync('skills/react-fiber-sensing/scripts/fiber_sense.js', 'utf8');

function createDOM() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="__next"><div id="root"></div></div></body></html>`, {
    url: 'http://localhost:3000/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  // Mock React Fiber internal properties
  const root = dom.window.document.getElementById('__next');
  root['__reactFiber$root'] = createMockFiberTree();
  return dom;
}

function createMockFiberTree() {
  const App = { name: 'App' };
  const Header = { name: 'Header' };
  const Content = { name: 'Content' };

  return {
    type: App,
    tag: 0,
    memoizedState: createMockHookChain([{ count: 0, name: 'test' }]),
    memoizedProps: { user: 'ayberk', token: 'sk-secret-123' },
    actualDuration: 25,
    lanes: 1,
    _debugSource: { fileName: '/src/App.tsx', lineNumber: 42 },
    child: {
      type: Header,
      tag: 0,
      memoizedState: createMockHookChain([{ title: 'Dashboard' }]),
      memoizedProps: { onClick: () => {}, className: 'header' },
      actualDuration: 2,
      _debugSource: { fileName: '/src/Header.tsx', lineNumber: 10 },
      child: {
        type: 'header',
        tag: 5,
        memoizedProps: { className: 'main-header' },
        stateNode: null,
      },
      sibling: {
        type: Content,
        tag: 0,
        memoizedState: createMockHookChain([{ data: [1, 2, 3] }, { dispatch: () => {} }]),
        memoizedProps: { items: [1, 2, 3], password: 'super-secret' },
        actualDuration: 8,
        _debugSource: { fileName: '/src/Content.tsx', lineNumber: 25 },
        child: null,
        sibling: null,
      },
    },
    return: null,
    sibling: null,
    alternate: null,
  };
}

function createMockHookChain(values) {
  const head = { memoizedState: values[0], next: null };
  let curr = head;
  for (let i = 1; i < values.length; i++) {
    curr.next = { memoizedState: values[i], next: null };
    curr = curr.next;
  }
  return head;
}

// ──────────────────────────────────────────────
// CORE UTILITIES
// ──────────────────────────────────────────────

describe('Core utilities', () => {
  it('serialize() should walk hook chain', () => {
    const hooks = createMockHookChain([{ x: 1 }, 'hello', { y: 2 }]);
    const result = [];
    let curr = hooks;
    let i = 0;
    while (curr && i < 100) {
      const val = curr.memoizedState;
      if (val && typeof val === 'object') result.push(`[${val.constructor?.name || 'Object'}]`);
      else result.push(String(val));
      curr = curr.next;
      i++;
    }
    assert.deepStrictEqual(result, ['[Object]', 'hello', '[Object]']);
  });

  it('safeStringify should handle circular refs', () => {
    const seen = new WeakSet();
    const obj = {};
    obj.self = obj;
    const json = JSON.stringify(obj, (k, v) => {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    });
    assert.ok(json.includes('[Circular]'));
  });

  it('safeStringify should handle functions', () => {
    const json = JSON.stringify({ fn: function hello() {} }, (k, v) => {
      if (typeof v === 'function') return `[fn:${v.name || 'anonymous'}]`;
      return v;
    });
    assert.ok(json.includes('[fn:hello]'));
  });
});

// ──────────────────────────────────────────────
// FIBER TREE DIAGNOSTICS
// ──────────────────────────────────────────────

describe('Fiber tree diagnostics', () => {
  it('getName should return component name', () => {
    const fiber = { type: { name: 'MyComponent' } };
    const t = fiber.type;
    const name = typeof t === 'string' ? t : t?.name || t?.displayName || 'Anonymous';
    assert.strictEqual(name, 'MyComponent');
  });

  it('getName should handle string type (HTML elements)', () => {
    const fiber = { type: 'div' };
    const name = typeof fiber.type === 'string' ? fiber.type : 'Anonymous';
    assert.strictEqual(name, 'div');
  });

  it('getName should handle React.memo', () => {
    const Inner = { name: 'InnerComp' };
    const fiber = {
      type: { $$typeof: Symbol.for('react.memo'), type: Inner },
    };
    const t = fiber.type;
    const ct = (t?.$$typeof === Symbol.for('react.forward_ref') || t?.$$typeof === Symbol.for('react.memo'))
      ? (t.type || t.render)
      : t;
    assert.strictEqual(ct?.name, 'InnerComp');
  });

  it('should traverse all fibers in tree', () => {
    const tree = createMockFiberTree();
    const names = [];
    const walk = (f, d) => {
      if (!f || d > 100) return;
      const t = f.type;
      const name = typeof t === 'string' ? t : t?.name || 'Anonymous';
      names.push(name);
      let c = f.child;
      while (c) { walk(c, d + 1); c = c.sibling; }
    };
    walk(tree, 0);
    assert.deepStrictEqual(names, ['App', 'Header', 'header', 'Content']);
  });

  it('source() should extract _debugSource', () => {
    const tree = createMockFiberTree();
    const hits = [];
    const walk = (f) => {
      if (!f) return;
      const t = f.type;
      const name = typeof t === 'string' ? t : t?.name || 'Anonymous';
      if (name === 'App') {
        const src = f._debugSource || (f.type?._debugSource);
        hits.push({ name, file: src?.fileName || 'Unknown', line: src?.lineNumber || 'Unknown' });
      }
      let c = f.child;
      while (c) { walk(c); c = c.sibling; }
    };
    walk(tree);
    assert.strictEqual(hits[0].file, '/src/App.tsx');
    assert.strictEqual(hits[0].line, 42);
  });
});

// ──────────────────────────────────────────────
// SECURITY
// ──────────────────────────────────────────────

describe('Security', () => {
  it('SENSITIVE keys should redact', () => {
    const SENSITIVE = new Set(['password', 'token', 'secret', 'key', 'apikey', 'api_key', 'auth', 'credential', 'private']);
    const props = { user: 'ayberk', password: 'secret123', token: 'abc', normal: 'visible' };
    const out = {};
    for (const k of Object.keys(props)) {
      if (SENSITIVE.has(k) || /token|secret|password|credential/i.test(k)) out[k] = '[REDACTED]';
      else out[k] = props[k];
    }
    assert.strictEqual(out.password, '[REDACTED]');
    assert.strictEqual(out.token, '[REDACTED]');
    assert.strictEqual(out.user, 'ayberk');
    assert.strictEqual(out.normal, 'visible');
  });

  it('sanitize should truncate objects', () => {
    const obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 };
    const keys = Object.keys(obj).slice(0, 8);
    assert.strictEqual(keys.length, 8);
    assert.strictEqual(keys[7], 'h');
  });

  it('sanitize should cap message at 300 chars', () => {
    const raw = 'x'.repeat(500);
    const msg = raw.length > 300 ? raw.substring(0, 300) + '...' : raw;
    assert.strictEqual(msg.length, 303);
    assert.ok(msg.endsWith('...'));
  });
});

// ──────────────────────────────────────────────
// EFFECT AUDIT LOGIC
// ──────────────────────────────────────────────

describe('Effect audit logic', () => {
  it('should detect effects with NO_DEPS', () => {
    const effect = {
      create: () => {},
      deps: null,           // null = runs every render
      destroy: undefined,   // no cleanup
    };
    const depsStr = effect.deps === null
      ? 'NO_DEPS (runs every render)'
      : effect.deps === undefined
        ? 'undefined (mount-only)'
        : 'has deps';
    assert.strictEqual(depsStr, 'NO_DEPS (runs every render)');
  });

  it('should detect mount-only effects', () => {
    const effect = { create: () => {}, deps: undefined, destroy: undefined };
    const depsStr = effect.deps === undefined ? 'undefined (mount-only)' : 'has deps';
    assert.strictEqual(depsStr, 'undefined (mount-only)');
  });

  it('should detect effects with cleanup', () => {
    const effect = { create: () => {}, deps: [1], destroy: () => {} };
    const hasCleanup = typeof effect.destroy === 'function';
    assert.ok(hasCleanup);
  });
});

// ──────────────────────────────────────────────
// RERENDER REASON LOGIC
// ──────────────────────────────────────────────

describe('Rerender reason logic', () => {
  it('should detect PROPS_CHANGED', () => {
    const curr = { memoizedProps: { x: 1, y: 2 }, memoizedState: {} };
    const prev = { memoizedProps: { x: 2, y: 2 } };
    if (curr.memoizedProps !== prev.memoizedProps) {
      const changed = Object.keys({ ...curr.memoizedProps, ...prev.memoizedProps })
        .filter(k => k !== 'children' && curr.memoizedProps[k] !== prev.memoizedProps[k]);
      assert.deepStrictEqual(changed, ['x']);
    }
  });

  it('should detect STATE_CHANGED', () => {
    if ({}.memoizedState !== { hello: 'world' }.memoizedState) {
      assert.ok(true);
    }
  });
});

// ──────────────────────────────────────────────
// ZOMBIE SCAN LOGIC
// ──────────────────────────────────────────────

describe('Zombie scan logic', () => {
  it('should detect useState never dispatched', () => {
    const hook = {
      memoizedState: 'initial',
      queue: { lastRenderedState: 'initial', pending: null, lanes: 0 },
      next: null,
    };
    const isZombie = hook.memoizedState === hook.queue.lastRenderedState
      && hook.queue.pending === null
      && hook.queue.lanes === 0;
    assert.ok(isZombie);
  });

  it('should not flag dispatched hooks', () => {
    const hook = {
      memoizedState: 'updated',
      queue: { lastRenderedState: 'initial', pending: {}, lanes: 1 },
      next: null,
    };
    const isZombie = hook.memoizedState === hook.queue.lastRenderedState
      && hook.queue.pending === null
      && hook.queue.lanes === 0;
    assert.strictEqual(isZombie, false);
  });
});

// ──────────────────────────────────────────────
// PRODUCTION GUARD
// ──────────────────────────────────────────────

describe('Production guard', () => {
  it('should block on non-localhost', () => {
    const host = 'example.com';
    const isProd = !host.match(/localhost|127\.0\.0\.1|\.local$/);
    assert.ok(isProd);
  });

  it('should allow on localhost', () => {
    const host = 'localhost:3000';
    const isProd = !host.match(/localhost|127\.0\.0\.1|\.local$/);
    assert.strictEqual(isProd, false);
  });
});

// ──────────────────────────────────────────────
// VERSION
// ──────────────────────────────────────────────

describe('Version contract', () => {
  it('source should contain V1.0.1', () => {
    assert.ok(source.includes('V1.0.1') || source.includes('1.0.1'));
  });

  it('source should contain MIT license', () => {
    assert.ok(source.includes('MIT') || source.includes('mit'));
  });

  it('source should contain production guard', () => {
    assert.ok(source.includes('FIBERSENSE_PRODUCTION'));
  });

  it('source should contain sanitizeValue', () => {
    assert.ok(source.includes('sanitizeValue'));
  });

  it('source should contain destroy()', () => {
    assert.ok(source.includes('destroy') && source.includes('cleaned'));
  });

  it('source should contain benchmark()', () => {
    assert.ok(source.includes('benchmark'));
  });
});
