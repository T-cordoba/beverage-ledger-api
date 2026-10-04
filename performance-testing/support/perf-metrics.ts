import { performance } from 'node:perf_hooks';

/**
 * Minimal timing toolkit for the performance suite: run an operation a fixed
 * number of times, keep every sample, and reduce them to the statistics the
 * budgets are checked against.
 *
 * Like the course example (`timeit.repeat` + `median`), the budgets are judged on
 * the median, which a single slow sample (GC pause, CI neighbour) cannot move,
 * plus a generous ceiling on the worst sample to catch real stalls.
 */

export interface LatencyStats {
  samples: number;
  mean: number;
  median: number;
  p95: number;
  min: number;
  max: number;
}

/** Latency budget in milliseconds for a single sequential operation. */
export interface LatencyBudget {
  median: number;
  max: number;
}

/**
 * Every budget in one place, so the thresholds are reviewed together.
 *
 * They are deliberately loose. Measured locally with the six files running in
 * parallel, the in-memory API answers a single write in ~3-5 ms (median), a full
 * create + confirm in ~4-6 ms, a PDF download in ~10 ms, and renders a 150-line
 * voucher in ~45 ms. Each budget leaves roughly 10x headroom for slower CI
 * agents (Jenkins in Docker, shared CPU) while still failing if an operation
 * regresses to, say, an accidental O(n^2) or a blocking call.
 */
export const BUDGETS = {
  /** POST /movements (draft) and POST /movements/:id/confirm|cancel, each. */
  request: { median: 50, max: 250 } satisfies LatencyBudget,
  /** Create + confirm, the two requests a user makes to register a movement. */
  register: { median: 100, max: 500 } satisfies LatencyBudget,
  /** GET /movements/:id/pdf, end to end. */
  pdfDownload: { median: 150, max: 750 } satisfies LatencyBudget,
  /** MovementPdfService.render alone for a one-line voucher. */
  pdfRenderSmall: { median: 100, max: 500 } satisfies LatencyBudget,
  /** MovementPdfService.render for a multi-page voucher (LARGE_VOUCHER_LINES). */
  pdfRenderLarge: { median: 500, max: 2000 } satisfies LatencyBudget,
  /** Wall-clock time for a whole burst of concurrent registrations. */
  registerBurstMs: 2000,
  /** Wall-clock time for a whole burst of concurrent cancellations. */
  cancelBurstMs: 1500,
  /** Wall-clock time for a whole burst of concurrent PDF downloads. */
  pdfBurstMs: 3000,
} as const;

/** Small, controlled volumes: enough samples for a stable median, never a load test. */
export const VOLUME = {
  /** Untimed runs first: JIT, lazy module init and font embedding happen here. */
  warmup: 3,
  /** Timed sequential runs for request-level operations. */
  iterations: 30,
  /** Timed sequential runs for PDF operations, which are heavier. */
  pdfIterations: 20,
  /** Requests fired at once in a burst. */
  burst: 20,
  /** PDF downloads fired at once in a burst. */
  pdfBurst: 10,
  /** Lines in the voucher used for the multi-page rendering test. */
  largeVoucherLines: 150,
} as const;

/** Elapsed milliseconds of one awaited call, with its result. */
export async function timed<T>(work: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = performance.now();
  const result = await work();
  return { ms: performance.now() - start, result };
}

export function summarize(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    throw new Error('no samples to summarize');
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const at = (index: number): number => sorted[Math.max(0, Math.min(sorted.length - 1, index))]!;
  const middle = Math.floor(sorted.length / 2);

  return {
    samples: sorted.length,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    median: sorted.length % 2 === 0 ? (at(middle - 1) + at(middle)) / 2 : at(middle),
    p95: at(Math.ceil(0.95 * sorted.length) - 1),
    min: at(0),
    max: at(sorted.length - 1),
  };
}

/**
 * Runs `operation` sequentially: `warmup` untimed rounds, then `iterations`
 * timed ones. `prepare` runs before each round outside the stopwatch, for work
 * that is setup rather than the thing being measured (e.g. creating the
 * movement a cancel needs).
 */
export async function measureSequential<P>(options: {
  iterations: number;
  warmup?: number;
  prepare?: (round: number) => Promise<P>;
  operation: (prepared: P, round: number) => Promise<unknown>;
}): Promise<LatencyStats> {
  const { iterations, warmup = VOLUME.warmup, prepare, operation } = options;
  const samples: number[] = [];

  for (let round = 0; round < warmup + iterations; round += 1) {
    const prepared = (prepare ? await prepare(round) : undefined) as P;
    const { ms } = await timed(() => operation(prepared, round));

    if (round >= warmup) {
      samples.push(ms);
    }
  }

  return summarize(samples);
}

/** Fires `count` operations at once and times the whole burst. */
export async function measureBurst<T>(
  count: number,
  operation: (index: number) => Promise<T>,
): Promise<{ totalMs: number; results: T[] }> {
  const { ms, result } = await timed(() =>
    Promise.all(Array.from({ length: count }, (_, index) => operation(index))),
  );
  return { totalMs: ms, results: result };
}

const fmt = (ms: number) => `${ms.toFixed(2)} ms`;

/** One line per measurement in the test output, so a run doubles as a report. */
export function report(label: string, stats: LatencyStats, budget: LatencyBudget): void {
  console.info(
    `[perf] ${label} | n=${stats.samples} mean=${fmt(stats.mean)} median=${fmt(stats.median)} ` +
      `p95=${fmt(stats.p95)} max=${fmt(stats.max)} | budget median<${budget.median} ms max<${budget.max} ms`,
  );
}

export function reportBurst(label: string, count: number, totalMs: number, budgetMs: number): void {
  console.info(
    `[perf] ${label} | ${count} concurrent in ${fmt(totalMs)} ` +
      `(${fmt(totalMs / count)} per op) | budget total<${budgetMs} ms`,
  );
}

/** Asserts a sequential measurement against its budget with a readable message. */
export function assertWithinBudget(
  label: string,
  stats: LatencyStats,
  budget: LatencyBudget,
): void {
  report(label, stats, budget);

  if (stats.median >= budget.median) {
    throw new Error(
      `${label}: median ${fmt(stats.median)} exceeds the ${budget.median} ms budget`,
    );
  }
  if (stats.max >= budget.max) {
    throw new Error(`${label}: worst sample ${fmt(stats.max)} exceeds the ${budget.max} ms ceiling`);
  }
}

export function assertBurstWithinBudget(
  label: string,
  count: number,
  totalMs: number,
  budgetMs: number,
): void {
  reportBurst(label, count, totalMs, budgetMs);

  if (totalMs >= budgetMs) {
    throw new Error(`${label}: ${count} concurrent took ${fmt(totalMs)}, budget ${budgetMs} ms`);
  }
}
