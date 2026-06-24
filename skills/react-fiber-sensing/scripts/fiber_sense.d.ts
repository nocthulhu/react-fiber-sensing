// TypeScript definitions for FiberSense V1.0.1
// https://github.com/nocthulhu/react-fiber-sensing

interface FiberSenseFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  what: string;
  why: string;
  where: string;
  category?: string;
  evidence?: Record<string, unknown>;
}

interface FiberSenseReport {
  verdict: string;
  timestamp: string;
  summary: Record<string, unknown>;
  findings: FiberSenseFinding[];
}

interface FiberSenseDiagnosis {
  hypothesis: string;
  commands: string[];
  interpretation: string;
}

interface FiberSenseScan {
  timestamp: string;
  verdict: string;
  hotspots: Array<{ name: string; dur: number; depth: number; hooks: number; props: number }>;
  leaks: unknown[];
  syncGaps: unknown[];
  metrics: { totalComponents: number; maxDepth: number };
}

interface FiberSenseVersion {
  version: string;
  blocked?: boolean;
  codename: string;
  capabilities: string[];
  limitations: string[];
}

interface FiberSenseBenchmark {
  version: string;
  componentCount: number;
  maxDepth: number;
  heavyRenders: number;
  totalComponents: number;
  effectCount: number;
  findings: number;
  heatmapSize: number;
  providers: number;
  totalMs: number;
  avgMs: number;
  perComponentMs: number;
  verdict: string;
}

interface FiberSenseQueryAudit {
  total: number;
  fresh: number;
  stale: number;
  fetching: number;
  error: number;
  queries: Array<{
    key: unknown[];
    status: string;
    fetchStatus: string;
    stale: boolean;
    updatedAt: number;
    error: string | null;
  }>;
}

interface FiberSense {
  // Core diagnostics
  architect(): Record<string, unknown>;
  dump(): Record<string, unknown>;
  omni(query: string): Array<{ n: string; s: unknown }>;
  track(name: string): unknown[];
  source(name: string): Array<{ name: string; file: string; line: string | number }>;
  scan(): FiberSenseScan;
  heatmap(): unknown[];
  report(): FiberSenseReport;
  narrate(): string;
  diagnose(symptom: string): FiberSenseDiagnosis;
  version(): FiberSenseVersion;

  // Architecture
  contextMap(): unknown[];
  effectAudit(): unknown[];
  layoutEffectAudit(): unknown[];
  suspenseMap(): unknown[];
  tokenAudit(): unknown[];
  routeMap(): unknown[];
  memoScan(): unknown[];
  storeRead(): unknown;
  renderCascade(): unknown[];
  laneMap(): unknown[];
  errorBoundaryMap(): unknown[];
  rscMap(): unknown[];

  // Performance
  rerenderReason(name: string): unknown[];
  propDiff(name: string): unknown[];
  velocityWatch(name: string | null, ms?: number): string;
  waterfall(): Record<string, unknown>;
  longTaskMonitor(ms?: number): string;
  benchmark(): FiberSenseBenchmark;

  // Infrastructure probes
  eventTrace(comp?: string | null, ms?: number): Record<string, unknown>;
  readEventTrace(): { events: unknown[]; slowest: unknown[] };
  errorLog(): Record<string, unknown>;
  readErrorLog(filters?: { level?: string }): { topByCount: unknown[]; recent: unknown[] };
  stopErrorLog(): Record<string, unknown>;
  queryAudit(): FiberSenseQueryAudit | { error: string };
  invalidateQuery(key?: string): Record<string, unknown>;
  routeTiming(): Record<string, unknown>;
  readRouteTiming(): { total: number; minMs: number; maxMs: number; avgMs: number };
  actionTrace(): Record<string, unknown>;
  readActionTrace(filter?: string): { total: number; byComponent: unknown[] };

  // Time-travel
  record(comp: string, event: string): string;
  rewind(steps?: number): string;
  replay(): Record<string, unknown>;
  chronosDump(): Record<string, unknown>;

  // Memory & state
  memorize(label: string): string;
  compareMemory(a: string, b: string): Record<string, unknown>;
  fixture(name: string): string;
  interface(name: string): string;
  debugOwner(name: string): unknown[];
  zombieScan(): { totalZombies: number; findings: unknown[] } | { totalZombies: number; verdict: string };

  // Lifecycle
  destroy(): { status: string; cleaned: number };
  startOmniWatch(config?: Record<string, unknown>): Record<string, unknown>;
  stopOmniWatch(): Record<string, unknown>;
  telemetry(filters?: Record<string, unknown>): Record<string, unknown>;
  agentEyes(symptom?: string): Record<string, unknown>;
}

declare global {
  var FiberSense: FiberSense;
  var FIBERSENSE_PRODUCTION: string | undefined;
}
