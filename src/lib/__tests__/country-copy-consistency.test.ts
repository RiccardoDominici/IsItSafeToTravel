/**
 * Country-page copy consistency (2026-10-15 audit, scripts/calibration/consistency/issues.json):
 * the meta description, the top summary and the FAQ name the same pillar, follow the government
 * advisories, never call a weak pillar a strength, and keep country names grammatical.
 * Each test names the issue id it guards.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IndicatorScore, PillarName, PillarScore, ScoredCountry } from '../../pipeline/types';
import type { Lang } from '../../i18n/ui';
import { buildCountryFaqJsonLd, buildCountryMetaDescription, getCountryFaqData } from '../seo';
import { buildCountrySummary } from '../country-summary';
import { getAdvisoryConsensus } from '../advisory-consensus';
import { selectPillarFocus } from '../pillar-focus';
import { describeDriver, formatSourceNumber, selectBadDriver, worldBankLagNote } from '../indicator-display';

const ind = (name: string, rawValue: number, normalizedValue: number, source: string, year: number): IndicatorScore => ({
  name,
  rawValue,
  normalizedValue,
  source,
  year,
});

interface Fixture {
  iso3: string;
  score: number;
  pillars: Partial<Record<PillarName, { score: number; indicators?: IndicatorScore[]; dataCompleteness?: number }>>;
  advisories: Record<string, number>;
  confidence?: number;
}

const DEFAULT_INDICATORS: Record<PillarName, IndicatorScore[]> = {
  conflict: [ind('gpi_overall', 1.8, 0.73, 'gpi', 2026), ind('ucdp_conflict_deaths', 0, 1, 'ucdp', 2025)],
  crime: [ind('gpi_safety_security', 1.9, 0.7, 'gpi', 2026), ind('wb_homicide', 2, 0.95, 'worldbank', 2023)],
  health: [ind('inform_health_access', 2, 0.8, 'inform', 2026), ind('inform_epidemic', 3, 0.7, 'inform', 2026)],
  governance: [ind('vdem_rule_of_law', 0.8, 0.8, 'vdem', 2025), ind('inform_governance', 3, 0.7, 'inform', 2026)],
  environment: [ind('inform_natural', 3, 0.7, 'inform', 2026)],
};

function country(f: Fixture): ScoredCountry {
  const names: PillarName[] = ['conflict', 'crime', 'health', 'governance', 'environment'];
  const pillars: PillarScore[] = names.map((name) => {
    const p = f.pillars[name] ?? { score: 0.8 };
    return {
      name,
      score: p.score,
      weight: 0.2,
      indicators: p.indicators ?? DEFAULT_INDICATORS[name],
      dataCompleteness: p.dataCompleteness ?? 1,
    };
  });
  const advisories: ScoredCountry['advisories'] = {};
  for (const [key, level] of Object.entries(f.advisories)) {
    (advisories as Record<string, unknown>)[key] = { level, text: '', source: key, url: '' };
  }
  return {
    iso3: f.iso3,
    name: { en: f.iso3 },
    score: f.score,
    scoreDisplay: Math.round(f.score),
    scoreStatus: 'scored',
    dataScore: f.score,
    pillars,
    advisories,
    dataCompleteness: 1,
    confidence: f.confidence ?? 0.8,
    lastUpdated: '2026-10-15T00:00:00Z',
    sources: ['advisories', 'gpi', 'inform', 'ucdp', 'vdem', 'worldbank'].map((name) => ({ name, url: 'u', fetchedAt: '', description: '' })),
  } as ScoredCountry;
}

/** Many advisories at given levels: { 3: 11 } -> 11 governments at level 3. */
function advisoriesOf(spec: Partial<Record<1 | 2 | 3 | 4, number>>): Record<string, number> {
  const keys = ['us', 'uk', 'ca', 'au', 'de', 'fr', 'nl', 'nz', 'jp', 'at', 'ch', 'be', 'ie', 'es', 'it', 'dk', 'pl', 'cz', 'hu', 'ee', 'sk', 'rs', 'sg', 'tw', 'hk'];
  const out: Record<string, number> = {};
  let i = 0;
  for (const level of [4, 3, 2, 1] as const) for (let k = 0; k < (spec[level] ?? 0); k++) out[keys[i++]] = level;
  return out;
}

