// scripts/send-daily-digest.ts — daily mailing-list digest sender
// (quick task 260711-daily-news-and-mailing-list).
//
// USAGE: npx tsx scripts/send-daily-digest.ts [YYYY-MM-DD] [--dry-run]
// ENV:   RESEND_API_KEY (required for a real send)
//        CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_TOKEN (preferred) or CLOUDFLARE_API_TOKEN
//        DIGEST_D1_LOCAL=1 to target the local D1 replica instead of --remote (manual E2E only)
//
// --dry-run: reads only the news file, never touches D1 or Resend (no wrangler/network calls),
// and prints what WOULD be sent with recipient counts stubbed to 0. Always exits 0, including
// when the news file is missing — lets this script be syntax/logic-checked without D1 creds.
//
// EXACT YAML step for .github/workflows/data-pipeline.yml (added by the integration pass, placed
// AFTER the existing "Trigger deploy" step so a digest failure never blocks deploy):
//
//   - name: Send daily digest
//     if: success()
//     continue-on-error: true
//     env:
//       RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
//       CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
//       CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
//       CLOUDFLARE_D1_TOKEN: ${{ secrets.CLOUDFLARE_D1_TOKEN }}
//     run: npx tsx scripts/send-daily-digest.ts ${{ github.event.inputs.date || '' }}
//
// NOTE ON THE NEWS SCHEMA (deviation, see final report): PLAN-mailinglist.md's interface
// contract assumed `data/news/YYYY-MM-DD.json` events would carry pre-rendered per-locale text
// (`countryName`/`headline`/`detail`). The sibling PLAN-news.md (authoritative — it is the news
// track's actual file-by-file plan) instead defines a language-neutral `NewsEvent { type,
// params: {country, other, delta, score, rank, direction, fromBand, toBand, issuer, level} }`
// with ALL text rendered at build/send time. renderEvent() below now tries THREE renderers in
// order: (1) the pre-rendered shape, if a producer ever ships it; (2) src/lib/news.ts's
// renderNewsEvent — the SAME i18n-backed renderer the /news/ page uses, imported directly (works
// cleanly from this tsx/Node context); (3) this script's own minimal TEMPLATES/renderBuiltIn as a
// last-resort fallback if (2) throws for any reason.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { sendBatch, type EmailMessage } from '../functions/lib/email.js';
import { digestSubjectFallback, wrapperHtml, escapeHtml, type Locale } from '../functions/lib/newsletter-copy.js';
import { loadLatestScores, getLocalizedCountryName } from '../src/lib/scores.js';
import { routes } from '../src/i18n/ui.js';
import type { Lang } from '../src/i18n/ui.js';
import { renderNewsEvent } from '../src/lib/news.js';
import { useTranslations } from '../src/i18n/utils.js';
import type { NewsEvent as PipelineNewsEvent } from '../src/pipeline/news/types.js';

const DB_NAME = 'isitsafetotravel-sentiment';
const CHUNK_SIZE = 100; // Resend /emails/batch max per call
const UNCONFIRMED_TTL_DAYS = 30; // legal §4 MUST #4 — delete unconfirmed signups after 30 days
const LOCALE_LIST: Locale[] = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'];

interface NewsEventParams {
  country?: string;
  other?: string;
  delta?: number;
  score?: number;
  prevScore?: number;
  rank?: number;
  direction?: 'up' | 'down' | 'enter' | 'exit';
  fromBand?: string;
  toBand?: string;
  issuer?: string;
  level?: number;
}

interface NewsEvent {
  id?: string;
  date?: string;
  type?: string;
  priority?: number;
  params?: NewsEventParams;
  // Alternate pre-rendered shape (see NOTE above) — supported defensively.
  iso3?: string;
  slug?: string;
  countryName?: Record<string, string>;
  headline?: Record<string, string>;
  detail?: Record<string, string>;
}

interface NewsDayFile {
  date: string;
  generatedAt?: string;
  events: NewsEvent[];
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): { date: string; dryRun: boolean } {
  const dryRun = argv.includes('--dry-run');
  const date = argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || todayUTC();
  return { date, dryRun };
}

