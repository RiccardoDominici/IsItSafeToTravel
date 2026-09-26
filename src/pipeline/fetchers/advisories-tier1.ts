import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { enforcePerSourceFloors } from './source-floor.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import type { UnifiedLevel } from '../normalize/advisory-levels.js';
import {
  normalizeDeLevel,
  normalizeDeContentText,
  normalizeNlColor,
  normalizeJpLevel,
  normalizeJpRegionalLevel,
  normalizeSkSecurityText,
} from '../normalize/advisory-levels.js';
import { join } from 'node:path';

// --- API URLs ---
// DE_API_URL doubles as the per-country content endpoint's base:
// `${DE_API_URL}/{contentId}` (e.g. .../opendata/travelwarning/203814)
// returns that one country's "content" HTML field — same opendata API
// family, official AA data, not the public website. See
// normalizeDeContentText's doc comment (normalize/advisory-levels.ts) for
// why the bulk endpoint's 4 booleans alone are not enough (repair 2026-09-25,
// SOURCE-REPAIR-BRIEF).
const DE_API_URL = 'https://www.auswaertiges-amt.de/opendata/travelwarning';
const NL_API_BASE =
  'https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/countries';
const JP_MOFA_BASE = 'https://www.anzen.mofa.go.jp';
// SK repair 2026-09-25 (SOURCE-REPAIR-BRIEF): the OLD SK_API_URL pointed at
// the "aktualne-upozornenia-pred-cestou" CKAN resource (a single flat table)
// and read its "Stupen rizika CO" column. That resource died silently the
// week of 2026-08-22 — MZV repurposed it into a rolling feed of ad-hoc travel
// notices (border-crossing closures, embassy press releases...); on
// 2026-09-25 only 1 of its 140 rows still carried a non-empty risk level, so
// the fetcher had been emitting a "0 countries" collapse and living off the
// per-source-floor cache restore every day since. MZV's actual per-country
// risk baseline lives in a DIFFERENT CKAN package: one resource per country,
// each with a "Bezpecnostna situacia" free-text field (see
// normalizeSkSecurityText in normalize/advisory-levels.ts for how that text
// maps to our 1-4 scale). SK_COUNTRY_PACKAGE_URL discovers the current
// {resourceId -> country} list (resource IDs are not stable identifiers we
// can hardcode); SK_DATASTORE_BASE then fetches each country's single record.
const SK_COUNTRY_PACKAGE_URL =
  'https://opendata.mzv.sk/api/3/action/package_show?id=staty-sveta-podmienky-cestovania-a-pobytu';
const SK_DATASTORE_BASE = 'https://opendata.mzv.sk/api/3/action/datastore_search';

// --- Level text maps ---
// Level 3 relabeled 2026-09-25: it used to say "Teilreisewarnung" (a FORMAL
// partial travel warning), but that concept is now explicitly capped at
// Level 2 (SOURCE-REPAIR-BRIEF: "partial/sub-national warnings must stay <=
// 2"). Level 3 is produced by normalizeDeContentText's whole-country "wird
// (dringend) abgeraten" text match instead — "travel advised against" is
// the accurate label for that.
const DE_LEVEL_TEXT: Record<number, string> = {
  1: 'Keine Reisewarnung',
  2: 'Sicherheitshinweis',
  3: 'Von Reisen wird abgeraten',
  4: 'Reisewarnung',
};

const NL_LEVEL_TEXT: Record<number, string> = {
  1: 'Veilig',
  2: 'Let op, veiligheidsrisicos',
  3: 'Alleen noodzakelijke reizen',
  4: 'Niet reizen',
};

const JP_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise caution',
  2: 'Avoid non-essential travel',
  3: 'Do not travel (advisory)',
  4: 'Evacuate (advisory)',
};

const SK_LEVEL_TEXT: Record<number, string> = {
  1: 'No specific warning',
  2: 'Consider necessity of travel',
  3: 'Avoid travel',
  4: 'Do not travel',
};