/** United Arab Emirates-like: good pillars, but most governments advise reconsidering travel. */
const uae = () =>
  country({
    iso3: 'ARE',
    score: 7.3,
    pillars: { conflict: { score: 0.71 }, crime: { score: 0.76 }, environment: { score: 0.53 }, governance: { score: 0.6 } },
    advisories: advisoriesOf({ 4: 1, 3: 10, 2: 9, 1: 1 }),
  });

/** Afghanistan-like: danger band, every government says do not travel. */
const afghanistan = () =>
  country({
    iso3: 'AFG',
    score: 3.6,
    pillars: {
      conflict: { score: 0.3, indicators: [ind('gpi_overall', 3.11, 0.3, 'gpi', 2026), ind('ucdp_conflict_deaths', 1200, 0.2, 'ucdp', 2025)] },
      crime: { score: 0.5 },
      health: { score: 0.43 },
      governance: { score: 0.18 },
      environment: { score: 0.45 },
    },
    advisories: advisoriesOf({ 4: 22 }),
  });

/** Mozambique-like: conflict is the BEST bar and must not be the main concern (I02). */
const mozambique = () =>
  country({
    iso3: 'MOZ',
    score: 5.5,
    pillars: {
      conflict: { score: 0.55 },
      crime: { score: 0.52 },
      health: { score: 0.49, indicators: [ind('inform_health_access', 6.9, 0.31, 'inform', 2026)] },
      governance: { score: 0.34 },
      environment: { score: 0.5 },
    },
    advisories: advisoriesOf({ 2: 18, 3: 2 }),
  });

/** Nauru-like: measured pillars 7+, two low-coverage estimates below 7 (I05). */
const nauru = () =>
  country({
    iso3: 'NRU',
    score: 7.4,
    pillars: {
      conflict: { score: 0.89, dataCompleteness: 0.5, indicators: [ind('ucdp_conflict_deaths', 0, 1, 'ucdp', 2025)] },
      crime: { score: 0.57, dataCompleteness: 0, indicators: [] },
      health: { score: 0.76 },
      governance: { score: 0.54, dataCompleteness: 0.25, indicators: [ind('inform_governance', 5, 0.5, 'inform', 2026)] },
      environment: { score: 0.81 },
    },
    advisories: advisoriesOf({ 1: 14, 2: 3 }),
  });

const LANGS: Lang[] = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'];
const faq = (c: ScoredCountry, lang: Lang) => getCountryFaqData(c, lang);
const summary = (c: ScoredCountry, lang: Lang, name: string) =>
  buildCountrySummary(c, { lang, name, rank: 70, total: 192, snapshotDate: '2026-10-15' });

