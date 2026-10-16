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
import { describeDriver, selectBadDriver, worldBankLagNote } from '../indicator-display';
import { formatNumber } from '../display-number';
import { buildBestSentence } from '../pillar-narrative';

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
    assert.match(a1.answer, /Even the best-rated area, crime, scores only 5\.0\/10\./);
    assert.doesNotMatch(a1.answer + a2.answer, /strongest/);
  });

  it('says the best-rated area once per page, in A1 only (task 8: ECU repeated it in Q1 and Q2)', () => {
    let checked = 0;
    for (const lang of LANGS) {
      for (const c of [afghanistan(), mozambique(), uae()]) {
        const best = buildBestSentence(selectPillarFocus(c.pillars), lang, true);
        if (!best) continue;
        const [a1, a2] = faq(c, lang);
        assert.ok(!a2.answer.includes(best.replace(/^./, '')), `${c.iso3} ${lang}: A2 repeats "${best}"`);
        if (a1.answer.includes(best.replace(/^./, ''))) checked++;
      }
    }
    assert.ok(checked > 0, 'no best-area sentence found in any A1');
  });

  it('opens the provenance sentence with the score as subject, never "It" (task 8)', () => {
    const text = summary(uae(), 'en', 'United Arab Emirates');
    assert.match(text, /The score combines \d+ (of the \d+ )?government travel advisories/);
    assert.doesNotMatch(text, /\bIt combines\b/);
  });

  it('calls no pillar the main risk when all five are at 7.0+ (I30)', () => {
    const c = country({
      iso3: 'CZE',
      score: 8.7,
      pillars: { conflict: { score: 0.88 }, crime: { score: 0.83 }, health: { score: 0.88 }, governance: { score: 0.8 }, environment: { score: 0.86 } },
      advisories: advisoriesOf({ 1: 16 }),
    });
    const meta = buildCountryMetaDescription(c, 'de');
    assert.match(meta, /Alle fünf Bereiche bei 7\/10 oder mehr; am niedrigsten: Regierungsführung \(8,0\)/);
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
    // Governance prints its value with the asterisk; crime's bar reads "No data", so no number (task 7).
    assert.match(text, /The value for governance \(5\.4\/10\) is a cautious estimate: there is too little data to measure it\. There is no data on crime yet\./);
    const a2 = faq(c, 'en')[1].answer;
    assert.doesNotMatch(a2, /all five|precautions are enough/);
    assert.match(a2, /cautious estimate/);
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
    // 22 governments publish advice; jp, ch, be, ie, es and sk are frozen-excluded issuers (task 5).
    assert.match(meta, /Score based on 16 of 22 advisories and 5 datasets, recalculated daily\./);
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
    assert.equal(formatNumber(2428, 0, 'it'), '2.428');
    assert.equal(formatNumber(2428, 0, 'es'), '2428');
  });

  it('uses one Chinese term for level 4 in the summary and the FAQ', () => {
    const zhSummary = summary(afghanistan(), 'zh', '阿富汗');
    assert.match(zhSummary, /建议切勿前往/);
    assert.doesNotMatch(zhSummary + faq(afghanistan(), 'zh').map((qa) => qa.answer).join(''), /避免一切旅行|风险等级为/);
  });
});