// --- Japan MOFA (anzen.mofa.go.jp) japanese-name -> ISO3 mapping (v9.1 rewrite) ---
//
// v9.1 (SHIP-SPEC 1.1d): the OLD static JP_MOFA_ID_TO_ISO3 table above (page-ID
// keyed) went STALE — anzen.mofa.go.jp renumbered its per-country page IDs at
// some point, so the old IDs pointed at the WRONG countries and the level-scrape
// regex additionally matched unrelated in-page "レベル" text, together producing
// a spurious constant-Level-4 ("Do Not Travel") reading for ~89 actually-safe
// countries — this is why v9/v9.1's frozen exclusion set (weights.json
// frozenExcludedSources) has always had to carry 'jp' as a broken-parser
// exclusion. The fix REWRITES discovery to be fully dynamic: scrape the live
// riskmap index page for {pageId, japaneseName} pairs (~206, see
// fetchJpCountryIndex below) and resolve ISO3 via THIS name table, instead of
// trusting any hardcoded page ID. Unmatched names are skipped with a console
// warning and NEVER guessed (T-lb3-02).
const JP_NAME_TO_ISO3: Record<string, string> = {
  'インド': 'IND', 'インドネシア': 'IDN', '大韓民国（韓国）': 'KOR', 'カンボジア': 'KHM',
  'シンガポール': 'SGP', 'スリランカ': 'LKA', 'タイ': 'THA', '台湾': 'TWN',
  '中華人民共和国（中国）': 'CHN', 'ネパール': 'NPL', 'パキスタン': 'PAK', 'バングラデシュ': 'BGD',
  'フィリピン': 'PHL', 'ブルネイ': 'BRN', 'ベトナム': 'VNM', '香港': 'HKG',
  'マレーシア': 'MYS', 'ミャンマー': 'MMR', 'モンゴル': 'MNG', 'ラオス': 'LAO',
  'モルディブ': 'MDV', '北朝鮮': 'PRK', 'マカオ': 'MAC', 'ブータン': 'BTN',
  'アフガニスタン': 'AFG', 'アラブ首長国連邦': 'ARE', 'イエメン': 'YEM', 'イスラエル': 'ISR',
  'イラク': 'IRQ', 'イラン': 'IRN', 'オマーン': 'OMN', 'カタール': 'QAT',
  'クウェート': 'KWT', 'サウジアラビア': 'SAU', 'シリア': 'SYR', 'トルコ': 'TUR',
  'バーレーン': 'BHR', 'ヨルダン': 'JOR', 'レバノン': 'LBN',
  'オーストラリア': 'AUS', 'ソロモン諸島': 'SLB', 'サモア': 'WSM', 'ニュージーランド': 'NZL',
  'パプアニューギニア': 'PNG', 'フィジー': 'FJI', 'バヌアツ': 'VUT', 'タヒチ': 'PYF',
  'アルジェリア': 'DZA', 'アンゴラ': 'AGO', 'ウガンダ': 'UGA', 'エジプト': 'EGY',
  'エチオピア': 'ETH', 'ガーナ': 'GHA', 'ガボン': 'GAB', 'カメルーン': 'CMR',
  'ギニア': 'GIN', 'ケニア': 'KEN', 'コートジボワール': 'CIV', 'コンゴ共和国': 'COG',
  'コンゴ民主共和国': 'COD', 'ザンビア': 'ZMB', 'シエラレオネ': 'SLE', 'ジンバブエ': 'ZWE',
  'スーダン': 'SDN', 'セーシェル': 'SYC', 'セネガル': 'SEN', 'ソマリア': 'SOM',
  'タンザニア': 'TZA', '中央アフリカ': 'CAF', 'チュニジア': 'TUN', 'トーゴ': 'TGO',
  'ナイジェリア': 'NGA', 'ニジェール': 'NER', 'ブルキナファソ': 'BFA', 'ベナン': 'BEN',
  'マダガスカル': 'MDG', 'マラウイ': 'MWI', 'マリ': 'MLI', '南アフリカ共和国': 'ZAF',
  'モザンビーク': 'MOZ', 'モロッコ': 'MAR', 'リビア': 'LBY', 'リベリア': 'LBR',
  'ブルンジ': 'BDI', 'レソト': 'LSO', 'ルワンダ': 'RWA', 'コモロ': 'COM',
  'チャド': 'TCD', 'エリトリア': 'ERI', 'ギニアビサウ': 'GNB', 'ジブチ': 'DJI',
  '西サハラ地域': 'ESH', 'ナミビア': 'NAM',
  'アイルランド': 'IRL', 'アゼルバイジャン': 'AZE', 'イタリア': 'ITA', '英国': 'GBR',
  'エストニア': 'EST', 'オーストリア': 'AUT', 'オランダ': 'NLD', 'ギリシャ': 'GRC',
  'スイス': 'CHE', 'スウェーデン': 'SWE', 'スペイン': 'ESP', 'スロベニア': 'SVN',
  'チェコ': 'CZE', 'デンマーク': 'DNK', 'ドイツ': 'DEU', 'ノルウェー': 'NOR',
  'バチカン': 'VAT', 'ハンガリー': 'HUN', 'フィンランド': 'FIN', 'フランス': 'FRA',
  'ブルガリア': 'BGR', 'ベルギー': 'BEL', 'ポーランド': 'POL', 'ポルトガル': 'PRT',
  'セルビア': 'SRB', 'ルクセンブルク': 'LUX', 'ルーマニア': 'ROU', 'ロシア': 'RUS',
  'モンテネグロ': 'MNE', 'コソボ': 'XKX', 'ウクライナ': 'UKR', 'ウズベキスタン': 'UZB',
  'スロバキア': 'SVK', 'ベラルーシ': 'BLR', 'ラトビア': 'LVA', 'カザフスタン': 'KAZ',
  'クロアチア': 'HRV', 'ボスニア・ヘルツェゴビナ': 'BIH', 'リトアニア': 'LTU', 'キプロス': 'CYP',
  'マルタ': 'MLT', 'アルバニア': 'ALB', 'ジブラルタル': 'GIB', 'モルドバ': 'MDA',
  'アルメニア': 'ARM', 'ジョージア': 'GEO', 'タジキスタン': 'TJK', 'トルクメニスタン': 'TKM',
  '北マケドニア共和国': 'MKD',
  'アメリカ合衆国（米国）': 'USA', 'カナダ': 'CAN', '北マリアナ諸島': 'MNP', 'グアム': 'GUM',
  'アルゼンチン': 'ARG', 'ウルグアイ': 'URY', 'エクアドル': 'ECU', 'エルサルバドル': 'SLV',
  'キューバ': 'CUB', 'グアテマラ': 'GTM', 'コスタリカ': 'CRI', 'コロンビア': 'COL',
  'ジャマイカ': 'JAM', 'スリナム': 'SUR', 'チリ': 'CHL', 'ドミニカ共和国': 'DOM',
  'トリニダード・トバゴ': 'TTO', 'ニカラグア': 'NIC', 'ハイチ': 'HTI', 'パナマ': 'PAN',
  'バハマ': 'BHS', 'パラグアイ': 'PRY', 'ブラジル': 'BRA', 'ベネズエラ': 'VEN',
  'ペルー': 'PER', 'ボリビア': 'BOL', 'ホンジュラス': 'HND', 'メキシコ': 'MEX',
  'キルギス': 'KGZ', 'キリバス': 'KIR', 'マーシャル': 'MHL', 'ミクロネシア': 'FSM',
  'ナウル': 'NRU', 'パラオ': 'PLW', 'トンガ': 'TON', 'ツバル': 'TUV',
  'カーボベルデ': 'CPV', '赤道ギニア': 'GNQ', 'ガンビア': 'GMB', 'モーリタニア': 'MRT',
  'モーリシャス': 'MUS', 'サントメ・プリンシペ': 'STP', 'エスワティニ王国': 'SWZ',
  'アイスランド': 'ISL', 'リヒテンシュタイン': 'LIE', 'モナコ': 'MCO', 'サンマリノ': 'SMR',
  'アンティグア・バーブーダ': 'ATG', 'バルバドス': 'BRB', 'ベリーズ': 'BLZ', 'ドミニカ': 'DMA',
  'グレナダ': 'GRD', 'セントクリストファー・ネービス': 'KNA', 'セントルシア': 'LCA',
  'セントビンセント': 'VCT', 'ガイアナ': 'GUY', '東ティモール': 'TLS', 'ボツワナ': 'BWA',
  'アンドラ': 'AND', 'ニューカレドニア': 'NCL', 'クック諸島': 'COK', '南スーダン': 'SSD',
  'ニウエ': 'NIU',
};

