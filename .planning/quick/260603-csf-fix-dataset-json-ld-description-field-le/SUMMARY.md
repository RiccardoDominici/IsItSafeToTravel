---
quick_id: "260603-csf"
slug: fix-dataset-json-ld-description-field-le
title: Fix Dataset JSON-LD description field length (GSC alert)
completed: 2026-06-03
status: complete
---

# Quick Task 260603-csf — Summary

## What changed

- `src/lib/seo.ts:161` — `datasetDescriptions.zh` extended from
  `${n} 每日更新的安全评分，涵盖冲突、犯罪、健康、治理和环境。` (30 chars
  for "日本") to
  `${n} 每日更新的安全评分，基于 40 多个公开来源，涵盖武装冲突、犯罪、健康、治理和自然灾害五大风险类别。`
  (53 chars for "日本", 58 for the longest country name tested).
- `scripts/validate-seo.ts` — added `validateDatasetDescriptionLength()`
  which walks the rendered JSON-LD `@graph` on
  `dist/client/{lang}/.../jpn/index.html` for every locale and asserts
  the `Dataset.description` length is in the Google-required `[50, 5000]`
  range. Wired into `main()` after the advisory checks. Total checks
  went from 2199 → 2213 (7 locales × 2 = +14).

## Why

Google Search Console alert (Message type `WNC-10030322`, 2026-06-03):

> Dati strutturati Set di dati — Lunghezza stringa non valida nel campo
> "description"

Per [Google's Dataset rich-result spec](https://developers.google.com/search/docs/appearance/structured-data/dataset),
`description` must be between 50 and 5000 characters. The `zh` locale
template emitted by `buildCountryJsonLd` rendered only ~30 chars for
short country names like "日本" (Japan). 248 `/zh/country/*` pages were
affected; the homepage and methodology Datasets were already above the
floor.

## Verification

```bash
npx astro build && npm run validate:seo
# Result: 2213/2213 checks passed (was 2199).
```

Per-locale rendered Dataset.description for JPN:

| Lang | Chars |
|---:|---:|
| en | 101 |
| it | 126 |
| es | 134 |
| fr | 130 |
| pt | 133 |
| zh | **53** (was 30) |
| de | 134 |

## Regression guard

The new `validateDatasetDescriptionLength()` step makes any future
locale-template regression a build-time failure — the deploy workflow
cannot ship a Dataset description that falls outside `[50, 5000]`.

## Follow-up

After the deploy lands, click "Risolvi" in Google Search Console (or
wait for re-crawl) to clear the `WNC-10030322` alert.