describe('one focus pillar on every surface (I01 I02 I16 I25 I30)', () => {
  it('names the weakest direct-risk bar in the description, the summary and both FAQ answers', () => {
    const c = mozambique();
    assert.equal(selectPillarFocus(c.pillars).focus.name, 'health');
    assert.match(buildCountryMetaDescription(c, 'en'), /Main risk: health \(4\.9\) and natural hazards \(5\.0\)\./);
    const text = summary(c, 'en', 'Mozambique');
    assert.match(text, /The main risk is health \(4\.9\/10\), above all poor access to health care: 6\.9 out of 10 on the INFORM risk scale/);
    assert.match(text, /The natural hazards score is almost as low \(5\.0\/10\)\. At 3\.4\/10, governance scores even lower than health \(4\.9\/10\)/);
    const [a1, a2] = faq(c, 'en');
    assert.match(a1.answer, /The main risk is health \(4\.9\/10\)\./);
    assert.match(a2.answer, /^The main risk for travelers to Mozambique is health, at 4\.9\/10\./);
    for (const qa of faq(c, 'en')) assert.doesNotMatch(qa.answer, /conflict \(5\.5\/10\) is|main concern is conflict|No single factor|pulled down/);
  });

  it('never presents a pillar below 7.0 as a strength (I16)', () => {
    const [a1, a2] = faq(afghanistan(), 'en');
    assert.match(a2.answer, /Even the best-rated area, crime, scores only 5\.0\/10\./);
    assert.match(a1.answer, /Even the best-rated area, crime, scores only 5\.0\/10\./);
    assert.doesNotMatch(a1.answer + a2.answer, /strongest/);
  });

  it('calls no pillar the main risk when all five are at 7.0+ (I30)', () => {
    const c = country({
      iso3: 'CZE',
      score: 8.7,
      pillars: { conflict: { score: 0.88 }, crime: { score: 0.83 }, health: { score: 0.88 }, governance: { score: 0.8 }, environment: { score: 0.86 } },
      advisories: advisoriesOf({ 1: 16 }),
    });
    const meta = buildCountryMetaDescription(c, 'de');
    assert.match(meta, /Alle fünf Bereiche bei 7\/10 oder mehr; am niedrigsten: Regierungsführung \(8\.0\)/);
    assert.doesNotMatch(meta, /Hauptrisiko/);
  });

  it('names a displayed tie as a tie, never "above all" one of them (I54)', () => {
    const c = country({ iso3: 'BWA', score: 7.5, pillars: { crime: { score: 0.664 }, health: { score: 0.656 }, conflict: { score: 0.79 } }, advisories: advisoriesOf({ 1: 13, 2: 7, 3: 1 }) });
    const text = summary(c, 'en', 'Botswana');
    assert.match(text, /The main concern is crime \(6\.6\/10\)\. The health score is the same \(6\.6\/10\)\./);
    assert.match(buildCountryMetaDescription(c, 'en'), /Main concern: crime and health \(6\.6\)/);
  });
});

describe('government advice leads where it is the strongest signal (review 2026-10-15)', () => {
  it('opens the meta description and the summary with the advisory majority', () => {
    const c = uae();
    assert.match(buildCountryMetaDescription(c, 'en'), /^United Arab Emirates safety score: 7\.3\/10 \(Low risk\)\. 11 of 21 governments advise reconsidering travel or avoiding it altogether\./);
    assert.match(summary(c, 'en', 'United Arab Emirates'), /countries we score\. Government advice is the strongest warning here: 11 of 21 governments advise reconsidering travel or avoiding it altogether\. The main concern is/);
    assert.match(buildCountryMetaDescription(c, 'de'), /11 der 21 Regierungen raten, die Reise zu überdenken oder ganz darauf zu verzichten\./);
  });

  it('answers No for a level-4 majority in any band', () => {
    const belarus = country({ iso3: 'BLR', score: 5.5, pillars: { conflict: { score: 0.56 }, governance: { score: 0.38 } }, advisories: advisoriesOf({ 4: 12, 3: 4, 2: 3 }) });
    assert.match(faq(belarus, 'en')[0].answer, /^No — 12 of 19 governments advise against all travel/);
  });

  it('does not point to advisories that do not exist on a page without a score', () => {
    const grey = { ...country({ iso3: 'CCK', score: 7, pillars: {}, advisories: {} }), score: null, scoreStatus: 'insufficient_data' } as unknown as ScoredCountry;
    assert.doesNotMatch(faq(grey, 'en')[0].answer, /advisories below/);
    assert.match(buildCountryMetaDescription(grey, 'en'), /no government advisory on record/);
    assert.doesNotMatch(buildCountryMetaDescription(grey, 'en'), /official/);
  });
});