/** Minimum matched-country floor for the JP dynamic index (T-lb3-02, SHIP-SPEC 1.1d: >=180/206). */
const JP_MIN_MAPPED = 180;

/**
 * Discovery anchors the rewritten JP fetcher MUST reproduce (SHIP-SPEC 1.1d). Checked
 * against `indicators[].value` (the FINAL, doctrine-compliant level — see
 * normalizeJpRegionalLevel's doc comment), not the raw per-region legend MAX, so four
 * values were corrected 2026-09-26 (PARSER-REGIONAL-BRIEF) to match: RUS 4->3 and BLR 4->3
 * (each country's own catch-all covering the capital, Moscow/Minsk, is genuinely Level 3 —
 * only a named Ukraine-border strip is 4); MEX 3->2 and ECU 3->2 (each country's own
 * catch-all covering the capital is genuinely Level 1 — only named cities/provinces are
 * 2/3, capped at 2 per the regional-cap doctrine). UKR/IRQ/IRN stay 4: each source text
 * explicitly states or implies the WHOLE country (not just a border strip) is Level 4.
 */
const JP_DISCOVERY_ANCHORS: Record<string, number> = {
  UKR: 4, IRQ: 4, IRN: 4,
  FRA: 1, USA: 1, SGP: 1, AUS: 1, CAN: 1, GBR: 1, VAT: 1, CHN: 1,
  MEX: 2, ECU: 2,
  BHR: 2, XKX: 2,
  RUS: 3, BLR: 3,
};

interface FetcherResult {
  indicators: RawIndicator[];
  advisoryInfo: AdvisoryInfoMap;
}

/** Fetch a batch of items concurrently with worker queue pattern */
async function fetchBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.allSettled(workers);
}

/** Merge source advisory info into the combined map */
function mergeAdvisoryInfo(target: AdvisoryInfoMap, source: AdvisoryInfoMap): void {
  for (const [iso3, info] of Object.entries(source)) {
    if (!target[iso3]) target[iso3] = {};
    Object.assign(target[iso3], info);
  }
}

