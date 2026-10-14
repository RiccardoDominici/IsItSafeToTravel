/**
 * Formula v10 top summary and indicator display (src/lib/country-summary.ts,
 * src/lib/indicator-display.ts): concrete facts with the source's own value, year and source,
 * advisories by level, a strong area only when it is good in absolute terms, and no figure at all
 * for a grey place.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IndicatorScore, PillarScore, ScoredCountry } from '../../pipeline/types';
import type { Lang } from '../../i18n/ui';
import { buildCountrySummary, buildAdvisorySentence, selectDriverPillar } from '../country-summary';
import {
  displayedIndicators,
  formatIndicatorValue,
  indicatorSourceLabel,
  pillarEvidenceCoverage,
  selectPillarDriver,
} from '../indicator-display';

const ind = (name: string, rawValue: number, normalizedValue: number, source: string, year: number): IndicatorScore => ({
  name,
  rawValue,
  normalizedValue,
  source,
  year,
});

const pillar = (name: PillarScore['name'], score: number, indicators: IndicatorScore[], weight = 0.2): PillarScore => ({
  name,
  score,
  weight,
  indicators,
  dataCompleteness: 1,
});

/** Ecuador as scored by v10 on the frozen 2026-10-14 fixture (values from the engine output). */
function ecuador(): ScoredCountry {
  const levels: Record<string, number> = { ee: 1, ie: 3, rs: 3, tw: 3 };
  const advisories: ScoredCountry['advisories'] = {};
  for (const key of ['us', 'uk', 'ca', 'au', 'de', 'nl', 'jp', 'sk', 'at', 'fr', 'nz', 'ie', 'be', 'rs', 'ee', 'it', 'es', 'tw', 'ch', 'pl', 'cz', 'hu']) {
    (advisories as Record<string, unknown>)[key] = { level: levels[key] ?? 2, text: '', source: key, url: '' };
  }
  return {
    iso3: 'ECU',
    name: { en: 'Ecuador', it: 'Ecuador', es: 'Ecuador', fr: 'Équateur', pt: 'Equador' },
    score: 5.923620909656415,
    scoreDisplay: 6,
    scoreStatus: 'scored',
    dataScore: 5.923620909656415,
    pillars: [
      pillar('conflict', 0.69, [ind('gpi_overall', 2.539, 0.487, 'gpi', 2026), ind('gpi_militarisation', 1.957, 0.76, 'gpi', 2026), ind('ucdp_conflict_deaths', 0, 1, 'ucdp', 2025)], 0.3),
      pillar('crime', 0.439, [ind('gpi_safety_security', 2.914, 0.5215, 'gpi', 2026), ind('wb_homicide', 45.7228145164847, 0.238, 'worldbank', 2023)], 0.25),
      pillar('health', 0.614, [ind('inform_health_access', 4.1, 0.59, 'inform', 2026), ind('inform_epidemic', 6.1, 0.39, 'inform', 2026)], 0.2),
      pillar('governance', 0.4, [ind('vdem_corruption_control', 0.652, 0.348, 'vdem', 2025), ind('inform_governance', 6.1, 0.39, 'inform', 2026)], 0.15),
      pillar('environment', 0.499, [ind('inform_natural', 6.5, 0.35, 'inform', 2026), ind('reliefweb_active_disasters', 3, 0.7, 'reliefweb', 2026)], 0.1),
    ],
    advisories,
    dataCompleteness: 1,
    confidence: 0.8,
    lastUpdated: '2026-10-15T00:00:00Z',
    sources: ['advisories', 'gpi', 'inform', 'reliefweb', 'ucdp', 'vdem', 'worldbank'].map((name) => ({ name, url: 'u', fetchedAt: '', description: '' })),
  };
}

const ctx = (lang: Lang) => ({ lang, name: lang === 'fr' ? 'Équateur' : lang === 'pt' ? 'Equador' : 'Ecuador', rank: 154, total: 192, snapshotDate: '2026-10-15' });

