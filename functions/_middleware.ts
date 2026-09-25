/// <reference types="@cloudflare/workers-types" />
// Cloudflare Pages Middleware: host aliasing + URL canonicalization.
// Prevents duplicate-content indexing from stray domains/hosts and from
// mixed-case locale URLs that would otherwise 404 instead of resolving to
// the one real (lowercase) page.

const CANONICAL_HOST = 'isitsafetotravel.org';

// Every one of these currently resolves to this same Cloudflare Pages
// project (verified live in the 2026-09-25 audit: www.isitsafetotravels.com
// serves the full site with a 200 and only a <link rel="canonical"> hint;
// the apex isitsafetotravels.com and www.isitsafetotravel.org already
// 301 correctly through other config, but are listed here too so the
// redirect is enforced in one place instead of depending on Cloudflare
// dashboard rules that live outside this repo).
const ALIAS_HOSTS = new Set([
  'www.isitsafetotravels.com',
  'isitsafetotravels.com',
  'www.isitsafetotravel.org',
]);

// Route slugs live in src/i18n/ui.ts `routes`; every published locale
// prefixes its whole page tree with one of these two-letter codes.
const LOCALE_PREFIX_RE = /^\/(en|it|es|fr|pt|zh|de)\//;

// Static assets (JS/CSS/images/JSON/etc.) and the Astro build output can
// legitimately contain content-addressed or mixed-case filenames — only
// normalize extension-less pretty-URLs, i.e. actual pages.
function hasFileExtension(pathname: string): boolean {
  return /\.[^./]+$/.test(pathname);
}

function needsLowercasing(pathname: string): boolean {
  if (pathname.startsWith('/_astro/')) return false;
  if (hasFileExtension(pathname)) return false;
  if (!LOCALE_PREFIX_RE.test(pathname)) return false;
  return pathname !== pathname.toLowerCase();
}

// Pure and directly unit-testable: given the incoming URL, returns the URL
// to 301 to, or null if the request should just pass through. Kept separate
// from `onRequest` so tests don't need to fabricate a full Cloudflare
// `EventContext` to exercise the redirect rules.
export function computeRedirectUrl(url: URL): URL | null {
  const next = new URL(url.toString());
  let changed = false;

  if (next.hostname.endsWith('.pages.dev') || ALIAS_HOSTS.has(next.hostname)) {
    next.hostname = CANONICAL_HOST;
    next.protocol = 'https:';
    changed = true;
  }

  // Checked on the (possibly already-rewritten) pathname so a request to an
  // alias host with an uppercase path only needs a single redirect hop.
  if (needsLowercasing(next.pathname)) {
    next.pathname = next.pathname.toLowerCase();
    changed = true;
  }

  return changed ? next : null;
}

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const redirectUrl = computeRedirectUrl(url);

  if (redirectUrl) {
    return new Response(null, {
      status: 301,
      headers: { Location: redirectUrl.toString() },
    });
  }

  return context.next();
};