/** Simple async delay helper — used only for the SK sub-fetcher's politeness pause. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Sub-fetcher 1: Germany (Auswaertiges Amt)
// =============================================================================

interface DeCountryEntry {
  id: number;
  iso3: string;
  countryName: string;
  boolLevel: UnifiedLevel;
  lastModified: string | undefined;
}

async function fetchDeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch(DE_API_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const rawData = await response.json();
  writeJson(join(rawDir, 'advisories-de.json'), rawData);

  const r = (rawData as Record<string, unknown>).response as Record<string, unknown> | undefined;
  if (!r) throw new Error('No response field in Germany API data');

  const contentList = r.contentList as number[];
  if (!Array.isArray(contentList)) throw new Error('No contentList in Germany API response');

  // Pass 1: parse the bulk list (country identity + the 4 legacy booleans).
  const entries: DeCountryEntry[] = [];
  for (const id of contentList) {
    const entry = r[String(id)] as Record<string, unknown> | undefined;
    if (!entry) continue;

    const iso3 = String(entry.iso3CountryCode || '').toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;

    const country = getCountryByIso3(iso3);
    if (!country) continue;

    entries.push({
      id,
      iso3: country.iso3,
      countryName: String(entry.countryName || country.name.en),
      boolLevel: normalizeDeLevel({
        warning: Boolean(entry.warning),
        partialWarning: Boolean(entry.partialWarning),
        situationWarning: Boolean(entry.situationWarning),
        situationPartWarning: Boolean(entry.situationPartWarning),
      }),
      lastModified: entry.lastModified
        ? new Date(Number(entry.lastModified) * 1000).toISOString()
        : undefined,
    });
  }

  // Pass 2: per-country content fetch, escalating the boolean-derived level
  // with normalizeDeContentText (see its doc comment — the booleans alone
  // miss AA's informal "wird (dringend) abgeraten" tier entirely). A
  // per-country fetch failure degrades gracefully to the boolean-only level
  // rather than dropping the country: the bulk call already gave us valid
  // indicator data for it.
  const textEscalated: string[] = []; // countries where text pushed the level above the boolean
  const contentFetchFailed: string[] = [];

  await fetchBatch(
    entries,
    async (entry) => {
      let finalLevel: UnifiedLevel = entry.boolLevel;
      try {
        const cr = await fetch(`${DE_API_URL}/${entry.id}`, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
        });
        if (cr.ok) {
          const cData = (await cr.json()) as Record<string, unknown>;
          const cResult = cData.response as Record<string, unknown> | undefined;
          const cEntry = cResult?.[String(entry.id)] as Record<string, unknown> | undefined;
          const content = cEntry?.content as string | undefined;
          if (content) {
            const textLevel = normalizeDeContentText(content, entry.countryName);
            if (textLevel > finalLevel) {
              finalLevel = textLevel;
              textEscalated.push(entry.iso3);
            }
          }
        } else {
          contentFetchFailed.push(entry.iso3);
        }
      } catch {
        contentFetchFailed.push(entry.iso3);
      }

      indicators.push({
        countryIso3: entry.iso3,
        indicatorName: 'advisory_level_de',
        value: finalLevel,
        year: currentYear,
        source: 'advisories_de',
        fetchedAt,
      });

      if (!advisoryInfo[entry.iso3]) advisoryInfo[entry.iso3] = {};
      advisoryInfo[entry.iso3].de = {
        level: finalLevel,
        text: DE_LEVEL_TEXT[finalLevel] || `Level ${finalLevel}`,
        source: 'German Federal Foreign Office',
        url: 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise',
        updatedAt: entry.lastModified,
      };

      // Be polite to the opendata API: ~200 requests follow the single bulk
      // call. A concurrency-8, no-delay version of this loop (200 requests
      // in ~1.4s) tripped auswaertiges-amt.de's bot-challenge ("Enodia")
      // mid-investigation on 2026-09-25 after repeated runs in a short
      // window — SOURCE-REPAIR-BRIEF rule 4 caps this at <=3 anyway.
      await delay(150);
    },
    3, // Concurrency <=3 per SOURCE-REPAIR-BRIEF rule 4
  );

  writeJson(join(rawDir, 'advisories-de-content-diagnostics.json'), {
    fetchedAt,
    countriesChecked: entries.length,
    textEscalatedAboveBoolean: textEscalated,
    contentFetchFailed,
  });
  console.log(
    `[ADVISORIES-T1] DE: ${textEscalated.length} countries escalated above their warning/partialWarning boolean by the "wird abgeraten" text check (${contentFetchFailed.length} content fetches failed, boolean-only fallback used)`,
  );

  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: Netherlands (nederlandwereldwijd.nl)
// =============================================================================

async function fetchNlAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const summary: { total: number; found: number; samples: string[] } = {
    total: COUNTRIES.length,
    found: 0,
    samples: [],
  };

  // Iterate all countries from our list (listing endpoint only returns 25)
  await fetchBatch(
    [...COUNTRIES],
    async (country) => {
      const url = `${NL_API_BASE}/${country.iso3.toLowerCase()}/traveladvice`;
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
        });

        if (!r.ok) return; // No data for this country, skip silently

        const xml = await r.text();

        // Country-level color from the <introduction> summary only. The NL
        // advisory describes sub-regional warnings alongside the country
        // baseline (e.g. for Japan: "kleurcode rood voor het zuidoosten van
        // Fukushima" AND "voor de rest van Japan geldt kleurcode groen"). The
        // country baseline is always the LEAST-severe color mentioned in the
        // introduction summary — sub-regional warnings can only escalate
        // above it, never below. Taking MIN prevents Fukushima-style
        // sub-region warnings from promoting the whole country to Level 4.
        const introMatch = xml.match(/<introduction>([\s\S]*?)<\/introduction>/i);
        if (!introMatch) return; // No introduction summary — skip
        const introScope = introMatch[1];
        const colorMatches = introScope.match(/(rood|oranje|geel|groen)/gi);
        if (!colorMatches || colorMatches.length === 0) return;

        let minLevel: 1 | 2 | 3 | 4 = 4;
        for (const c of colorMatches) {
          const lvl = normalizeNlColor(c);
          if (lvl < minLevel) minLevel = lvl as 1 | 2 | 3 | 4;
        }
        const level = minLevel;

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_nl',
          value: level,
          year: currentYear,
          source: 'advisories_nl',
          fetchedAt,
        });

        // Extract last modified date if available — otherwise omit (never the fetch time)
        const lastModMatch = xml.match(/<lastmodified>([^<]+)<\/lastmodified>/);
        const updatedAt = lastModMatch ? lastModMatch[1] : undefined;

        // Prefer the structured <canonical> URL from the XML — guessing the
        // slug from the English name (e.g. "ivory-coast") frequently 404s on
        // nederlandwereldwijd.nl. Fall back to the slug guess only if the
        // canonical is missing.
        const canonicalMatch = xml.match(/<canonical>([^<]+)<\/canonical>/i);
        const canonicalUrl = canonicalMatch
          ? canonicalMatch[1].trim()
          : `https://www.nederlandwereldwijd.nl/reisadvies/${country.name.en.toLowerCase().replace(/\s+/g, '-')}`;

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].nl = {
          level,
          text: NL_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Netherlands Ministry of Foreign Affairs',
          url: canonicalUrl,
          updatedAt,
        };

        summary.found++;
        if (summary.samples.length < 5) {
          summary.samples.push(`${country.iso3}=${level}`);
        }
      } catch {
        // Individual country fetch failed, skip silently
      }
    },
    10, // Concurrency 10 (lower than UK's 20 for smaller API)
  );

  writeJson(join(rawDir, 'advisories-nl.json'), {
    fetchedAt,
    countriesQueried: summary.total,
    countriesWithData: summary.found,
    samples: summary.samples,
  });

  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 3: Japan (MOFA anzen.mofa.go.jp) — v9.1 REWRITE (SHIP-SPEC 1.1d)
// =============================================================================

interface JpIndexEntry {
  pageId: string;
  japaneseName: string;
  iso3: string | null; // null = unmatched (skipped, never guessed)
}

/**
 * Discover the CURRENT {pageId -> japaneseName} index from the live riskmap
 * listing page. The old static JP_MOFA_ID_TO_ISO3 table (page-ID keyed) went
 * stale when anzen.mofa.go.jp renumbered its pages — this is the root cause of
 * the pre-v9.1 spurious constant-Level-4 bug. Resolving ISO3 by NAME (via
 * JP_NAME_TO_ISO3) instead of by page ID is renumbering-proof.
 */