function d1Flag(): string {
  return process.env.DIGEST_D1_LOCAL === '1' ? '--local' : '--remote';
}

function d1json(sql: string): any[] {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, d1Flag(), '--json', '--command', sql],
    {
      encoding: 'utf8',
      env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN },
    },
  );
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

function d1run(sql: string): void {
  d1json(sql);
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Built-in fallback renderer — translated templates for the 6 PLAN-news.md event types.
// ---------------------------------------------------------------------------

const BAND_LABEL: Record<string, Record<Locale, string>> = {
  excellent: { en: 'Excellent', it: 'Eccellente', es: 'Excelente', fr: 'Excellent', pt: 'Excelente', zh: '优秀', de: 'Ausgezeichnet' },
  good: { en: 'Good', it: 'Buono', es: 'Bueno', fr: 'Bon', pt: 'Bom', zh: '良好', de: 'Gut' },
  moderate: { en: 'Moderate', it: 'Moderato', es: 'Moderado', fr: 'Modéré', pt: 'Moderado', zh: '中等', de: 'Moderat' },
  high_caution: { en: 'High Caution', it: 'Alta Cautela', es: 'Alta Precaución', fr: 'Prudence Élevée', pt: 'Alta Cautela', zh: '高度谨慎', de: 'Hohe Vorsicht' },
  danger: { en: 'Danger', it: 'Pericolo', es: 'Peligro', fr: 'Danger', pt: 'Perigo', zh: '危险', de: 'Gefahr' },
};

const ISSUER_LABEL: Record<string, Record<Locale, string>> = {
  us: { en: 'U.S. State Department', it: 'Dipartimento di Stato USA', es: 'Departamento de Estado de EE. UU.', fr: "Département d'État américain", pt: 'Departamento de Estado dos EUA', zh: '美国国务院', de: 'US-Außenministerium' },
  uk: { en: 'UK FCDO', it: 'FCDO britannico', es: 'FCDO del Reino Unido', fr: 'FCDO britannique', pt: 'FCDO do Reino Unido', zh: '英国外交部', de: 'Britisches FCDO' },
  ca: { en: 'Government of Canada', it: 'Governo del Canada', es: 'Gobierno de Canadá', fr: 'Gouvernement du Canada', pt: 'Governo do Canadá', zh: '加拿大政府', de: 'Regierung von Kanada' },
  au: { en: 'Australia (DFAT)', it: 'Australia (DFAT)', es: 'Australia (DFAT)', fr: 'Australie (DFAT)', pt: 'Austrália (DFAT)', zh: '澳大利亚(DFAT)', de: 'Australien (DFAT)' },
};

const LEVEL_LABEL: Record<string, Record<Locale, string>> = {
  '3': { en: 'Reconsider Travel', it: 'Riconsiderare il Viaggio', es: 'Reconsiderar el Viaje', fr: 'Reconsidérer le Voyage', pt: 'Reconsiderar a Viagem', zh: '重新考虑旅行', de: 'Reise überdenken' },
  '4': { en: 'Do Not Travel', it: 'Non Viaggiare', es: 'No Viajar', fr: 'Ne Pas Voyager', pt: 'Não Viajar', zh: '不要旅行', de: 'Nicht reisen' },
};

const TEMPLATES: Record<string, Record<Locale, { head: string; detail: string }>> = {
  rank_overtake: {
    en: { head: "{a} overtakes {b} among the world's safest countries", detail: '{a} climbs to #{rank} in the global safety ranking, edging past {b}.' },
    it: { head: '{a} supera {b} tra i Paesi più sicuri al mondo', detail: '{a} sale al #{rank} nella classifica mondiale della sicurezza, superando {b}.' },
    es: { head: '{a} supera a {b} entre los países más seguros del mundo', detail: '{a} sube al puesto #{rank} en la clasificación mundial de seguridad, superando a {b}.' },
    fr: { head: '{a} dépasse {b} parmi les pays les plus sûrs au monde', detail: '{a} grimpe au #{rank} du classement mondial de sécurité, dépassant {b}.' },
    pt: { head: '{a} ultrapassa {b} entre os países mais seguros do mundo', detail: '{a} sobe para #{rank} na classificação global de segurança, ultrapassando {b}.' },
    zh: { head: '{a} 在全球最安全国家排名中超越 {b}', detail: '{a} 升至全球安全排名第 {rank} 位,超过 {b}。' },
    de: { head: '{a} überholt {b} unter den sichersten Ländern der Welt', detail: '{a} steigt auf Platz #{rank} im globalen Sicherheitsranking auf und überholt {b}.' },
  },
  score_jump_up: {
    en: { head: "{country}'s safety score climbs to {score}", detail: '{country} gained {delta} points over the past day, now {score}/10.' },
    it: { head: 'Il punteggio di sicurezza di {country} sale a {score}', detail: '{country} guadagna {delta} punti nell\'ultimo giorno, ora a {score}/10.' },
    es: { head: 'El puntaje de seguridad de {country} sube a {score}', detail: '{country} ganó {delta} puntos en el último día, ahora {score}/10.' },
    fr: { head: 'Le score de sécurité de {country} grimpe à {score}', detail: '{country} a gagné {delta} points au cours de la dernière journée, désormais {score}/10.' },
    pt: { head: 'A pontuação de segurança de {country} sobe para {score}', detail: '{country} ganhou {delta} pontos no último dia, agora {score}/10.' },
    zh: { head: '{country} 的安全评分升至 {score}', detail: '{country} 在过去一天内提升了 {delta} 分,现为 {score}/10。' },
    de: { head: 'Der Sicherheitswert von {country} steigt auf {score}', detail: '{country} hat im letzten Tag {delta} Punkte gewonnen, jetzt {score}/10.' },
  },
  score_jump_down: {
    en: { head: "{country}'s safety score slips to {score}", detail: '{country} lost {delta} points over the past day, now {score}/10.' },
    it: { head: 'Il punteggio di sicurezza di {country} scende a {score}', detail: '{country} perde {delta} punti nell\'ultimo giorno, ora a {score}/10.' },
    es: { head: 'El puntaje de seguridad de {country} baja a {score}', detail: '{country} perdió {delta} puntos en el último día, ahora {score}/10.' },
    fr: { head: 'Le score de sécurité de {country} chute à {score}', detail: '{country} a perdu {delta} points au cours de la dernière journée, désormais {score}/10.' },
    pt: { head: 'A pontuação de segurança de {country} cai para {score}', detail: '{country} perdeu {delta} pontos no último dia, agora {score}/10.' },
    zh: { head: '{country} 的安全评分降至 {score}', detail: '{country} 在过去一天内下降了 {delta} 分,现为 {score}/10。' },
    de: { head: 'Der Sicherheitswert von {country} sinkt auf {score}', detail: '{country} hat im letzten Tag {delta} Punkte verloren, jetzt {score}/10.' },
  },
  band_change_up: {
    en: { head: "{country} upgraded from '{from}' to '{to}'", detail: "{country}'s safety rating improved to {to} ({score}/10), up from {from}." },
    it: { head: "{country} migliora da '{from}' a '{to}'", detail: 'La valutazione di sicurezza di {country} migliora a {to} ({score}/10), da {from}.' },
    es: { head: "{country} mejora de '{from}' a '{to}'", detail: 'La calificación de seguridad de {country} mejoró a {to} ({score}/10), desde {from}.' },
    fr: { head: "{country} passe de '{from}' à '{to}'", detail: "La note de sécurité de {country} s'est améliorée à {to} ({score}/10), contre {from} auparavant." },
    pt: { head: "{country} melhora de '{from}' para '{to}'", detail: 'A classificação de segurança de {country} melhorou para {to} ({score}/10), a partir de {from}.' },
    zh: { head: '{country} 从「{from}」升级为「{to}」', detail: '{country} 的安全评级提升至 {to}({score}/10),此前为 {from}。' },
    de: { head: "{country} von '{from}' zu '{to}' hochgestuft", detail: 'Die Sicherheitsbewertung von {country} verbesserte sich auf {to} ({score}/10), zuvor {from}.' },
  },
  band_change_down: {
    en: { head: "{country} downgraded from '{from}' to '{to}'", detail: "{country}'s safety rating fell to {to} ({score}/10), down from {from}." },
    it: { head: "{country} peggiora da '{from}' a '{to}'", detail: 'La valutazione di sicurezza di {country} scende a {to} ({score}/10), da {from}.' },
    es: { head: "{country} empeora de '{from}' a '{to}'", detail: 'La calificación de seguridad de {country} bajó a {to} ({score}/10), desde {from}.' },
    fr: { head: "{country} rétrograde de '{from}' à '{to}'", detail: "La note de sécurité de {country} est tombée à {to} ({score}/10), contre {from} auparavant." },
    pt: { head: "{country} piora de '{from}' para '{to}'", detail: 'A classificação de segurança de {country} caiu para {to} ({score}/10), a partir de {from}.' },
    zh: { head: '{country} 从「{from}」降级为「{to}」', detail: '{country} 的安全评级降至 {to}({score}/10),此前为 {from}。' },
    de: { head: "{country} von '{from}' zu '{to}' herabgestuft", detail: 'Die Sicherheitsbewertung von {country} fiel auf {to} ({score}/10), zuvor {from}.' },
  },
  top10_enter: {
    en: { head: "{country} enters the world's 10 safest countries", detail: '{country} rises to #{rank} globally, joining the top 10 safest destinations.' },
    it: { head: '{country} entra tra i 10 Paesi più sicuri al mondo', detail: '{country} sale al #{rank} a livello mondiale, entrando nella top 10 delle mete più sicure.' },
    es: { head: '{country} entra en los 10 países más seguros del mundo', detail: '{country} sube al puesto #{rank} a nivel mundial, uniéndose a los 10 destinos más seguros.' },
    fr: { head: '{country} entre dans le top 10 des pays les plus sûrs au monde', detail: '{country} grimpe au #{rank} mondial, rejoignant le top 10 des destinations les plus sûres.' },
    pt: { head: '{country} entra nos 10 países mais seguros do mundo', detail: '{country} sobe para #{rank} globalmente, juntando-se aos 10 destinos mais seguros.' },
    zh: { head: '{country} 进入全球最安全的10个国家', detail: '{country} 升至全球第 {rank} 位,跻身最安全的10个目的地之列。' },
    de: { head: '{country} steigt in die 10 sichersten Länder der Welt auf', detail: '{country} steigt weltweit auf Platz #{rank} und gehört nun zu den 10 sichersten Reisezielen.' },
  },
  top10_exit: {
    en: { head: "{country} drops out of the world's 10 safest countries", detail: '{country} slips to #{rank}, leaving the top 10 safest destinations.' },
    it: { head: '{country} esce dai 10 Paesi più sicuri al mondo', detail: '{country} scende al #{rank}, lasciando la top 10 delle mete più sicure.' },
    es: { head: '{country} sale de los 10 países más seguros del mundo', detail: '{country} baja al puesto #{rank}, dejando los 10 destinos más seguros.' },
    fr: { head: '{country} sort du top 10 des pays les plus sûrs au monde', detail: '{country} recule au #{rank}, quittant le top 10 des destinations les plus sûres.' },
    pt: { head: '{country} sai dos 10 países mais seguros do mundo', detail: '{country} cai para #{rank}, deixando os 10 destinos mais seguros.' },
    zh: { head: '{country} 跌出全球最安全的10个国家', detail: '{country} 降至第 {rank} 位,退出最安全的10个目的地之列。' },
    de: { head: '{country} fällt aus den 10 sichersten Ländern der Welt', detail: '{country} fällt auf Platz #{rank} und verlässt die 10 sichersten Reiseziele.' },
  },
  severe_advisory: {
    en: { head: "{issuer} issues a '{levelLabel}' warning for {country}", detail: '{issuer} raised its advisory for {country} to level {level} — {levelLabel}.' },
    it: { head: "{issuer} emette un avviso '{levelLabel}' per {country}", detail: '{issuer} ha alzato il proprio avviso per {country} al livello {level} — {levelLabel}.' },
    es: { head: "{issuer} emite una advertencia de '{levelLabel}' para {country}", detail: '{issuer} elevó su advertencia para {country} al nivel {level} — {levelLabel}.' },
    fr: { head: "{issuer} émet un avis '{levelLabel}' pour {country}", detail: '{issuer} a relevé son avis pour {country} au niveau {level} — {levelLabel}.' },
    pt: { head: "{issuer} emite um alerta de '{levelLabel}' para {country}", detail: '{issuer} elevou o seu alerta para {country} para o nível {level} — {levelLabel}.' },
    zh: { head: '{issuer} 对 {country} 发布「{levelLabel}」警告', detail: '{issuer} 将对 {country} 的警告提升至 {level} 级 — {levelLabel}。' },
    de: { head: "{issuer} gibt eine Warnung '{levelLabel}' für {country} heraus", detail: '{issuer} hat die Reisewarnung für {country} auf Stufe {level} angehoben — {levelLabel}.' },
  },
  new_country: {
    en: { head: '{country} added to IsItSafeToTravel', detail: '{country} now has a daily safety score, tracked across 40+ global sources.' },
    it: { head: '{country} aggiunto a IsItSafeToTravel', detail: 'Ora {country} ha un punteggio di sicurezza quotidiano, monitorato da oltre 40 fonti globali.' },
    es: { head: '{country} se une a IsItSafeToTravel', detail: '{country} ahora tiene un puntaje de seguridad diario, monitoreado por más de 40 fuentes globales.' },
    fr: { head: '{country} rejoint IsItSafeToTravel', detail: '{country} dispose désormais d\'un score de sécurité quotidien, suivi par plus de 40 sources mondiales.' },
    pt: { head: '{country} adicionado ao IsItSafeToTravel', detail: '{country} agora tem uma pontuação de segurança diária, monitorizada por mais de 40 fontes globais.' },
    zh: { head: '{country} 已加入 IsItSafeToTravel', detail: '{country} 现已拥有每日安全评分,由40多个全球数据源持续追踪。' },
    de: { head: '{country} zu IsItSafeToTravel hinzugefügt', detail: '{country} hat jetzt einen täglichen Sicherheitswert, verfolgt über mehr als 40 globale Quellen.' },
  },
};

function fill(s: string, m: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => m[k] ?? '');
}

