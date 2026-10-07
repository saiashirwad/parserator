export const meanLatency = (samples: ReadonlyArray<number>): number =>
  samples.length === 0 ? 0 : samples.reduce((sum, sample) => sum + sample, 0) / (samples.length - 1);