function parseJpCountryIndex(html: string): JpIndexEntry[] {
  const pattern = /href="\/info\/pcinfectionspothazardinfo_(\d+)\.html">([^<]+)</g;
  const seen = new Set<string>();
  const entries: JpIndexEntry[] = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const pageId = match[1];
    if (seen.has(pageId)) continue;
    seen.add(pageId);
    const japaneseName = match[2].trim();
    const iso3 = JP_NAME_TO_ISO3[japaneseName] ?? null;
    entries.push({ pageId, japaneseName, iso3 });
  }
  return entries;
}

/**
 * Parse ONE country's max hazard level from its detail page, SCOPED to
 * `<div id="kikendetail">` only (T-lb3-01/T-lb3-02: prevents the old bug where
 * unrelated in-page level text elsewhere on the page was matched). Within that
 * div, each regional `.kiken_levels` block carries 0+
 * `kiken_level_base kiken_level_{chuui|kentou|enki|taihi}` divs — we take the
 * MAX numeric level across all of them (a country with any region at Level 4
 * is treated as Level 4 overall, matching the pre-existing MAX-across-regions
 * convention). A page with NO `#kikendetail` div has no active hazard-level
 * advisory published at all, which is Level 1 (safest / no warning) —
 * verified live against USA/FRA/GBR/AUS/CAN/SGP/VAT (all lack the div).
 *
 * Repair 2026-09-25 (source review follow-up): returns null — never guess —
 * when the `#kikendetail` div IS present but no recognized
 * `kiken_level_{chuui|kentou|enki|taihi}` class was found inside it. Before
 * this fix that case fell through to the SAME `return 1` as "no div at all",
 * silently collapsing "MOFA published a hazard block we failed to parse"
 * (a markup change, an unknown class, the scoping window missing the real
 * content) into "this country is safe" — the exact false
 * "no-contraindications" failure mode SOURCE-REPAIR-BRIEF rule 1 forbids.
 * The caller (fetchJpAdvisories) must skip the country entirely on null,
 * exactly like a failed fetch — see the "kikenLevelUnparseable" tracking
 * there.
 */
export function parseJpKikenLevel(html: string): number | null {
  const detailMatch = html.match(/<div id="kikendetail">/);
  if (!detailMatch || detailMatch.index === undefined) return 1; // no advisory published -> safest

  // Scope the search window to the kikendetail div's contents. We don't have a
  // full HTML parser here; a generous fixed window comfortably covers every
  // observed kikendetail block (typically <3KB) while stopping well before the
  // unrelated infectious-disease section that follows it.
  const scoped = html.slice(detailMatch.index, detailMatch.index + 8000);
  const closeMatch = scoped.match(/<\/div>\s*<\/div>\s*<\/div>/);
  const window = closeMatch && closeMatch.index !== undefined ? scoped.slice(0, closeMatch.index) : scoped;

  const LEVEL_BY_CLASS: Record<string, number> = { chuui: 1, kentou: 2, enki: 3, taihi: 4 };
  const classPattern = /kiken_level_(chuui|kentou|enki|taihi)/g;
  let max = 0;
  let m;
  while ((m = classPattern.exec(window)) !== null) {
    const lvl = LEVEL_BY_CLASS[m[1]];
    if (lvl > max) max = lvl;
  }
  return max > 0 ? max : null; // div present but unparseable -> never guess
}

