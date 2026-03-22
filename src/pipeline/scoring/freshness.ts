/**
 * Compute a freshness weight for an indicator based on its data age.
 * Uses exponential decay: weight = e^(-lambda * ageDays)
 * where lambda = ln(2) / halfLifeDays
 *
 * Returns 1.0 for fresh data, approaches 0.0 for stale data.
 * Clamped to 0 if age exceeds maxAgeDays.
 *
 * @param dataAgeMs - Age of data in milliseconds (Date.now() - dataDate)
 * @param halfLifeDays - Number of days until weight reaches 0.5
 * @param maxAgeDays - Maximum age in days; data older than this gets weight 0
 * @returns Weight between 0 and 1
 */
export function freshnessWeight(
  dataAgeMs: number,
  halfLifeDays: number,
  maxAgeDays: number,
): number {
  const ageDays = dataAgeMs / (1000 * 60 * 60 * 24);

  if (ageDays > maxAgeDays) return 0;
  if (ageDays <= 0) return 1;

  const lambda = Math.LN2 / halfLifeDays;
  return Math.exp(-lambda * ageDays);
}