describe('the advisory count in the provenance sentence is the one the score uses (task 5, 2026-10-15)', () => {
  // Micronesia's shape: 13 governments publish advice, 3 of them (jp, ie, es) are frozen-excluded
  // issuers (weights.json frozenExcludedSources), so 10 enter the score.
  const fsm = () =>
    country({
      iso3: 'FSM',
      score: 7.4,
      pillars: { environment: { score: 0.62 } },
      advisories: { us: 1, uk: 1, ca: 1, au: 1, de: 1, fr: 1, nl: 1, nz: 1, at: 1, it: 1, jp: 1, ie: 1, es: 1 },
    });

  it('summary says both numbers, in every language', () => {
    const expected: Record<Lang, RegExp> = {
      en: /combines 10 of the 13 government travel advisories and 5 other public datasets/,
      it: /combina 10 dei 13 avvisi di viaggio governativi e altri 5 dataset pubblici/,
      es: /combina 10 de los 13 avisos de viaje gubernamentales y otros 5 conjuntos de datos públicos/,
      fr: /combine 10 des 13 avis aux voyageurs officiels et 5 autres jeux de données publics/,
      pt: /combina 10 dos 13 avisos de viagem governamentais e outros 5 conjuntos de dados públicos/,
      zh: /综合了13条政府旅行警告中的10条和另外5个公开数据集/,
      de: /kombiniert 10 der 13 staatlichen Reisehinweise und 5 weitere öffentliche Datensätze/,
    };
    for (const [lang, re] of Object.entries(expected) as Array<[Lang, RegExp]>) assert.match(summary(fsm(), lang, 'Micronesia'), re, lang);
  });

  it('meta description gives the same two numbers when its tail fits', () => {
    const meta = buildCountryMetaDescription(fsm(), 'en');
    assert.match(meta, /Score based on 10 of 13 advisories and 5 datasets, recalculated daily\./);
    for (const lang of ['it', 'es', 'fr', 'pt', 'zh', 'de'] as const) {
      const m = buildCountryMetaDescription(fsm(), lang);
      // The tail is dropped only when the description would pass 155 characters.
      if (/\b10\b|10份/.test(m.replace(/^[^.。]*[.。]/, ''))) assert.match(m, /13/, `${lang}: ${m}`);
    }
  });

  it('keeps the plain count when every published advisory is used', () => {
    const c = country({ iso3: 'XXX', score: 7.4, pillars: {}, advisories: { us: 1, uk: 2, ca: 1 } });
    assert.match(summary(c, 'en', 'Xland'), /combines 3 government travel advisories and 5 other public datasets/);
    assert.match(buildCountryMetaDescription(c, 'en'), /Score based on 3 advisories and 5 datasets/);
  });

  it('never counts an excluded issuer', () => {
    const c = country({ iso3: 'XXX', score: 7.4, pillars: {}, advisories: { jp: 1, ie: 1, es: 1, us: 1 } });
    assert.match(summary(c, 'en', 'Xland'), /combines 1 of the 4 government travel advisories/);
  });
});

describe('advisory issuers and Spanish place names carry their articles (task 6, 2026-10-15)', () => {
  // Two governments at "reconsider travel" above an "increased caution" majority: the strictest
  // issuers are named.
  const twoStrict = () =>
    country({ iso3: 'ARM', score: 6.4, pillars: {}, advisories: { us: 3, uk: 3, ca: 2, au: 2, de: 2, fr: 2, nl: 2, at: 1 } });

  it('names the strictest issuers with the article of running prose in it, es, pt, fr, de', () => {
    const a3 = (lang: Lang) => faq(twoStrict(), lang)[2].answer;
    assert.match(a3('it'), /viene da 2 governi: gli Stati Uniti e il Regno Unito\./);
    assert.match(a3('es'), /procede de 2 gobiernos: Estados Unidos y el Reino Unido\./);
    assert.match(a3('pt'), /vem de 2 governos: os Estados Unidos e o Reino Unido\./);
    assert.match(a3('fr'), /émane de 2 gouvernements : les États-Unis et le Royaume-Uni\./);
    assert.match(a3('de'), /sprechen 2 Regierungen aus: die Vereinigten Staaten und das Vereinigte Königreich\./);
  });

  it('a single issuer agrees with "one government" whatever its number', () => {
    const one = country({ iso3: 'ALA', score: 7.5, pillars: {}, advisories: { us: 1 } });
    const a3 = (lang: Lang) => faq(one, lang)[2].answer;
    assert.match(a3('it'), /: quello degli Stati Uniti, che raccomanda/);
    assert.match(a3('es'), /: el de Estados Unidos, que recomienda/);
    assert.match(a3('pt'), /: o dos Estados Unidos, que recomenda/);
    assert.match(a3('fr'), / : celui des États-Unis, qui recommande/);
    const uk = country({ iso3: 'IOT', score: 7.5, pillars: {}, advisories: { uk: 1 } });
    assert.match(faq(uk, 'es')[2].answer, /: el del Reino Unido, que recomienda/);
    assert.match(faq(uk, 'it')[2].answer, /: quello del Regno Unito, che raccomanda/);
  });

  it('Spanish keeps the article after a preposition and a singular verb in subject position', () => {
    const gbr = country({ iso3: 'GBR', score: 8.4, pillars: {}, advisories: { us: 1, ca: 2 } });
    assert.match(summary(gbr, 'es', 'Reino Unido'), /^El Reino Unido tiene una puntuación/);
    assert.match(summary(gbr, 'es', 'Reino Unido'), /para quien viaja al Reino Unido/);
    assert.match(getCountryFaqData(gbr, 'es')[0].question, /^¿Es seguro viajar al Reino Unido en \d{4}\?$/);
    const nld = country({ iso3: 'NLD', score: 8.4, pillars: {}, advisories: { us: 1, ca: 2 } });
    assert.match(summary(nld, 'es', 'Países Bajos'), /^Países Bajos tiene una puntuación/);
    assert.match(summary(nld, 'es', 'Países Bajos'), /para quien viaja a los Países Bajos/);
    assert.doesNotMatch(faq(nld, 'es').map((qa) => qa.answer).join(' '), /los Países Bajos (es|obtiene|tiene)\b/);
  });
});