async function fetchJpAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const pageResults: Record<string, { japaneseName: string; iso3: string | null; level?: number }> = {};
  // Countries whose #kikendetail div was present but had no recognized
  // kiken_level_* class inside — parseJpKikenLevel returns null for these,
  // and we emit nothing for them rather than guess (see its doc comment).
  const kikenLevelUnparseable: string[] = [];

  // Step 1: dynamic country index from the live riskmap listing page.
  const indexResponse = await fetch(`${JP_MOFA_BASE}/riskmap/`, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });
  if (!indexResponse.ok) {
    throw new Error(`riskmap index: HTTP ${indexResponse.status}`);
  }
  const indexHtml = await indexResponse.text();
  const jpIndex = parseJpCountryIndex(indexHtml);

  writeJson(join(rawDir, 'advisories-jp-index.json'), {
    fetchedAt,
    totalEntries: jpIndex.length,
    entries: jpIndex,
  });

  const matched = jpIndex.filter((e) => e.iso3 !== null);
  const unmatched = jpIndex.filter((e) => e.iso3 === null);
  console.log(
    `[ADVISORIES-T1] JP: index discovered ${jpIndex.length} entries, ${matched.length} mapped to ISO3, ${unmatched.length} unmatched (skipped, never guessed)`,
  );
  if (unmatched.length > 0) {
    console.warn(`[ADVISORIES-T1] JP: unmatched japaneseName values: ${unmatched.map((e) => e.japaneseName).join(', ')}`);
  }
  if (matched.length < JP_MIN_MAPPED) {
    console.error(
      `[ADVISORIES-T1] JP: only ${matched.length}/${jpIndex.length} mapped, below the ${JP_MIN_MAPPED} floor — JP_NAME_TO_ISO3 table may need updating`,
    );
  }

  // Step 2: fetch each matched country's detail page, scoped kikendetail parse.
  await fetchBatch(
    matched,
    async (entry) => {
      const iso3 = entry.iso3 as string;
      const country = getCountryByIso3(iso3);
      if (!country) return;

      const url = `${JP_MOFA_BASE}/info/pcinfectionspothazardinfo_${entry.pageId}.html`;
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
        });

        if (!r.ok) return; // Page doesn't exist for this country

        const html = await r.text();
        const rawLevel = parseJpKikenLevel(html);
        if (rawLevel === null) {
          kikenLevelUnparseable.push(country.iso3);
          return; // never guess — emit nothing for this country
        }
        // parseJpKikenLevel's MAX-across-regions reading is a discovery/legend sanity
        // check (see its own doc comment), not the country's advisory level: it turns any
        // single named border strip or separatist enclave into a whole-country "do not
        // travel" (repair 2026-09-25/26, PARSER-REGIONAL-BRIEF). normalizeJpRegionalLevel
        // parses the actual region breakdown and applies the project's standing doctrine —
        // a sub-national entry never promotes the country above Level 2, unless the
        // country's own catch-all/main-area statement is already higher — falling back to
        // this same legend MAX when the page has no parseable per-region text at all (e.g.
        // pure prose with no "Level N" statement anywhere).
        const legendLevel = normalizeJpLevel(rawLevel);
        const level = normalizeJpRegionalLevel(html, entry.japaneseName, legendLevel) ?? legendLevel;

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_jp',
          value: level,
          year: currentYear,
          source: 'advisories_jp',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].jp = {
          level,
          text: JP_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Japan Ministry of Foreign Affairs',
          url,
        };

        pageResults[entry.pageId] = { japaneseName: entry.japaneseName, iso3: country.iso3, level };
      } catch {
        // Individual page fetch failed, skip silently
      }
    },
    5, // Concurrency 5 (be polite to MOFA servers)
  );

  if (kikenLevelUnparseable.length > 0) {
    console.warn(
      `[ADVISORIES-T1] JP: ${kikenLevelUnparseable.length} countries had a #kikendetail div with no recognized kiken_level_* class — skipped, never guessed: ${kikenLevelUnparseable.join(', ')}`,
    );
  }

  // Discovery-anchor self-check (SHIP-SPEC 1.1d): log any mismatch loudly —
  // never throws, so a transient MOFA content change doesn't break the whole
  // fetch, but a regression is impossible to miss in the pipeline logs.
  const gotByIso3 = new Map(indicators.map((i) => [i.countryIso3, i.value]));
  const anchorMismatches: string[] = [];
  for (const [iso3, expectedLevel] of Object.entries(JP_DISCOVERY_ANCHORS)) {
    const got = gotByIso3.get(iso3);
    if (got !== expectedLevel) {
      anchorMismatches.push(`${iso3}: expected ${expectedLevel}, got ${got ?? 'MISSING'}`);
    }
  }
  if (anchorMismatches.length > 0) {
    console.warn(`[ADVISORIES-T1] JP: discovery-anchor mismatches: ${anchorMismatches.join('; ')}`);
  } else {
    console.log('[ADVISORIES-T1] JP: all discovery anchors reproduced correctly');
  }

  writeJson(join(rawDir, 'advisories-jp.json'), {
    fetchedAt,
    totalMappings: jpIndex.length,
    matchedCount: matched.length,
    countriesWithData: Object.keys(pageResults).length,
    kikenLevelUnparseable,
    anchorMismatches,
    pageResults,
  });

  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: Slovakia (MZV open data) — v-repair-2026-09-25