describe('measured values versus estimates (I05 I07)', () => {
  it('says "all five" only when all five bars are at 7.0+, and flags lower estimates', () => {
    const c = nauru();
    const text = summary(c, 'en', 'Nauru');
    assert.doesNotMatch(text, /All five areas/);
    assert.match(text, /Every area measured with enough data scores at least 7 out of 10; the lowest of them is health \(7\.6\/10\)\./);
    assert.match(text, /The values for governance \(5\.4\/10\) and crime \(5\.7\/10\) are cautious estimates/);
    const a2 = faq(c, 'en')[1].answer;
    assert.doesNotMatch(a2, /all five|precautions are enough/);
    assert.match(a2, /cautious estimates/);
    assert.match(buildCountryMetaDescription(c, 'en'), /too little data on governance and crime/);
  });
});

describe('verdict follows the government advisories (I06 I18 I23)', () => {
  it('never opens with "Yes" when most governments advise reconsidering travel or worse', () => {
    for (const lang of LANGS) {
      const a1 = faq(uae(), lang)[0].answer;
      assert.doesNotMatch(a1, /^(Yes|Sì|Sí|Oui|Sim|Ja|是的|总体而言是的|可以)/, `${lang}: ${a1.slice(0, 80)}`);
    }
    assert.match(faq(uae(), 'en')[0].answer, /^The score is 7\.3\/10 as of .+, classified as low risk, but 11 of 21 governments advise reconsidering travel or avoiding it altogether: read their warnings below before you decide\./);
  });

  it('says No and advises against travel where most governments say do not travel', () => {
    const a1 = faq(afghanistan(), 'en')[0].answer;
    assert.match(a1, /^No — all 22 governments advise against all travel, and as of .+ Afghanistan scores only 3\.6\/10 on our safety index, classified as high risk\. We advise against travel there\./);
    for (const lang of LANGS) assert.doesNotMatch(faq(afghanistan(), lang)[0].answer, /serious caution|grande prudenza|extremar las precauciones|grande prudence|muita cautela|erhebliche Vorsicht|格外谨慎/);
  });

  it('opens the 5-6 band with the hero badge words', () => {
    assert.match(faq(mozambique(), 'en')[0].answer, /^Only for experienced travelers — /);
    assert.match(faq(mozambique(), 'pt')[0].answer, /^Apenas para viajantes experientes — /);
    assert.doesNotMatch(faq(mozambique(), 'pt')[0].answer, /cautela real/);
    assert.doesNotMatch(faq(mozambique(), 'de')[0].answer, /als hohe Vorsicht geboten eingestuft/);
  });
});