describe('a pillar whose bar reads "No data" has no number in the text (task 7, 2026-10-15)', () => {
  // Nauru's shape: crime has nothing measured (isEstimatedPillar), governance is a low-coverage
  // estimate that still prints its value with the asterisk.
  const nauru = () =>
    country({
      iso3: 'NRU',
      score: 7.4,
      pillars: {
        conflict: { score: 0.89 },
        crime: { score: 0.57, indicators: [], dataCompleteness: 0 },
        health: { score: 0.76 },
        governance: { score: 0.54, indicators: [ind('inform_governance', 5, 0.5, 'inform', 2026)], dataCompleteness: 0.25 },
        environment: { score: 0.81 },
      },
      advisories: advisoriesOf({ 1: 14, 2: 3 }),
    });
  // Taiwan's shape: health and natural hazards have no INFORM data at all.
  const taiwan = () =>
    country({
      iso3: 'TWN',
      score: 7.9,
      pillars: {
        conflict: { score: 0.85 },
        crime: { score: 0.75 },
        health: { score: 0.67, indicators: [], dataCompleteness: 0 },
        governance: { score: 0.8 },
        environment: { score: 0.62, indicators: [], dataCompleteness: 0 },
      },
      advisories: advisoriesOf({ 1: 17 }),
    });
  const texts = (c: ScoredCountry, lang: Lang, name: string) =>
    [summary(c, lang, name), buildCountryMetaDescription(c, lang), ...faq(c, lang).map((qa) => qa.answer)].join(' ');

  it('never quotes the prior of a "No data" pillar, in any language', () => {
    for (const lang of LANGS) {
      for (const [c, name, empty] of [[nauru(), 'Nauru', ['5.7', '5,7']], [taiwan(), 'Taiwan', ['6.7', '6,7', '6.2', '6,2']]] as const) {
        const all = texts(c, lang, name);
        for (const v of empty) assert.ok(!all.includes(`${v}/10`) && !all.includes(`(${v})`), `${c.iso3} ${lang}: quotes ${v}\n${all}`);
      }
    }
  });

  it('says there is no data instead, and keeps the value of an asterisked estimate', () => {
    const en = summary(nauru(), 'en', 'Nauru');
    assert.match(en, /The value for governance \(5\.4\/10\) is a cautious estimate: there is too little data to measure it\. There is no data on crime yet\./);
    assert.match(summary(taiwan(), 'en', 'Taiwan'), /There is no data on (natural hazards and health|health and natural hazards) yet\./);
    assert.match(summary(nauru(), 'de', 'Nauru'), /Für den Bereich Kriminalität liegen noch keine Daten vor\./);
    assert.match(summary(nauru(), 'it', 'Nauru'), /Per l'area della criminalità non ci sono ancora dati\./);
    assert.match(summary(nauru(), 'zh', '瑙鲁'), /犯罪方面暂无数据。/);
  });

  it('a "No data" pillar is never the focus, the best area or part of "all five at 7+"', () => {
    const focus = selectPillarFocus(taiwan().pillars);
    assert.notEqual(focus.focus.name, 'health');
    assert.notEqual(focus.focus.name, 'environment');
    assert.equal(focus.allFiveAtLeast7, false);
    assert.deepEqual(focus.noData.map((p) => p.name).sort(), ['environment', 'health']);
    assert.doesNotMatch(buildCountryMetaDescription(taiwan(), 'en'), /All five areas/);
  });
});
