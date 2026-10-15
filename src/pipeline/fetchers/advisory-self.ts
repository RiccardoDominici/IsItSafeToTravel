import type { RawIndicator } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { getCountryByIso2 } from '../config/countries.js';

/**
 * A government's own foreign ministry is never a travel advisory for its own country
 * (consistency issue I51, 2026-10-15).
 *
 * Several ministries list their home country among their destination pages: Austria's
 * BMEIA has a "land/oesterreich" page ("Sichere Lage"), Argentina's alert list carries an
 * "Argentina" row ("Precaucion"). The fetchers turned those rows into advisory_level_at
 * for AUT and advisory_level_ar for ARG, so both countries listed their own government
 * among the issuers and counted it in the advisory consensus that enters the score. A home
 * ministry's page addresses its own nationals travelling abroad (or foreigners' entry
 * formalities), not a verdict on its own country's safety.
 *
 * One rule for every issuer: the issuer key's home country is dropped from that issuer's
 * indicators and side-channel info. Every advisory writer (advisories.ts and the five
 * tier files) applies it to what it is about to write, live rows and cache restores alike.
 */

/**
 * Home ISO3 of an advisory issuer key ("at" -> AUT). Issuer keys are ISO 3166-1 alpha-2
 * codes, except "uk" (the ISO code is GB). Null for a key that resolves to no country.
 */
export function issuerHomeIso3(issuerKey: string): string | null {
  const iso2 = issuerKey.toLowerCase() === 'uk' ? 'GB' : issuerKey;
  return getCountryByIso2(iso2)?.iso3 ?? null;
}

/** Issuer key carried by an advisory indicator's source tag ("advisories_at" -> "at"), or null. */
function issuerOfSource(source: string): string | null {
  return /^advisories_([a-z]{2})$/.exec(source)?.[1] ?? null;
}

/**
 * Remove every issuer-about-itself entry, in place, from an advisory writer's indicators and
 * info map. Returns one "<issuer> -> <ISO3>" line per info entry removed, for the log.
 */
export function dropSelfAdvisories(indicators: RawIndicator[], advisoryInfo: AdvisoryInfoMap): string[] {
  for (let i = indicators.length - 1; i >= 0; i--) {
    const issuer = issuerOfSource(indicators[i].source);
    if (issuer && issuerHomeIso3(issuer) === indicators[i].countryIso3) indicators.splice(i, 1);
  }

  const dropped: string[] = [];
  const info = advisoryInfo as Record<string, Record<string, unknown> | undefined>;
  for (const [iso3, entry] of Object.entries(info)) {
    if (!entry) continue;
    for (const issuer of Object.keys(entry)) {
      if (issuerHomeIso3(issuer) !== iso3) continue;
      delete entry[issuer];
      dropped.push(`${issuer} -> ${iso3}`);
    }
    if (Object.keys(entry).length === 0) delete info[iso3];
  }
  return dropped;
}

/** dropSelfAdvisories plus the log line every writer prints when something was dropped. */
export function dropSelfAdvisoriesLogged(
  logPrefix: string,
  indicators: RawIndicator[],
  advisoryInfo: AdvisoryInfoMap,
): void {
  const dropped = dropSelfAdvisories(indicators, advisoryInfo);
  if (dropped.length > 0) {
    console.log(
      `${logPrefix} Dropped ${dropped.length} advisory/advisories a ministry published about its own country (never counted): ${dropped.join(', ')}`,
    );
  }
}
