import { bench, run, group } from "mitata";

export { bench, run, group };

// Benchmark configuration
export const config = {
  warmup: 100,
  iterations: 1000,
  time: 1000 // ms
};

// Helper to format ops/sec
export function formatOps(ops: number): string {
  if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(2)}M ops/s`;
  if (ops >= 1_000) return `${(ops / 1_000).toFixed(2)}K ops/s`;
  return `${ops.toFixed(2)} ops/s`;
}

// Helper to measure memory usage
export function measureMemory(fn: () => void): number {
  if (typeof Bun !== "undefined") {
    const before = Bun.nanoseconds();
    fn();
    const after = Bun.nanoseconds();
    return after - before;
  }

  // Node.js fallback
  const before = process.memoryUsage().heapUsed;
  fn();
  const after = process.memoryUsage().heapUsed;
  return after - before;
}

// Run all benchmarks with summary
export async function runBenchmarks() {
  console.log("\n🚀 Parserator Performance Benchmarks\n");
  console.log(`Runtime: ${typeof Bun !== "undefined" ? "Bun" : "Node.js"}`);
  console.log(
    `Version: ${typeof Bun !== "undefined" ? Bun.version : process.version}\n`
  );

  await run();
}