// =============================================================================
//
// MZV's per-country CKAN resources are named "Traveling - <English name>",
// using EU-Publications-Office-style abbreviated official names (e.g. "Dem.
// Peopl.Rep. of Korea", "Iran,Islamic Republic of", "Czechia") that mostly —
// but not always — match our COUNTRIES en names. getCountryByName() resolves
// the ~199/235 resources whose stripped name already matches directly (e.g.
// "Ethiopia", "Turkey"); this table carries the ~35 documented exceptions,
// found by diffing the live resource list against COUNTRIES with a
// throwaway harness (not committed). Anything covered by NEITHER path is
// logged and skipped — never guessed (mirrors JP_NAME_TO_ISO3 above).
const SK_NAME_TO_ISO3: Record<string, string> = {
  'Viet Nam': 'VNM',
  'Venezuela (Bol.Rep.of)': 'VEN',
  'United Rep.of Tanzania': 'TZA',
  'Syrian Arab Republic': 'SYR',
  'St.Vincent,the Grenadin.': 'VCT',
  'Sint Maarten (Dutch p.)': 'SXM',
  'Saint Martin (French p.)': 'MAF',
  'Saint Barthélemy': 'BLM',
  'Holy See': 'VAT',
  'St.Helena,Asc,Trist.daC.': 'SHN',
  'United States of America': 'USA',
  'United Kingd.of GB a.NI.': 'GBR',
  'Dem.Peopl.Rep. of Korea': 'PRK',
  'St. Pierre and Miquelon': 'SPM',
  'Russian Federation': 'RUS',
  'Réunion': 'REU',
  "Côte d'Ivoire": 'CIV',
  'Palestine, State of': 'PSE',
  'Republic of Moldova': 'MDA',
  'Micronesia (Fed.St. of)': 'FSM',
  'US Minor Outlying Isl.': 'UMI',
  "Lao People's Dem. Rep.": 'LAO',
  'Dem.Rep. of the Congo': 'COD',
  'Korea, Republic of': 'KOR',
  'Iran,Islamic Republic of': 'IRN',
  'Falkland Isl. (Malvinas)': 'FLK',
  'The State of Eritrea': 'ERI',
  'Curaçao': 'CUW',
  'Czechia': 'CZE',
  'Brunei Darussalam': 'BRN',
  'Virgin Islands, British': 'VGB',
  'British Ind.Ocean Terr.': 'IOT',
  'Bolivia (Plurinat.State)': 'BOL',
  'Virgin Islands of the US': 'VIR',
  'Central African Rep.': 'CAF',
  // NOT mapped: "Bermuda" — the resource exists but BMU is not in COUNTRIES.
};

interface SkCountryResource {
  resourceId: string;
  countryName: string; // "Traveling - " prefix stripped
  iso3: string | null; // null = unmatched (skipped, never guessed)
}

/**
 * Discover the CURRENT {resourceId -> country} list from the CCKAN package
 * metadata (1 request). Resource IDs are opaque and NOT stable across MZV
 * content edits, so this cannot be a hardcoded table like DE/NL/JP's URLs —
 * it must be rediscovered on every run, same reasoning as JP's dynamic
 * riskmap index above.
 */
async function fetchSkCountryIndex(): Promise<SkCountryResource[]> {
  const response = await fetch(SK_COUNTRY_PACKAGE_URL, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });
  if (!response.ok) {
    throw new Error(`package_show: HTTP ${response.status}`);
  }
  const data = (await response.json()) as Record<string, unknown>;
  const result = data.result as Record<string, unknown> | undefined;
  const resources = result?.resources as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(resources)) {
    throw new Error('No resources array in Slovakia package_show response');
  }

  return resources.map((r) => {
    const rawName = String(r.name || '');
    const prefix = 'Traveling - ';
    const countryName = rawName.startsWith(prefix) ? rawName.slice(prefix.length) : rawName;
    const direct = getCountryByName(countryName);
    const iso3 = direct?.iso3 ?? SK_NAME_TO_ISO3[countryName] ?? null;
    return { resourceId: String(r.id || ''), countryName, iso3 };
  });
}

