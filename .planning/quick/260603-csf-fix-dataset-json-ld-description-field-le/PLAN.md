---
quick_id: "260603-csf"
slug: fix-dataset-json-ld-description-field-le
title: Fix Dataset JSON-LD description field length (GSC alert)
created: 2026-06-03
status: in-progress
---

# Quick Task 260603-csf — Fix Dataset JSON-LD description length

## Problem

Google Search Console e-mail (Message type `WNC-10030322`, 2026-06-03):

> Dati strutturati Set di dati problemi rilevati in isitsafetotravel.org
> Principali problemi critici: Lunghezza stringa non valida nel campo "description"

Google's [Dataset structured data spec](https://developers.google.com/search/docs/appearance/structured-data/dataset) requires `description` between **50 and 5000 characters**.

## Root cause

`src/lib/seo.ts:155-163` `datasetDescriptions` table — the **zh** locale's
description is only ~30 characters when the country name is short (e.g.
"日本"):

```
zh: (n) => `${n} 每日更新的安全评分，涵盖冲突、犯罪、健康、治理和环境。`
```

Measured for all 7 locales with Japan as the test country:

| Lang | Length | OK (>=50) |
|---:|---:|:---:|
| en | 101 | ✓ |
| it | 125 | ✓ |
| es | 134 | ✓ |
| fr | 125 | ✓ |
| pt | 128 | ✓ |
| **zh** | **30** | **✗** |
| de | 130 | ✓ |

This is emitted by every `/zh/country/{iso3}/` page (248 pages affected).
The homepage and methodology Datasets (lines 576, 607) are already well
above the floor — they are not implicated.

## Fix

Rewrite `zh` `datasetDescriptions[lang]` so the output is unconditionally
>= 50 chars regardless of country name. Target ~70–90 chars to leave
buffer. Mirror the breadth of the other locales (40+ sources, 5 pillars,
plus updateFrequency hint).

Proposed replacement:
```
zh: (n) => `${n} 每日更新的安全评分，基于 40 多个公开来源，涵盖武装冲突、犯罪、健康、治理和自然灾害五大风险类别。`
```

Adds: "based on 40+ public sources" + "armed conflict" + "natural
disasters" + the explicit "five risk categories" phrasing, parallel to
en/it/es/fr/pt/de.

## Tasks

1. Edit `src/lib/seo.ts:161` — replace zh `datasetDescriptions` with the
   extended version above.
2. Add a build-time guard in `scripts/validate-seo.ts` so a future
   regression fails the build:
   - Assert that the rendered `Dataset.description` in every
     `dist/client/{lang}/.../jpn/index.html` is between 50 and 5000
     characters.
3. Run `npx astro build && npm run validate:seo`. Confirm checks pass.
4. Verify the built HTML: every locale's Dataset description >= 50.

## Verification gates

- `validate:seo` keeps passing.
- `grep` on `dist/client/zh/country/jpn/index.html` shows
  `Dataset.description` length >= 50.
- No regression in other locales.
- Eventually, GSC re-validates the URL after deploy (manual / via
  "Risolvi" button in GSC).