function templateKey(e: NewsEvent): string {
  const p = e.params ?? {};
  switch (e.type) {
    case 'score_jump':
      return p.direction === 'down' ? 'score_jump_down' : 'score_jump_up';
    case 'band_change':
      return p.direction === 'down' ? 'band_change_down' : 'band_change_up';
    case 'top10_change':
      return p.direction === 'exit' ? 'top10_exit' : 'top10_enter';
    default:
      return e.type ?? 'new_country';
  }
}

function renderBuiltIn(
  e: NewsEvent,
  lang: Locale,
  nameOf: (iso3: string) => string,
): { head: string; detail: string; iso3: string } {
  const p = e.params ?? {};
  const iso3 = p.country ?? e.iso3 ?? '';
  const name = nameOf(iso3);
  const key = templateKey(e);
  const tpl = TEMPLATES[key]?.[lang] ?? TEMPLATES[key]?.en ?? { head: name, detail: '' };
  const vars: Record<string, string> = {
    country: name,
    a: name,
    b: p.other ? nameOf(p.other) : '',
    other: p.other ? nameOf(p.other) : '',
    score: p.score !== undefined ? String(p.score) : '',
    prevScore: p.prevScore !== undefined ? String(p.prevScore) : '',
    delta: p.delta !== undefined ? Math.abs(p.delta).toFixed(2) : '',
    rank: p.rank !== undefined ? String(p.rank) : '',
    from: p.fromBand ? (BAND_LABEL[p.fromBand]?.[lang] ?? p.fromBand) : '',
    to: p.toBand ? (BAND_LABEL[p.toBand]?.[lang] ?? p.toBand) : '',
    issuer: p.issuer ? (ISSUER_LABEL[p.issuer]?.[lang] ?? p.issuer.toUpperCase()) : '',
    level: p.level !== undefined ? String(p.level) : '',
    levelLabel: p.level !== undefined ? (LEVEL_LABEL[String(p.level)]?.[lang] ?? '') : '',
  };
  return { head: fill(tpl.head, vars), detail: fill(tpl.detail, vars), iso3 };
}

