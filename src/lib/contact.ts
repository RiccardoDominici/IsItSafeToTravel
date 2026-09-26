// Single source of truth for the owner's public contact email.
//
// Consumed by: the 7 About pages (discreet mailto line in the Contact
// section, owner decision 2026-09-26 — shown small/discreet, About page
// only, not in the footer or header) and buildPersonJsonLd in ./seo.ts
// (Person.email).
//
// NOT consumed from here, but carrying the SAME address as a literal string
// and needing to stay in sync by hand whenever this changes:
//   - src/i18n/ui.ts            `legal.imprint_email` (7 locales)
//   - functions/lib/newsletter-copy.ts (subscribe-confirmation and
//     digest-email footers, 14 occurrences across 7 locales x 2 templates)
//   - public/.well-known/security.txt  (RFC 9116 security contact — a static
//     public file, not TS, so it can't import this constant)
// These can't import a TS module (security.txt is a static asset; ui.ts and
// newsletter-copy.ts predate this file and duplicate the address inline per
// locale/template), so a future address change means grepping for the old
// address across all of them, not just editing this one constant.
export const CONTACT_EMAIL = 'riccardo.dominici19999@gmail.com';
