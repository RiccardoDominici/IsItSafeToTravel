import type { ScoredCountry } from '../pipeline/types';
import type { HistoryPoint } from './scores';
import { getCountriesByRegion } from './regions';
import type { Region } from './regions';

/** Returns top N countries sorted by score descending */
export function getSafestCountries(countries: ScoredCountry[], n: number): ScoredCountry[] {
  return [...countries].sort((a, b) => b.score - a.score).slice(0, n);
}

/** Returns bottom N countries sorted by score ascending */
export function getMostDangerousCountries(countries: ScoredCountry[], n: number): ScoredCountry[] {
  return [...countries].sort((a, b) => a.score - b.score).slice(0, n);
}

/** For solo travelers: weighted by crime (40%) + governance (40%) + overall (20%) */
export function getSafestForSoloTravelers(countries: ScoredCountry[], n: number): ScoredCountry[] {
  return [...countries]
    .map(c => {
      const crime = c.pillars.find(p => p.name === 'crime')?.score ?? 0;
      const governance = c.pillars.find(p => p.name === 'governance')?.score ?? 0;
      const overall = c.score / 10; // normalize to 0-1
      const weighted = crime * 0.4 + governance * 0.4 + overall * 0.2;
      return { ...c, _soloScore: weighted };
    })
    .sort((a, b) => b._soloScore - a._soloScore)
    .slice(0, n);
}

/** For families: weighted by health (35%) + governance (35%) + crime (20%) + overall (10%) */
export function getSafestForFamilies(countries: ScoredCountry[], n: number): ScoredCountry[] {
  return [...countries]
    .map(c => {
      const health = c.pillars.find(p => p.name === 'health')?.score ?? 0;
      const governance = c.pillars.find(p => p.name === 'governance')?.score ?? 0;
      const crime = c.pillars.find(p => p.name === 'crime')?.score ?? 0;
      const overall = c.score / 10;
      const weighted = health * 0.35 + governance * 0.35 + crime * 0.2 + overall * 0.1;
      return { ...c, _familyScore: weighted };
    })
    .sort((a, b) => b._familyScore - a._familyScore)
    .slice(0, n);
}

/** Countries where majority of advisories are level 4 (Do Not Travel) */
export function getCountriesToAvoid(countries: ScoredCountry[]): ScoredCountry[] {
  return [...countries]
    .filter(c => {
      const advisories = Object.values(c.advisories || {});
      if (advisories.length === 0) return false;
      const level4Count = advisories.filter(a => a && a.level === 4).length;
      return level4Count >= Math.ceil(advisories.length / 2);
    })
    .sort((a, b) => a.score - b.score);
}

/** Countries with biggest positive delta in last 7 days */
export function getImprovingSafety(
  countries: ScoredCountry[],
  history: Map<string, HistoryPoint[]>,
  n: number
): Array<ScoredCountry & { delta: number }> {
  return countries
    .map(c => {
      const points = history.get(c.iso3);
      if (!points || points.length < 2) return null;
      const latest = points[points.length - 1];
      const latestDate = new Date(latest.date).getTime();
      const targetDate = latestDate - 7 * 24 * 60 * 60 * 1000;
      let closestIdx = -1;
      let closestDiff = Infinity;
      for (let i = 0; i < points.length - 1; i++) {
        const diff = Math.abs(new Date(points[i].date).getTime() - targetDate);
        if (diff < closestDiff) { closestDiff = diff; closestIdx = i; }
      }
      if (closestIdx === -1 || closestDiff > 14 * 24 * 60 * 60 * 1000) return null;
      const delta = latest.score - points[closestIdx].score;
      return delta > 0 ? { ...c, delta } : null;
    })
    .filter((c): c is ScoredCountry & { delta: number } => c !== null)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, n);
}

/** Countries with biggest negative delta in last 7 days */
export function getDecliningCountries(
  countries: ScoredCountry[],
  history: Map<string, HistoryPoint[]>,
  n: number
): Array<ScoredCountry & { delta: number }> {
  return countries
    .map(c => {
      const points = history.get(c.iso3);
      if (!points || points.length < 2) return null;
      const latest = points[points.length - 1];
      const latestDate = new Date(latest.date).getTime();
      const targetDate = latestDate - 7 * 24 * 60 * 60 * 1000;
      let closestIdx = -1;
      let closestDiff = Infinity;
      for (let i = 0; i < points.length - 1; i++) {
        const diff = Math.abs(new Date(points[i].date).getTime() - targetDate);
        if (diff < closestDiff) { closestDiff = diff; closestIdx = i; }
      }
      if (closestIdx === -1 || closestDiff > 14 * 24 * 60 * 60 * 1000) return null;
      const delta = latest.score - points[closestIdx].score;
      return delta < 0 ? { ...c, delta } : null;
    })
    .filter((c): c is ScoredCountry & { delta: number } => c !== null)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, n);
}

/** Re-export for convenience */
export { getCountriesByRegion } from './regions';
export type { Region } from './regions';