function countrySeg(lang: Locale): string {
  return (routes as Record<Lang, Record<string, string>>)[lang as Lang]?.country ?? 'country';
}

function renderEvent(e: NewsEvent, lang: Locale, nameOf: (iso3: string) => string): { head: string; detail: string; url: string } {
  // Pre-rendered shape, if the news track ships baked-in per-locale text instead of codes.
  if (e.headline && e.countryName) {
    const iso3 = e.iso3 ?? '';
    const slug = e.slug ?? iso3.toLowerCase();
    return {
      head: e.headline[lang] ?? e.headline.en ?? '',
      detail: e.detail?.[lang] ?? e.detail?.en ?? '',
      url: `https://isitsafetotravel.org/${lang}/${countrySeg(lang)}/${slug}/`,
    };
  }
  // Primary renderer: src/lib/news.ts's renderNewsEvent, the SAME i18n-backed function the
  // /news/ page uses — single source of truth for headline/detail copy (no drift vs. the site).
  // Verified importable cleanly from this tsx/Node context (news.ts's only runtime deps are
  // ./scores.js + node:fs, already used elsewhere in this script). Falls back to this script's
  // own minimal TEMPLATES renderer below if it throws for any reason.
  try {
    const t = useTranslations(lang as Lang);
    const rendered = renderNewsEvent(e as unknown as PipelineNewsEvent, lang as Lang, t, nameOf);
    const iso3 = e.params?.country ?? e.iso3 ?? '';
    return { head: rendered.headline, detail: rendered.detail, url: `https://isitsafetotravel.org/${lang}/${countrySeg(lang)}/${iso3.toLowerCase()}/` };
  } catch (err) {
    console.warn(`[digest] renderNewsEvent failed for event ${e.id ?? '?'} (falling back to built-in templates): ${err instanceof Error ? err.message : String(err)}`);
  }
  const r = renderBuiltIn(e, lang, nameOf);
  return { head: r.head, detail: r.detail, url: `https://isitsafetotravel.org/${lang}/${countrySeg(lang)}/${r.iso3.toLowerCase()}/` };
}