async function fetchSkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const index = await fetchSkCountryIndex();
  const matched = index.filter(
    (e): e is SkCountryResource & { iso3: string } => e.iso3 !== null,
  );
  const unmatched = index.filter((e) => e.iso3 === null);

  console.log(
    `[ADVISORIES-T1] SK: country index discovered ${index.length} resources, ${matched.length} mapped to ISO3, ${unmatched.length} unmatched (skipped, never guessed)`,
  );
  if (unmatched.length > 0) {
    console.warn(
      `[ADVISORIES-T1] SK: unmatched resource names: ${unmatched.map((e) => e.countryName).join(', ')}`,
    );
  }

  // Countries whose page exists but whose "Bezpecnostna situacia" field is
  // blank (observed for e.g. North Korea, Mali, Somalia on 2026-09-25) — we
  // emit nothing for them (SOURCE-REPAIR-BRIEF rule 1), logged here so a
  // future run can be diffed against this list rather than re-discovering it.
  const emptySecurityField: string[] = [];

  await fetchBatch(
    matched,
    async (entry) => {
      const country = getCountryByIso3(entry.iso3);
      if (!country) return;

      const url = `${SK_DATASTORE_BASE}?resource_id=${entry.resourceId}&limit=1`;
      try {
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
        });
        if (!r.ok) return; // Page doesn't exist / resource gone, skip silently

        const data = (await r.json()) as Record<string, unknown>;
        const result = data.result as Record<string, unknown> | undefined;
        const records = result?.records as Array<Record<string, unknown>> | undefined;
        const record = records?.[0];
        if (!record) return;

        const securityText = record['Bezpecnostna situacia'] as string | null | undefined;
        const level = normalizeSkSecurityText(securityText);
        if (level === null) {
          emptySecurityField.push(country.iso3);
          return; // rule 1: never guess — no assessment published for this country
        }

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_sk',
          value: level,
          year: currentYear,
          source: 'advisories_sk',
          fetchedAt,
        });

        // Extract date if available — otherwise omit (never the fetch time)
        const dateStr = String(record['Datum zmeny'] || '').trim();
        let updatedAt: string | undefined;
        if (dateStr) {
          // Format: "DD.MM.YYYY HH:MM:SS"
          const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (parts) {
            updatedAt = `${parts[3]}-${parts[2]}-${parts[1]}T00:00:00Z`;
          }
        }

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].sk = {
          level,
          text: SK_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Slovak Ministry of Foreign Affairs',
          url: 'https://www.mzv.sk/cestovanie/cestovne-odporucania',
          updatedAt,
        };
      } catch {
        // Individual country fetch failed, skip silently
      }

      // Be polite to a small government CKAN instance: ~200 requests follow
      // the single discovery call, on top of the <=3 concurrency cap below.
      await delay(150);
    },
    3, // Concurrency <=3 per SOURCE-REPAIR-BRIEF rule 4
  );

  writeJson(join(rawDir, 'advisories-sk.json'), {
    fetchedAt,
    resourcesDiscovered: index.length,
    matchedToIso3: matched.length,
    unmatchedNames: unmatched.map((e) => e.countryName),
    countriesWithLevel: indicators.length,
    emptySecurityField,
  });

  console.log(
    `[ADVISORIES-T1] SK: ${indicators.length} countries with a classified risk level out of ${matched.length} matched (${emptySecurityField.length} had an empty security-situation field, skipped)`,
  );

  return { indicators, advisoryInfo };
}

// =============================================================================
// Main orchestrator
// =============================================================================

/**
 * Fetch Tier 1 advisory sources: Germany, Netherlands, Japan, Slovakia.
 * Each sub-fetcher runs independently in try/catch blocks.
 * Falls back to cached data if ALL sub-fetchers fail.
 */
export async function fetchTier1Advisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];

  // Fetch Germany advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Germany (Auswaertiges Amt) advisories...');
    const result = await fetchDeAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const deCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] DE: ${deCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] DE fetch failed: ${msg}`);
    errors.push(`DE: ${msg}`);
  }

  // Fetch Netherlands advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Netherlands (BZ) advisories...');
    const result = await fetchNlAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const nlCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] NL: ${nlCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] NL fetch failed: ${msg}`);
    errors.push(`NL: ${msg}`);
  }

  // Fetch Japan advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Japan (MOFA) advisories...');
    const result = await fetchJpAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const jpCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] JP: ${jpCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] JP fetch failed: ${msg}`);
    errors.push(`JP: ${msg}`);
  }

  // Fetch Slovakia advisories
  try {
    console.log('[ADVISORIES-T1] Fetching Slovakia (MZV) advisories...');
    const result = await fetchSkAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const skCountries = new Set(result.indicators.map((i) => i.countryIso3));
    console.log(`[ADVISORIES-T1] SK: ${skCountries.size} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T1] SK fetch failed: ${msg}`);
    errors.push(`SK: ${msg}`);
  }

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-tier1-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES-T1] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-tier1-parsed.json'), cachedData);
        const cachedInfoPath = cached.replace(
          'advisories-tier1-parsed.json',
          'advisories-tier1-info.json',
        );
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-tier1-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories_tier1',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories_tier1',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // Per-source floor check: a single issuer's site redesign must not
  // silently drop its column (restores from the last healthy cache).
  enforcePerSourceFloors({
    logPrefix: '[ADVISORIES-T1]',
    infoFile: 'advisories-tier1-info.json',
    // Full issuer list from this tier's sub-fetchers — a zero-row collapse
    // must be caught too, not skipped because nothing was fetched.
    expectedIssuers: [
      'de',
      'nl',
      'jp',
      'sk',
    ],
    // Measured minimums — small issuers must not false-positive daily.
    floors: { sk: 2 },
    indicators: allIndicators,
    advisoryInfo: combinedAdvisoryInfo,
    errors,
    runDate: date,
  });

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories_tier1',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-tier1-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-tier1-info.json'), combinedAdvisoryInfo);

  const totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES-T1] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories_tier1',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}