describe('advisory answer from the real distribution (I03 I14 I15 I19 I59)', () => {
  it('counts majorities strictly and resolves modal ties upward', () => {
    const k = getAdvisoryConsensus(country({ iso3: 'GAB', score: 6.5, pillars: {}, advisories: advisoriesOf({ 1: 10, 2: 7, 3: 2, 4: 1 }) }));
    assert.deepEqual([k.n, k.modal, k.max, k.reconsiderOrWorse, k.majorityReconsiderOrWorse], [20, 1, 4, 3, false]);
    assert.equal(getAdvisoryConsensus(country({ iso3: 'X', score: 6, pillars: {}, advisories: advisoriesOf({ 1: 5, 2: 5 }) })).modal, 2);
  });

  it('gives the breakdown and names the strictest issuers with their article', () => {
    const c = country({ iso3: 'GAB', score: 6.5, pillars: {}, advisories: { us: 4, uk: 1, ca: 1, au: 1, de: 2 } });
    const en = faq(c, 'en')[2].answer;
    assert.match(en, /of the 5 governments that publish a travel advisory for Gabon, 3 advise normal precautions, 1 advises increased caution and 1 advises against all travel\./);
    assert.match(en, /Only the United States advises against all travel\./);
    assert.doesNotMatch(en, /reassuring|none currently raises|most governments/i);
    assert.match(faq(c, 'fr')[2].answer, /émane d’un seul gouvernement\s: les États-Unis\./);
    assert.match(faq(c, 'de')[2].answer, /spricht nur eine Regierung aus: die Vereinigten Staaten\./);
  });

  it('leaves the strictest clause out when it is the most common level, and counts many issuers', () => {
    const same = faq(country({ iso3: 'PER', score: 6.9, pillars: {}, advisories: advisoriesOf({ 2: 18, 1: 3 }) }), 'en')[2].answer;
    assert.doesNotMatch(same, /strictest/);
    assert.match(same, /No government advises more than increased caution\./);
    const many = faq(country({ iso3: 'SAU', score: 6.2, pillars: {}, advisories: advisoriesOf({ 4: 5, 3: 10, 2: 6 }) }), 'en')[2].answer;
    assert.match(many, /The 5 governments that advise against all travel include the United States and the United Kingdom\./);
  });

  it('reads the Italian article before 8 and 11 as "degli" / "gli"', () => {
    const it8 = faq(country({ iso3: 'CYM', score: 7, pillars: {}, advisories: advisoriesOf({ 1: 7, 2: 1 }) }), 'it')[2].answer;
    assert.match(it8, /degli 8 governi/);
    const it11 = summary(country({ iso3: 'HRV', score: 8, pillars: {}, advisories: advisoriesOf({ 1: 11 }) }), 'it', 'Croazia');
    assert.match(it11, /Tutti gli 11 governi/);
  });

  it('names the only government instead of "most governments" for a single advisory', () => {
    const c = country({ iso3: 'IMN', score: 7.5, pillars: {}, advisories: { pl: 1 } });
    assert.match(faq(c, 'en')[2].answer, /only one government in our dataset publishes a travel advisory for the Isle of Man: Poland, which advises normal precautions\./);
    assert.match(faq(c, 'it')[2].answer, /un solo governo nei nostri dati pubblica avvisi per chi viaggia/);
  });

  it('has no unsupported generalisation and uses 您 when no advisory exists', () => {
    const c = country({ iso3: 'CCK', score: 7, pillars: {}, advisories: {} });
    assert.doesNotMatch(faq(c, 'en')[2].answer, /typically|remote territories/);
    assert.match(faq(c, 'zh')[2].answer, /您所在国家/);
    assert.doesNotMatch(faq(c, 'zh')[2].answer, /你/);
  });
});