function fallbackDigestHtml(events: NewsEvent[], lang: Locale, unsubUrl: string, nameOf: (iso3: string) => string): string {
  const rows = events
    .map((e) => {
      const { head, detail, url } = renderEvent(e, lang, nameOf);
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
        <a href="${url}" style="color:#c96b4f;font-weight:600;text-decoration:none">${escapeHtml(head)}</a><br>
        <span style="color:#555">${escapeHtml(detail)}</span></td></tr>`;
    })
    .join('');
  return wrapperHtml(lang, rows, unsubUrl);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { date, dryRun } = parseArgs(process.argv.slice(2));
  console.log(`[digest] date=${date} dryRun=${dryRun}`);

  // Cleanup: auto-delete unconfirmed subscribers older than 30 days (legal §4 MUST #4).
  // Runs every invocation regardless of whether today has events; skipped entirely in --dry-run
  // (dry-run must never touch D1).
  if (!dryRun) {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - UNCONFIRMED_TTL_DAYS * 86400;
      d1run(`DELETE FROM subscribers WHERE status='pending' AND created_at < ${cutoff}`);
      console.log('[digest] cleanup: purged pending subscribers older than 30 days');
    } catch (err) {
      console.warn(`[digest] cleanup failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const newsPath = `data/news/${date}.json`;
  if (!existsSync(newsPath)) {
    console.log(`[digest] ${newsPath} not found — no events, skipping`);
    process.exit(0);
    return;
  }

  let dayFile: NewsDayFile;
  try {
    dayFile = JSON.parse(readFileSync(newsPath, 'utf8'));
  } catch (err) {
    console.warn(`[digest] failed to parse ${newsPath}: ${err instanceof Error ? err.message : String(err)} — skipping`);
    process.exit(0);
    return;
  }

  const events = dayFile.events ?? [];
  if (events.length === 0) {
    console.log(`[digest] ${date}: 0 events — skipping`);
    process.exit(0);
    return;
  }

  if (dryRun) {
    console.log(`[digest] DRY RUN — ${events.length} event(s) for ${date}, no D1/Resend calls made`);
    for (const lang of LOCALE_LIST) {
      console.log(`[digest]   locale=${lang} recipients=0 subject="${digestSubjectFallback(lang, events.length)}"`);
    }
    process.exit(0);
    return;
  }

  // Idempotency: a rerun for a date already logged is a no-op.
  const already = d1json(`SELECT 1 AS x FROM digest_log WHERE send_date='${esc(date)}'`);
  if (already.length > 0) {
    console.log(`[digest] ${date}: already sent — no-op`);
    process.exit(0);
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[digest] RESEND_API_KEY not set — skipping send (no key)');
    process.exit(0);
    return;
  }

  const subscribers = d1json(`SELECT email, locale, unsub_token FROM subscribers WHERE status='confirmed'`);
  if (subscribers.length === 0) {
    d1run(
      `INSERT OR REPLACE INTO digest_log (send_date, sent_at, recipients, events) VALUES ('${esc(date)}', ${Math.floor(Date.now() / 1000)}, 0, ${events.length})`,
    );
    console.log(`[digest] ${date}: 0 confirmed subscribers — logged, nothing sent`);
    process.exit(0);
    return;
  }

  // Country-name resolution for the built-in fallback renderer.
  const scored = loadLatestScores();
  const byIso3 = new Map(scored.map((c) => [c.iso3, c]));
  const nameOf = (lang: Lang) => (iso3: string) => {
    const c = byIso3.get(iso3);
    return c ? getLocalizedCountryName(c, lang) : iso3;
  };

  const byLocale = new Map<string, Array<{ email: string; unsub_token: string }>>();
  for (const s of subscribers) {
    const loc = (s.locale as string) || 'en';
    if (!byLocale.has(loc)) byLocale.set(loc, []);
    byLocale.get(loc)!.push({ email: s.email, unsub_token: s.unsub_token });
  }

  let totalSent = 0;
  for (const [locale, recipients] of byLocale) {
    const lang = (LOCALE_LIST.includes(locale as Locale) ? locale : 'en') as Locale;
    const subject = digestSubjectFallback(lang, events.length);
    const messages: EmailMessage[] = recipients.map((r) => {
      const unsubUrl = `https://isitsafetotravel.org/api/unsubscribe?token=${r.unsub_token}`;
      return {
        to: r.email,
        subject,
        html: fallbackDigestHtml(events, lang, unsubUrl, nameOf(lang as Lang)),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      };
    });
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      try {
        totalSent += await sendBatch(apiKey, chunk);
      } catch (err) {
        console.warn(`[digest] chunk send failed for locale=${locale} (continuing): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  try {
    d1run(
      `INSERT OR REPLACE INTO digest_log (send_date, sent_at, recipients, events) VALUES ('${esc(date)}', ${Math.floor(Date.now() / 1000)}, ${totalSent}, ${events.length})`,
    );
  } catch (err) {
    console.warn(`[digest] failed to write digest_log (idempotency at risk on rerun): ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`digest ${date}: ${totalSent} sent across ${byLocale.size} locales, ${events.length} events`);
}

main().catch((err) => {
  console.error(`[digest] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
  process.exit(1);
});
