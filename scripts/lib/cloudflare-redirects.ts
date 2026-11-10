/**
 * Offline mirror of how Cloudflare Pages parses `_redirects`, so a rule that
 * production would silently ignore fails `npm test` / `validate:seo` instead.
 *
 * Why this exists: on 2026-09-25 a `/country/*` splat rule was inserted in the
 * middle of `public/_redirects`. Cloudflare counts every rule that follows the
 * first splat/placeholder rule as "dynamic" (to preserve first-match order),
 * caps dynamic rules at 100 and then DROPS THE REST OF THE FILE without any
 * error in `wrangler pages deploy`. The last 28 rules (pt/de legacy slugs and
 * the per-locale /xx/country/… hardening) were dead in production for six weeks
 * and those URLs served 404 to Googlebot (GSC "Not found (404)", 2026-11-10).
 *
 * Semantics copied from workers-sdk `packages/workers-shared/utils/configuration/
 * parseRedirects.ts` + `constants.ts` (wrangler 4.75, verified line by line in
 * node_modules/wrangler/wrangler-dist/cli.js). Only the parts that decide whether
 * a line is applied are mirrored — not the URL normalisation.
 */

/** Cloudflare limits (workers-shared constants.ts). */
export const MAX_STATIC_REDIRECT_RULES = 2000;
export const MAX_DYNAMIC_REDIRECT_RULES = 100;
export const MAX_LINE_LENGTH = 2000;
export const PERMITTED_STATUS_CODES = new Set([200, 301, 302, 303, 307, 308]);

const SPLAT_RE = /\*/;
const PLACEHOLDER_RE = /:[A-Za-z]\w*/;

export interface RedirectRule {
  lineNumber: number;
  from: string;
  to: string;
  status: number;
  /** true when Cloudflare files it under the 100-rule dynamic budget. */
  dynamic: boolean;
  /** true when the source itself has a splat/placeholder (a "real" dynamic rule). */
  hasPattern: boolean;
}

export type RedirectIssueKind =
  | 'invalid-line' // wrong token count, absolute source, bad status, too long
  | 'static-after-dynamic' // plain rule below a splat rule → eats the dynamic budget
  | 'dropped' // beyond a Cloudflare limit → never applied
  | 'duplicate-source'; // top-most wins, later ones are dead

export interface RedirectIssue {
  kind: RedirectIssueKind;
  lineNumber: number;
  line: string;
  message: string;
}

export interface RedirectsAnalysis {
  /** Rules Cloudflare will actually apply, in file order. */
  rules: RedirectRule[];
  issues: RedirectIssue[];
  staticCount: number;
  dynamicCount: number;
}

/**
 * Parse `_redirects` text the way Cloudflare does and report every line that
 * would be ignored or that silently consumes the dynamic-rule budget.
 */
export function analyzeRedirects(text: string): RedirectsAnalysis {
  const lines = text.split('\n');
  const rules: RedirectRule[] = [];
  const issues: RedirectIssue[] = [];
  const seenSources = new Map<string, number>();
  let staticCount = 0;
  let dynamicCount = 0;
  let canCreateStaticRule = true;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = (lines[i] ?? '').trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const invalid = (message: string) => issues.push({ kind: 'invalid-line', lineNumber, line, message });

    if (line.length > MAX_LINE_LENGTH) {
      invalid(`longer than ${MAX_LINE_LENGTH} characters`);
      continue;
    }
    const tokens = line.replace(/\s+#.*$/, '').split(/\s+/);
    if (tokens.length < 2 || tokens.length > 3) {
      invalid(`expected 2 or 3 whitespace-separated tokens, got ${tokens.length}`);
      continue;
    }
    const [from, to, statusToken = '302'] = tokens;
    // Cloudflare: "Only relative URLs are allowed" for the source.
    if (!from.startsWith('/')) {
      invalid('source must be a relative path — Pages ignores absolute/host-based sources');
      continue;
    }

    const hasPattern = SPLAT_RE.test(from) || PLACEHOLDER_RE.test(from);
    let dynamic: boolean;
    if (canCreateStaticRule && !hasPattern) {
      staticCount++;
      dynamic = false;
      if (staticCount > MAX_STATIC_REDIRECT_RULES) {
        issues.push({ kind: 'dropped', lineNumber, line, message: `beyond the ${MAX_STATIC_REDIRECT_RULES}-static-rule limit` });
        continue;
      }
    } else {
      dynamicCount++;
      dynamic = true;
      canCreateStaticRule = false;
      if (dynamicCount > MAX_DYNAMIC_REDIRECT_RULES) {
        // Cloudflare `break`s here: every remaining line of the file is lost.
        for (let j = i; j < lines.length; j++) {
          const rest = (lines[j] ?? '').trim();
          if (rest.length === 0 || rest.startsWith('#')) continue;
          issues.push({
            kind: 'dropped',
            lineNumber: j + 1,
            line: rest,
            message: `beyond the ${MAX_DYNAMIC_REDIRECT_RULES}-dynamic-rule limit — Cloudflare skips the rest of the file`,
          });
        }
        break;
      }
      if (!hasPattern) {
        issues.push({
          kind: 'static-after-dynamic',
          lineNumber,
          line,
          message: 'plain rule below a splat/placeholder rule: Cloudflare counts it as dynamic (move it above the dynamic section)',
        });
      }
    }

    const status = Number(statusToken);
    if (Number.isNaN(status) || !PERMITTED_STATUS_CODES.has(status)) {
      invalid(`status must be one of ${[...PERMITTED_STATUS_CODES].join(', ')}, got ${statusToken}`);
      continue;
    }

    const firstSeen = seenSources.get(from);
    if (firstSeen !== undefined) {
      issues.push({ kind: 'duplicate-source', lineNumber, line, message: `same source as line ${firstSeen}; only the top-most rule applies` });
      continue;
    }
    seenSources.set(from, lineNumber);
    rules.push({ lineNumber, from, to, status, dynamic, hasPattern });
  }

  return { rules, issues, staticCount, dynamicCount };
}

/** One-line human summary of an issue, for test/validator output. */
export function formatRedirectIssue(issue: RedirectIssue): string {
  return `line ${issue.lineNumber} [${issue.kind}] ${issue.message}: ${issue.line}`;
}