describe('country summary: scored country', () => {
  it('names the concrete driver with value, year and source (Ecuador: violent crime, not governance)', () => {
    const text = buildCountrySummary(ecuador(), ctx('en'));
    assert.match(text, /The main risk is violent crime: 45\.7 homicides per 100,000 people \(World Bank, 2023\)\./);
    assert.doesNotMatch(text, /biggest concern|strongest area/i);
  });

  it('ranks among countries with an official score and uses the snapshot date', () => {
    const text = buildCountrySummary(ecuador(), ctx('en'));
    assert.match(text, /ranking 154th of the 192 countries with an official score/);
    assert.match(text, /as of October 15, 2026/);
  });

  it('gives the advisory picture by level', () => {
    const text = buildCountrySummary(ecuador(), ctx('en'));
    assert.match(text, /Of the 22 governments that publish a travel advisory for Ecuador, 1 advises normal precautions, 18 advise increased caution and 3 advise reconsidering travel\./);
  });

  it('mentions no strong area when no pillar reaches 7.0 (conflict 6.9 is not a strength)', () => {
    const text = buildCountrySummary(ecuador(), ctx('en'));
    assert.doesNotMatch(text, /best-rated/);
  });

  it('writes the German driver with locale numbers and a capital after the colon only for sentences', () => {
    const text = buildCountrySummary(ecuador(), ctx('de'));
    assert.match(text, /Das größte Risiko ist die Gewaltkriminalität: 45,7 Tötungsdelikte je 100\.000 Einwohner \(Weltbank, 2023\)\./);
    assert.match(text, /22 Regierungen veröffentlichen Reisehinweise für Ecuador: 1 empfiehlt normale Vorsicht, 18 empfehlen erhöhte Vorsicht und 3 raten, die Reise zu überdenken\./);
  });

  it('keeps Chinese free of spaces around the country name', () => {
    const text = buildCountrySummary(ecuador(), ctx('zh'));
    assert.doesNotMatch(text, / Ecuador|Ecuador /);
  });

  it('mentions the best-rated area only when it is at 7.0 or above', () => {
    const c = ecuador();
    c.pillars = c.pillars.map((p) => (p.name === 'health' ? { ...p, score: 0.89 } : p));
    assert.match(buildCountrySummary(c, ctx('en')), /Its best-rated area is health \(8\.9\/10\)\./);
  });
});

describe('country summary: grey place', () => {
  it('says partial data, keeps the advisories, and shows no score, band or rank', () => {
    const grey: ScoredCountry = {
      ...ecuador(),
      iso3: 'ALA',
      name: { en: 'Aland Islands', it: 'Isole Åland', es: 'Islas Aland', fr: 'Îles Åland', pt: 'Ilhas Aland' },
      score: null,
      scoreDisplay: null,
      scoreStatus: 'insufficient_data',
      dataScore: null,
      advisories: { fi: { level: 1, text: '', source: 'fi', url: '' } },
      sources: [],
    };
    const text = buildCountrySummary(grey, { lang: 'en', name: 'Aland Islands', rank: 0, total: 192, snapshotDate: '2026-10-15' });
    assert.match(text, /There is no official safety score for the Aland Islands yet: fewer than four independent sources cover this place/);
    assert.match(text, /One government publishes a travel advisory for the Aland Islands, and it advises normal precautions\./);
    assert.doesNotMatch(text, /\/10|rank|\d+\.\d/);
  });
});

describe('country summary: driver pillar', () => {
  it('prefers the direct-risk pillar that drags the score most over governance', () => {
    assert.equal(selectDriverPillar(ecuador().pillars).pillar.name, 'crime');
  });

  it('names governance only when every direct-risk pillar is at 7.0 or above', () => {
    const pillars = ecuador().pillars.map((p) => ({ ...p, score: p.name === 'governance' ? 0.55 : 0.8 }));
    const pick = selectDriverPillar(pillars);
    assert.equal(pick.pillar.name, 'governance');
    assert.equal(pick.frame, 'weakest');
  });

  it('reports allGood when every pillar is at 7.0 or above', () => {
    const pillars = ecuador().pillars.map((p) => ({ ...p, score: 0.8 }));
    assert.equal(selectDriverPillar(pillars).frame, 'allGood');
  });
});

describe('advisory sentence', () => {
  it('handles none, one and all-same-level cases', () => {
    const names = { name: 'Japan', nameIn: 'in Giappone', namePrep: 'au Japon', nameA: 'ao Japão', nameDe: 'do Japão', nameFuer: 'für Japan' };
    assert.equal(buildAdvisorySentence([], 'en', names), 'No government in our dataset publishes a travel advisory for Japan.');
    assert.equal(buildAdvisorySentence([2], 'en', names), 'One government publishes a travel advisory for Japan, and it advises increased caution.');
    assert.equal(buildAdvisorySentence([1, 1, 1], 'en', names), 'All 3 governments that publish a travel advisory for Japan advise normal precautions.');
  });

  it('closes the German infinitive clause with a comma before the next item', () => {
    const names = { name: 'Israel', nameFuer: 'für Israel' };
    assert.equal(
      buildAdvisorySentence([3, 3, 4], 'de', names),
      '3 Regierungen veröffentlichen Reisehinweise für Israel: 2 raten, die Reise zu überdenken, und 1 rät von allen Reisen ab.',
    );
  });
});

