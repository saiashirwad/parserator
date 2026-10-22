import type { Diagnostic } from "./diagnostic.ts"

export function levenshteinDistance(a: string, b: string): number {
  let previous = Array.from({ length: a.length + 1 }, (_, index) => index)
  for (let j = 1; j <= b.length; j++) {
    const current = [j]
    for (let i = 1; i <= a.length; i++)
      current[i] = Math.min(
        current[i - 1]! + 1,
        previous[i]! + 1,
        previous[i - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    previous = current
  }
  return previous[a.length]!
}

export function generateHints(
  found: string,
  expected: readonly string[],
  maxDistance = 2,
  maxHints = 3
): string[] {
  return expected
    .map(word => ({ word, distance: levenshteinDistance(found, word) }))
    .filter(item => item.distance > 0 && item.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxHints)
    .map(item => item.word)
}

export function resolveHints(diagnostic: Diagnostic): Diagnostic {
  if (!diagnostic.suggestions) return diagnostic
  const { suggestions, ...rest } = diagnostic
  const hints = [
    ...new Set([
      ...(rest.hints ?? []),
      ...suggestions.flatMap(({ found, vocabulary }) =>
        generateHints(found, vocabulary)
      )
    ])
  ]
  return hints.length ? { ...rest, hints } : rest
}