describe('grammar of names and sentences (I38 I39 I40 I41 I48 I60 I63 I65)', () => {
  it('starts every en/it/es/fr/pt/de sentence with a capital and leaves no placeholder', () => {
    for (const c of [uae(), afghanistan(), mozambique(), nauru()]) {
      for (const lang of LANGS) {
        for (const qa of faq(c, lang)) {
          const text = `${qa.question} ${qa.answer}`;
          assert.doesNotMatch(text, /\{\w+\}|undefined|NaN/, `${c.iso3} ${lang}`);
          if (lang !== 'zh') assert.doesNotMatch(text, /[.!?]\s+[a-zà-öø-ÿ]/u, `${c.iso3} ${lang}: ${text}`);
          else assert.doesNotMatch(text, /[一-鿿] [一-鿿]|\d 年/, `${c.iso3} zh`);
        }
      }
    }
  });

  it('puts the article or preposition every locale needs around the country name', () => {
    const it_ = faq(uae(), 'it').map((qa) => qa.question + qa.answer).join(' ');
    assert.match(it_, /negli Emirati Arabi Uniti/);
    assert.doesNotMatch(it_, /\b(di|su|per|da) Emirati/);
    const fr = faq(uae(), 'fr').map((qa) => qa.question + qa.answer).join(' ');
    assert.match(fr, /aux Émirats arabes unis/);
    assert.doesNotMatch(fr, /\bde Émirats|\bpour Émirats|^Émirats arabes unis est/m);
    const de = faq(uae(), 'de').map((qa) => qa.question + qa.answer).join(' ');
    assert.match(de, /über die Vereinigten Arabischen Emirate\?/);
    assert.doesNotMatch(de, /von Vereinigte|Säule von/);
    const pt = faq(afghanistan(), 'pt').map((qa) => qa.question + qa.answer).join(' ');
    assert.match(pt, /do Afeganistão/);
    assert.doesNotMatch(pt, /\bde Afeganistão|(?<!do )Afeganistão é/);
  });

  it('writes no possessive on plural-form names (I65)', () => {
    const c = country({ iso3: 'PHL', score: 6.1, pillars: { environment: { score: 0.38 } }, advisories: advisoriesOf({ 2: 18, 3: 2, 1: 1 }) });
    for (const qa of faq(c, 'en')) assert.doesNotMatch(qa.answer, /Philippines's|Philippines has/);
  });

  it('uses Spanish pillar names inside an "área" frame, never bare after "es" (I63)', () => {
    const es = faq(mozambique(), 'es').map((qa) => qa.answer).join(' ');
    assert.doesNotMatch(es, / es (conflicto|criminalidad|salud|gobernanza|riesgos naturales)\b/);
    assert.match(es, /el área de salud/);
  });
});

describe('meta description provenance (I13 I62)', () => {
  it('counts this country’s own advisories and datasets, never the site-wide "30+"', () => {
    const c = country({ iso3: 'JPN', score: 8.1, pillars: { environment: { score: 0.66 } }, advisories: advisoriesOf({ 1: 18, 2: 4 }) });
    const meta = buildCountryMetaDescription(c, 'en');
    assert.doesNotMatch(meta, /30\+/);
    assert.match(meta, /Score based on 22 advisories and 5 datasets, recalculated daily\./);
    assert.doesNotMatch(buildCountryMetaDescription(mozambique(), 'de'), /Kostenloser Wert/);
  });
});

describe('FAQPage JSON-LD matches the visible FAQ', () => {
  it('carries exactly the visible questions and answers', () => {
    for (const lang of LANGS) {
      const c = uae();
      const visible = faq(c, lang);
      const ld = buildCountryFaqJsonLd(c, lang) as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
      assert.deepEqual(
        ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]),
        visible.map((qa) => [qa.question, qa.answer]),
      );
    }
  });
});

describe('indicator facts (I04 I17 I53 I61 I64)', () => {
  it('never quotes a good value as the main risk', () => {
    const qatarConflict: PillarScore = { name: 'conflict', score: 0.68, weight: 0.3, dataCompleteness: 1, indicators: [ind('gpi_overall', 1.676, 0.775, 'gpi', 2026)] };
    assert.equal(selectBadDriver(qatarConflict), null);
  });

  it('describes both ends of the GPI scale with the edition in the subject', () => {
    const fact = describeDriver(ind('gpi_overall', 3.11, 0.3, 'gpi', 2026), 'en')!.fact;
    assert.equal(fact, 'the 2026 Global Peace Index scores the country 3.11 on a scale from 1 (most peaceful) to 5 (least peaceful)');
    for (const lang of LANGS) assert.doesNotMatch(describeDriver(ind('gpi_safety_security', 2.9, 0.4, 'gpi', 2026), lang)!.fact, /5 \(GPI|avalia/);
  });

  it('drops the wrong "1-2 year lag" claim from the World Bank note', () => {
    for (const lang of LANGS) assert.doesNotMatch(worldBankLagNote(lang), /1[–-]2|1 o 2|1 à 2|1 a 2/);
  });

  it('groups Italian four-digit counts like the larger ones', () => {
    assert.equal(formatSourceNumber(2428, 0, 'it'), '2.428');
    assert.equal(formatSourceNumber(2428, 0, 'es'), '2428');
  });

  it('uses one Chinese term for level 4 in the summary and the FAQ', () => {
    const zhSummary = summary(afghanistan(), 'zh', '阿富汗');
    assert.match(zhSummary, /建议切勿前往/);
    assert.doesNotMatch(zhSummary + faq(afghanistan(), 'zh').map((qa) => qa.answer).join(''), /避免一切旅行|风险等级为/);
  });
});
