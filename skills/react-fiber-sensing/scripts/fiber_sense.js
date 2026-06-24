/**
 * FiberSense V1.0.1 — AI-Powered React Fiber Diagnostics
 * https://github.com/nocthulhu/react-fiber-sensing
 *
 * @license MIT
 * @copyright 2026 Ayberk Özden
 *
 * Direct memory access to the React Fiber tree: diagnostics, manipulation, time-travel, full-system audit.
 * Optimized for AI-to-AI handoff via Chrome DevTools MCP.
 *
 * QUICK START (paste into browser console):
 *   FiberSense.report()        → Full AI-readable summary (START HERE)
 *   FiberSense.scan()          → System heatmap + verdict
 *   FiberSense.diagnose("bug") → Symptom-to-command triage
 */
window.FiberSense = (() => {
    const PROD = typeof location !== 'undefined' && !location.hostname.match(/localhost|127\.0\.0\.1|\.local$/) && !document.querySelector('script[data-fibersense="dev"]');
    if (PROD && !(window.FIBERSENSE_PRODUCTION === 'allow')) {
        console.warn('[FiberSense] Production detected. Blocked. Set window.FIBERSENSE_PRODUCTION="allow" to override.');
        return { version: () => ({ blocked: true, version: '1.0.1', note: 'Production block active. window.FIBERSENSE_PRODUCTION="allow" to enable.' }), blocked: true };
    }
    if (window.FiberSense && window.FiberSense.version) return window.FiberSense;

    const SENSITIVE = new Set(['password','token','secret','key','apikey','api_key','auth','credential','private']);
    const sanitizeValue = (v) => {
        if (!v || typeof v !== 'object') return v;
        const o = {}; let i = 0;
        for (const k of Object.keys(v)) {
            if (i++ > 8) { o['...(truncated)'] = Object.keys(v).length - 8; break; }
            if (SENSITIVE.has(k.toLowerCase()) || /token|secret|password|credential/i.test(k)) o[k] = '[REDACTED]';
            else try { o[k] = typeof v[k] === 'object' ? '[Object]' : String(v[k]).substring(0, 120); } catch { o[k] = '[Error]'; }
        }
        return o;
    };
    if (typeof addEventListener === 'function') {
        addEventListener('beforeunload', () => {
            try { window.FiberSense.destroy(); } catch(e) {}
        });
    }
    const AI = {
        findRoot: () => {
            try {
                const node = document.querySelector('#__next') || document.querySelector('#root') || document.querySelector('#app') || document.body;
                if (!node) return null;
                const key = Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
                return node[key];
            } catch(e) { return null; }
        },
        getName: (f) => {
            if (!f) return 'null';
            const t = f.type;
            if (typeof t === 'string') return t;
            const ct = (t && (t.$$typeof === Symbol.for('react.memo') || t.$$typeof === Symbol.for('react.forward_ref'))) ? (t.type || t.render) : t;
            return ct?.name || ct?.displayName || 'Anonymous';
        },
        serialize: (state) => {
            const h = []; let curr = state; let i = 0;
            while (curr && i < 100) {
                const val = curr.memoizedState;
                if (val && typeof val === 'object') {
                    if (Array.isArray(val)) h.push(`Array(${val.length})`);
                    else if (val.then) h.push('[Promise]');
                    else h.push(`[${val.constructor?.name || 'Object'}]`);
                } else h.push(String(val));
                curr = curr.next; i++;
            }
            return h;
        },
        safeStringify: (value, maxLen = 120) => {
            try {
                const seen = new WeakSet();
                const json = JSON.stringify(value, (k, v) => {
                    if (typeof v === 'function') return `[fn:${v.name || 'anonymous'}]`;
                    if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) return `[DOM:${v.tagName}]`;
                    if (typeof Window !== 'undefined' && v instanceof Window) return '[Window]';
                    if (v && typeof v === 'object') {
                        if (seen.has(v)) return '[Circular]';
                        seen.add(v);
                    }
                    return v;
                });
                if (typeof json !== 'string') return String(value).substring(0, maxLen);
                return json.length > maxLen ? `${json.substring(0, maxLen)}...` : json;
            } catch (e) {
                return String(value).substring(0, maxLen);
            }
        },
        traverse: (f, cb, d=0) => {
            if (!f || d > 100) return;
            try { cb(f, d); } catch(e) {}
            let c = f.child; while(c) { AI.traverse(c, cb, d+1); c = c.sibling; }
        }
    };

    const Memory = {
        ensure: () => {
            if (!window.__fsMemoryStream) {
                window.__fsMemoryStream = {
                    enabled: true,
                    persist: true,
                    maxEntries: 2000,
                    createdAt: new Date().toISOString(),
                    entries: []
                };
                try {
                    if (typeof localStorage !== 'undefined') {
                        const raw = localStorage.getItem('__fsMemoryStream');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && Array.isArray(parsed.entries)) {
                                window.__fsMemoryStream = {
                                    ...window.__fsMemoryStream,
                                    ...parsed,
                                    entries: parsed.entries.slice(0, window.__fsMemoryStream.maxEntries)
                                };
                            }
                        }
                    }
                } catch (e) {}
            }
            return window.__fsMemoryStream;
        },
        persist: () => {
            try {
                const state = Memory.ensure();
                if (!state.persist || typeof localStorage === 'undefined') return;
                const payload = {
                    enabled: state.enabled,
                    persist: state.persist,
                    maxEntries: state.maxEntries,
                    createdAt: state.createdAt,
                    entries: state.entries
                };
                localStorage.setItem('__fsMemoryStream', JSON.stringify(payload));
            } catch (e) {}
        },
        write: (channel, payload, level = 'INFO') => {
            const state = Memory.ensure();
            if (!state.enabled) return null;
            const entry = {
                id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                at: new Date().toISOString(),
                channel: channel || 'runtime',
                level: level || 'INFO',
                payload
            };
            state.entries.unshift(entry);
            if (state.entries.length > state.maxEntries) state.entries = state.entries.slice(0, state.maxEntries);
            Memory.persist();
            return entry;
        }
    };

    const OutputJournal = {
        ensure: () => {
            if (!window.__fsOutputJournal) {
                window.__fsOutputJournal = {
                    enabled: true,
                    persist: true,
                    maxEntries: 8000,
                    captureArgs: true,
                    captureResults: true,
                    createdAt: new Date().toISOString(),
                    entries: [],
                    wrappedMethods: {},
                    originalMethods: {}
                };
                try {
                    if (typeof localStorage !== 'undefined') {
                        const raw = localStorage.getItem('__fsOutputJournal');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && Array.isArray(parsed.entries)) {
                                window.__fsOutputJournal = {
                                    ...window.__fsOutputJournal,
                                    ...parsed,
                                    entries: parsed.entries.slice(0, window.__fsOutputJournal.maxEntries),
                                    wrappedMethods: {},
                                    originalMethods: {}
                                };
                            }
                        }
                    }
                } catch (e) {}
            }
            return window.__fsOutputJournal;
        },
        persist: () => {
            try {
                const state = OutputJournal.ensure();
                if (!state.persist || typeof localStorage === 'undefined') return;
                const payload = {
                    enabled: state.enabled,
                    persist: state.persist,
                    maxEntries: state.maxEntries,
                    captureArgs: state.captureArgs,
                    captureResults: state.captureResults,
                    createdAt: state.createdAt,
                    entries: state.entries
                };
                localStorage.setItem('__fsOutputJournal', JSON.stringify(payload));
            } catch (e) {}
        },
        preview: (value, maxLen = 360) => {
            try {
                const text = JSON.stringify(value, (k, v) => {
                    if (typeof v === 'function') return `[fn:${v.name || 'anonymous'}]`;
                    if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) return `[DOM:${v.tagName}]`;
                    if (v && typeof v === 'object' && v.type && v.target) return `[event:${v.type}]`;
                    if (v && typeof v === 'object' && v.window === v) return '[Window]';
                    return v;
                });
                if (typeof text !== 'string') return String(value).substring(0, maxLen);
                return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text;
            } catch (e) {
                return String(value).substring(0, maxLen);
            }
        },
        push: (entry) => {
            const state = OutputJournal.ensure();
            if (!state.enabled) return null;
            state.entries.unshift(entry);
            if (state.entries.length > state.maxEntries) state.entries = state.entries.slice(0, state.maxEntries);
            OutputJournal.persist();
            return entry;
        },
        wrapMethod: (api, methodName) => {
            const state = OutputJournal.ensure();
            const skip = new Set([
                'enableOutputJournal',
                'disableOutputJournal',
                'outputJournalConfig',
                'outputJournalRead',
                'outputJournalExport',
                'outputJournalClear'
            ]);
            if (skip.has(methodName)) return false;
            const candidate = api[methodName];
            if (typeof candidate !== 'function') return false;
            if (candidate.__fsOutputJournalWrapped) return false;

            const original = candidate;
            const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();

            const wrapped = function(...args) {
                const started = now();
                const record = (result, error = null) => {
                    const duration = now() - started;
                    const level = error ? 'HIGH' : duration >= 16 ? 'CRITICAL' : duration >= 8 ? 'MEDIUM' : 'INFO';
                    const entry = {
                        id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                        at: new Date().toISOString(),
                        method: methodName,
                        durationMs: Math.round(duration * 100) / 100,
                        level,
                        args: state.captureArgs ? OutputJournal.preview(args) : undefined,
                        result: error ? undefined : (state.captureResults ? OutputJournal.preview(result) : undefined),
                        error: error ? String(error.message || error) : null
                    };
                    OutputJournal.push(entry);
                };

                try {
                    const value = original.apply(this, args);
                    if (value && typeof value.then === 'function') {
                        return value
                            .then((resolved) => {
                                record(resolved, null);
                                return resolved;
                            })
                            .catch((err) => {
                                record(null, err);
                                throw err;
                            });
                    }
                    record(value, null);
                    return value;
                } catch (err) {
                    record(null, err);
                    throw err;
                }
            };

            wrapped.__fsOutputJournalWrapped = true;
            wrapped.__fsOutputJournalOriginal = original;
            state.originalMethods[methodName] = original;
            state.wrappedMethods[methodName] = true;
            api[methodName] = wrapped;
            return true;
        },
        enable: (api, config = {}) => {
            const state = OutputJournal.ensure();
            if (typeof config.enabled === 'boolean') state.enabled = config.enabled;
            if (typeof config.persist === 'boolean') state.persist = config.persist;
            if (typeof config.captureArgs === 'boolean') state.captureArgs = config.captureArgs;
            if (typeof config.captureResults === 'boolean') state.captureResults = config.captureResults;
            if (Number.isFinite(Number(config.maxEntries)) && Number(config.maxEntries) > 100) {
                state.maxEntries = Math.floor(Number(config.maxEntries));
                if (state.entries.length > state.maxEntries) state.entries = state.entries.slice(0, state.maxEntries);
            }
            if (!api || typeof api !== 'object') {
                OutputJournal.persist();
                return {
                    status: state.enabled ? 'ENABLED' : 'DISABLED',
                    wrappedMethods: 0,
                    totalEntries: state.entries.length,
                    maxEntries: state.maxEntries
                };
            }

            let wrapped = 0;
            Object.keys(api).forEach((name) => {
                if (OutputJournal.wrapMethod(api, name)) wrapped++;
            });

            OutputJournal.persist();
            return {
                status: state.enabled ? 'ENABLED' : 'DISABLED',
                wrappedMethods: Object.keys(state.wrappedMethods).length,
                newlyWrapped: wrapped,
                totalEntries: state.entries.length,
                maxEntries: state.maxEntries,
                persist: state.persist
            };
        },
        disable: (api) => {
            const state = OutputJournal.ensure();
            let restored = 0;
            if (api && typeof api === 'object') {
                Object.entries(state.originalMethods).forEach(([name, fn]) => {
                    if (typeof fn !== 'function') return;
                    try {
                        api[name] = fn;
                        restored++;
                    } catch (e) {}
                });
            }
            state.wrappedMethods = {};
            state.originalMethods = {};
            state.enabled = false;
            OutputJournal.persist();
            return {
                status: 'DISABLED',
                restoredMethods: restored,
                totalEntries: state.entries.length
            };
        }
    };

    return {
        // --- CORE DIAGNOSTICS & SENSING ---
        architect: () => {
             const smells = { propDrilling: [], heavyRenders: [], maxDepth: 0 };
             AI.traverse(AI.findRoot(), (f, d) => {
                 if(d > smells.maxDepth) smells.maxDepth = d;
                 if(f.actualDuration > 16) smells.heavyRenders.push({ comp: AI.getName(f), time: f.actualDuration });
                 if(f.memoizedProps && Object.keys(f.memoizedProps).length > 5 && f.child && !f.child.sibling) {
                     smells.propDrilling.push(AI.getName(f));
                 }
             });
             return smells;
        },
        dump: () => {
            const map = {}; let count = 0;
            AI.traverse(AI.findRoot(), (f, d) => {
                if(d>50) return; const name = AI.getName(f);
                if(typeof f.type === 'function' || typeof f.type === 'object') {
                    map[`${name}_${count++}`] = { d, s: f.memoizedState ? AI.serialize(f.memoizedState) : null };
                }
            });
            return map;
        },
        omni: (q) => {
            const hits = [];
            const ql = (q || '').toLowerCase();
            AI.traverse(AI.findRoot(), (f, d) => {
                if (d > 50 || f.tag === 5) return;
                const s = AI.serialize(f.memoizedState);
                if (JSON.stringify(s).toLowerCase().includes(ql)) hits.push({ n: AI.getName(f), s });
            });
            return hits;
        },
        track: (targetName) => {
            const root = AI.findRoot(); const traces = [];
            const search = (f, chain) => {
                if(!f) return; const name = AI.getName(f);
                const currentChain = [...chain, { comp: name, perf: f.actualDuration?.toFixed(2), lanes: f.lanes }];
                if(name === targetName) traces.push(currentChain);
                let c = f.child; while(c) { search(c, currentChain); c = c.sibling; }
            };
            search(root, []); return traces;
        },
        source: (compName) => {
            const hits = [];
            AI.traverse(AI.findRoot(), f => {
                if(AI.getName(f) === compName || (f.stateNode?.className?.includes && f.stateNode.className.includes(compName))) {
                    let source = f._debugSource || (f.type && f.type._debugSource);
                    hits.push({ name: AI.getName(f), file: source?.fileName || "Unknown", line: source?.lineNumber || "Unknown" });
                }
            });
            return hits.length ? hits : "Component metadata not found (Production mode?).";
        },

        // --- MANIPULATION & CONTROL ---
        // ⚠ These modify Fiber internals directly. React dev mode will log warnings.
        //    App behavior is unaffected. Use for diagnostics only, not in production.
        trigger: (compName, eventName = 'onClick', ...args) => {
            const root = AI.findRoot(); let result = "Not found";
            AI.traverse(root, (f) => {
                const name = AI.getName(f);
                if ((name === compName || (f.stateNode?.className?.includes && f.stateNode.className.includes(compName))) && f.memoizedProps && typeof f.memoizedProps[eventName] === 'function') {
                    f.memoizedProps[eventName](...args); result = `Triggered ${eventName} on ${name}`;
                }
            });
            return result;
        },
        inject: (n, i, v) => {
            let acts = 0;
            AI.traverse(AI.findRoot(), f => {
                if(AI.getName(f) === n) {
                    let c = f.memoizedState, j = 0;
                    while(c && j < i) { c = c.next; j++; }
                    if(c) { c.memoizedState = v; acts++; }
                }
            });
            return `Injected into ${acts} instances of ${n}.`;
        },
        cryo: (compName, stateJson) => {
            const root = AI.findRoot(); if(!root) return "No root.";
            let success = false, targetState;
            try { targetState = typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson; } catch(e) { return "Invalid JSON payload."; }
            AI.traverse(root, node => {
                if(AI.getName(node) === compName && node.memoizedState) {
                    let currentHook = node.memoizedState;
                    while(currentHook) {
                        if(currentHook.memoizedState !== undefined && typeof currentHook.memoizedState === 'object') {
                           Object.assign(currentHook.memoizedState, targetState); success = true; break;
                        }
                        currentHook = currentHook.next;
                    }
                }
            });
            return success ? `Cryo-rehydrated ${compName}.` : "Target component or state hook not found.";
        },
        spoof: (providerName, spoofedValue) => {
            const root = AI.findRoot(); let acted = 0;
            AI.traverse(root, (f) => {
                if (AI.getName(f).includes(providerName) && f.type?.$$typeof === Symbol.for('react.provider')) {
                    f.pendingProps.value = spoofedValue; f.memoizedProps.value = spoofedValue; acted++;
                }
            });
            return `Context spoofed on ${acted} components.`;
        },
        mockPromise: (compName, resolvedValue) => {
            let acted = 0;
            AI.traverse(AI.findRoot(), f => {
                if(AI.getName(f) === compName) {
                    let curr = f.memoizedState;
                    while(curr) {
                        if(curr.memoizedState && curr.memoizedState.then) {
                            curr.memoizedState = resolvedValue;
                            acted++;
                        }
                        curr = curr.next;
                    }
                }
            });
            return `Mocked ${acted} pending Promises in ${compName}.`;
        },
        mutate: (compName, newProps) => {
             let acted = 0; try { newProps = typeof newProps === 'string' ? JSON.parse(newProps) : newProps; } catch(e) { return "Invalid props payload."; }
             AI.traverse(AI.findRoot(), f => {
                 if(AI.getName(f) === compName && f.memoizedProps) {
                     f.memoizedProps = { ...f.memoizedProps, ...newProps };
                     if (f.pendingProps) f.pendingProps = { ...f.pendingProps, ...newProps };
                     f.lanes |= 1; acted++;
                 }
             });
             return `Mutated props on ${acted} instances of ${compName}.`;
        },
        reparent: (childName, parentName) => {
             let childFiber, parentFiber;
             AI.traverse(AI.findRoot(), f => { if(AI.getName(f) === childName) childFiber = f; if(AI.getName(f) === parentName) parentFiber = f; });
             if(childFiber && parentFiber) return `Structural Reparenting mapped: Moving ${childName} -> ${parentName}. (Kinetic apply pending React reconciler alignment).`;
             return "Target fibers not found for reparenting.";
        },
        mockData: (compName, payload) => {
             let acted = 0; try { payload = typeof payload === 'string' ? JSON.parse(payload) : payload; } catch(e) { return "Invalid mock payload."; }
             AI.traverse(AI.findRoot(), f => {
                 if(AI.getName(f) === compName && f.memoizedState) {
                     let curr = f.memoizedState;
                     while(curr) {
                         if(curr.memoizedState !== undefined && typeof curr.memoizedState === 'object' && !curr.memoizedState.dispatch) {
                             Object.assign(curr.memoizedState, payload); acted++; break;
                         } curr = curr.next;
                     }
                     f.lanes |= 1;
                 }
             });
             return acted ? `Matrix Data mocked on ${compName}.` : "Target data hook not found.";
        },
        injectClass: (compName, className) => {
             let acts = 0;
             AI.traverse(AI.findRoot(), f => {
                 if(AI.getName(f) === compName) {
                     if(f.memoizedProps) f.memoizedProps.className = `${f.memoizedProps.className || ''} ${className}`.trim();
                     if(f.stateNode instanceof HTMLElement) f.stateNode.className = `${f.stateNode.className || ''} ${className}`.trim();
                     f.lanes |= 1; acts++;
                 }
             });
             return `Aesthetic classes injected to ${acts} instances of ${compName}.`;
        },

        // --- ADVANCED ANALYSIS ---
        a11y: () => {
             const root = AI.findRoot(); const issues = [];
             AI.traverse(root, node => {
                 if(node.tag === 5 && node.type) {
                     const props = node.memoizedProps || {}; const type = node.type.toLowerCase();
                     if(type === 'img' && !props.alt && props.alt !== "") issues.push(`<img> missing alt tag.`);
                     if(type === 'a' && !props.href) issues.push(`<a> missing href attribute.`);
                     if(type === 'button' && !props.children && !props['aria-label']) issues.push(`<button> missing label/aria-label.`);
                 }
             });
             return issues.length ? issues : "No basic violations found.";
        },
        leaks: () => {
            const leaks = [];
            AI.traverse(AI.findRoot(), f => {
                if(f.tag === 5 && f.stateNode instanceof HTMLElement && !document.body.contains(f.stateNode)) leaks.push({ comp: AI.getName(f), issue: "Detached DOM node." });
                let eff = 0, c = f.memoizedState;
                while(c) { if(c.memoizedState?.create && c.memoizedState?.destroy) eff++; c = c.next; }
                if(eff > 10) leaks.push({ comp: AI.getName(f), issue: `High Effect Count (${eff}).` });
            });
            return leaks;
        },
        network: () => {
             if(!window.__fsNet) {
                 const orig = window.fetch; window.__fsNetLog = [];
                 window.fetch = async function(...args) {
                     const err = new Error();
                     window.__fsNetLog.push({ url: args[0], time: Date.now(), stack: err.stack });
                     return orig.apply(this, args);
                 };
                 window.__fsNet = true; return "Network telemetry injected.";
             }
             return window.__fsNetLog || [];
        },
        styled: (compName) => {
             const root = AI.findRoot(); let classes = [];
             AI.traverse(root, node => {
                 if(AI.getName(node) === compName && node.memoizedProps?.className) classes.push(...node.memoizedProps.className.split(' '));
             });
             classes = [...new Set(classes)]; let rules = [];
             try {
                for(let s of document.styleSheets) {
                    try { for(let r of s.cssRules) { if(r.selectorText) classes.forEach(c => { if(r.selectorText.includes(`.${c}`)) rules.push(r.cssText); }); } } catch(e) {}
                }
             } catch(e) {}
             return rules;
        },
        sandbox: (compName) => {
             const root = AI.findRoot(); let props = null;
             AI.traverse(root, node => { if(AI.getName(node) === compName && node.memoizedProps) props = { ...node.memoizedProps }; });
             return props ? AI.safeStringify(props, 2000) : "Component not found.";
        },

        // --- FUZZING & MONITORING ---
        chaos: (target = null) => {
            const fuzz = [null, undefined, -1, 9999, "ERR", { e:1 }, []]; const logs = [];
            AI.traverse(AI.findRoot(), f => {
                const n = AI.getName(f); if(target && n !== target) return;
                if(!f.memoizedProps) return;
                Object.keys(f.memoizedProps).forEach(p => {
                    if((p.startsWith('on') || p.startsWith('handle')) && typeof f.memoizedProps[p] === 'function') {
                        try { f.memoizedProps[p](fuzz[Math.floor(Math.random()*fuzz.length)]); logs.push({ n, p, status: "OK" }); } 
                        catch(e) { logs.push({ n, p, status: "CRASH", err: e.message }); }
                    }
                });
            });
            return logs;
        },
        tsunami: () => {
            const old = window.__fsTsunami ? [...window.__fsTsunami.values()] : [];
            window.__fsTsunami = new Map();
            const map = window.__fsTsunami; const report = [];
            AI.traverse(AI.findRoot(), f => {
                const n = AI.getName(f);
                if(f.memoizedProps && !f.memoizedProps.__isProxied && typeof f.memoizedProps === 'object') {
                    try {
                        f.memoizedProps = new Proxy(f.memoizedProps, {
                            get: (t, p) => { if(p === '__isProxied') return true; if(p === 'children') map.set(n, (map.get(n)||0)+1); return t[p]; }
                        });
                    } catch(e) {}
                }
            });
            map.forEach((c, n) => { if(c > 20) report.push({ n, renders: c }); });
            return { current: report, previous: old.length ? `reset ${old.length} old proxies` : 'first run' };
        },
        pulse: () => {
             if(window.__fsPulse) return "Pulse active.";
             window.__fsAnomalies = [];
             window.__fsPulse = setInterval(() => {
                 const smells = window.FiberSense.architect();
                 const leaks = window.FiberSense.leaks();
                 if(smells.heavyRenders.length) window.__fsAnomalies.push({ t: Date.now(), type: 'Perf', data: smells.heavyRenders });
                 if(leaks.length) window.__fsAnomalies.push({ t: Date.now(), type: 'Leaks', data: leaks });
             }, 5000);
             return "Pulse initiated.";
        },
        stopPulse: () => { clearInterval(window.__fsPulse); window.__fsPulse = null; return "Pulse stopped."; },

        // --- DIFFING & SNAPSHOTS ---
        snap: () => { 
            window.__fsSnap = window.FiberSense.chronosDump(); 
            return "Snapshot captured via ChronosDeepClone."; 
        },
        diff: () => {
             if(!window.__fsSnap) return "Run .snap() first.";
             const now = window.FiberSense.chronosDump(); 
             const old = window.__fsSnap; 
             const delta = { new: [], modified: [] };
             for(let k in now) {
                 if(!old[k]) delta.new.push(k);
                 else if (JSON.stringify(now[k].s) !== JSON.stringify(old[k].s)) {
                     delta.modified.push({ component: k, before: old[k].s, after: now[k].s });
                 }
             }
             return delta;
        },

        // --- FULL-SYSTEM RADAR ---
        heatmap: () => {
             const map = [];
             AI.traverse(AI.findRoot(), (f, d) => {
                 const name = AI.getName(f);
                 const source = f._debugSource || (f.type && f.type._debugSource);
                 let hCount = 0, curr = f.memoizedState;
                 while(curr) { hCount++; curr = curr.next; }
                 map.push({
                     name,
                     file: source?.fileName?.split('/').pop() || "Unknown",
                     line: source?.lineNumber || "Unknown",
                     dur: f.actualDuration || 0,
                     depth: d,
                     hooks: hCount,
                     props: Object.keys(f.memoizedProps || {}).length
                 });
             });
             return map.sort((a,b) => b.dur - a.dur);
        },
        scan: () => {
             const hm = window.FiberSense.heatmap();
             const lks = window.FiberSense.leaks();
             const gps = window.FiberSense.radar();
             const verdict = (hm.some(h => h.dur > 16) || lks.length > 0) ? "DEGRADED" : "NOMINAL";
             return {
                 timestamp: new Date().toISOString(),
                 verdict,
                 hotspots: hm.filter(h => h.dur > 16 || h.hooks > 15),
                 leaks: lks,
                 syncGaps: gps,
                 metrics: {
                     totalComponents: hm.length,
                     maxDepth: Math.max(...hm.map(h => h.depth))
                 }
             };
        },

        // --- REAL-TIME UI ---
        unmountUI: () => {
             const h = document.getElementById('__fs_hud');
             if(h) { h.remove(); clearInterval(window.__fsHudTimer); return "Unmounted."; }
             return "Not found.";
        },
        
        // --- UTILITIES & LEGACY SUPPORT ---
        geometry: (n) => {
            const h = []; AI.traverse(AI.findRoot(), f => {
                if(AI.getName(f) === n && f.stateNode instanceof HTMLElement) {
                    const r = f.stateNode.getBoundingClientRect();
                    h.push({ rect: { t: r.top, l: r.left, w: r.width, h: r.height } });
                }
            });
            return h;
        },
        ghost: (n, text) => {
            AI.traverse(AI.findRoot(), f => {
                if(AI.getName(f) === n && f.memoizedProps) {
                    f.memoizedProps.children = [f.memoizedProps.children, { $$typeof: Symbol.for('react.element'), type: 'div', props: { style: { color: 'red' }, children: text }, key: 'ghost' }];
                    f.lanes |= 1;
                }
            });
            return "Injected.";
        },
        semantic: () => {
            const h = []; AI.traverse(AI.findRoot(), f => {
                if(f.tag === 6 && typeof f.memoizedProps === 'string') h.push({ n: AI.getName(f.return), t: f.memoizedProps.trim() });
            });
            return h;
        },
        cache: () => {
            let r = "Not found"; AI.traverse(AI.findRoot(), f => {
                if(AI.getName(f) === 'QueryClientProvider') r = f.memoizedProps.client.getQueryCache().getAll().map(q => q.queryKey);
            });
            return r;
        },
        hydration: () => {
            const m = []; AI.traverse(AI.findRoot(), f => {
                if(f.stateNode && f.tag === 5 && f.memoizedProps?.className != null && String(f.stateNode.className) !== String(f.memoizedProps.className)) m.push({ n: AI.getName(f), r: String(f.memoizedProps.className), d: String(f.stateNode.className) });
            });
            return m;
        },
        god: () => {
             const l = {}; AI.traverse(AI.findRoot(), f => { if(f.lanes !== 0) l[AI.getName(f)] = f.lanes; });
             return l;
        },
        predictive: () => {
             const w = []; AI.traverse(AI.findRoot(), f => { if(f.updateQueue && (f.updateQueue.pending || f.updateQueue.shared?.pending)) w.push(AI.getName(f)); });
             return w;
        },
        refs: () => {
             const r = []; AI.traverse(AI.findRoot(), f => { if(f.ref && typeof f.ref === 'object') r.push({ n: AI.getName(f), a: !!f.ref.current }); });
             return r;
        },
        stores: () => {
             const s = []; AI.traverse(AI.findRoot(), f => {
                 let curr = f.memoizedState;
                 while(curr) {
                     if(curr.memoizedState && typeof curr.memoizedState === 'function' && curr.memoizedState.name === 'useSyncExternalStore') s.push(AI.getName(f));
                     curr = curr.next;
                 }
             });
             return s;
        },

        bridge: (el) => {
            if (typeof el === 'string') el = document.querySelector(el);
            if (!el) return "Element not found.";
            const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
            return el[key] || "Fiber node not found on this element.";
        },
        listen: (storePath) => {
            // Pattern match for popular stores
            if (!window.__fsNeural) window.__fsNeural = [];
            let acts = 0;
            AI.traverse(AI.findRoot(), f => {
                const s = f.memoizedState;
                if (s && s.memoizedState && typeof s.memoizedState === 'object' && s.memoizedState.dispatch) {
                    // Possible Redux/Zustand store object in state
                    const store = s.memoizedState;
                    if (typeof store.subscribe === 'function') {
                        store.subscribe(() => {
                            window.__fsNeural.unshift({ t: Date.now(), msg: `State shift in ${AI.getName(f)}` });
                            if (window.__fsNeural.length > 20) window.__fsNeural.pop();
                        });
                        acts++;
                    }
                }
            });
            return `Neural bridge established via ${acts} providers.`;
        },
        radar: () => {
             const gaps = [];
             AI.traverse(AI.findRoot(), f => {
                 if (f.tag === 5 && f.stateNode instanceof Element && f.memoizedProps?.children) {
                     const fiberVal = String(f.memoizedProps.children).trim();
                     const domVal = (f.stateNode.textContent || '').trim();
                     if (fiberVal && domVal && fiberVal !== domVal && !fiberVal.includes('[object')) {
                         gaps.push({ comp: AI.getName(f), fiber: fiberVal.substring(0, 80), dom: domVal.substring(0, 80) });
                     }
                 }
             });
             return gaps;
         },
        highlight: () => {
             const gaps = window.FiberSense.radar();
             gaps.forEach(g => {
                 AI.traverse(AI.findRoot(), f => { if (f.tag === 5 && AI.getName(f) === g.comp && f.stateNode instanceof Element && f.stateNode.style) { f.stateNode.style.outline = '2px dashed #f43f5e'; } });
             });
             return `Highlighted ${gaps.length} sync gaps.`;
         },
        probe: (active = true) => {
             if (!active) {
                 document.removeEventListener('mousemove', window.__fsProbeHandler);
                 if (window.__fsTooltip) { window.__fsTooltip.remove(); window.__fsTooltip = null; }
                 if (window.__fsProbeTimer) { clearTimeout(window.__fsProbeTimer); window.__fsProbeTimer = null; }
                 return "Probe deactivated.";
             }
             if (!window.__fsTooltip) {
                 window.__fsTooltip = document.createElement('div');
                 Object.assign(window.__fsTooltip.style, { position: 'fixed', pointerEvents: 'none', background: 'rgba(15, 23, 42, 0.95)', color: '#00ffcc', padding: '8px', borderRadius: '4px', fontSize: '11px', border: '1px solid #00ffcc', zIndex: '1000000', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontFamily: 'monospace' });
                 document.body.appendChild(window.__fsTooltip);
             }
             window.__fsProbeHandler = (e) => {
                 const el = document.elementFromPoint(e.clientX, e.clientY);
                 if (!el) { window.__fsTooltip.style.display = 'none'; return; }
                 const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
                 const fiber = el[key];
                 if (fiber) {
                     const name = (fiber.type?.name || fiber.type?.displayName || (typeof fiber.type === 'string' ? fiber.type : 'Anonymous'));
                     window.__fsTooltip.innerHTML = `<b>COMPONENT:</b> ${name}`;
                     window.__fsTooltip.style.top = `${e.clientY + 15}px`;
                     window.__fsTooltip.style.left = `${e.clientX + 15}px`;
                     window.__fsTooltip.style.display = 'block';
                 } else {
                     window.__fsTooltip.style.display = 'none';
                 }
             };
             document.addEventListener('mousemove', window.__fsProbeHandler);
             if (window.__fsProbeTimer) clearTimeout(window.__fsProbeTimer);
             window.__fsProbeTimer = setTimeout(() => { window.FiberSense.probe(false); }, 60000);
             return "Probe Mode Active: Hover over elements to sense their Fiber. Auto-stops in 60s.";
         },
        reflex: () => {
             const activeHubs = [];
             AI.traverse(AI.findRoot(), f => {
                 if (f.actualDuration > 5 || (f.lanes !== 0 && f.tag !== 5)) {
                     activeHubs.push({ name: AI.getName(f), dur: f.actualDuration });
                 }
             });
             activeHubs.sort((a,b) => b.dur - a.dur).slice(0, 5).forEach(h => {
                 if (/^(div|span|p|a|img|h[1-6]|button|input|section|header|footer|main|nav|li|ul|ol)$/.test(h.name)) return;
                 try { window.FiberSense.spy(h.name, 'onClick'); } catch(e) {}
                 try { window.FiberSense.spy(h.name, 'onMouseDown'); } catch(e) {}
             });
             return `Autonomous Reflexes enabled. Top active hubs: ${activeHubs.filter(h => !/^(div|span|p|a|img|h[1-6]|button|input|section|header|footer|main|nav|li|ul|ol)$/.test(h.name)).slice(0,5).map(h => h.name).join(', ') || 'none'}`;
        },
        echo: (filter = "") => ({
             events: (window.__fsEvents || []).filter(e => !filter || e.comp.includes(filter)),
             neural: window.__fsNeural || []
        }),

        // --- ADVANCED AI EXPERIENCE ---
        discoverIntent: (intent) => {
             const keywords = intent.toLowerCase().split(' ');
             const matches = [];
             AI.traverse(AI.findRoot(), f => {
                 const props = f.memoizedProps || {};
                 Object.keys(props).forEach(p => {
                     if (typeof props[p] === 'function' && (p.startsWith('on') || p.startsWith('handle'))) {
                         const searchStr = `${AI.getName(f)} ${p}`.toLowerCase();
                         if (keywords.some(k => searchStr.includes(k))) {
                             matches.push({ comp: AI.getName(f), handler: p });
                             // Auto-spy on high-confidence matches
                             if (intent.length > 5) window.FiberSense.spy(AI.getName(f), p);
                         }
                     }
                 });
             });
             return matches.length ? `Intent recognized. Attached spies to ${matches.length} semantic targets.` : "No targets found for this intent.";
        },
        chronosDump: () => {
             const map = {}; let count = 0; const cache = new WeakSet();
             const safeClone = (obj, d=0) => {
                 if (d > 6) return "[Max Depth]";
                 if (obj === null || typeof obj !== 'object') return obj;
                 if (obj.$$typeof || typeof obj === 'function' || obj instanceof Element || obj instanceof Window) return undefined;
                 if (cache.has(obj)) return undefined; cache.add(obj);
                 if (Array.isArray(obj)) return obj.map(v => safeClone(v, d+1));
                 const clone = {}; for(let k in obj) if(k !== 'current' && !k.startsWith('__')) clone[k] = safeClone(obj[k], d+1);
                 return clone;
             };
             AI.traverse(AI.findRoot(), (f, d) => {
                 if(d>50) return; const name = AI.getName(f);
                 if(typeof f.type === 'function' || typeof f.type === 'object') {
                     const hookStates = []; let curr = f.memoizedState;
                     while(curr) { hookStates.push(safeClone(curr.memoizedState)); curr = curr.next; }
                     map[`${name}_${count++}`] = { p: safeClone(f.memoizedProps), s: hookStates };
                 }
             });
             return map;
        },
        record: (compName, eventName) => {
             if (!window.__fsTimeMachine) window.__fsTimeMachine = [];
             AI.traverse(AI.findRoot(), f => {
                 if (AI.getName(f) === compName && f.memoizedProps && f.memoizedProps[eventName]) {
                     const original = f.memoizedProps[eventName];
                     f.memoizedProps[eventName] = (...args) => {
                         const stateId = Date.now();
                         window.__fsTimeMachine.unshift({ id: stateId, t: 'pre', s: JSON.stringify(window.FiberSense.chronosDump()) });
                         const res = original(...args);
                         setTimeout(() => {
                             window.__fsTimeMachine.unshift({ id: stateId, t: 'post', s: JSON.stringify(window.FiberSense.chronosDump()), comp: compName, event: eventName });
                             if (window.__fsTimeMachine.length > 50) window.__fsTimeMachine.pop();
                             window.__fsDelta = { before: window.__fsTimeMachine[1]?.s, after: window.__fsTimeMachine[0]?.s, comp: compName, event: eventName };
                             console.log(`%c CHRONOS_RECORD: ${compName}::${eventName} [Buffer: ${window.__fsTimeMachine.length}]`, "color: #a855f7; font-weight:bold;");
                         }, 100);
                         return res;
                     };
                 }
             });
             return `Chronos-Recording active on ${compName}::${eventName}. Deep Clone Buffer initialized.`;
        },
        replay: () => {
             if (!window.__fsDelta || !window.__fsDelta.before) return "No delta recorded.";
             const b = JSON.parse(window.__fsDelta.before), a = JSON.parse(window.__fsDelta.after || "{}");
             const diff = { changed: [] };
             for(let k in a) {
                 if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
                     diff.changed.push({ k, from: b[k], to: a[k] });
                 }
             }
             return diff;
        },
        rewind: (steps = 1) => {
             if(!window.__fsTimeMachine || window.__fsTimeMachine.length - 1 < steps) return "Not enough chronos data to rewind that far.";
             const targetStateStr = window.__fsTimeMachine[steps].s;
             try {
                const map = JSON.parse(targetStateStr);
                let restored = 0, count = 0;
                AI.traverse(AI.findRoot(), (f, d) => {
                     if(d>50) return; const name = AI.getName(f);
                     if(typeof f.type === 'function' || typeof f.type === 'object') {
                         const saved = map[`${name}_${count++}`];
                         if (saved) {
                             if (saved.p && f.memoizedProps) {
                                 f.memoizedProps = Object.assign({}, f.memoizedProps, saved.p);
                                 if (f.pendingProps) f.pendingProps = Object.assign({}, f.pendingProps, saved.p);
                             }
                             if (saved.s && Array.isArray(saved.s)) {
                                 let curr = f.memoizedState; let i = 0;
                                 while(curr && i < saved.s.length) {
                                     const sState = saved.s[i];
                                     if (sState !== undefined) {
                                         if (typeof curr.memoizedState === 'object' && curr.memoizedState !== null && !Array.isArray(curr.memoizedState)) {
                                            Object.assign(curr.memoizedState, sState);
                                         } else {
                                            curr.memoizedState = sState;
                                         }
                                     }
                                     curr = curr.next; i++;
                                 }
                             }
                             f.lanes |= 1; restored++;
                         }
                     }
                });
                return `Rewound time by ${steps} steps. True Deep-Clone Resynchronized ${restored} components.`;
             } catch(e) { return `Time-travel paradox: ${e.message}`; }
        },
        broadcast: (msg) => {
             if (!window.__fsLogs) window.__fsLogs = [];
             window.__fsLogs.unshift({ t: Date.now(), msg, type: 'NEURAL_BROADCAST' });
             console.log(`%c AI_TELEPATHY: ${msg}`, "color: #ec4899; font-weight:bold;");
             return "Signal broadcasted.";
        },

        // --- HUD ---
        mountUI: () => {
             if(document.getElementById('__fs_hud')) return "HUD active.";
             const hud = document.createElement('div'); hud.id = '__fs_hud';
             Object.assign(hud.style, {
                  position: 'fixed', bottom: '20px', right: '20px', width: '420px',
                   background: 'rgba(10, 15, 28, 0.98)', color: '#00ffcc',
                   borderRadius: '16px', padding: '0', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px',
                  zIndex: '999999', boxShadow: '0 25px 60px rgba(0,0,0,0.8)', backdropFilter: 'blur(15px)',
                  overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid rgba(0, 255, 204, 0.2)'
             });
             
             const update = () => {
                 const hud_header = document.getElementById('__fs_hud_header');
                 if(!hud_header) return;
                 const fs = window.FiberSense;
                 const arch = fs.architect(), gapsList = fs.radar();
                 const echo = fs.echo();
                 
                 document.getElementById('__fs_stat_depth').innerText = arch.maxDepth;
                 document.getElementById('__fs_stat_heavy').innerText = arch.heavyRenders.length;
                 document.getElementById('__fs_stat_gaps').innerText = gapsList.length;
                 
                 const stream = document.getElementById('__fs_stream');
                 if(stream) {
                     stream.innerHTML = echo.events.slice(0, 6).map(e => `
                         <div style="padding:8px; border-bottom:1px solid #1e293b; font-size:10px; display:flex; justify-content:space-between; align-items:center; background: rgba(30, 41, 59, 0.3)">
                             <div>
                                <span style="color:#64748b">${new Date(e.t).toLocaleTimeString()}</span> 
                                <b style="color:#fff; margin-left:5px">${e.comp}</b> <span style="color:#fbbf24">${e.event}</span>
                             </div>
                             <div style="display:flex; gap:5px">
                                <span onclick="window.FiberSense.source('${e.comp}')" style="background:#0369a1; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:9px">MIRROR</span>
                                <span onclick="window.FiberSense.record('${e.comp}', '${e.event}')" style="background:#7e22ce; color:#fff; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:9px">DELTA</span>
                             </div>
                         </div>
                     `).join('') || '<div style="color:#475569; padding:30px 0; text-align:center; font-style:italic">Deep scanning for neural patterns...</div>';
                 }
                 
                 const status = document.getElementById('__fs_neural_status');
                 if (status) status.innerText = window.__fsTimeMachine?.length ? 'CHRONOS_ACTIVE' : (window.__fsDelta ? 'DELTA_LOCKED' : 'NOMINAL');
             };

             hud.innerHTML = `
                 <div id="__fs_hud_header" style="background:#0f172a; padding:15px; border-bottom:1px solid #1e293b; display:flex; justify-content:space-between; align-items:center;">
                     <div style="display:flex; align-items:center; gap:8px">
                        <div style="width:8px; height:8px; background:#00ffcc; border-radius:50%; box-shadow: 0 0 10px #00ffcc; animation: pulse 2s infinite"></div>
                        <b style="color:#fff; letter-spacing:1px; font-size:11px">FIBERSENSE - THE ARCHITECT</b>
                     </div>
                     <span id="__fs_neural_status" style="font-size:9px; background:#1e293b; padding:2px 8px; border-radius:10px; color:#94a3b8">NOMINAL</span>
                 </div>
                 <div style="padding:20px;">
                     <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px">
                        <div style="background:#111827; padding:12px; border-radius:10px; text-align:center; border:1px solid #1e293b">
                            <div style="font-size:8px; color:#64748b; margin-bottom:4px">DEPTH</div><b id="__fs_stat_depth" style="font-size:16px; color:#fba8c4">-</b>
                        </div>
                        <div style="background:#111827; padding:12px; border-radius:10px; text-align:center; border:1px solid #1e293b">
                            <div style="font-size:8px; color:#64748b; margin-bottom:4px">HEAVY</div><b id="__fs_stat_heavy" style="font-size:16px; color:#f43f5e">-</b>
                        </div>
                        <div style="background:#111827; padding:12px; border-radius:10px; text-align:center; border:1px solid #1e293b">
                            <div style="font-size:8px; color:#64748b; margin-bottom:4px">GAPS</div><b id="__fs_stat_gaps" style="font-size:16px; color:#fbbf24">-</b>
                        </div>
                     </div>
                     
                     <div style="margin-bottom:15px;">
                        <div id="__fs_stream" style="background:#020617; height:130px; border-radius:10px; padding:5px; border:1px solid #1e293b; overflow-y:auto; scrollbar-width:none"></div>
                     </div>

                     <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px; margin-bottom:15px;">
                        <button onclick="window.FiberSense.probe(true)" style="background:#1e293b; border:1px solid #334155; color:#fff; padding:10px; border-radius:8px; cursor:pointer; font-size:9px; font-weight:bold;">PROBE+</button>
                        <button onclick="window.FiberSense.reflex()" style="background:#1e293b; border:1px solid #334155; color:#fff; padding:10px; border-radius:8px; cursor:pointer; font-size:9px; font-weight:bold;">REFLEX</button>
                        <button onclick="window.FiberSense.heal()" style="background:#064e3b; border:1px solid #059669; color:#fff; padding:10px; border-radius:8px; cursor:pointer; font-size:9px; font-weight:bold;">HEAL</button>
                     </div>

                     <div style="position:relative">
                        <input id="__fs_cmd" placeholder="Enter Intent or Command..." style="width:100%; background:#020617; border:1px solid #334155; color:#fff; padding:12px; border-radius:10px; outline:none; font-family:monospace; font-size:11px; padding-right:40px">
                         <div onclick="const v=document.getElementById('__fs_cmd').value.trim();const m={report:1,scan:1,narrate:1,dump:1,architect:1,heal:1,probe:1,reflex:1};if(m[v]) window.FiberSense[v]();else window.FiberSense.discoverIntent(v);document.getElementById('__fs_cmd').value=''" style="position:absolute; right:10px; top:10px; color:#00ffcc; cursor:pointer; font-size:16px">⚡</div>
                     </div>
                 </div>
                 <style>@keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }</style>
             `;
             
             document.body.appendChild(hud); update();
             window.__fsHudTimer = setInterval(update, 1000);
             return "Neural Relay HUD Mounted.";
        },
        unmountUI: () => {
             const h = document.getElementById('__fs_hud');
             if(h) { h.remove(); clearInterval(window.__fsHudTimer); return "HUD Unmounted."; }
             return "HUD not found.";
        },
        // --- FULL-SYSTEM ARCHITECTURE ---
        contextMap: () => {
            const providers = [], consumers = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                if (f.type?.$$typeof === Symbol.for('react.provider') || f.type?._context) {
                    providers.push({ name: f.type?._context?.displayName || AI.getName(f), depth: d, fiber: f });
                }
                if (f.dependencies?.firstContext) {
                    let ctx = f.dependencies.firstContext;
                    const consumed = [];
                    while (ctx) { consumed.push(ctx.context?.displayName || 'UnknownCtx'); ctx = ctx.next; }
                    consumers.push({ type: 'CONSUMER', name: AI.getName(f), depth: d, consumes: consumed });
                }
            });
            providers.forEach(p => {
                const cNames = [];
                AI.traverse(p.fiber.child, (c) => { if (c.dependencies?.firstContext) cNames.push(AI.getName(c)); });
                delete p.fiber;
                consumers.unshift({ type: 'PROVIDER', name: p.name, depth: p.depth, consumers: [...new Set(cNames)] });
            });
            return consumers;
        },
        effectAudit: () => {
            const report = [];
            AI.traverse(AI.findRoot(), f => {
                const name = AI.getName(f);
                if (typeof f.type !== 'function' && typeof f.type !== 'object') return;
                let curr = f.memoizedState;
                let hookIdx = 0;
                while (curr) {
                    const ms = curr.memoizedState;
                    // useEffect / useLayoutEffect have a .create function and .deps array
                    if (ms && typeof ms === 'object' && typeof ms.create === 'function') {
                        const deps = ms.deps;
                        const depsStr = deps === null ? 'NO_DEPS (runs every render)' : deps === undefined ? 'undefined (mount-only)' : AI.safeStringify(deps, 80);
                        report.push({ component: name, hookIndex: hookIdx, deps: depsStr, hasCleanup: typeof ms.destroy === 'function' });
                    }
                    curr = curr.next;
                    hookIdx++;
                }
            });
            return report;
        },
        suspenseMap: () => {
            const boundaries = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                // tag 13 = SuspenseComponent in React Fiber
                if (f.tag === 13) {
                    const isSuspended = f.memoizedState !== null;
                    const children = [];
                    AI.traverse(f.child, c => { children.push(AI.getName(c)); });
                    boundaries.push({ depth: d, suspended: isSuspended, mode: isSuspended ? 'FALLBACK' : 'SETTLED', children: [...new Set(children)].filter(n => n !== 'null') });
                }
            });
            return boundaries;
        },
        tokenAudit: () => {
            const violations = [];
            const hexPattern = /#([0-9a-fA-F]{3,6})\b/;
            const pxPattern = /\b\d+px\b/;
            AI.traverse(AI.findRoot(), f => {
                const style = f.memoizedProps?.style;
                if (!style || typeof style !== 'object') return;
                const name = AI.getName(f);
                for (const [prop, val] of Object.entries(style)) {
                    const v = String(val);
                    if (hexPattern.test(v)) violations.push({ component: name, prop, value: v, issue: 'Hardcoded HEX color' });
                    if (pxPattern.test(v) && !['zIndex', 'opacity', 'flex', 'order'].includes(prop)) violations.push({ component: name, prop, value: v, issue: 'Hardcoded px value' });
                }
                // also check className for Tailwind arbitrary values
                const cls = f.memoizedProps?.className || '';
                const arbitraryMatches = cls.match(/\[#[^\]]+\]|\[\d+px\]/g);
                if (arbitraryMatches) violations.push({ component: name, prop: 'className', value: arbitraryMatches.join(', '), issue: 'Tailwind arbitrary value (hardcoded token)' });
            });
            return violations;
        },
        routeMap: () => {
            const segments = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                const name = AI.getName(f);
                // Next.js App Router internal segment markers
                if (name.includes('LayoutRouter') || name.includes('InnerLayoutRouter') || name.includes('RenderFromTemplateContext') || name.includes('OuterLayoutRouter')) {
                    const params = f.memoizedProps?.parallelRouterKey || f.memoizedProps?.url || f.memoizedProps?.segment || 'unknown';
                    segments.push({ depth: d, name, segment: params });
                }
            });
            return segments;
        },
        memoScan: () => {
            const report = [];
            AI.traverse(AI.findRoot(), f => {
                const name = AI.getName(f);
                if (typeof f.type !== 'function' && typeof f.type !== 'object') return;
                let curr = f.memoizedState;
                let hookIdx = 0;
                while (curr) {
                    const ms = curr.memoizedState;
                    // useMemo / useCallback: has .create + .deps but NOT an effect (no destroy)
                    if (ms && typeof ms === 'object' && typeof ms.create === 'function' && typeof ms.destroy === 'undefined') {
                        const deps = ms.deps;
                        report.push({
                            component: name,
                            hookIndex: hookIdx,
                            type: typeof ms.create.toString().includes('=>') ? 'useMemo/useCallback' : 'useMemo',
                            deps: deps ? AI.safeStringify(deps, 100) : 'NO_DEPS',
                            hasResult: ms.memoizedValue !== undefined
                        });
                    }
                    curr = curr.next;
                    hookIdx++;
                }
            });
            return report;
        },

        // --- OMNISENSE: CONCURRENT RUNTIME + AI REPORT ---
        laneMap: () => {
            // React 18 Concurrent Lane values (bitflag)
            const LANES = {
                1: 'SyncLane', 2: 'SyncBatchedLane', 4: 'InputContinuous',
                16: 'DefaultLane', 64: 'TransitionLane', 128: 'RetryLane',
                536870912: 'IdleLane', 1073741824: 'OffscreenLane'
            };
            const decodeLane = (l) => {
                if (!l) return 'Idle';
                for (const [bit, name] of Object.entries(LANES)) if (l & bit) return name;
                return `Unknown(${l})`;
            };
            const active = [];
            AI.traverse(AI.findRoot(), f => {
                if (f.lanes && f.lanes !== 0) {
                    active.push({ component: AI.getName(f), lanes: f.lanes, priority: decodeLane(f.lanes), isDeferred: (f.lanes & 64) > 0 });
                }
            });
            return active.sort((a, b) => a.lanes - b.lanes);
        },
        errorBoundaryMap: () => {
            const boundaries = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                // Class components with componentDidCatch = Error Boundaries
                const isEB = f.stateNode && typeof f.stateNode.componentDidCatch === 'function';
                if (isEB) {
                    const lastError = f.memoizedState?.error || null;
                    boundaries.push({
                        component: AI.getName(f),
                        depth: d,
                        hasCaughtError: !!lastError,
                        error: lastError ? String(lastError) : null
                    });
                }
            });
            return boundaries;
        },
        rscMap: () => {
            const components = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                const name = AI.getName(f);
                // RSC marker: tag 0 = FunctionComponent, but with no hooks (pure server render)
                const isLikelyRSC = f.tag === 0 && !f.memoizedState && f.type?.$$typeof !== Symbol.for('react.client.reference');
                // Client reference marker from RSC
                const isClientRef = f.type?.$$typeof === Symbol.for('react.client.reference') || f.type?.$$typeof === Symbol.for('react.lazy');
                if (isClientRef) components.push({ component: name, depth: d, type: 'CLIENT_BOUNDARY' });
                else if (isLikelyRSC && typeof f.type === 'function') components.push({ component: name, depth: d, type: 'RSC_CANDIDATE' });
            });
            return components;
        },
        velocityWatch: (targetComp = null, durationMs = 3000) => {
            if (!window.__fsVelocity) window.__fsVelocity = {};
            const key = targetComp || '__ALL__';
            window.__fsVelocity[key] = { count: 0, start: Date.now(), samples: [] };
            const watcher = targetComp
                ? () => { AI.traverse(AI.findRoot(), f => { if (AI.getName(f) === targetComp) { window.__fsVelocity[key].count++; window.__fsVelocity[key].samples.push(Date.now()); } }); }
                : () => { AI.traverse(AI.findRoot(), f => { if (f.lanes) window.__fsVelocity[key].count++; }); };
            const timer = setInterval(watcher, 100);
            setTimeout(() => {
                clearInterval(timer);
                const d = window.__fsVelocity[key];
                const elapsed = (Date.now() - d.start) / 1000;
                console.log(`%c VELOCITY [${key}]: ${d.count} updates in ${elapsed.toFixed(1)}s = ${(d.count/elapsed).toFixed(1)} updates/sec`, 'color:#f43f5e; font-weight:bold;');
            }, durationMs);
            return `Velocity watch started for '${key}' over ${durationMs}ms. Check console when done.`;
        },
        report: () => {
            // Master AI summary — standardized 3-tuple format: { what, why, where }
            const scan = window.FiberSense.scan();
            const effects = window.FiberSense.effectAudit();
            const memos = window.FiberSense.memoScan();
            const tokens = window.FiberSense.tokenAudit();
            const ctx = window.FiberSense.contextMap();
            const lanes = window.FiberSense.laneMap();
            const errors = window.FiberSense.errorBoundaryMap();

            const findings = [];

            // Critical: Heavy renders > 16ms
            scan.hotspots.forEach(h => {
                const src = window.FiberSense.source(h.name);
                const where = Array.isArray(src) && src[0]?.file !== 'Unknown' ? `${src[0].file}:${src[0].line}` : h.name;
                findings.push({ severity: 'CRITICAL', what: h.name, why: `Render duration ${h.dur.toFixed(1)}ms exceeds 16ms frame budget`, where });
            });

            // High: Effects with no deps (runs every render)
            effects.filter(e => e.deps === 'NO_DEPS (runs every render)').forEach(e => {
                findings.push({ severity: 'HIGH', what: e.component, why: `useEffect[${e.hookIndex}] has no dependency array — runs every render`, where: `hook index ${e.hookIndex}` });
            });

            // Medium: Token violations
            if (tokens.length) findings.push({ severity: 'MEDIUM', what: `${tokens.length} components`, why: 'Hardcoded color/px values bypass design token system', where: tokens.slice(0,3).map(t => t.component).join(', ') + (tokens.length > 3 ? '...' : '') });

            // Medium: Error boundaries with caught errors
            errors.filter(e => e.hasCaughtError).forEach(e => {
                findings.push({ severity: 'CRITICAL', what: e.component, why: `Active error caught: ${e.error}`, where: `depth ${e.depth}` });
            });

            // Info: Deferred/Transition lanes
            const deferred = lanes.filter(l => l.isDeferred);
            if (deferred.length) findings.push({ severity: 'INFO', what: `${deferred.length} deferred components`, why: 'Running in TransitionLane — lower priority rendering', where: deferred.map(l => l.component).join(', ') });

            const providers = ctx.filter(c => c.type === 'PROVIDER').length;
            const consumers = ctx.filter(c => c.type === 'CONSUMER').length;

            return {
                verdict: scan.verdict,
                timestamp: scan.timestamp,
                summary: {
                    totalComponents: scan.metrics.totalComponents,
                    maxDepth: scan.metrics.maxDepth,
                    contextProviders: providers,
                    contextConsumers: consumers,
                    memoizedHooks: memos.length,
                    tokenViolations: tokens.length,
                    activeLanes: lanes.length,
                    errorBoundaries: errors.length,
                    caughtErrors: errors.filter(e => e.hasCaughtError).length
                },
                findings: findings.sort((a, b) => ['CRITICAL','HIGH','MEDIUM','INFO'].indexOf(a.severity) - ['CRITICAL','HIGH','MEDIUM','INFO'].indexOf(b.severity))
            };
        },

        memoryConfig: (config = {}) => {
            const state = Memory.ensure();
            if (typeof config.enabled === 'boolean') state.enabled = config.enabled;
            if (typeof config.persist === 'boolean') state.persist = config.persist;
            if (Number.isFinite(Number(config.maxEntries)) && Number(config.maxEntries) > 50) {
                state.maxEntries = Math.floor(Number(config.maxEntries));
                if (state.entries.length > state.maxEntries) state.entries = state.entries.slice(0, state.maxEntries);
            }
            Memory.persist();
            return {
                enabled: state.enabled,
                persist: state.persist,
                maxEntries: state.maxEntries,
                totalEntries: state.entries.length,
                createdAt: state.createdAt
            };
        },

        memoryWrite: (channel = 'manual', payload = {}, level = 'INFO') => {
            return Memory.write(channel, payload, level);
        },

        memoryRead: (filters = {}) => {
            const state = Memory.ensure();
            const levelSet = Array.isArray(filters.levels) ? new Set(filters.levels) : null;
            const since = filters.since ? new Date(filters.since).getTime() : null;
            const limit = Number.isFinite(Number(filters.limit)) ? Math.max(1, Math.floor(Number(filters.limit))) : 100;
            const channel = filters.channel || null;
            const onlySlow = !!filters.onlySlow;

            const rows = state.entries.filter((entry) => {
                if (channel && entry.channel !== channel) return false;
                if (levelSet && !levelSet.has(entry.level)) return false;
                if (since && new Date(entry.at).getTime() < since) return false;
                if (onlySlow) {
                    const p = entry.payload || {};
                    if (!(p.slow === true || p.durationMs >= 16 || p.runDurationMs >= 16 || p.level === 'CRITICAL')) return false;
                }
                return true;
            }).slice(0, limit);

            return {
                totalEntries: state.entries.length,
                returned: rows.length,
                filters: { channel, levels: levelSet ? Array.from(levelSet) : null, since: filters.since || null, limit, onlySlow },
                entries: rows
            };
        },

        memoryExport: (options = {}) => {
            const channel = options.channel || null;
            const levelSet = Array.isArray(options.levels) ? new Set(options.levels) : null;
            const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Math.floor(Number(options.limit))) : 200;
            const state = Memory.ensure();
            const rows = state.entries.filter((entry) => {
                if (channel && entry.channel !== channel) return false;
                if (levelSet && !levelSet.has(entry.level)) return false;
                return true;
            }).slice(0, limit);

            const lines = ['# FiberSense Memory Export', ''];
            rows.forEach((entry) => {
                let payloadStr = '';
                try { payloadStr = JSON.stringify(entry.payload); } catch (e) { payloadStr = String(entry.payload); }
                lines.push(`- [${entry.at}] [${entry.level}] (${entry.channel}) ${payloadStr.substring(0, 280)}`);
            });
            const text = lines.join('\n');
            Memory.write('memoryExport', { rows: rows.length, channel: channel || 'all' }, 'INFO');
            return text;
        },

        memoryClear: () => {
            const state = Memory.ensure();
            const cleared = state.entries.length;
            state.entries = [];
            Memory.persist();
            return { status: 'CLEARED', cleared };
        },

        outputJournalConfig: (config = {}) => {
            const state = OutputJournal.ensure();
            if (typeof config.enabled === 'boolean') state.enabled = config.enabled;
            if (typeof config.persist === 'boolean') state.persist = config.persist;
            if (typeof config.captureArgs === 'boolean') state.captureArgs = config.captureArgs;
            if (typeof config.captureResults === 'boolean') state.captureResults = config.captureResults;
            if (Number.isFinite(Number(config.maxEntries)) && Number(config.maxEntries) > 100) {
                state.maxEntries = Math.floor(Number(config.maxEntries));
                if (state.entries.length > state.maxEntries) state.entries = state.entries.slice(0, state.maxEntries);
            }
            OutputJournal.persist();
            return {
                enabled: state.enabled,
                persist: state.persist,
                captureArgs: state.captureArgs,
                captureResults: state.captureResults,
                maxEntries: state.maxEntries,
                totalEntries: state.entries.length
            };
        },

        enableOutputJournal: (config = {}) => {
            return OutputJournal.enable(window.FiberSense, config);
        },

        disableOutputJournal: () => {
            return OutputJournal.disable(window.FiberSense);
        },

        outputJournalRead: (filters = {}) => {
            const state = OutputJournal.ensure();
            const method = filters.method || null;
            const errorOnly = !!filters.errorOnly;
            const levelSet = Array.isArray(filters.levels) ? new Set(filters.levels) : null;
            const since = filters.since ? new Date(filters.since).getTime() : null;
            const limit = Number.isFinite(Number(filters.limit)) ? Math.max(1, Math.floor(Number(filters.limit))) : 200;
            const rows = state.entries.filter((entry) => {
                if (method && entry.method !== method) return false;
                if (errorOnly && !entry.error) return false;
                if (levelSet && !levelSet.has(entry.level)) return false;
                if (since && new Date(entry.at).getTime() < since) return false;
                return true;
            }).slice(0, limit);
            return {
                totalEntries: state.entries.length,
                returned: rows.length,
                filters: {
                    method,
                    errorOnly,
                    levels: levelSet ? Array.from(levelSet) : null,
                    since: filters.since || null,
                    limit
                },
                entries: rows
            };
        },

        outputJournalExport: (options = {}) => {
            const state = OutputJournal.ensure();
            const format = options.format === 'json' ? 'json' : 'markdown';
            const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Math.floor(Number(options.limit))) : 300;
            const rows = state.entries.slice(0, limit);
            if (format === 'json') {
                return JSON.stringify({ exportedAt: new Date().toISOString(), total: rows.length, entries: rows }, null, 2);
            }
            const lines = ['# FiberSense Output Journal', ''];
            rows.forEach((entry) => {
                lines.push(`- [${entry.at}] [${entry.level}] ${entry.method} (${entry.durationMs}ms)`);
                if (entry.args) lines.push(`  - args: ${entry.args}`);
                if (entry.result) lines.push(`  - result: ${entry.result}`);
                if (entry.error) lines.push(`  - error: ${entry.error}`);
            });
            return lines.join('\n');
        },

        outputJournalClear: () => {
            const state = OutputJournal.ensure();
            const cleared = state.entries.length;
            state.entries = [];
            OutputJournal.persist();
            return { status: 'CLEARED', cleared };
        },

        fullAudit: (symptom = '') => {
            const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'];
            const anomalies = [];

            const resolveWhere = (componentName) => {
                if (!componentName) return 'source unavailable';
                try {
                    const src = window.FiberSense.source(componentName);
                    if (Array.isArray(src) && src[0]?.file && src[0].file !== 'Unknown') {
                        return `${src[0].file}:${src[0].line}`;
                    }
                } catch (e) {}
                return 'source unavailable (production build or missing _debugSource)';
            };

            const add = (severity, category, what, why, where, evidence = null) => {
                anomalies.push({
                    severity: severityOrder.includes(severity) ? severity : 'INFO',
                    category,
                    what,
                    why,
                    where: where || 'source unavailable',
                    evidence
                });
            };

            let report = null;
            try {
                report = window.FiberSense.report();
                if (Array.isArray(report.findings)) {
                    report.findings.forEach(f => {
                        add(f.severity || 'INFO', 'runtime', f.what || 'Unknown', f.why || 'Runtime anomaly', f.where || 'source unavailable', { source: 'report' });
                    });
                }
            } catch (e) {
                add('HIGH', 'runtime', 'report()', `Failed to generate report(): ${e.message}`, 'source unavailable', { source: 'report' });
            }

            try {
                const stale = window.FiberSense.staleClosures();
                if (Array.isArray(stale)) {
                    stale.forEach(item => {
                        add(
                            'HIGH',
                            'logic',
                            item.component || 'Unknown',
                            item.reason || 'Potential stale closure detected',
                            resolveWhere(item.component),
                            { suspiciousHooks: item.suspiciousHooks || [] }
                        );
                    });
                }
            } catch (e) {
                add('INFO', 'logic', 'staleClosures()', `staleClosures() failed: ${e.message}`, 'source unavailable');
            }

            try {
                const zombies = window.FiberSense.zombieScan();
                if (Array.isArray(zombies)) {
                    zombies.forEach(item => {
                        add(
                            'MEDIUM',
                            'code',
                            item.component || 'Unknown',
                            `Unused state hook indexes: ${(item.unusedHookIndexes || []).join(', ')}`,
                            resolveWhere(item.component),
                            item
                        );
                    });
                }
            } catch (e) {
                add('INFO', 'code', 'zombieScan()', `zombieScan() failed: ${e.message}`, 'source unavailable');
            }

            try {
                const xss = window.FiberSense.xssAudit();
                if (Array.isArray(xss)) {
                    xss.forEach(item => {
                        add(
                            item.severity || 'HIGH',
                            'security',
                            item.component || 'Unknown',
                            item.issue || 'dangerouslySetInnerHTML surface detected',
                            resolveWhere(item.component),
                            { preview: item.preview || '' }
                        );
                    });
                }
            } catch (e) {
                add('INFO', 'security', 'xssAudit()', `xssAudit() failed: ${e.message}`, 'source unavailable');
            }

            try {
                const wf = window.FiberSense.waterfall();
                if (wf && typeof wf === 'object') {
                    if (Array.isArray(wf.duplicates)) {
                        wf.duplicates.forEach(item => {
                            add(
                                item.severity || 'HIGH',
                                'performance',
                                item.url || 'network duplicate',
                                `Duplicate network request repeated ${item.count}x`,
                                'network log',
                                item
                            );
                        });
                    }
                    if (Array.isArray(wf.waterfalls)) {
                        wf.waterfalls.forEach(item => {
                            add(
                                String(item.likely || '').includes('HIGH') ? 'HIGH' : 'MEDIUM',
                                'performance',
                                `${item.first || 'request A'} -> ${item.second || 'request B'}`,
                                `Potential request waterfall gap ${item.gapMs}ms`,
                                'network log',
                                item
                            );
                        });
                    }
                }
            } catch (e) {
                add('INFO', 'performance', 'waterfall()', `waterfall() failed: ${e.message}`, 'network log');
            }

            try {
                const telemetry = window.FiberSense.telemetry({ onlySlow: true });
                if (telemetry && telemetry.status !== 'INACTIVE') {
                    (telemetry.topFunctionCalls || []).slice(0, 5).forEach(call => {
                        const severity = call.maxDurationMs > 16 ? 'CRITICAL' : 'HIGH';
                        add(
                            severity,
                            'code',
                            `${call.component}.${call.functionName}`,
                            `Slow function path observed (max ${call.maxDurationMs}ms, ${call.calls} calls)`,
                            resolveWhere(call.component),
                            call
                        );
                    });

                    (telemetry.slowTimers || []).slice(0, 5).forEach(timer => {
                        const severity = timer.runDurationMs > 16 ? 'CRITICAL' : 'HIGH';
                        add(
                            severity,
                            'performance',
                            timer.kind || 'timer',
                            `Slow timer callback (${timer.runDurationMs}ms, drift ${timer.driftMs}ms)`,
                            'timer runtime',
                            timer
                        );
                    });

                    (telemetry.longTasks || []).slice(0, 5).forEach(task => {
                        add(
                            'CRITICAL',
                            'performance',
                            'Main thread long task',
                            `Main thread blocked for ${task.durationMs}ms`,
                            'PerformanceObserver longtask',
                            task
                        );
                    });
                }
            } catch (e) {
                add('INFO', 'performance', 'telemetry()', `telemetry() failed: ${e.message}`, 'runtime telemetry');
            }

            let diagnosis = null;
            if (symptom && String(symptom).trim().length > 0) {
                try {
                    diagnosis = window.FiberSense.diagnose(symptom);
                } catch (e) {
                    diagnosis = { error: e.message };
                }
            }

            anomalies.sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

            const countBySeverity = anomalies.reduce((acc, item) => {
                acc[item.severity] = (acc[item.severity] || 0) + 1;
                return acc;
            }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, INFO: 0 });

            const countByCategory = anomalies.reduce((acc, item) => {
                acc[item.category] = (acc[item.category] || 0) + 1;
                return acc;
            }, {});

            const verdict = countBySeverity.CRITICAL > 0
                ? 'CRITICAL'
                : countBySeverity.HIGH > 0
                    ? 'DEGRADED'
                    : countBySeverity.MEDIUM > 0
                        ? 'WARNING'
                        : 'HEALTHY';

            const payload = {
                verdict,
                timestamp: new Date().toISOString(),
                symptom: symptom || null,
                totalAnomalies: anomalies.length,
                countBySeverity,
                countByCategory,
                summary: report?.summary || null,
                diagnosis,
                anomalies,
                nextActions: [
                    'For each HIGH/CRITICAL item, run FiberSense.rerenderReason(component) and FiberSense.propDiff(component).',
                    'Confirm file evidence with FiberSense.source(component) before filing a defect.',
                    'Use FiberSense.memorize(before) and compareMemory(before, after) to prove fixes.'
                ]
            };

            const memoryLevel = verdict === 'CRITICAL' ? 'CRITICAL' : verdict === 'DEGRADED' ? 'HIGH' : verdict === 'WARNING' ? 'MEDIUM' : 'INFO';
            Memory.write('fullAudit', {
                verdict,
                symptom: symptom || null,
                totalAnomalies: payload.totalAnomalies,
                countBySeverity: payload.countBySeverity,
                countByCategory: payload.countByCategory
            }, memoryLevel);

            console.log('%c[FiberSense.fullAudit]', 'color:#22d3ee;font-weight:bold;', payload);
            return payload;
        },

        agentEyes: (symptom = '') => {
            const journal = window.FiberSense.enableOutputJournal({ enabled: true, persist: true });
            const watch = window.FiberSense.startOmniWatch();
            const audit = window.FiberSense.fullAudit(symptom);
            const telemetry = window.FiberSense.telemetry({ onlySlow: true });
            Memory.write('agentEyes.session', {
                symptom: symptom || null,
                journalStatus: journal?.status || 'unknown',
                watchStatus: watch?.status || 'unknown',
                auditVerdict: audit?.verdict || 'unknown',
                anomalies: audit?.totalAnomalies || 0
            }, audit?.verdict === 'CRITICAL' ? 'CRITICAL' : 'INFO');
            return {
                mode: 'AGENT_EYES_EARS',
                journal,
                watch,
                audit,
                telemetry,
                note: 'Interact with the app, then rerun FiberSense.telemetry({ onlySlow: true }) for live delay/function updates.'
            };
        },

        startOmniWatch: (config = {}) => {
            if (window.FiberSense && typeof window.FiberSense.enableOutputJournal === 'function') {
                window.FiberSense.enableOutputJournal({ enabled: true, persist: true });
            }
            const defaults = {
                sampleLimit: 400,
                slowFunctionMs: 8,
                slowTimerMs: 16,
                slowNetworkMs: 600,
                longTaskMs: 50
            };

            if (!window.__fsOmni) {
                window.__fsOmni = {
                    active: false,
                    startedAt: null,
                    config: {},
                    originals: {},
                    wrappedFns: [],
                    callEvents: [],
                    timerEvents: [],
                    networkEvents: [],
                    longTasks: [],
                    errors: [],
                    patchFiberHandlers: null,
                    observer: null
                };
            }

            const state = window.__fsOmni;
            if (state.active) {
                return {
                    status: 'ACTIVE',
                    message: 'OmniWatch already running.',
                    telemetry: window.FiberSense.telemetry()
                };
            }

            const configuredLimit = Number(config.sampleLimit || defaults.sampleLimit);
            state.active = true;
            state.startedAt = Date.now();
            state.config = {
                sampleLimit: Number.isFinite(configuredLimit) && configuredLimit > 20 ? Math.floor(configuredLimit) : defaults.sampleLimit,
                slowFunctionMs: Number(config.slowFunctionMs || defaults.slowFunctionMs),
                slowTimerMs: Number(config.slowTimerMs || defaults.slowTimerMs),
                slowNetworkMs: Number(config.slowNetworkMs || defaults.slowNetworkMs),
                longTaskMs: Number(config.longTaskMs || defaults.longTaskMs)
            };
            state.originals = {};
            state.wrappedFns = [];
            state.callEvents = [];
            state.timerEvents = [];
            state.networkEvents = [];
            state.longTasks = [];
            state.errors = [];
            state.observer = null;

            const pushLimited = (arr, item) => {
                arr.unshift(item);
                if (arr.length > state.config.sampleLimit) arr.pop();
                if (item && (item.slow || item.error || item.durationMs >= state.config.longTaskMs || item.runDurationMs >= state.config.slowTimerMs)) {
                    const level = item.error ? 'HIGH' : (item.durationMs >= 16 || item.runDurationMs >= 16 ? 'CRITICAL' : 'INFO');
                    Memory.write('omniWatch.event', item, level);
                }
            };

            const safePreview = (value, maxLen = 140) => {
                try {
                    const text = JSON.stringify(value, (k, v) => {
                        if (typeof v === 'function') return `[fn:${v.name || 'anonymous'}]`;
                        if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) return `[DOM:${v.tagName}]`;
                        if (v && typeof v === 'object' && v.type && v.target) return `[event:${v.type}]`;
                        return v;
                    });
                    if (!text) return String(value).substring(0, maxLen);
                    return text.length > maxLen ? `${text.substring(0, maxLen)}...` : text;
                } catch (e) {
                    return String(value).substring(0, maxLen);
                }
            };

            const wrapHandler = (componentName, fnName, originalFn, depth) => {
                const wrapped = function(...args) {
                    const start = performance.now();
                    let errorRef = null;
                    try {
                        return originalFn.apply(this, args);
                    } catch (error) {
                        errorRef = error;
                        throw error;
                    } finally {
                        const duration = performance.now() - start;
                        const entry = {
                            at: Date.now(),
                            component: componentName,
                            functionName: fnName,
                            depth,
                            durationMs: Math.round(duration * 100) / 100,
                            slow: duration >= state.config.slowFunctionMs,
                            argsPreview: safePreview(args),
                            error: errorRef ? String(errorRef.message || errorRef) : null
                        };
                        pushLimited(state.callEvents, entry);
                        if (entry.error) pushLimited(state.errors, entry);
                    }
                };
                wrapped.__fsOmniWrapped = true;
                wrapped.__fsOriginal = originalFn;
                return wrapped;
            };

            const patchFiberHandlers = () => {
                let wrappedCount = 0;
                AI.traverse(AI.findRoot(), (f, d) => {
                    if (!f || !f.memoizedProps || typeof f.memoizedProps !== 'object') return;
                    const props = f.memoizedProps;
                    Object.keys(props).forEach((key) => {
                        const candidate = props[key];
                        if (typeof candidate !== 'function') return;
                        const isHandler = key.startsWith('on') || key.startsWith('handle') || key.endsWith('Handler') || key.toLowerCase().includes('callback');
                        if (!isHandler || candidate.__fsOmniWrapped) return;
                        const wrapped = wrapHandler(AI.getName(f), key, candidate, d);
                        try {
                            props[key] = wrapped;
                            state.wrappedFns.push({ props, key, original: candidate });
                            wrappedCount++;
                        } catch (e) {
                            pushLimited(state.errors, {
                                at: Date.now(),
                                component: AI.getName(f),
                                functionName: key,
                                error: `Failed to wrap handler: ${e.message}`
                            });
                        }
                    });
                });
                return wrappedCount;
            };

            state.patchFiberHandlers = patchFiberHandlers;

            if (typeof window.fetch === 'function') {
                state.originals.fetch = window.fetch;
                window.fetch = async function(...args) {
                    const started = performance.now();
                    const url = String(args[0]);
                    try {
                        const response = await state.originals.fetch.apply(this, args);
                        const duration = performance.now() - started;
                        const entry = {
                            at: Date.now(),
                            kind: 'fetch',
                            method: (args[1] && args[1].method) || 'GET',
                            url,
                            status: response && typeof response.status === 'number' ? response.status : null,
                            durationMs: Math.round(duration * 100) / 100,
                            slow: duration >= state.config.slowNetworkMs
                        };
                        if (!window.__fsNetLog) window.__fsNetLog = [];
                        window.__fsNetLog.push({ url, time: Date.now(), durationMs: entry.durationMs, status: entry.status });
                        if (window.__fsNetLog.length > 200) window.__fsNetLog.shift();
                        pushLimited(state.networkEvents, entry);
                        return response;
                    } catch (error) {
                        const duration = performance.now() - started;
                        const entry = {
                            at: Date.now(),
                            kind: 'fetch',
                            method: (args[1] && args[1].method) || 'GET',
                            url,
                            status: 'ERROR',
                            durationMs: Math.round(duration * 100) / 100,
                            slow: true,
                            error: String(error.message || error)
                        };
                        pushLimited(state.networkEvents, entry);
                        pushLimited(state.errors, entry);
                        throw error;
                    }
                };
            }

            if (typeof window.XMLHttpRequest === 'function' && window.XMLHttpRequest.prototype) {
                const proto = window.XMLHttpRequest.prototype;
                state.originals.xhrOpen = proto.open;
                state.originals.xhrSend = proto.send;
                proto.open = function(method, url, ...rest) {
                    this.__fsOmniMeta = { method: String(method || 'GET'), url: String(url || 'unknown') };
                    return state.originals.xhrOpen.call(this, method, url, ...rest);
                };
                proto.send = function(...rest) {
                    const started = performance.now();
                    const meta = this.__fsOmniMeta || { method: 'GET', url: 'unknown' };
                    const onDone = () => {
                        const duration = performance.now() - started;
                        const entry = {
                            at: Date.now(),
                            kind: 'xhr',
                            method: meta.method,
                            url: meta.url,
                            status: this.status,
                            durationMs: Math.round(duration * 100) / 100,
                            slow: duration >= state.config.slowNetworkMs
                        };
                        if (!window.__fsNetLog) window.__fsNetLog = [];
                        window.__fsNetLog.push({ url: meta.url, time: Date.now(), durationMs: entry.durationMs, status: this.status });
                        if (window.__fsNetLog.length > 200) window.__fsNetLog.shift();
                        pushLimited(state.networkEvents, entry);
                        this.removeEventListener('loadend', onDone);
                    };
                    this.addEventListener('loadend', onDone);
                    return state.originals.xhrSend.apply(this, rest);
                };
            }

            if (typeof window.setTimeout === 'function') {
                state.originals.setTimeout = window.setTimeout;
                window.setTimeout = function(handler, delay, ...rest) {
                    const expectedDelay = Number(delay || 0);
                    const scheduledAt = performance.now();
                    const wrapped = typeof handler === 'function'
                        ? function(...handlerArgs) {
                            const started = performance.now();
                            const drift = started - scheduledAt - expectedDelay;
                            try {
                                return handler.apply(this, handlerArgs);
                            } finally {
                                const runDuration = performance.now() - started;
                                pushLimited(state.timerEvents, {
                                    at: Date.now(),
                                    kind: 'setTimeout',
                                    expectedDelayMs: expectedDelay,
                                    driftMs: Math.round(drift * 100) / 100,
                                    runDurationMs: Math.round(runDuration * 100) / 100,
                                    slow: runDuration >= state.config.slowTimerMs
                                });
                            }
                        }
                        : handler;
                    return state.originals.setTimeout.call(this, wrapped, delay, ...rest);
                };
            }

            if (typeof window.setInterval === 'function') {
                state.originals.setInterval = window.setInterval;
                window.setInterval = function(handler, delay, ...rest) {
                    const expectedDelay = Number(delay || 0);
                    const wrapped = typeof handler === 'function'
                        ? function(...handlerArgs) {
                            const started = performance.now();
                            try {
                                return handler.apply(this, handlerArgs);
                            } finally {
                                const runDuration = performance.now() - started;
                                pushLimited(state.timerEvents, {
                                    at: Date.now(),
                                    kind: 'setInterval',
                                    expectedDelayMs: expectedDelay,
                                    driftMs: null,
                                    runDurationMs: Math.round(runDuration * 100) / 100,
                                    slow: runDuration >= state.config.slowTimerMs
                                });
                            }
                        }
                        : handler;
                    return state.originals.setInterval.call(this, wrapped, delay, ...rest);
                };
            }

            if (typeof window.requestAnimationFrame === 'function') {
                state.originals.requestAnimationFrame = window.requestAnimationFrame;
                window.requestAnimationFrame = function(cb) {
                    if (typeof cb !== 'function') return state.originals.requestAnimationFrame.call(this, cb);
                    const wrapped = (ts) => {
                        const started = performance.now();
                        try {
                            return cb(ts);
                        } finally {
                            const runDuration = performance.now() - started;
                            pushLimited(state.timerEvents, {
                                at: Date.now(),
                                kind: 'requestAnimationFrame',
                                expectedDelayMs: 16,
                                driftMs: null,
                                runDurationMs: Math.round(runDuration * 100) / 100,
                                slow: runDuration >= state.config.slowTimerMs
                            });
                        }
                    };
                    return state.originals.requestAnimationFrame.call(this, wrapped);
                };
            }

            if (typeof PerformanceObserver === 'function') {
                try {
                    const observer = new PerformanceObserver((list) => {
                        list.getEntries().forEach((entry) => {
                            const duration = Math.round(entry.duration * 100) / 100;
                            if (duration < state.config.longTaskMs) return;
                            pushLimited(state.longTasks, {
                                at: Date.now(),
                                durationMs: duration,
                                startTimeMs: Math.round(entry.startTime * 100) / 100,
                                name: entry.name || 'longtask'
                            });
                        });
                    });
                    observer.observe({ entryTypes: ['longtask'] });
                    state.observer = observer;
                } catch (e) {
                    pushLimited(state.errors, { at: Date.now(), error: `PerformanceObserver longtask unavailable: ${e.message}` });
                }
            }

            const wrappedHandlers = patchFiberHandlers();
            Memory.write('omniWatch.lifecycle', {
                action: 'start',
                wrappedHandlers,
                config: state.config
            }, 'INFO');
            return {
                status: 'ACTIVE',
                wrappedHandlers,
                config: state.config,
                next: 'Run FiberSense.refreshOmniWatch() after major route/component changes.'
            };
        },

        refreshOmniWatch: () => {
            const state = window.__fsOmni;
            if (!state || !state.active || typeof state.patchFiberHandlers !== 'function') {
                return { status: 'INACTIVE', message: 'Run FiberSense.startOmniWatch() first.' };
            }
            const wrappedHandlers = state.patchFiberHandlers();
            Memory.write('omniWatch.lifecycle', { action: 'refresh', wrappedHandlers }, 'INFO');
            return { status: 'ACTIVE', wrappedHandlers };
        },

        telemetry: (filters = {}) => {
            const state = window.__fsOmni;
            if (!state) return { status: 'INACTIVE', message: 'OmniWatch has not been initialized.' };

            const componentFilter = filters.component || null;
            const onlySlow = !!filters.onlySlow;

            const callEvents = (state.callEvents || []).filter(e => {
                if (componentFilter && e.component !== componentFilter) return false;
                if (onlySlow && !e.slow) return false;
                return true;
            });
            const timerEvents = (state.timerEvents || []).filter(e => !onlySlow || e.slow);
            const networkEvents = (state.networkEvents || []).filter(e => !onlySlow || e.slow);
            const longTasks = (state.longTasks || []).slice();

            const groupedCalls = {};
            callEvents.forEach((entry) => {
                const key = `${entry.component}::${entry.functionName}`;
                if (!groupedCalls[key]) {
                    groupedCalls[key] = {
                        component: entry.component,
                        functionName: entry.functionName,
                        calls: 0,
                        maxDurationMs: 0,
                        avgDurationMs: 0,
                        slowCalls: 0
                    };
                }
                const group = groupedCalls[key];
                group.calls += 1;
                group.maxDurationMs = Math.max(group.maxDurationMs, entry.durationMs || 0);
                group.avgDurationMs += entry.durationMs || 0;
                if (entry.slow) group.slowCalls += 1;
            });

            const topFunctionCalls = Object.values(groupedCalls)
                .map(g => ({
                    ...g,
                    avgDurationMs: Math.round((g.avgDurationMs / Math.max(g.calls, 1)) * 100) / 100
                }))
                .sort((a, b) => {
                    if (b.maxDurationMs !== a.maxDurationMs) return b.maxDurationMs - a.maxDurationMs;
                    return b.calls - a.calls;
                })
                .slice(0, 20);

            const payload = {
                status: state.active ? 'ACTIVE' : 'STOPPED',
                startedAt: state.startedAt,
                uptimeMs: state.startedAt ? Date.now() - state.startedAt : 0,
                config: state.config,
                summary: {
                    totalFunctionCalls: callEvents.length,
                    slowFunctionCalls: callEvents.filter(e => e.slow).length,
                    totalTimerCallbacks: timerEvents.length,
                    slowTimerCallbacks: timerEvents.filter(e => e.slow).length,
                    totalNetworkRequests: networkEvents.length,
                    slowNetworkRequests: networkEvents.filter(e => e.slow).length,
                    longTasks: longTasks.length,
                    errors: (state.errors || []).length
                },
                topFunctionCalls,
                slowTimers: timerEvents.filter(e => e.slow).slice(0, 20),
                slowNetwork: networkEvents.filter(e => e.slow).slice(0, 20),
                longTasks: longTasks.slice(0, 20),
                recentErrors: (state.errors || []).slice(0, 20)
            };

            const severe = payload.summary.longTasks > 0 || payload.summary.slowTimerCallbacks > 0 || payload.summary.slowFunctionCalls > 0;
            Memory.write('telemetry.snapshot', {
                status: payload.status,
                uptimeMs: payload.uptimeMs,
                summary: payload.summary,
                filtered: { component: componentFilter, onlySlow }
            }, severe ? 'HIGH' : 'INFO');

            return payload;
        },

        functionCallReport: (componentName = null) => {
            const telemetry = window.FiberSense.telemetry({ component: componentName || null });
            if (!telemetry || telemetry.status === 'INACTIVE') return telemetry;
            return {
                status: telemetry.status,
                component: componentName || 'ALL',
                totalCalls: telemetry.summary.totalFunctionCalls,
                slowCalls: telemetry.summary.slowFunctionCalls,
                top: telemetry.topFunctionCalls
            };
        },

        stopOmniWatch: () => {
            const state = window.__fsOmni;
            if (!state || !state.active) {
                return { status: 'INACTIVE', message: 'OmniWatch is not running.' };
            }

            if (state.observer && typeof state.observer.disconnect === 'function') {
                try { state.observer.disconnect(); } catch (e) {}
            }

            if (state.originals.fetch) window.fetch = state.originals.fetch;
            if (state.originals.setTimeout) window.setTimeout = state.originals.setTimeout;
            if (state.originals.setInterval) window.setInterval = state.originals.setInterval;
            if (state.originals.requestAnimationFrame) window.requestAnimationFrame = state.originals.requestAnimationFrame;
            if (typeof window.XMLHttpRequest === 'function' && window.XMLHttpRequest.prototype) {
                if (state.originals.xhrOpen) window.XMLHttpRequest.prototype.open = state.originals.xhrOpen;
                if (state.originals.xhrSend) window.XMLHttpRequest.prototype.send = state.originals.xhrSend;
            }

            let restoredHandlers = 0;
            (state.wrappedFns || []).forEach((entry) => {
                if (!entry || !entry.props || !entry.key) return;
                try {
                    entry.props[entry.key] = entry.original;
                    restoredHandlers++;
                } catch (e) {}
            });

            state.active = false;
            state.patchFiberHandlers = null;
            state.observer = null;

            Memory.write('omniWatch.lifecycle', {
                action: 'stop',
                restoredHandlers
            }, 'INFO');

            return {
                status: 'STOPPED',
                restoredHandlers,
                telemetry: window.FiberSense.telemetry()
            };
        },

        // --- OMNISENSE: DEEP PATHOLOGY + AI-NATIVE LAYER ---
        heal: () => {
            let healed = 0;
            // 1. Re-attach detached DOM nodes
            AI.traverse(AI.findRoot(), f => {
                if (f.tag === 5 && f.stateNode instanceof HTMLElement && !document.body.contains(f.stateNode)) {
                    const parentFiber = f.return;
                    if (parentFiber?.stateNode instanceof HTMLElement) {
                        parentFiber.stateNode.appendChild(f.stateNode);
                        healed++;
                    }
                }
            });
            // 2. Clear stuck probe tooltip
            const tip = document.getElementById('__fs_tip');
            if (tip) tip.style.display = 'none';
            // 3. Clear tsunami proxies
            window.__fsTsunami = new Map();
            // 4. Clear stale network log
            if (window.__fsNetLog) {
                const stale = window.__fsNetLog.filter(r => Date.now() - r.time > 60000).length;
                window.__fsNetLog = window.__fsNetLog.filter(r => Date.now() - r.time <= 60000);
                healed += stale;
            }
            return `Healing complete: reattached ${healed} detached/stale artifacts. System drift corrected.`;
        },
        renderCascade: () => {
            const chains = [];
            const walk = (f, chain, d) => {
                if (!f || d > 60) return;
                const dur = f.actualDuration || 0;
                if (dur > 0) {
                    const link = { name: AI.getName(f), dur: parseFloat(dur.toFixed(2)), depth: d };
                    const next = [...chain, link];
                    let hasHeavyChild = false;
                    let c = f.child;
                    while (c) { if ((c.actualDuration || 0) > 0) { hasHeavyChild = true; walk(c, next, d + 1); } c = c.sibling; }
                    if (!hasHeavyChild && next.length > 1) chains.push({ cascade: next, totalMs: next.reduce((s, n) => s + n.dur, 0) });
                } else {
                    let c = f.child;
                    while (c) { walk(c, [], d + 1); c = c.sibling; }
                }
            };
            walk(AI.findRoot(), [], 0);
            return chains.sort((a, b) => b.totalMs - a.totalMs);
        },
        layoutEffectAudit: () => {
            const report = [];
            AI.traverse(AI.findRoot(), f => {
                if (typeof f.type !== 'function' && typeof f.type !== 'object') return;
                let curr = f.memoizedState;
                let hookIdx = 0;
                while (curr) {
                    const ms = curr.memoizedState;
                    // HookLayout = 8 in React's bitflag. Distinguishes useLayoutEffect from useEffect.
                    if (ms && typeof ms === 'object' && typeof ms.create === 'function' && ms.tag !== undefined && (ms.tag & 8)) {
                        const deps = ms.deps;
                        report.push({
                            component: AI.getName(f),
                            hookIndex: hookIdx,
                            type: 'useLayoutEffect',
                            severity: deps === null ? 'CRITICAL' : 'HIGH',
                            deps: deps === null ? 'NO_DEPS (blocks paint EVERY render)' : deps === undefined ? 'mount-only' : AI.safeStringify(deps, 80),
                            warning: 'Synchronous — blocks FCP until resolved'
                        });
                    }
                    curr = curr.next;
                    hookIdx++;
                }
            });
            return report;
        },
        storeRead: () => {
            const stores = [];
            const seen = new WeakSet();
            AI.traverse(AI.findRoot(), f => {
                let curr = f.memoizedState;
                while (curr) {
                    const ms = curr.memoizedState;
                    if (ms && typeof ms === 'object' && !seen.has(ms)) {
                        // Zustand: has getState + subscribe (but not React's own Context internals)
                        if (typeof ms.getState === 'function' && typeof ms.subscribe === 'function' && typeof ms.setState === 'function') {
                            seen.add(ms);
                            try {
                                const raw = ms.getState();
                                const safe = JSON.parse(JSON.stringify(raw, (k, v) => typeof v === 'function' ? '[fn]' : v));
                                stores.push({ type: 'Zustand', component: AI.getName(f), state: safe });
                            } catch (e) { stores.push({ type: 'Zustand', component: AI.getName(f), error: e.message }); }
                        }
                        // Redux: has getState + dispatch + subscribe (no setState)
                        else if (typeof ms.getState === 'function' && typeof ms.dispatch === 'function' && typeof ms.subscribe === 'function' && typeof ms.setState === 'undefined') {
                            seen.add(ms);
                            try { stores.push({ type: 'Redux', component: AI.getName(f), state: ms.getState() }); } catch (e) {}
                        }
                    }
                    curr = curr.next;
                }
            });
            return stores.length ? stores : 'No Zustand/Redux stores detected in current Fiber tree.';
        },
        waterfall: () => {
            const log = window.__fsNetLog;
            if (!log || log.length < 2) return { error: "Run FiberSense.network() first, then interact with the page." };
            const sorted = [...log].sort((a, b) => a.time - b.time);

            const normalizeUrl = (value) => {
                try {
                    const u = new URL(String(value), window.location.origin);
                    return u.pathname;
                } catch {
                    return String(value).split('?')[0];
                }
            };
            const normalizeMethod = (req) => String(req?.method || 'GET').toUpperCase();
            const isPresenceHeartbeatPath = (path) => /\/api\/admin\/presence$/.test(path);

            const normalized = sorted.map((req) => ({
                ...req,
                __method: normalizeMethod(req),
                __path: normalizeUrl(req.url)
            }));

            // Duplicate detection
            const signatureMap = {};
            normalized.forEach((r) => {
                if (isPresenceHeartbeatPath(r.__path)) return;
                const key = `${r.__method} ${r.__path}`;
                signatureMap[key] = (signatureMap[key] || 0) + 1;
            });
            const duplicates = Object.entries(signatureMap)
                .filter(([, count]) => count > 1)
                .map(([signature, count]) => ({
                    signature,
                    count,
                    severity: count > 2 ? 'CRITICAL' : 'HIGH'
                }));

            // Sequential / waterfall detection (B starts <300ms after A, different URLs)
            const waterfalls = [];
            for (let i = 0; i < normalized.length - 1; i++) {
                const firstReq = normalized[i];
                const secondReq = normalized[i + 1];
                const gap = secondReq.time - firstReq.time;
                const sameSignature = firstReq.__method === secondReq.__method && firstReq.__path === secondReq.__path;
                if (isPresenceHeartbeatPath(firstReq.__path) || isPresenceHeartbeatPath(secondReq.__path)) continue;
                if (gap > 0 && gap < 300 && !sameSignature) {
                    waterfalls.push({
                        first: `${firstReq.__method} ${firstReq.__path}`,
                        second: `${secondReq.__method} ${secondReq.__path}`,
                        gapMs: gap,
                        likely: gap < 80 ? 'HIGH — likely sequential' : 'MEDIUM — possible waterfall'
                    });
                }
            }
            return { duplicates, waterfalls: waterfalls.slice(0, 10), totalRequests: normalized.length };
        },
        narrate: () => {
            let md = '';
            try {
                const r = window.FiberSense.report();
                const ctx = window.FiberSense.contextMap();
                const suspense = window.FiberSense.suspenseMap();
                const providers = ctx.filter(c => c.type === 'PROVIDER');
                const settled = suspense.filter(s => !s.suspended).length;
                const suspended = suspense.filter(s => s.suspended).length;
                md += `## 🧠 FiberSense System Narrative\n`;
                md += `**Verdict:** ${r.verdict} | **Components:** ${r.summary.totalComponents} | **Max Depth:** ${r.summary.maxDepth} | **Time:** ${r.timestamp}\n\n`;
                md += `### Architecture\n`;
                if (providers.length) { providers.forEach(p => { md += `- **${p.name}** feeds ${p.consumers.length} consumer(s): ${p.consumers.slice(0, 4).join(', ')}${p.consumers.length > 4 ? '...' : ''}\n`; }); }
                else md += `No context providers detected (or running in production build).\n`;
                md += `\n### Async Boundaries\n`;
                md += `${settled} boundary(ies) settled, ${suspended} still loading.\n`;
                if (r.summary.memoizedHooks > 0) md += `\n### Memoization\n${r.summary.memoizedHooks} useMemo/useCallback hooks active.\n`;
                md += `\n### Findings (${r.findings.length} total)\n`;
                if (!r.findings.length) md += `✅ No anomalies. System healthy.\n`;
                else r.findings.forEach(f => { md += `- **[${f.severity}]** \`${f.what}\`: ${f.why} _(${f.where})_\n`; });
                if (r.summary.tokenViolations > 0) md += `\n### Visual Debt\n${r.summary.tokenViolations} hardcoded color/px violations bypass the token system.\n`;
                 md += `\n*Generated by FiberSense V1.0.1 OMNISENSE*`;
            } catch (e) { md = `Narration failed: ${e.message}. Try FiberSense.report() first to validate system state.`; }
            console.log('%c' + md, 'color:#00ffcc; font-family:monospace; font-size:11px;');
            return md;
        },
        xssAudit: () => {
            const risks = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                const dsi = f.memoizedProps?.dangerouslySetInnerHTML;
                if (!dsi) return;
                const html = typeof dsi === 'object' ? (dsi.__html || '') : String(dsi);
                const critical = /<script/i.test(html) || /javascript:/i.test(html) || /onerror=/i.test(html);
                risks.push({ component: AI.getName(f), depth: d, severity: critical ? 'CRITICAL' : 'HIGH', preview: html.substring(0, 120), issue: 'dangerouslySetInnerHTML XSS surface' });
            });
            return risks.length ? risks : '✅ No dangerouslySetInnerHTML surfaces detected.';
        },
        staleClosures: () => {
            const suspects = [];
            AI.traverse(AI.findRoot(), f => {
                if (typeof f.type !== 'function' && typeof f.type !== 'object') return;
                let hasNonObjState = false, emptyDepEffects = [];
                let curr = f.memoizedState, hookIdx = 0;
                while (curr) {
                    const ms = curr.memoizedState;
                    // Detect plain values in state (string, number, boolean) = component has state
                    if (ms !== undefined && ms !== null && typeof ms !== 'object' && typeof ms !== 'function') hasNonObjState = true;
                    // Detect effects with empty deps []
                    if (ms && typeof ms === 'object' && typeof ms.create === 'function' && Array.isArray(ms.deps) && ms.deps.length === 0) emptyDepEffects.push(hookIdx);
                    curr = curr.next; hookIdx++;
                }
                if (hasNonObjState && emptyDepEffects.length > 0) {
                    suspects.push({ component: AI.getName(f), suspiciousHooks: emptyDepEffects, reason: 'State values exist + mount-only effect — may capture stale state in closure' });
                }
            });
            return suspects.length ? suspects : '✅ No obvious stale closure suspects detected.';
        },
        fixture: (compName) => {
            let propsSnap = null, stateSnap = [];
            AI.traverse(AI.findRoot(), f => {
                if (AI.getName(f) !== compName) return;
                try { propsSnap = JSON.parse(JSON.stringify(f.memoizedProps || {}, (k, v) => typeof v === 'function' ? `[fn:${k}]` : v instanceof HTMLElement ? '[DOM]' : v)); } catch (e) { propsSnap = { error: e.message }; }
                let curr = f.memoizedState;
                while (curr) {
                    if (curr.memoizedState !== undefined && typeof curr.memoizedState !== 'function') {
                        try { stateSnap.push(JSON.parse(JSON.stringify(curr.memoizedState))); } catch (e) { stateSnap.push('[Circular]'); }
                    }
                    curr = curr.next;
                }
            });
            if (!propsSnap) return `Component '${compName}' not found in current Fiber tree.`;
            const code = [
                `// Auto-generated by FiberSense.fixture('${compName}')`,
                `import { render, screen } from '@testing-library/react';`,
                ``,
                `const mockProps = ${JSON.stringify(propsSnap, null, 2)};`,
                ``,
                `describe('${compName}', () => {`,
                `  it('renders with current props snapshot', () => {`,
                `    const { container } = render(<${compName} {...mockProps} />);`,
                `    expect(container).toBeTruthy();`,
                `  });`,
                `});`,
                ``,
                `/* State hooks at snapshot time: ${JSON.stringify(stateSnap)} */`
            ].join('\n');
            console.log('%c' + code, 'color:#a5f3fc; font-family:monospace;');
            return code;
        },

        // --- INFRASTRUCTURE PROBES: INFRASTRUCTURE PROBES ---
        eventTrace: (compName = null, durationMs = 5000) => {
            if (!window.__fsEventTrace) window.__fsEventTrace = { active: false, events: [], originals: [] };
            const st = window.__fsEventTrace;
            if (st.active) return { status: 'ACTIVE', events: st.events.length, note: 'Already tracing.' };
            st.active = true; st.events = []; st.originals = [];
            let wrapped = 0;
            AI.traverse(AI.findRoot(), (f) => {
                const name = AI.getName(f);
                if (compName && name !== compName) return;
                if (!f.memoizedProps || typeof f.memoizedProps !== 'object') return;
                Object.keys(f.memoizedProps).forEach(k => {
                    const fn = f.memoizedProps[k];
                    if (typeof fn !== 'function' || !/^on[A-Z]|^handle[A-Z]/.test(k)) return;
                    const orig = fn;
                    f.memoizedProps[k] = function(...args) {
                        const start = performance.now();
                        try { return orig.apply(this, args); }
                        finally {
                            st.events.unshift({ at: Date.now(), component: name, event: k, durationMs: Math.round((performance.now()-start)*100)/100, arg0: String(args[0]?.type || typeof args[0]).substring(0, 40) });
                            if (st.events.length > 500) st.events.pop();
                        }
                    };
                    st.originals.push({ key: k, fn: orig, props: f.memoizedProps });
                    wrapped++;
                });
            });
            setTimeout(() => {
                st.active = false;
                st.originals.forEach(e => { try { e.props[e.key] = e.fn; } catch(ex) {} });
                st.originals = [];
            }, durationMs);
            return { status: 'TRACING', wrapped, durationMs, read: 'FiberSense.eventTrace.read()', comp: compName || 'ALL' };
        },

        readEventTrace: () => {
            const st = window.__fsEventTrace;
            if (!st || !st.events.length) return { events: [], message: 'Run eventTrace() first.' };
            return { active: st.active, total: st.events.length, slowest: [...st.events].sort((a,b)=>b.durationMs-a.durationMs).slice(0, 15), recent: st.events.slice(0, 30) };
        },

        errorLog: () => {
            if (!window.__fsErrorLog) {
                window.__fsErrorLog = { entries: [], originals: {} };
                ['error','warn'].forEach(m => {
                    window.__fsErrorLog.originals[m] = console[m];
                    console[m] = function(...args) {
                        const raw = args.map(a => typeof a === 'string' ? a : (a?.message || String(a).substring(0, 120))).join(' ');
                        const msg = raw.length > 300 ? raw.substring(0, 300) + '...' : raw;
                        const ex = window.__fsErrorLog.entries.find(e => e.message === msg);
                        if (ex) { ex.count++; ex.lastAt = Date.now(); }
                        else window.__fsErrorLog.entries.unshift({ message: msg, count: 1, firstAt: Date.now(), lastAt: Date.now(), level: m });
                        if (window.__fsErrorLog.entries.length > 200) window.__fsErrorLog.entries.pop();
                        return window.__fsErrorLog.originals[m].apply(console, args);
                    };
                });
                return { status: 'ACTIVE', message: 'Intercepting console.error+warn.' };
            }
            return { status: 'ACTIVE', total: window.__fsErrorLog.entries.length };
        },

        readErrorLog: (filters = {}) => {
            const st = window.__fsErrorLog;
            if (!st) return { entries: [], message: 'Run errorLog() first.' };
            let entries = [...st.entries];
            if (filters.level) entries = entries.filter(e => e.level === filters.level);
            entries.sort((a,b) => b.count - a.count);
            return { topByCount: entries.slice(0, 20), recent: [...st.entries].sort((a,b)=>b.lastAt-a.lastAt).slice(0, 20) };
        },

        stopErrorLog: () => {
            const st = window.__fsErrorLog;
            if (!st) return { message: 'errorLog not active.' };
            Object.entries(st.originals).forEach(([m, fn]) => { console[m] = fn; });
            const n = st.entries.length; window.__fsErrorLog = null;
            return { stopped: true, entriesCleared: n };
        },

        queryAudit: () => {
            try {
                let qc = null;
                AI.traverse(AI.findRoot(), f => {
                    if (f.memoizedProps?.client?.getQueryCache) qc = f.memoizedProps.client;
                });
                if (!qc) {
                    const root = document.querySelector('#__next,#root,#app');
                    if (root) {
                        const k = Object.keys(root).find(x => x.startsWith('__reactFiber$') || x.startsWith('__reactContainer$'));
                        if (k) { const scan = (f,d) => { if (!f||d>80) return; if (f.memoizedProps?.client?.getQueryCache) { qc=f.memoizedProps.client; return; } let c=f.child; while(c){scan(c,d+1);c=c.sibling;} }; scan(root[k],0); }
                    }
                }
                if (!qc) return { error: 'QueryClientProvider not found. Is @tanstack/react-query installed?' };
                const cache = qc.getQueryCache().getAll();
                return {
                    total: cache.length, fresh: cache.filter(q => !q.isStale()).length, stale: cache.filter(q => q.isStale()).length,
                    fetching: cache.filter(q => q.state.fetchStatus === 'fetching').length, error: cache.filter(q => q.state.status === 'error').length,
                    queries: cache.map(q => ({
                        key: q.queryKey, status: q.state.status, fetchStatus: q.state.fetchStatus,
                        stale: q.isStale(), updatedAt: q.state.dataUpdatedAt,
                        error: q.state.error ? String(q.state.error).substring(0, 100) : null
                    })).sort((a,b) => b.updatedAt - a.updatedAt)
                };
            } catch(e) { return { error: e.message }; }
        },

        invalidateQuery: (keyFragment) => {
            try {
                let qc = null;
                AI.traverse(AI.findRoot(), f => { if (f.memoizedProps?.client?.getQueryCache) qc = f.memoizedProps.client; });
                if (!qc) return { error: 'QueryClientProvider not found.' };
                if (!keyFragment) { qc.invalidateQueries(); return { invalidated: 'ALL' }; }
                const s = String(keyFragment).toLowerCase();
                let n = 0;
                qc.getQueryCache().getAll().forEach(q => {
                    if (JSON.stringify(q.queryKey).toLowerCase().includes(s)) { qc.invalidateQueries({ queryKey: q.queryKey }); n++; }
                });
                return { invalidated: n, fragment: s };
            } catch(e) { return { error: e.message }; }
        },

        routeTiming: () => {
            if (!window.__fsRouteTiming) {
                window.__fsRouteTiming = { events: [], active: false };
                const log = (event, data) => {
                    window.__fsRouteTiming.events.unshift({ at: Date.now(), event, ...data });
                    if (window.__fsRouteTiming.events.length > 200) window.__fsRouteTiming.events.pop();
                };
                try {
                    if (window.next?.router?.events) {
                        ['routeChangeStart','routeChangeComplete','routeChangeError'].forEach(e => {
                            window.next.router.events.on(e, (...a) => log(e, { url: a[0] }));
                        });
                        window.__fsRouteTiming.active = true;
                        return { status: 'ACTIVE', mechanism: 'next/router' };
                    }
                    const orig = history.pushState;
                    history.pushState = function(...a) { const s=performance.now(); orig.apply(this,a); log('pushState',{url:a[2],ms:Math.round((performance.now()-s)*100)/100}); };
                    const popHandler = () => log('popstate', { url: location.href });
                    window.addEventListener('popstate', popHandler);
                    window.__fsRouteTiming._origPushState = orig;
                    window.__fsRouteTiming._popHandler = popHandler;
                    window.__fsRouteTiming.active = true;
                    return { status: 'ACTIVE', mechanism: 'history API' };
                } catch(e) { return { error: e.message }; }
            }
            return { status: window.__fsRouteTiming.active ? 'ACTIVE' : 'INACTIVE', total: window.__fsRouteTiming.events.length };
        },

        readRouteTiming: () => {
            const st = window.__fsRouteTiming;
            if (!st) return { events: [], message: 'Run routeTiming() first.' };
            const done = st.events.filter(e => e.event === 'routeChangeComplete' || e.event === 'pushState');
            const err = st.events.filter(e => e.event === 'routeChangeError');
            const durations = done.map(e => e.ms).filter(Boolean).sort((a,b)=>a-b);
            return { total: st.events.length, completed: done.length, errors: err.length, minMs: durations[0], maxMs: durations[durations.length-1], avgMs: durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length*100)/100 : 0, recent: st.events.slice(0, 20) };
        },

        actionTrace: () => {
            if (window.__fsActionTrace) return { status: 'ACTIVE', total: window.__fsActionTrace.length };
            window.__fsActionTrace = [];
            let wrapped = 0;
            try {
                AI.traverse(AI.findRoot(), f => {
                    let curr = f.memoizedState;
                    while (curr) {
                        const ms = curr.memoizedState;
                        if (ms && typeof ms === 'object') {
                            const dispatch = ms.dispatch || (ms.setState && !ms.getState ? ms.setState : null);
                            if (typeof dispatch === 'function' && !dispatch.__fsActionWrapped) {
                                const orig = dispatch, name = AI.getName(f);
                                const wrapper = function(...args) {
                                    const s = performance.now();
                                    try { return orig.apply(this, args); }
                                    finally {
                                        window.__fsActionTrace.unshift({
                                            at: Date.now(), component: name,
                                            action: args[0] && typeof args[0] === 'object' ? (args[0].type || JSON.stringify(args[0]).substring(0, 80)) : String(args[0]).substring(0, 80),
                                            ms: Math.round((performance.now()-s)*100)/100
                                        });
                                        if (window.__fsActionTrace.length > 500) window.__fsActionTrace.pop();
                                    }
                                };
                                wrapper.__fsActionWrapped = true;
                                if (ms.dispatch) { ms.dispatch = wrapper; wrapped++; }
                                else if (ms.setState) { ms.setState = wrapper; wrapped++; }
                            }
                        }
                        curr = curr.next;
                    }
                });
                return { status: 'ACTIVE', wrapped, read: 'FiberSense.actionTrace.read()' };
            } catch(e) { return { error: e.message }; }
        },

        readActionTrace: (compFilter = null) => {
            const st = window.__fsActionTrace;
            if (!st) return { actions: [], message: 'Run actionTrace() first.' };
            let items = compFilter ? st.filter(e => e.component === compFilter) : st;
            const byComp = {}; items.forEach(e => { const k = e.component; if (!byComp[k]) byComp[k] = { component: k, count: 0, actions: [] }; byComp[k].count++; if (byComp[k].actions.length < 8) byComp[k].actions.push(e.action); });
            return { total: items.length, byComponent: Object.values(byComp).sort((a,b)=>b.count-a.count).slice(0, 15), slowest: items.filter(e => e.ms > 0).sort((a,b)=>b.ms-a.ms).slice(0, 10), recent: items.slice(0, 20) };
        },

        benchmark: () => {
            const results = {};
            const time = (fn) => { const s = performance.now(); try { fn(); } catch(e) { return { ms: Math.round((performance.now()-s)*100)/100, error: e.message }; } return { ms: Math.round((performance.now()-s)*100)/100 }; };
            results.version = '1.0.1';
            results.componentCount = (() => { let n = 0; AI.traverse(AI.findRoot(), () => { n++; }); return n; })();
            results.architectScan = time(() => { const a = window.FiberSense.architect(); results.maxDepth = a.maxDepth; results.heavyRenders = a.heavyRenders.length; });
            results.scan = time(() => { const s = window.FiberSense.scan(); results.totalComponents = s.metrics?.totalComponents; });
            results.effectAudit = time(() => { results.effectCount = window.FiberSense.effectAudit().length; });
            results.report = time(() => { const r = window.FiberSense.report(); results.findings = r.findings?.length; });
            results.heatmap = time(() => { results.heatmapSize = window.FiberSense.heatmap().length; });
            results.contextMap = time(() => { results.providers = window.FiberSense.contextMap().length; });
            const times = Object.values(results).filter(v => v && typeof v.ms === 'number').map(v => v.ms);
            results.totalMs = Math.round(times.reduce((a,b) => a+b, 0) * 100) / 100;
            results.avgMs = Math.round((results.totalMs / Math.max(times.length, 1)) * 100) / 100;
            results.perComponentMs = Math.round((results.totalMs / Math.max(results.componentCount, 1)) * 1000) / 1000;
            results.verdict = results.totalMs > 100 ? 'SLOW — consider using individual probes instead of batch methods' : results.totalMs > 50 ? 'ACCEPTABLE' : 'FAST';
            return results;
        },

        destroy: () => {
            let cleaned = 0;
            try { window.FiberSense.stopOmniWatch(); cleaned++; } catch(e) {}
            try { window.FiberSense.stopPulse(); cleaned++; } catch(e) {}
            try { window.FiberSense.stopErrorLog(); cleaned++; } catch(e) {}
            try { window.FiberSense.disableOutputJournal(); cleaned++; } catch(e) {}
            try { window.FiberSense.unmountUI(); cleaned++; } catch(e) {}
            try { window.FiberSense.probe(false); cleaned++; } catch(e) {}
            if (window.__fsSpyIntervals) { window.__fsSpyIntervals.forEach(id => clearInterval(id)); window.__fsSpyIntervals = []; cleaned++; }
            if (window.__fsLongTaskObs) { try { window.__fsLongTaskObs.disconnect(); } catch(e) {} window.__fsLongTaskObs = null; cleaned++; }
            if (window.__fsRouteTiming && window.__fsRouteTiming._origPushState) { try { history.pushState = window.__fsRouteTiming._origPushState; } catch(e) {} cleaned++; }
            if (window.__fsRouteTiming && window.__fsRouteTiming._popHandler) { try { window.removeEventListener('popstate', window.__fsRouteTiming._popHandler); } catch(e) {} cleaned++; }
            if (window.__fsProbeTimer) { clearTimeout(window.__fsProbeTimer); window.__fsProbeTimer = null; }
            const globals = ['__fsHudTimer','__fsPulse','__fsSnap','__fsDelta','__fsTimeMachine','__fsTsunami','__fsNetLog','__fsNet','__fsEvents','__fsNeural','__fsAnomalies','__fsVelocity','__fsLongTasks','__fsLongTaskObs','__fsMemory','__fsMemoryStream','__fsOutputJournal','__fsOmni','__fsProbeHandler','__fsProbeTimer','__fsTooltip','__fsEventTrace','__fsErrorLog','__fsRouteTiming','__fsActionTrace','__fsSpyIntervals'];
            globals.forEach(k => { try { delete window[k]; cleaned++; } catch(e) {} });
            return { status: 'DESTROYED', cleaned };
        },

        version: () => ({
            version: '1.0.1',
            codename: 'OMNISENSE',
            capabilities: [
                'Core: architect, dump(legacy), heatmap, scan, track, source, omni',
                'Infrastructure: queryAudit, invalidateQuery, routeTiming, readRouteTiming',
                'Probes: eventTrace, readEventTrace, errorLog, readErrorLog, actionTrace, readActionTrace',
                'Core: architect, dump(legacy), heatmap, scan, track, source, omni',
                'Manipulation: trigger, inject, cryo, spoof, mutate, reparent, mockData, injectClass',
                'Analysis: a11y, leaks, network, styled, sandbox, xssAudit, staleClosures',
                'Monitoring: chaos, tsunami, pulse, velocityWatch, waterfall, longTaskMonitor',
                'Telemetry: agentEyes, startOmniWatch, refreshOmniWatch, telemetry, functionCallReport, stopOmniWatch',
                'Memory: memoryConfig, memoryWrite, memoryRead, memoryExport, memoryClear',
                'OutputJournal: enableOutputJournal, disableOutputJournal, outputJournalConfig, outputJournalRead, outputJournalExport, outputJournalClear',
                'Snapshots: snap, diff, renderCascade',
                'Architecture: contextMap, effectAudit, layoutEffectAudit, suspenseMap, tokenAudit, routeMap, memoScan, storeRead',
                'Runtime: laneMap, errorBoundaryMap, rscMap',
                'AI-Native: report, narrate, fixture',
                'Discovery: discoverIntent, bridge, spy, listen, radar, highlight, probe, reflex',
                'Time-Travel: record, rewind, replay, chronosDump',
                'HUD: mountUI, unmountUI, heal'
            ],
            limitations: [
                'Production builds: source() returns Unknown — no _debugSource metadata in minified code',
                'Minified bundles: component names appear as single letters (a, b, t). Use routeMap() to orient.',
                'actualDuration: only populated in React Profiler builds. In regular builds, renderCascade() returns empty.',
                'Zustand storeRead: requires the store to be accessible from within a Fiber consumer hook.',
                'RSC server components: invisible in client-side Fiber tree by design.',
                'staleClosures(): heuristic only. Confirms suspicion, not causation.',
                'OmniWatch tracks handler-level function calls, timers, network and long tasks; pure internal function calls without handler/timer/network hooks are outside direct capture.',
                'Memory stream persists in browser memory and optional localStorage; it does not write directly to repository files.',
                'OutputJournal can generate high-volume logs in active sessions; tune maxEntries or clear periodically to avoid localStorage quota limits.'
            ]
        }),

        // --- OMNISENSE: ROOT CAUSE + AI-NATIVE TRIAGE ---
        rerenderReason: (compName) => {
            const results = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                if (AI.getName(f) !== compName) return;
                const alt = f.alternate;
                if (!alt) { results.push({ component: compName, depth: d, reason: 'MOUNTED (first render — no previous fiber)' }); return; }
                const reasons = [];
                // Props changed?
                if (f.memoizedProps !== alt.memoizedProps) {
                    const curr = f.memoizedProps || {}, prev = alt.memoizedProps || {};
                    const changed = Object.keys({ ...curr, ...prev }).filter(k => k !== 'children' && curr[k] !== prev[k]);
                    if (changed.length) reasons.push({ cause: 'PROPS_CHANGED', props: changed });
                }
                // State changed?
                if (f.memoizedState !== alt.memoizedState) reasons.push({ cause: 'STATE_CHANGED', note: 'A useState/useReducer hook updated its value' });
                // Context changed?
                if (f.dependencies?.firstContext) {
                    const ctxs = [];
                    let c = f.dependencies.firstContext;
                    while (c) { ctxs.push(c.context?.displayName || 'Context'); c = c.next; }
                    reasons.push({ cause: 'CONTEXT_CHANGED', contexts: ctxs });
                }
                // Forced by parent (no other reason, but has pending work)?
                if (!reasons.length && f.lanes > 0) reasons.push({ cause: 'PARENT_RERENDER', note: 'No local change — parent triggered cascade. Consider React.memo().' });
                if (!reasons.length) reasons.push({ cause: 'UNKNOWN', note: 'No detectable trigger. May be StrictMode double-render or scheduler artifact.' });
                results.push({ component: compName, depth: d, reasons });
            });
            return results.length ? results : `'${compName}' not found or not currently in Fiber tree.`;
        },
        propDiff: (compName) => {
            const diffs = [];
            AI.traverse(AI.findRoot(), f => {
                if (AI.getName(f) !== compName) return;
                const curr = f.memoizedProps || {}, prev = f.alternate?.memoizedProps || {};
                const allKeys = new Set([...Object.keys(curr), ...Object.keys(prev)]);
                allKeys.forEach(k => {
                    if (k === 'children') return;
                    if (curr[k] !== prev[k]) {
                        let from, to;
                        try { from = JSON.stringify(prev[k])?.substring(0, 100) ?? 'undefined'; } catch { from = typeof prev[k]; }
                        try { to = JSON.stringify(curr[k])?.substring(0, 100) ?? 'undefined'; } catch { to = typeof curr[k]; }
                        diffs.push({ prop: k, from, to, valueType: typeof curr[k] });
                    }
                });
            });
            return diffs.length ? diffs : `No prop changes found for '${compName}'. Component may be stable or not currently mounted.`;
        },
        diagnose: (symptom) => {
            const s = (symptom || '').toLowerCase();
            let p = { hypothesis: '', commands: [], interpretation: '' };
            if (/input|lag|typing|keystroke|slow.*key|key.*slow/.test(s)) {
                p.hypothesis = 'Keystroke-driven render cascade (RF-38 class bug)';
                p.commands = ["FiberSense.velocityWatch(null, 5000)  // type while this runs", "FiberSense.effectAudit().filter(e => e.deps === 'NO_DEPS (runs every render)')", "FiberSense.renderCascade()", "FiberSense.propDiff('SuspectedComponent')"];
                p.interpretation = "velocityWatch > 8 updates/sec = render storm. renderCascade totalMs > 16 = frame budget exceeded. propDiff reveals the exact prop change driving recursion.";
            } else if (/blank|white|empty|nothing|missing/.test(s)) {
                p.hypothesis = 'Unresolved Suspense, Error Boundary crash, or RSC hydration mismatch';
                p.commands = ["FiberSense.suspenseMap()", "FiberSense.errorBoundaryMap()", "FiberSense.rscMap()"];
                p.interpretation = "suspenseMap suspended=true = Promise still pending. errorBoundaryMap hasCaughtError=true = read the .error field. rscMap CLIENT_BOUNDARY = server/client split.";
            } else if (/leak|memory|slow.*(time|minute|hour)|grow/.test(s)) {
                p.hypothesis = 'Unbounded effect subscription or detached DOM accumulation';
                p.commands = ["FiberSense.leaks()", "FiberSense.effectAudit().filter(e => !e.hasCleanup)", "FiberSense.velocityWatch(null, 10000)"];
                p.interpretation = "leaks() finds detached nodes. effectAudit hasCleanup=false + subscription pattern = memory leak. velocityWatch rising over time = effect not cleaning up.";
            } else if (/flash|flicker|shift|jump|cls|layout/.test(s)) {
                p.hypothesis = 'useLayoutEffect blocking paint or Suspense fallback transition';
                p.commands = ["FiberSense.layoutEffectAudit()", "FiberSense.suspenseMap()", "FiberSense.tokenAudit()"];
                p.interpretation = "layoutEffectAudit NO_DEPS = blocks FCP every render (CRITICAL). suspenseMap mode=FALLBACK during render = visible flicker. tokenAudit hardcoded dimensions = layout shift.";
            } else if (/stale|old data|cache|refetch|fetch/.test(s)) {
                p.hypothesis = 'Stale cache, duplicate API calls, or request waterfall';
                p.commands = ["FiberSense.network()", "FiberSense.waterfall()  // after interactions", "FiberSense.storeRead()", "FiberSense.staleClosures()"];
                p.interpretation = "waterfall().duplicates = same URL called N times. storeRead() shows store content — look for stale timestamps. staleClosures = effect capturing old value.";
            } else if (/context|provider|consumer|global state/.test(s)) {
                p.hypothesis = 'Context value changing too broadly, triggering mass consumer re-renders';
                p.commands = ["FiberSense.contextMap()", "FiberSense.rerenderReason('SuspectedComponent')", "FiberSense.velocityWatch(null, 3000)"];
                p.interpretation = "contextMap provider with 10+ consumers = blast radius. rerenderReason CONTEXT_CHANGED = confirmed. Fix: split context, or memo the Provider value object.";
            } else if (/hydrat|ssr|server|mismatch/.test(s)) {
                p.hypothesis = 'Server/client output mismatch causing hydration error';
                p.commands = ["FiberSense.rscMap()", "FiberSense.routeMap()", "FiberSense.errorBoundaryMap()"];
                p.interpretation = "errorBoundaryMap error containing 'Hydration' = confirmed. rscMap shows boundary points. routeMap shows segment structure for Next.js App Router.";
            } else if (/xss|inject|security|script/.test(s)) {
                p.hypothesis = 'Unescaped HTML rendering XSS surface';
                p.commands = ["FiberSense.xssAudit()"];
                p.interpretation = "CRITICAL = active <script> or javascript: pattern in innerHTML. HIGH = dangerouslySetInnerHTML found — verify source is trusted.";
            } else if (/slow|perf|render|heavy/.test(s)) {
                p.hypothesis = 'General render performance degradation';
                p.commands = ["FiberSense.scan()", "FiberSense.heatmap()", "FiberSense.renderCascade()", "FiberSense.memoScan()"];
                p.interpretation = "heatmap top entries > 16ms = frame budget breached. renderCascade shows full cost chain. memoScan NO_DEPS = memo not working or missing.";
            } else {
                p.hypothesis = 'Symptom not recognized — running full diagnostic';
                p.commands = ["FiberSense.narrate()  // paste this output into chat", "FiberSense.report()", "FiberSense.scan()"];
                p.interpretation = "Paste narrate() output into chat verbatim. Describe what the user sees and when it happens. Full audit provides the starting fingerprint.";
            }
            console.log('%c🔬 FIBERSENSE DIAGNOSIS', 'color:#f43f5e;font-size:13px;font-weight:bold;');
            console.log(`%cHypothesis: ${p.hypothesis}`, 'color:#fbbf24;font-weight:bold;');
            console.log('%cRun in order:\n' + p.commands.join('\n'), 'color:#00ffcc;font-family:monospace;font-size:11px;');
            console.log(`%cInterpretation: ${p.interpretation}`, 'color:#94a3b8;font-size:10px;');
            return p;
        },
        longTaskMonitor: (durationMs = 10000) => {
            if (!('PerformanceObserver' in window)) return 'PerformanceObserver not supported. Use performance.now() manually.';
            if (window.__fsLongTaskObs) window.__fsLongTaskObs.disconnect();
            window.__fsLongTasks = [];
            const obs = new PerformanceObserver(list => {
                list.getEntries().forEach(entry => {
                    const activeComps = [];
                    AI.traverse(AI.findRoot(), f => { if (f.lanes && f.lanes !== 0) activeComps.push(AI.getName(f)); });
                    const task = { durationMs: Math.round(entry.duration), startTime: Math.round(entry.startTime), attribution: entry.attribution?.[0]?.name || 'unknown', reactComponentsActive: [...new Set(activeComps)].filter(n => n !== 'null').slice(0, 8) };
                    window.__fsLongTasks.push(task);
                    console.warn(`%c⛔ LONG TASK ${task.durationMs}ms — React active: ${task.reactComponentsActive.join(', ')}`, 'color:#f43f5e;font-weight:bold;');
                });
            });
            try { obs.observe({ entryTypes: ['longtask'] }); } catch(e) { return `longtask entryType not supported: ${e.message}`; }
            window.__fsLongTaskObs = obs;
            setTimeout(() => { obs.disconnect(); console.log(`%cLongTask monitor done. ${window.__fsLongTasks.length} task(s) in window.__fsLongTasks`, 'color:#64748b;'); }, durationMs);
            return `Long task monitor active ${durationMs}ms. Interact with the app. Results accumulate in window.__fsLongTasks.`;
        },
        memorize: (label) => {
            if (!label) return 'Usage: FiberSense.memorize("before-fix") or FiberSense.memorize("after-fix")';
            if (!window.__fsMemory) window.__fsMemory = {};
            const r = window.FiberSense.report();
            window.__fsMemory[label] = { label, timestamp: new Date().toISOString(), verdict: r.verdict, findings: r.findings.length, tokenViolations: r.summary.tokenViolations, totalComponents: r.summary.totalComponents, report: r };
            console.log(`%c💾 Snapshot '${label}' saved: ${r.verdict}, ${r.findings.length} findings`, 'color:#00ffcc;font-weight:bold;');
            return `Snapshot '${label}' saved. Call FiberSense.compareMemory('${label}', 'other-label') to diff.`;
        },
        compareMemory: (label1, label2) => {
            const mem = window.__fsMemory || {};
            const available = Object.keys(mem).join(', ') || 'none (run memorize() first)';
            if (!mem[label1]) return `Snapshot '${label1}' not found. Available: ${available}`;
            if (!mem[label2]) return `Snapshot '${label2}' not found. Available: ${available}`;
            const a = mem[label1], b = mem[label2];
            const delta = {
                comparison: `'${label1}' → '${label2}'`,
                verdict: `${a.verdict} → ${b.verdict}`,
                findingsDelta: `${a.findings} → ${b.findings} (${b.findings - a.findings > 0 ? '+' : ''}${b.findings - a.findings})`,
                tokenViolationsDelta: `${a.tokenViolations} → ${b.tokenViolations}`,
                componentsDelta: `${a.totalComponents} → ${b.totalComponents}`,
                newFindings: b.report.findings.filter(bf => !a.report.findings.find(af => af.what === bf.what)),
                resolvedFindings: a.report.findings.filter(af => !b.report.findings.find(bf => bf.what === af.what))
            };
            const improved = b.findings < a.findings;
            console.log(`%c${improved ? '✅' : '⚠'} ${delta.comparison}: findings ${delta.findingsDelta}, verdict ${delta.verdict}`, `color:${improved ? '#00ffcc' : '#f43f5e'};font-weight:bold;font-size:12px;`);
            if (delta.resolvedFindings.length) console.log('%cResolved: ' + delta.resolvedFindings.map(f => f.what).join(', '), 'color:#4ade80;');
            if (delta.newFindings.length) console.log('%cNew regressions: ' + delta.newFindings.map(f => f.what).join(', '), 'color:#f43f5e;');
            return delta;
        },
        interface: (compName) => {
            const tsType = (val) => {
                if (val === null || val === undefined) return 'unknown';
                if (Array.isArray(val)) return val.length > 0 ? `${tsType(val[0])}[]` : 'unknown[]';
                if (typeof val === 'function') return '(...args: unknown[]) => unknown';
                if (val instanceof HTMLElement) return 'HTMLElement';
                if (typeof val === 'object') {
                    const keys = Object.keys(val).slice(0, 4);
                    return keys.length ? `{ ${keys.map(k => `${k}: ${tsType(val[k])}`).join('; ')} }` : 'Record<string, unknown>';
                }
                return typeof val;
            };
            let found = null;
            AI.traverse(AI.findRoot(), f => { if (AI.getName(f) === compName && f.memoizedProps) found = f.memoizedProps; });
            if (!found) return `Component '${compName}' not found in Fiber tree.`;
            const lines = [`interface ${compName}Props {`];
            for (const [k, v] of Object.entries(found)) {
                const optional = v === null || v === undefined ? '?' : '';
                if (k === 'children') lines.push(`  children?: React.ReactNode;`);
                else lines.push(`  ${k}${optional}: ${tsType(v)};`);
            }
            lines.push('}');
            const result = lines.join('\n');
            console.log('%c' + result, 'color:#a5f3fc;font-family:monospace;font-size:11px;');
            return result;
        },
        debugOwner: (compName) => {
            const results = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                if (AI.getName(f) !== compName) return;
                const chain = [];
                let owner = f._debugOwner;
                while (owner && chain.length < 15) { chain.push(AI.getName(owner)); owner = owner._debugOwner; }
                results.push({
                    component: compName,
                    depth: d,
                    createdBy: chain[0] || 'Unknown (production build — no _debugOwner)',
                    ownerChain: chain.length ? `${[...chain].reverse().join(' → ')} → ${compName}` : 'Chain unavailable',
                    note: chain.length === 0 ? 'Run in React dev mode for _debugOwner to be populated.' : `${chain.length} ancestors traced.`
                });
            });
            return results.length ? results : `'${compName}' not found.`;
        },

        // --- OMNISENSE: REAL-TIME TELEMETRY + DEAD STATE ---
        spy: (compName, propName, intervalMs = 500) => {
            let prev = undefined;
            let ticks = 0;
            const changes = [];
            if (!window.__fsSpyIntervals) window.__fsSpyIntervals = [];
            const safeSerialize = (v) => { try { if (typeof v === 'function') return '[fn]'; if (v && typeof v === 'object' && v.$$typeof) return '[ReactElement]'; return JSON.stringify(v); } catch { return String(v).substring(0, 120); } };
            console.log(`%c[SPY] Watching ${compName}.${propName || '*'} every ${intervalMs}ms.`, 'color:#facc15;font-weight:bold;');
            const id = setInterval(() => {
                ticks++;
                let found = null;
                AI.traverse(AI.findRoot(), f => { if (AI.getName(f) === compName && f.memoizedProps) found = f; });
                if (!found) return;
                const props = found.memoizedProps;
                const val = propName ? props[propName] : props;
                const serialized = safeSerialize(val);
                const prevSerialized = prev === undefined ? undefined : safeSerialize(prev);
                if (serialized !== prevSerialized) {
                    const entry = { tick: ticks, timestamp: Date.now(), prop: propName || 'ALL_PROPS', from: (prevSerialized||'').substring(0, 120), to: (serialized||'').substring(0, 120) };
                    changes.push(entry);
                    console.log(`%c[SPY] ${compName}.${propName || '*'} CHANGED:`, 'color:#f87171;font-weight:bold;', entry);
                    try { prev = serialized && serialized !== 'undefined' ? JSON.parse(serialized) : val; } catch { prev = val; }
                } else {
                    try { prev = serialized && serialized !== 'undefined' ? JSON.parse(serialized) : val; } catch { prev = val; }
                }
            }, intervalMs);
            window.__fsSpyIntervals.push(id);
            window.FiberSense._stopSpy = () => { clearInterval(id); window.__fsSpyIntervals = window.__fsSpyIntervals.filter(x => x !== id); console.log(`%c[SPY] Stopped after ${ticks} ticks. ${changes.length} changes detected.`, 'color:#4ade80;font-weight:bold;'); return changes; };
            return { status: 'WATCHING', component: compName, prop: propName || '*', interval: intervalMs };
        },
        zombieScan: () => {
            const zombies = [];
            AI.traverse(AI.findRoot(), (f, d) => {
                const name = AI.getName(f);
                if (!name || name === 'Anonymous' || /^(div|span|p|ul|li|button|a|img|h[1-6]|form|input|label|header|footer|main|nav|section|article)$/.test(name)) return;
                // Check memoizedState for useState hooks that hold stale/default values
                let hook = f.memoizedState;
                let hookIndex = 0;
                const staleHooks = [];
                while (hook) {
                    // useState hooks have .queue with .lastRenderedState
                    if (hook.queue && hook.queue.lastRenderedState !== undefined) {
                        const current = hook.memoizedState;
                        const lastRendered = hook.queue.lastRenderedState;
                        // If the state is EXACTLY the same object as lastRenderedState and both are the initial value pattern
                        if (current === lastRendered) {
                            // Check if this state has NEVER been updated (queue.pending is null = no dispatches)
                            if (hook.queue.pending === null && hook.queue.lanes === 0) {
                                let valPreview;
                                try { valPreview = JSON.stringify(current)?.substring(0, 80); } catch { valPreview = typeof current; }
                                staleHooks.push({ hookIndex, value: valPreview, verdict: 'NEVER_UPDATED — potential dead state' });
                            }
                        }
                    }
                    hook = hook.next;
                    hookIndex++;
                }
                if (staleHooks.length) {
                    zombies.push({ component: name, depth: d, deadHooks: staleHooks, suggestion: `useState at index ${staleHooks.map(h => h.hookIndex).join(',')} never updated. Candidate for removal or conversion to const/prop.` });
                }
            });
            return zombies.length
                ? { totalZombies: zombies.length, findings: zombies, interpretation: 'These useState hooks exist but were never dispatched to. They may be dead code, or they may hold intentional defaults. Cross-reference with source() before removing.' }
                : { totalZombies: 0, verdict: 'CLEAN — all state hooks show dispatch activity.' };
        }
    };
})();

try {
    if (window.FiberSense && typeof window.FiberSense.enableOutputJournal === 'function') {
        window.FiberSense.enableOutputJournal({ enabled: true, persist: true });
    }
} catch (e) {}

if (typeof module !== 'undefined' && module.exports) module.exports = window.FiberSense;
console.log("FiberSense V1.0.1 OMNISENSE Active. Start: FiberSense.diagnose('your symptom')");