describe('indicator display', () => {
  it('lists only indicators the current formula scores', () => {
    const p = pillar('health', 0.6, [
      ind('wb_child_mortality', 12.9, 0.93, 'worldbank', 2024),
      ind('inform_health', 7.1, 0.29, 'inform', 2026),
      ind('inform_epidemic', 6.1, 0.39, 'inform', 2026),
      ind('inform_health_access', 4.1, 0.59, 'inform', 2026),
    ]);
    assert.deepEqual(displayedIndicators(p).map((i) => i.name), ['inform_health_access', 'inform_epidemic']);
  });

  it('prints raw values on the source scale with units, per locale', () => {
    assert.deepEqual(formatIndicatorValue(ind('wb_homicide', 45.7228, 0.24, 'worldbank', 2023), 'en'), { value: '45.7', unit: 'per 100,000 people' });
    assert.deepEqual(formatIndicatorValue(ind('wb_homicide', 45.7228, 0.24, 'worldbank', 2023), 'de'), { value: '45,7', unit: 'je 100.000 Einwohner' });
    assert.deepEqual(formatIndicatorValue(ind('inform_health_access', 4.1, 0.59, 'inform', 2026), 'en'), { value: '4.1 / 10', unit: 'INFORM risk, higher is worse' });
    assert.deepEqual(formatIndicatorValue(ind('gpi_overall', 2.539, 0.49, 'gpi', 2026), 'en'), { value: '2.54', unit: 'GPI scale 1–5, lower is better' });
    assert.deepEqual(formatIndicatorValue(ind('ucdp_conflict_deaths', 0, 1, 'ucdp', 2025), 'en'), { value: '0', unit: 'conflict deaths' });
    assert.equal(formatIndicatorValue(ind('vdem_gov_effectiveness', -0.941, 0.37, 'vdem', 2025), 'en')?.value, '−0.94');
  });

  it('labels sources with their edition', () => {
    assert.equal(indicatorSourceLabel(ind('inform_natural', 6.5, 0.35, 'inform', 2026), 'en'), 'INFORM Risk 2026');
    assert.equal(indicatorSourceLabel(ind('gpi_overall', 2.5, 0.5, 'gpi', 2026), 'it'), 'GPI 2026');
    assert.equal(indicatorSourceLabel(ind('wb_homicide', 1, 1, 'worldbank', 2023), 'fr'), 'Banque mondiale');
  });

  it('passes over GPI militarisation as a driver when the pillar has another indicator', () => {
    const p = pillar('conflict', 0.5, [ind('gpi_overall', 2.9, 0.37, 'gpi', 2026), ind('gpi_militarisation', 3.5, 0.3, 'gpi', 2026)]);
    assert.equal(selectPillarDriver(p)?.name, 'gpi_overall');
    const only = pillar('conflict', 0.5, [ind('gpi_militarisation', 3.5, 0.3, 'gpi', 2026)]);
    assert.equal(selectPillarDriver(only)?.name, 'gpi_militarisation');
  });
});

describe('pillar evidence coverage', () => {
  it('does not count absent zero-precision alert feeds as missing data', () => {
    const p = { ...pillar('environment', 0.67, [ind('inform_natural', 4, 0.6, 'inform', 2026)]), dataCompleteness: 1 / 3 };
    assert.equal(pillarEvidenceCoverage(p), 1);
  });

  it('keeps the engine coverage when a scored indicator is missing', () => {
    const p = { ...pillar('environment', 0.5, [ind('reliefweb_active_disasters', 2, 0.8, 'reliefweb', 2026)]), dataCompleteness: 1 / 3 };
    assert.equal(pillarEvidenceCoverage(p), 1 / 3);
    const crime = { ...pillar('crime', 0.6, [ind('gpi_safety_security', 2, 0.75, 'gpi', 2026)]), dataCompleteness: 0.5 };
    assert.equal(pillarEvidenceCoverage(crime), 0.5);
  });
});
